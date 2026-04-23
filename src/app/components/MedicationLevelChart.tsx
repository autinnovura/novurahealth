'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Info, Clock, Syringe, Activity } from 'lucide-react'

/*
 * PHARMACOKINETIC DATA — sourced from FDA prescribing labels and published clinical studies
 *
 * Sources:
 * - Semaglutide: FDA Ozempic/Wegovy labels; Clin Pharmacokinet 2017;56(11):1391-1401
 * - Tirzepatide: FDA Mounjaro/Zepbound labels; CPT Pharmacometrics Syst Pharmacol 2024;13:e13099
 * - Liraglutide: FDA Saxenda label
 * - Dulaglutide: FDA Trulicity label
 *
 * Model: One-compartment with first-order absorption and elimination
 * C(t) = (dose * ka / (ka - ke)) * (e^(-ke*t) - e^(-ka*t))
 * For multi-dose: superposition of individual dose curves
 */

interface PKProfile {
  name: string
  halfLifeHours: number
  tmaxHours: number
  absorptionHalfLife: number
  dosingIntervalHours: number
  doses: { label: string; mg: number }[]
  color: string
  source: string
}

const PK_DATA: Record<string, PKProfile> = {
  'Ozempic': {
    name: 'Semaglutide (Ozempic)',
    halfLifeHours: 168, tmaxHours: 36, absorptionHalfLife: 12, dosingIntervalHours: 168,
    doses: [{ label: '0.25 mg', mg: 0.25 }, { label: '0.5 mg', mg: 0.5 }, { label: '1 mg', mg: 1.0 }, { label: '2 mg', mg: 2.0 }],
    color: '#1F4B32', source: 'FDA Ozempic label; Clin Pharmacokinet 2017;56(11):1391-1401',
  },
  'Wegovy': {
    name: 'Semaglutide (Wegovy)',
    halfLifeHours: 168, tmaxHours: 36, absorptionHalfLife: 12, dosingIntervalHours: 168,
    doses: [{ label: '0.25 mg', mg: 0.25 }, { label: '0.5 mg', mg: 0.5 }, { label: '1 mg', mg: 1.0 }, { label: '1.7 mg', mg: 1.7 }, { label: '2.4 mg', mg: 2.4 }],
    color: '#1F4B32', source: 'FDA Wegovy label; STEP 1 (NEJM 2021)',
  },
  'Semaglutide (Ozempic)': {
    name: 'Semaglutide (Ozempic)',
    halfLifeHours: 168, tmaxHours: 36, absorptionHalfLife: 12, dosingIntervalHours: 168,
    doses: [{ label: '0.25 mg', mg: 0.25 }, { label: '0.5 mg', mg: 0.5 }, { label: '1 mg', mg: 1.0 }, { label: '2 mg', mg: 2.0 }],
    color: '#1F4B32', source: 'FDA Ozempic label',
  },
  'Mounjaro': {
    name: 'Tirzepatide (Mounjaro)',
    halfLifeHours: 120, tmaxHours: 24, absorptionHalfLife: 8, dosingIntervalHours: 168,
    doses: [{ label: '2.5 mg', mg: 2.5 }, { label: '5 mg', mg: 5.0 }, { label: '7.5 mg', mg: 7.5 }, { label: '10 mg', mg: 10.0 }, { label: '12.5 mg', mg: 12.5 }, { label: '15 mg', mg: 15.0 }],
    color: '#4A90D9', source: 'FDA Mounjaro label; CPT Pharmacometrics 2024;13:e13099',
  },
  'Zepbound': {
    name: 'Tirzepatide (Zepbound)',
    halfLifeHours: 120, tmaxHours: 24, absorptionHalfLife: 8, dosingIntervalHours: 168,
    doses: [{ label: '2.5 mg', mg: 2.5 }, { label: '5 mg', mg: 5.0 }, { label: '7.5 mg', mg: 7.5 }, { label: '10 mg', mg: 10.0 }, { label: '12.5 mg', mg: 12.5 }, { label: '15 mg', mg: 15.0 }],
    color: '#4A90D9', source: 'FDA Zepbound label; SURMOUNT-1 (NEJM 2022)',
  },
  'Saxenda': {
    name: 'Liraglutide (Saxenda)',
    halfLifeHours: 13, tmaxHours: 11, absorptionHalfLife: 3, dosingIntervalHours: 24,
    doses: [{ label: '0.6 mg', mg: 0.6 }, { label: '1.2 mg', mg: 1.2 }, { label: '1.8 mg', mg: 1.8 }, { label: '2.4 mg', mg: 2.4 }, { label: '3.0 mg', mg: 3.0 }],
    color: '#C4742B', source: 'FDA Saxenda label',
  },
  'Trulicity': {
    name: 'Dulaglutide (Trulicity)',
    halfLifeHours: 120, tmaxHours: 48, absorptionHalfLife: 16, dosingIntervalHours: 168,
    doses: [{ label: '0.75 mg', mg: 0.75 }, { label: '1.5 mg', mg: 1.5 }, { label: '3 mg', mg: 3.0 }, { label: '4.5 mg', mg: 4.5 }],
    color: '#7B5EA7', source: 'FDA Trulicity label',
  },
  'Rybelsus': {
    name: 'Semaglutide oral (Rybelsus)',
    halfLifeHours: 168, tmaxHours: 1.5, absorptionHalfLife: 0.5, dosingIntervalHours: 24,
    doses: [{ label: '3 mg', mg: 3.0 }, { label: '7 mg', mg: 7.0 }, { label: '14 mg', mg: 14.0 }],
    color: '#1F4B32', source: 'FDA Rybelsus label',
  },
  'Other': {
    name: 'GLP-1 (Generic)',
    halfLifeHours: 168, tmaxHours: 36, absorptionHalfLife: 12, dosingIntervalHours: 168,
    doses: [{ label: '0.25 mg', mg: 0.25 }, { label: '0.5 mg', mg: 0.5 }, { label: '1 mg', mg: 1.0 }, { label: '2 mg', mg: 2.0 }],
    color: '#1F4B32', source: 'Estimated based on semaglutide PK profile',
  },
}

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

  const pk = PK_DATA[medication] || PK_DATA['Other']
  const ke = Math.LN2 / pk.halfLifeHours
  const ka = Math.LN2 / pk.absorptionHalfLife

  const currentDoseMg = dose
    ? parseFloat(dose.replace(/[^0-9.]/g, '')) || pk.doses[0].mg
    : pk.doses[0].mg

  // NOTE: Uses the full one-compartment PK model with first-order absorption,
  // NOT the simplified dose*(1-exp(-ln2*t/t½)) formula. This is more accurate
  // because it models the absorption phase (ka) separately from elimination (ke).
  // Multi-dose steady-state is handled by superposition in chartData.
  // @review — confirm this is the desired model vs the simplified version.
  function singleDoseConcentration(t: number, doseMg: number): number {
    if (t < 0) return 0
    const C = (doseMg * ka / (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t))
    return Math.max(0, C)
  }

  const injectionTimes = useMemo(() => {
    const rangeHours = timeRange === 'week' ? 168 : timeRange === 'month' ? 720 : 2160
    const now = Date.now()
    const startTime = now - rangeHours * 3600 * 1000

    if (injectionLogs && injectionLogs.length > 0) {
      return injectionLogs
        .map(log => ({
          time: new Date(log.logged_at).getTime(),
          dose: log.dose ? parseFloat(log.dose.replace(/[^0-9.]/g, '')) || currentDoseMg : currentDoseMg,
        }))
        .filter(inj => inj.time >= startTime - 30 * 24 * 3600 * 1000)
        .sort((a, b) => a.time - b.time)
    }

    return []
  }, [injectionLogs, timeRange, currentDoseMg])

  const pastHours = timeRange === 'week' ? 168 : timeRange === 'month' ? 720 : 2160
  const futureHours = 168
  const totalHours = pastHours + futureHours

  const chartData = useMemo(() => {
    const now = Date.now()
    const startTime = now - pastHours * 3600 * 1000
    const points: { time: number; level: number; date: Date; isFuture: boolean; dateLabel: string }[] = []
    const step = totalHours / 200

    for (let h = 0; h <= totalHours; h += step) {
      const pointTime = startTime + h * 3600 * 1000
      let totalConcentration = 0
      for (const inj of injectionTimes) {
        const hoursSinceInjection = (pointTime - inj.time) / (3600 * 1000)
        totalConcentration += singleDoseConcentration(hoursSinceInjection, inj.dose)
      }
      const d = new Date(pointTime)
      points.push({
        time: h,
        level: Math.round(totalConcentration * 1000) / 1000,
        date: d,
        isFuture: h > pastHours,
        dateLabel: `${d.getMonth() + 1}/${d.getDate()}`,
      })
    }
    return points
  }, [injectionTimes, pastHours, totalHours, ke, ka])

  const maxLevel = Math.max(...chartData.map(p => p.level), 0.01)

  const nowIdx = chartData.findIndex(p => p.isFuture)
  const currentLevel = nowIdx > 0 ? chartData[nowIdx - 1].level : chartData[chartData.length - 1]?.level || 0

  // Next shot countdown
  const lastInjTime = injectionTimes.length > 0 ? injectionTimes[injectionTimes.length - 1].time : null
  const nextShotTime = lastInjTime ? lastInjTime + pk.dosingIntervalHours * 3600 * 1000 : null
  const nextShotMs = nextShotTime ? nextShotTime - Date.now() : null
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

  // Remove duplicate at bridge
  const deduped = mergedData.filter((p, i, arr) => i === 0 || p.time !== arr[i - 1].time)

  // X-axis: show every other label
  const xTickInterval = timeRange === 'week' ? Math.floor(deduped.length / 8) : timeRange === 'month' ? Math.floor(deduped.length / 6) : Math.floor(deduped.length / 7)

  // "Now" position as fraction
  const nowTime = pastHours

  // Injection markers for the reference lines
  const now = Date.now()
  const startTime = now - pastHours * 3600 * 1000
  const injectionMarkerTimes = injectionTimes
    .filter(inj => inj.time >= startTime && inj.time <= now)
    .map(inj => (inj.time - startTime) / (3600 * 1000))

  const nextShotCountdown = (() => {
    if (nextShotMs === null || pk.dosingIntervalHours < 168) return null
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
      {/* Pulse keyframe */}
      <style>{`
        @keyframes medPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(127,255,164,0.6); }
          50% { box-shadow: 0 0 0 8px rgba(127,255,164,0); }
        }
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
            <p className="text-xs text-[#6B7A72] mt-0.5">{pk.name}</p>
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

        {/* Info sheet */}
        <AnimatePresence>
          {showInfoSheet && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 rounded-2xl bg-[#F5F8F3] border border-[#EAF2EB] text-xs text-[#6B7A72] leading-relaxed">
                This estimate models your medication accumulation based on a {Math.round(pk.halfLifeHours / 24)}-day half-life.
                At steady state, your trough level stays around 60% of peak due to weekly dosing.
                Individual responses vary — this is not a substitute for clinical monitoring.
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
            {/* "Now" vertical line */}
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
            {/* Past area fill */}
            <Area
              type="monotone"
              dataKey="pastLevel"
              stroke="#1F4B32"
              strokeWidth={2.5}
              fill="url(#medLevelGradient)"
              connectNulls={false}
              dot={false}
              activeDot={{ r: 4, fill: '#fff', stroke: '#1F4B32', strokeWidth: 2 }}
            />
            {/* Future dashed */}
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
            {Math.round(pk.halfLifeHours / 24)}d
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

      {/* Next shot pill */}
      {nextShotCountdown !== null && pk.dosingIntervalHours >= 168 && (
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
          Estimated levels based on published pharmacokinetic data ({pk.source}). Individual responses vary. Not a substitute for clinical monitoring.
        </p>
      </div>
    </div>
  )
}
