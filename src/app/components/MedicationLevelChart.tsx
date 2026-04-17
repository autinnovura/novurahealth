'use client'

import { useState, useMemo } from 'react'

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
  halfLifeHours: number   // elimination half-life
  tmaxHours: number       // time to peak concentration (median)
  absorptionHalfLife: number // absorption half-life (derived from Tmax)
  dosingIntervalHours: number // 168h for weekly, 24h for daily
  doses: { label: string; mg: number }[]
  color: string
  source: string
}

const PK_DATA: Record<string, PKProfile> = {
  'Ozempic': {
    name: 'Semaglutide (Ozempic)',
    halfLifeHours: 168,        // ~7 days
    tmaxHours: 36,             // median 24-36h
    absorptionHalfLife: 12,    // derived to produce ~36h Tmax
    dosingIntervalHours: 168,
    doses: [
      { label: '0.25 mg', mg: 0.25 },
      { label: '0.5 mg', mg: 0.5 },
      { label: '1 mg', mg: 1.0 },
      { label: '2 mg', mg: 2.0 },
    ],
    color: '#2D5A3D',
    source: 'FDA Ozempic label; Clin Pharmacokinet 2017;56(11):1391-1401',
  },
  'Wegovy': {
    name: 'Semaglutide (Wegovy)',
    halfLifeHours: 168,
    tmaxHours: 36,
    absorptionHalfLife: 12,
    dosingIntervalHours: 168,
    doses: [
      { label: '0.25 mg', mg: 0.25 },
      { label: '0.5 mg', mg: 0.5 },
      { label: '1 mg', mg: 1.0 },
      { label: '1.7 mg', mg: 1.7 },
      { label: '2.4 mg', mg: 2.4 },
    ],
    color: '#2D5A3D',
    source: 'FDA Wegovy label; STEP 1 (NEJM 2021)',
  },
  'Semaglutide (Ozempic)': {
    name: 'Semaglutide (Ozempic)',
    halfLifeHours: 168,
    tmaxHours: 36,
    absorptionHalfLife: 12,
    dosingIntervalHours: 168,
    doses: [
      { label: '0.25 mg', mg: 0.25 },
      { label: '0.5 mg', mg: 0.5 },
      { label: '1 mg', mg: 1.0 },
      { label: '2 mg', mg: 2.0 },
    ],
    color: '#2D5A3D',
    source: 'FDA Ozempic label',
  },
  'Mounjaro': {
    name: 'Tirzepatide (Mounjaro)',
    halfLifeHours: 120,        // ~5 days
    tmaxHours: 24,             // median 24h (range 8-72h)
    absorptionHalfLife: 8,
    dosingIntervalHours: 168,
    doses: [
      { label: '2.5 mg', mg: 2.5 },
      { label: '5 mg', mg: 5.0 },
      { label: '7.5 mg', mg: 7.5 },
      { label: '10 mg', mg: 10.0 },
      { label: '12.5 mg', mg: 12.5 },
      { label: '15 mg', mg: 15.0 },
    ],
    color: '#4A90D9',
    source: 'FDA Mounjaro label; CPT Pharmacometrics 2024;13:e13099',
  },
  'Zepbound': {
    name: 'Tirzepatide (Zepbound)',
    halfLifeHours: 120,
    tmaxHours: 24,
    absorptionHalfLife: 8,
    dosingIntervalHours: 168,
    doses: [
      { label: '2.5 mg', mg: 2.5 },
      { label: '5 mg', mg: 5.0 },
      { label: '7.5 mg', mg: 7.5 },
      { label: '10 mg', mg: 10.0 },
      { label: '12.5 mg', mg: 12.5 },
      { label: '15 mg', mg: 15.0 },
    ],
    color: '#4A90D9',
    source: 'FDA Zepbound label; SURMOUNT-1 (NEJM 2022)',
  },
  'Saxenda': {
    name: 'Liraglutide (Saxenda)',
    halfLifeHours: 13,          // ~13 hours
    tmaxHours: 11,              // 8-12h
    absorptionHalfLife: 3,
    dosingIntervalHours: 24,    // daily
    doses: [
      { label: '0.6 mg', mg: 0.6 },
      { label: '1.2 mg', mg: 1.2 },
      { label: '1.8 mg', mg: 1.8 },
      { label: '2.4 mg', mg: 2.4 },
      { label: '3.0 mg', mg: 3.0 },
    ],
    color: '#C4742B',
    source: 'FDA Saxenda label',
  },
  'Trulicity': {
    name: 'Dulaglutide (Trulicity)',
    halfLifeHours: 120,        // ~5 days
    tmaxHours: 48,             // 24-72h, median ~48h
    absorptionHalfLife: 16,
    dosingIntervalHours: 168,
    doses: [
      { label: '0.75 mg', mg: 0.75 },
      { label: '1.5 mg', mg: 1.5 },
      { label: '3 mg', mg: 3.0 },
      { label: '4.5 mg', mg: 4.5 },
    ],
    color: '#7B5EA7',
    source: 'FDA Trulicity label',
  },
  'Rybelsus': {
    name: 'Semaglutide oral (Rybelsus)',
    halfLifeHours: 168,
    tmaxHours: 1.5,            // oral: 0.8-1.75h
    absorptionHalfLife: 0.5,
    dosingIntervalHours: 24,   // daily
    doses: [
      { label: '3 mg', mg: 3.0 },
      { label: '7 mg', mg: 7.0 },
      { label: '14 mg', mg: 14.0 },
    ],
    color: '#2D5A3D',
    source: 'FDA Rybelsus label',
  },
  'Other': {
    name: 'GLP-1 (Generic)',
    halfLifeHours: 168,
    tmaxHours: 36,
    absorptionHalfLife: 12,
    dosingIntervalHours: 168,
    doses: [
      { label: '0.25 mg', mg: 0.25 },
      { label: '0.5 mg', mg: 0.5 },
      { label: '1 mg', mg: 1.0 },
      { label: '2 mg', mg: 2.0 },
    ],
    color: '#2D5A3D',
    source: 'Estimated based on semaglutide PK profile',
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
  injectionDay?: string // day of week
  injectionTime?: string // time of day
}

export default function MedicationLevelChart({ medication, dose, injectionLogs }: Props) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | '90days'>('month')
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; time: string; level: string } | null>(null)

  const pk = PK_DATA[medication] || PK_DATA['Other']
  const ke = Math.LN2 / pk.halfLifeHours
  const ka = Math.LN2 / pk.absorptionHalfLife

  // Parse dose from string like "1 mg" or "2.5mg"
  const currentDoseMg = dose
    ? parseFloat(dose.replace(/[^0-9.]/g, '')) || pk.doses[0].mg
    : pk.doses[0].mg

  // Calculate concentration at time t after a single dose
  function singleDoseConcentration(t: number, doseMg: number): number {
    if (t < 0) return 0
    const C = (doseMg * ka / (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t))
    return Math.max(0, C)
  }

  // Generate injection times from logs or assume weekly
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
        .filter(inj => inj.time >= startTime - 30 * 24 * 3600 * 1000) // include injections from before range for carryover
        .sort((a, b) => a.time - b.time)
    }

    // Default: assume weekly injections for the range + 4 weeks before
    const times = []
    const weeksBack = Math.ceil(rangeHours / 168) + 4
    for (let i = weeksBack; i >= 0; i--) {
      times.push({
        time: now - i * pk.dosingIntervalHours * 3600 * 1000,
        dose: currentDoseMg,
      })
    }
    return times
  }, [injectionLogs, timeRange, currentDoseMg, pk.dosingIntervalHours])

  // Generate curve data
  const chartData = useMemo(() => {
    const rangeHours = timeRange === 'week' ? 168 : timeRange === 'month' ? 720 : 2160
    const now = Date.now()
    const startTime = now - rangeHours * 3600 * 1000
    const points: { time: number; level: number; date: Date }[] = []
    const step = rangeHours / 200

    for (let h = 0; h <= rangeHours; h += step) {
      const pointTime = startTime + h * 3600 * 1000
      let totalConcentration = 0

      for (const inj of injectionTimes) {
        const hoursSinceInjection = (pointTime - inj.time) / (3600 * 1000)
        totalConcentration += singleDoseConcentration(hoursSinceInjection, inj.dose)
      }

      points.push({
        time: h,
        level: totalConcentration,
        date: new Date(pointTime),
      })
    }

    return points
  }, [injectionTimes, timeRange, ke, ka])

  // Find max level for scaling
  const maxLevel = Math.max(...chartData.map(p => p.level), 0.01)
  const currentLevel = chartData[chartData.length - 1]?.level || 0
  const peakLevel = maxLevel
  const currentPercent = peakLevel > 0 ? Math.round((currentLevel / peakLevel) * 100) : 0

  // SVG dimensions
  const width = 340
  const height = 180
  const padding = { top: 20, right: 15, bottom: 30, left: 40 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  // Generate SVG path
  const pathData = chartData.map((p, i) => {
    const x = padding.left + (p.time / (chartData[chartData.length - 1]?.time || 1)) * plotW
    const y = padding.top + plotH - (p.level / maxLevel) * plotH
    return `${i === 0 ? 'M' : 'L'}${x},${y}`
  }).join(' ')

  // Area fill path
  const areaPath = pathData +
    ` L${padding.left + plotW},${padding.top + plotH}` +
    ` L${padding.left},${padding.top + plotH} Z`

  // X-axis labels
  const rangeHours = timeRange === 'week' ? 168 : timeRange === 'month' ? 720 : 2160
  const now = Date.now()
  const startTime = now - rangeHours * 3600 * 1000

  const xLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = []
    const count = timeRange === 'week' ? 7 : timeRange === 'month' ? 4 : 6
    for (let i = 0; i <= count; i++) {
      const frac = i / count
      const date = new Date(startTime + frac * rangeHours * 3600 * 1000)
      labels.push({
        x: padding.left + frac * plotW,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
      })
    }
    return labels
  }, [timeRange, startTime, rangeHours, plotW])

  // Y-axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(frac => ({
    y: padding.top + plotH - frac * plotH,
    label: `${(frac * maxLevel).toFixed(1)}mg`,
  }))

  // Injection markers on chart
  const injectionMarkers = injectionTimes.filter(inj => inj.time >= startTime && inj.time <= now).map(inj => {
    const hoursSinceStart = (inj.time - startTime) / (3600 * 1000)
    const x = padding.left + (hoursSinceStart / rangeHours) * plotW
    return { x, dose: inj.dose, date: new Date(inj.time) }
  })

  // Handle touch/hover for tooltip
  function handleInteraction(e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const svgX = ((clientX - rect.left) / rect.width) * width

    if (svgX < padding.left || svgX > padding.left + plotW) {
      setHoveredPoint(null)
      return
    }

    const frac = (svgX - padding.left) / plotW
    const idx = Math.round(frac * (chartData.length - 1))
    const point = chartData[Math.max(0, Math.min(idx, chartData.length - 1))]
    if (point) {
      const x = padding.left + (point.time / (chartData[chartData.length - 1]?.time || 1)) * plotW
      const y = padding.top + plotH - (point.level / maxLevel) * plotH
      setHoveredPoint({
        x, y,
        time: point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + point.date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
        level: point.level.toFixed(2) + 'mg',
      })
    }
  }

  return (
    <div className="bg-white border border-[#EDEDEA] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-sm font-bold text-[#1E1E1C]">Estimated Medication Levels</h3>
            <p className="text-[10px] text-[#B0B0A8] mt-0.5">{pk.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-[#B0B0A8] uppercase font-semibold">Est. level</p>
            <p className="text-lg font-bold" style={{ color: pk.color }}>{currentLevel.toFixed(2)}<span className="text-xs font-normal text-[#B0B0A8]">mg</span></p>
          </div>
        </div>

        {/* Time range tabs */}
        <div className="flex gap-1 mt-3 bg-[#F5F5F2] rounded-lg p-0.5">
          {([
            { id: 'week' as const, label: 'Week' },
            { id: 'month' as const, label: 'Month' },
            { id: '90days' as const, label: '90 Days' },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setTimeRange(tab.id)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                timeRange === tab.id
                  ? 'bg-white text-[#1E1E1C] shadow-sm'
                  : 'text-[#B0B0A8] hover:text-[#6B6B65]'
              }`}>{tab.label}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-2 relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto touch-none"
          onMouseMove={handleInteraction}
          onTouchMove={handleInteraction}
          onMouseLeave={() => setHoveredPoint(null)}
          onTouchEnd={() => setHoveredPoint(null)}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(frac => (
            <line key={frac}
              x1={padding.left} y1={padding.top + plotH - frac * plotH}
              x2={padding.left + plotW} y2={padding.top + plotH - frac * plotH}
              stroke="#F0F0ED" strokeWidth="0.5" />
          ))}

          {/* Area fill with gradient */}
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={pk.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={pk.color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#areaGrad)" />

          {/* Main curve */}
          <path d={pathData} fill="none" stroke={pk.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Injection markers */}
          {injectionMarkers.map((m, i) => (
            <g key={i}>
              <line x1={m.x} y1={padding.top} x2={m.x} y2={padding.top + plotH} stroke={pk.color} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4" />
              <circle cx={m.x} cy={padding.top + plotH} r="3" fill={pk.color} />
              <text x={m.x} y={padding.top + plotH + 10} textAnchor="middle" fontSize="7" fill="#B0B0A8">💉</text>
            </g>
          ))}

          {/* X-axis labels */}
          {xLabels.map((l, i) => (
            <text key={i} x={l.x} y={height - 5} textAnchor="middle" fontSize="8" fill="#B0B0A8">{l.label}</text>
          ))}

          {/* Y-axis labels */}
          {yLabels.filter((_, i) => i % 2 === 0 || i === yLabels.length - 1).map((l, i) => (
            <text key={i} x={padding.left - 4} y={l.y + 3} textAnchor="end" fontSize="7" fill="#B0B0A8">{l.label}</text>
          ))}

          {/* Hover tooltip */}
          {hoveredPoint && (
            <g>
              <line x1={hoveredPoint.x} y1={padding.top} x2={hoveredPoint.x} y2={padding.top + plotH} stroke={pk.color} strokeWidth="1" strokeDasharray="2,2" />
              <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" fill="white" stroke={pk.color} strokeWidth="2" />
              <rect x={Math.min(hoveredPoint.x - 50, width - 110)} y={Math.max(hoveredPoint.y - 35, 2)} width="100" height="28" rx="4" fill="white" stroke="#EDEDEA" strokeWidth="0.5" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.08))" />
              <text x={Math.min(hoveredPoint.x - 45, width - 105)} y={Math.max(hoveredPoint.y - 22, 14)} fontSize="8" fontWeight="600" fill="#1E1E1C">{hoveredPoint.level}</text>
              <text x={Math.min(hoveredPoint.x - 45, width - 105)} y={Math.max(hoveredPoint.y - 12, 24)} fontSize="7" fill="#B0B0A8">{hoveredPoint.time}</text>
            </g>
          )}
        </svg>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 border-t border-[#F5F5F2]">
        <div className="p-3 text-center border-r border-[#F5F5F2]">
          <p className="text-[9px] text-[#B0B0A8] uppercase font-semibold">Current</p>
          <p className="text-sm font-bold" style={{ color: pk.color }}>{currentPercent}%</p>
        </div>
        <div className="p-3 text-center border-r border-[#F5F5F2]">
          <p className="text-[9px] text-[#B0B0A8] uppercase font-semibold">Half-life</p>
          <p className="text-sm font-bold text-[#1E1E1C]">{Math.round(pk.halfLifeHours / 24)}d</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[9px] text-[#B0B0A8] uppercase font-semibold">Dose</p>
          <p className="text-sm font-bold text-[#1E1E1C]">{currentDoseMg}mg</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-4 py-2 bg-[#F5F5F2]">
        <p className="text-[8px] text-[#B0B0A8] leading-relaxed">Estimated levels based on published pharmacokinetic data ({pk.source}). Individual responses vary. This is not a substitute for clinical monitoring. Consult your healthcare provider for medical decisions.</p>
      </div>
    </div>
  )
}
