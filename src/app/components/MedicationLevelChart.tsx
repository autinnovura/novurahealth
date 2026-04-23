'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts'
import { format } from 'date-fns'
import ChartTooltip from './ui/ChartTooltip'
import { Info, Clock, Syringe, Activity } from 'lucide-react'
import { findMedicationByLabel } from '../lib/medications'

/*
 * PHARMACOKINETIC MODEL
 *
 * One-compartment with first-order absorption and elimination (Bateman equation):
 *   C(t) = (dose * ka / (ka - ke)) * (e^(-ke*t) - e^(-ka*t))
 *
 * Where:
 *   ka = ln(2) / (tmax / 3)   — absorption rate constant
 *   ke = ln(2) / half_life    — elimination rate constant
 *
 * Multi-dose steady-state is handled by superposition: sum contributions
 * from all past doses within 5 half-lives.
 *
 * Y-axis represents relative accumulated dose in the system (mg equivalent),
 * NOT actual plasma concentration (which would be ng/mL and require volume
 * of distribution data we don't have for a consumer app).
 *
 * Sources: FDA prescribing labels; Clin Pharmacokinet 2017;56(11):1391-1401;
 * CPT Pharmacometrics Syst Pharmacol 2024;13:e13099
 */

interface MedicationLog {
  logged_at: string
  dose?: string
  medication?: string
}

interface Props {
  medication: string
  dose?: string
  injectionLogs?: MedicationLog[]
}

export default function MedicationLevelChart({ medication, dose, injectionLogs }: Props) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | '90days'>('week')
  const [showInfoSheet, setShowInfoSheet] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const med = findMedicationByLabel(medication)

  const halfLifeHours = med?.half_life_hours ?? 165
  const tmaxHours = med?.absorption_tmax_hours ?? 72
  const dosingIntervalHours = med?.frequency === 'daily' ? 24 : 168
  const displayName = med
    ? `${med.generic_name} (${med.brand_names[0]})`
    : medication
  const source = med?.fda_approved
    ? `FDA ${med.brand_names[0]} label`
    : med?.notes ?? 'Estimated'
  const mechanism = med?.mechanism ?? 'GLP-1'

  const ke = Math.LN2 / halfLifeHours
  const ka = Math.LN2 / (tmaxHours / 3)

  const defaultDoseMg = med
    ? parseFloat(med.available_doses[0].replace('mg', '')) || 0.25
    : 0.25
  const currentDoseMg = dose
    ? parseFloat(dose.replace(/[^0-9.]/g, '')) || defaultDoseMg
    : defaultDoseMg

  // Bateman equation for single-dose concentration
  function singleDoseConcentration(t: number, doseMg: number): number {
    if (t < 0) return 0
    if (Math.abs(ka - ke) < 0.001) return 0
    const C = (doseMg * ka / (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t))
    return Math.max(0, C)
  }

  const injectionTimes = useMemo(() => {
    const rangeHours = timeRange === 'week' ? 168 : timeRange === 'month' ? 720 : 2160
    const startTime = now - rangeHours * 3600 * 1000
    // Include doses up to 5 half-lives before the start of the window
    const cutoff = startTime - halfLifeHours * 5 * 3600 * 1000

    if (injectionLogs && injectionLogs.length > 0) {
      return injectionLogs
        .map(log => ({
          time: new Date(log.logged_at).getTime(),
          dose: log.dose ? parseFloat(log.dose.replace(/[^0-9.]/g, '')) || currentDoseMg : currentDoseMg,
        }))
        .filter(inj => inj.time >= cutoff)
        .sort((a, b) => a.time - b.time)
    }

    return []
  }, [injectionLogs, timeRange, currentDoseMg, halfLifeHours, now])

  const pastHours = timeRange === 'week' ? 168 : timeRange === 'month' ? 720 : 2160
  const futureHours = 168
  const totalHours = pastHours + futureHours

  const chartData = useMemo(() => {
    const startTime = now - pastHours * 3600 * 1000
    const points: { time: number; level: number; date: Date; isFuture: boolean; dateLabel: string; percentOfPeak: number; status: string; isInjectionDay: boolean; dose: string }[] = []
    const step = totalHours / 200

    // First pass: compute levels
    const rawPoints: { time: number; level: number; date: Date; isFuture: boolean; dateLabel: string; pointTime: number }[] = []
    for (let h = 0; h <= totalHours; h += step) {
      const pointTime = startTime + h * 3600 * 1000
      let totalConcentration = 0
      for (const inj of injectionTimes) {
        const hoursSinceInjection = (pointTime - inj.time) / (3600 * 1000)
        totalConcentration += singleDoseConcentration(hoursSinceInjection, inj.dose)
      }
      const d = new Date(pointTime)
      rawPoints.push({
        time: h,
        level: Math.round(totalConcentration * 1000) / 1000,
        date: d,
        isFuture: h > pastHours,
        dateLabel: `${d.getMonth() + 1}/${d.getDate()}`,
        pointTime,
      })
    }

    const peakLevel = Math.max(...rawPoints.map(p => p.level), 0.01)

    // Second pass: enrich with tooltip fields
    for (let i = 0; i < rawPoints.length; i++) {
      const p = rawPoints[i]
      const prev = i > 0 ? rawPoints[i - 1] : null
      const percentOfPeak = Math.round((p.level / peakLevel) * 100)

      let status = 'Stable'
      if (prev) {
        const delta = p.level - prev.level
        const threshold = peakLevel * 0.005
        if (delta > threshold) status = 'Rising'
        else if (delta < -threshold) status = 'Declining'
        else if (percentOfPeak >= 95) status = 'Peak'
        else status = 'Trough'
      }

      // Check if this point falls on an injection day
      const dayStart = new Date(p.date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      const matchedInj = injectionTimes.find(inj => inj.time >= dayStart.getTime() && inj.time < dayEnd.getTime())

      points.push({
        time: p.time,
        level: p.level,
        date: p.date,
        isFuture: p.isFuture,
        dateLabel: p.dateLabel,
        percentOfPeak,
        status,
        isInjectionDay: !!matchedInj,
        dose: matchedInj ? `${matchedInj.dose}mg` : `${currentDoseMg}mg`,
      })
    }
    return points
  }, [injectionTimes, pastHours, totalHours, ke, ka, now, currentDoseMg])

  const maxLevel = Math.max(...chartData.map(p => p.level), 0.01)

  const nowIdx = chartData.findIndex(p => p.isFuture)
  const currentLevel = nowIdx > 0 ? chartData[nowIdx - 1].level : chartData[chartData.length - 1]?.level || 0

  // Steady-state trough estimate: ~50-60% of peak for weekly, higher for daily
  const steadyStateTroughPct = dosingIntervalHours >= 168
    ? Math.round((1 - Math.pow(0.5, dosingIntervalHours / halfLifeHours)) * 100)
    : Math.round((1 - Math.pow(0.5, dosingIntervalHours / halfLifeHours)) * 100)

  // Next shot countdown
  const lastInjTime = injectionTimes.length > 0 ? injectionTimes[injectionTimes.length - 1].time : null
  const nextShotTime = lastInjTime ? lastInjTime + dosingIntervalHours * 3600 * 1000 : null
  const nextShotMs = nextShotTime ? nextShotTime - now : null
  const nextShotDays = nextShotMs !== null ? Math.floor(nextShotMs / 86400000) : null
  const nextShotHours = nextShotMs !== null ? Math.floor((nextShotMs % 86400000) / 3600000) : null

  // Build split data for solid vs dashed line
  const pastData = chartData.filter(p => !p.isFuture).map(p => ({ ...p, pastLevel: p.level, futureLevel: undefined as number | undefined }))
  const futureData = chartData.filter(p => p.isFuture).map(p => ({ ...p, pastLevel: undefined as number | undefined, futureLevel: p.level }))

  // Bridge: last past point also in future series for continuity
  const bridgePoint = pastData.length > 0 ? { ...pastData[pastData.length - 1], futureLevel: pastData[pastData.length - 1].pastLevel } : null
  const mergedData = [
    ...pastData,
    ...(bridgePoint ? [{ ...bridgePoint, pastLevel: bridgePoint.pastLevel, futureLevel: bridgePoint.futureLevel }] : []),
    ...futureData,
  ]

  const deduped = mergedData.filter((p, i, arr) => i === 0 || p.time !== arr[i - 1].time)

  const xTickInterval = timeRange === 'week' ? Math.floor(deduped.length / 8) : timeRange === 'month' ? Math.floor(deduped.length / 6) : Math.floor(deduped.length / 7)

  const nowTime = pastHours

  const nextShotCountdown = (() => {
    if (nextShotMs === null || dosingIntervalHours < 168) return null
    if (nextShotMs <= 0) return 'Overdue'
    if (nextShotDays === 0) return `${nextShotHours}h`
    return `${nextShotDays}d ${nextShotHours}h`
  })()

  const ranges = [
    { id: 'week' as const, label: 'Week' },
    { id: 'month' as const, label: 'Month' },
    { id: '90days' as const, label: '90 Days' },
  ]

  return (
    <div className="rounded-3xl bg-gradient-to-br from-white via-[#F5F8F3]/30 to-white border border-[#EAF2EB] shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] overflow-hidden">
      <style>{`
        @keyframes syringePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>
              Estimated Medication Levels
            </h3>
            <p className="text-xs text-[#6B7A72] mt-0.5">{displayName}</p>
          </div>
          <div className="text-right flex items-start gap-1.5">
            <button
              onClick={() => setShowInfoSheet(!showInfoSheet)}
              className="mt-1 p-1 rounded-full hover:bg-[#EAF2EB] transition-colors cursor-pointer"
              aria-label="Info about estimated levels"
            >
              <Info className="w-3.5 h-3.5 text-[#6B7A72]" />
            </button>
            <div>
              <p className="text-[10px] text-[#6B7A72] uppercase font-semibold tracking-wider">Est. Level</p>
              <p className="text-xl font-bold tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <span className="text-[#7FFFA4]" style={{ textShadow: '0 0 12px rgba(127,255,164,0.3)' }}>{currentLevel.toFixed(2)}</span>
                <span className="text-xs font-normal text-[#6B7A72] ml-0.5">mg</span>
              </p>
            </div>
          </div>
        </div>

        {/* Info sheet — expanded educational content */}
        <AnimatePresence>
          {showInfoSheet && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-4 rounded-2xl bg-[#F5F8F3] border border-[#EAF2EB] text-xs text-[#6B7A72] leading-relaxed space-y-3">
                <div>
                  <p className="font-semibold text-[#0D1F16] text-[11px] mb-1">How this works</p>
                  <p>
                    This chart models your medication accumulation using standard pharmacokinetic
                    principles — absorption, peak concentration, and elimination half-life.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[#0D1F16] text-[11px] mb-1">Key concepts</p>
                  <ul className="space-y-1.5 ml-3">
                    <li className="relative before:content-['·'] before:absolute before:-left-2.5 before:text-[#1F4B32]">
                      <strong>Half-life</strong> means 50% reduction, not elimination. After one half-life, 50% remains; after two, 25%; after five, it&apos;s effectively cleared.
                    </li>
                    <li className="relative before:content-['·'] before:absolute before:-left-2.5 before:text-[#1F4B32]">
                      With {dosingIntervalHours >= 168 ? 'weekly' : 'daily'} dosing, your medication accumulates to &quot;steady state&quot; over {dosingIntervalHours >= 168 ? '4–5 weeks' : '3–5 days'} — your level never drops below ~{steadyStateTroughPct}% of peak once stable.
                    </li>
                    <li className="relative before:content-['·'] before:absolute before:-left-2.5 before:text-[#1F4B32]">
                      The <strong>solid line</strong> is your actual projected level. The <strong>dashed line</strong> shows what would happen if you skipped your next dose.
                    </li>
                  </ul>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="font-semibold text-[#0D1F16] text-[11px] mb-1">{displayName} specifics</p>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <span className="text-[#6B7A72]">Half-life</span>
                      <p className="font-semibold text-[#0D1F16]">{Math.round(halfLifeHours)}h / {Math.round(halfLifeHours / 24)}d</p>
                    </div>
                    <div>
                      <span className="text-[#6B7A72]">Time to peak</span>
                      <p className="font-semibold text-[#0D1F16]">{tmaxHours}h</p>
                    </div>
                    <div>
                      <span className="text-[#6B7A72]">Mechanism</span>
                      <p className="font-semibold text-[#0D1F16]">{mechanism}</p>
                    </div>
                  </div>
                </div>
                <p className="text-[9px] text-[#6B7A72]/70 italic">
                  This is an educational model, not medical advice. Always consult your provider for clinical decisions.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Time range segmented control */}
        <div className="mt-4 relative bg-[#F5F8F3] rounded-xl p-1 flex">
          {ranges.map(r => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id)}
              className={`relative flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 z-10 cursor-pointer ${
                timeRange === r.id ? 'text-[#1F4B32]' : 'text-[#6B7A72]/60 hover:text-[#6B7A72]'
              }`}
            >
              {timeRange === r.id && (
                <motion.div
                  layoutId="timeRangeIndicator"
                  className="absolute inset-0 bg-white rounded-lg shadow-sm"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className="relative z-10">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-3 pb-2 h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={deduped} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
            <defs>
              <linearGradient id="medLevelGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7FFFA4" stopOpacity={0.2} />
                <stop offset="80%" stopColor="#7FFFA4" stopOpacity={0.02} />
                <stop offset="100%" stopColor="#7FFFA4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              horizontal={true}
              vertical={false}
              strokeDasharray=""
              stroke="#EAF2EB"
              strokeOpacity={0.8}
            />
            <XAxis
              dataKey="dateLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6B7A72' }}
              interval={xTickInterval > 0 ? xTickInterval : 1}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#6B7A72' }}
              domain={[0, (max: number) => Math.ceil(max * 1.1 * 100) / 100]}
              tickCount={4}
              width={35}
            />
            <ReferenceLine
              x={deduped.find(p => p.time >= nowTime)?.dateLabel}
              stroke="#7FFFA4"
              strokeWidth={2}
              strokeDasharray=""
              label={{
                value: 'Now',
                position: 'top',
                fill: '#1F4B32',
                fontSize: 10,
                fontWeight: 600,
              }}
            />
            <Tooltip
              content={
                <ChartTooltip>
                  {(data) => (
                    <>
                      <div className="text-xs text-[#6B7A72] uppercase tracking-wider font-semibold mb-1">
                        {data.date instanceof Date ? format(data.date, 'MMM d') : ''}
                      </div>
                      <div className="text-2xl font-bold tabular-nums text-[#1F4B32]">
                        {(data.level as number).toFixed(2)}<span className="text-sm text-[#6B7A72] ml-1">mg</span>
                      </div>
                      <div className="text-xs text-[#6B7A72] mt-1">
                        {data.percentOfPeak as number}% of peak &middot; {data.status as string}
                      </div>
                      {data.isInjectionDay && (
                        <div className="mt-2 pt-2 border-t border-[#EAF2EB] text-xs flex items-center gap-1">
                          <span>💉</span>
                          <span className="font-semibold">{data.dose as string} injection</span>
                        </div>
                      )}
                    </>
                  )}
                </ChartTooltip>
              }
              cursor={{ stroke: '#7FFFA4', strokeWidth: 1, strokeDasharray: '3 3' }}
              wrapperStyle={{ outline: 'none' }}
            />
            <Area
              type="monotone"
              dataKey="pastLevel"
              stroke="#1F4B32"
              strokeWidth={2.5}
              fill="url(#medLevelGradient)"
              connectNulls={false}
              dot={false}
              activeDot={{ r: 6, fill: '#7FFFA4', stroke: '#1F4B32', strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="futureLevel"
              stroke="#1F4B32"
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeOpacity={0.5}
              fill="url(#medLevelGradient)"
              fillOpacity={0.3}
              connectNulls={false}
              dot={false}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-3 gap-3 px-5 pb-4">
        <div className="bg-[#F5F8F3] rounded-2xl p-3 text-center">
          <div className="w-7 h-7 rounded-full bg-[#7FFFA4]/20 flex items-center justify-center mx-auto mb-1.5">
            <Activity className="w-3.5 h-3.5 text-[#1F4B32]" />
          </div>
          <p className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Current</p>
          <p className="text-sm font-bold tabular-nums text-[#0D1F16]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {maxLevel > 0 ? Math.round((currentLevel / maxLevel) * 100) : 0}%
          </p>
        </div>
        <div className="bg-[#F5F8F3] rounded-2xl p-3 text-center">
          <div className="w-7 h-7 rounded-full bg-[#EAF2EB] flex items-center justify-center mx-auto mb-1.5">
            <Clock className="w-3.5 h-3.5 text-[#1F4B32]" />
          </div>
          <p className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Half-life</p>
          <p className="text-sm font-bold tabular-nums text-[#0D1F16]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(halfLifeHours / 24)}d
          </p>
        </div>
        <div className="bg-[#F5F8F3] rounded-2xl p-3 text-center">
          <div className="w-7 h-7 rounded-full bg-[#EAF2EB] flex items-center justify-center mx-auto mb-1.5">
            <Syringe className="w-3.5 h-3.5 text-[#1F4B32]" />
          </div>
          <p className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Dose</p>
          <p className="text-sm font-bold tabular-nums text-[#0D1F16]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {currentDoseMg}mg
          </p>
        </div>
      </div>

      {/* Next shot pill — only for weekly medications */}
      {nextShotCountdown !== null && dosingIntervalHours >= 168 && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-3 bg-[#7FFFA4]/10 rounded-2xl px-4 py-3">
            <div
              className="w-8 h-8 rounded-full bg-[#7FFFA4]/20 flex items-center justify-center shrink-0"
              style={{ animation: 'syringePulse 2s ease-in-out infinite' }}
            >
              <Syringe className="w-4 h-4 text-[#1F4B32]" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Next Shot</p>
              <p className="text-sm font-bold tabular-nums" style={{ fontVariantNumeric: 'tabular-nums', color: nextShotCountdown === 'Overdue' ? '#C4742B' : '#1F4B32' }}>
                {nextShotCountdown === 'Overdue' ? 'Overdue' : nextShotCountdown}
              </p>
            </div>
            {nextShotMs !== null && nextShotMs <= 86400000 && (
              <span className="text-[9px] font-semibold px-2.5 py-1 rounded-full bg-[#FFF8F0] text-[#C4742B]">
                {nextShotMs <= 0 ? 'Due now' : 'Due soon'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-5 py-2.5 bg-[#F5F8F3]/60 border-t border-[#EAF2EB]">
        <p className="text-[9px] text-[#6B7A72]/80 leading-relaxed">
          Estimated levels based on published pharmacokinetic data ({source}). Individual responses vary. Not a substitute for clinical monitoring.
        </p>
      </div>
    </div>
  )
}
