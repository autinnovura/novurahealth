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
    color: '#2D5A3D', source: 'FDA Ozempic label; Clin Pharmacokinet 2017;56(11):1391-1401',
  },
  'Wegovy': {
    name: 'Semaglutide (Wegovy)',
    halfLifeHours: 168, tmaxHours: 36, absorptionHalfLife: 12, dosingIntervalHours: 168,
    doses: [{ label: '0.25 mg', mg: 0.25 }, { label: '0.5 mg', mg: 0.5 }, { label: '1 mg', mg: 1.0 }, { label: '1.7 mg', mg: 1.7 }, { label: '2.4 mg', mg: 2.4 }],
    color: '#2D5A3D', source: 'FDA Wegovy label; STEP 1 (NEJM 2021)',
  },
  'Semaglutide (Ozempic)': {
    name: 'Semaglutide (Ozempic)',
    halfLifeHours: 168, tmaxHours: 36, absorptionHalfLife: 12, dosingIntervalHours: 168,
    doses: [{ label: '0.25 mg', mg: 0.25 }, { label: '0.5 mg', mg: 0.5 }, { label: '1 mg', mg: 1.0 }, { label: '2 mg', mg: 2.0 }],
    color: '#2D5A3D', source: 'FDA Ozempic label',
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
    color: '#2D5A3D', source: 'FDA Rybelsus label',
  },
  'Other': {
    name: 'GLP-1 (Generic)',
    halfLifeHours: 168, tmaxHours: 36, absorptionHalfLife: 12, dosingIntervalHours: 168,
    doses: [{ label: '0.25 mg', mg: 0.25 }, { label: '0.5 mg', mg: 0.5 }, { label: '1 mg', mg: 1.0 }, { label: '2 mg', mg: 2.0 }],
    color: '#2D5A3D', source: 'Estimated based on semaglutide PK profile',
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

// Catmull-Rom to cubic bezier smooth path
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`

  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += `C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`
  }
  return d
}

export default function MedicationLevelChart({ medication, dose, injectionLogs }: Props) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | '90days'>('week')
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; time: string; level: string } | null>(null)

  const pk = PK_DATA[medication] || PK_DATA['Other']
  const ke = Math.LN2 / pk.halfLifeHours
  const ka = Math.LN2 / pk.absorptionHalfLife

  const currentDoseMg = dose
    ? parseFloat(dose.replace(/[^0-9.]/g, '')) || pk.doses[0].mg
    : pk.doses[0].mg

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
  }, [injectionLogs, timeRange, currentDoseMg, pk.dosingIntervalHours])

  // The chart shows past + future. "Now" sits at ~75% of the x-axis so you
  // can see the projected decay after the most recent injection.
  const pastHours = timeRange === 'week' ? 168 : timeRange === 'month' ? 720 : 2160
  const futureHours = 168 // always show 1 week into the future
  const totalHours = pastHours + futureHours

  const chartData = useMemo(() => {
    const now = Date.now()
    const startTime = now - pastHours * 3600 * 1000
    const points: { time: number; level: number; date: Date; isFuture: boolean }[] = []
    const step = totalHours / 250

    for (let h = 0; h <= totalHours; h += step) {
      const pointTime = startTime + h * 3600 * 1000
      let totalConcentration = 0
      for (const inj of injectionTimes) {
        const hoursSinceInjection = (pointTime - inj.time) / (3600 * 1000)
        totalConcentration += singleDoseConcentration(hoursSinceInjection, inj.dose)
      }
      points.push({ time: h, level: totalConcentration, date: new Date(pointTime), isFuture: h > pastHours })
    }
    return points
  }, [injectionTimes, pastHours, totalHours, ke, ka])

  const maxLevel = Math.max(...chartData.map(p => p.level), 0.01)

  // Current level = the point closest to "now"
  const nowIdx = chartData.findIndex(p => p.isFuture)
  const currentLevel = nowIdx > 0 ? chartData[nowIdx - 1].level : chartData[chartData.length - 1]?.level || 0
  const currentPercent = maxLevel > 0 ? Math.round((currentLevel / maxLevel) * 100) : 0

  // Next shot countdown
  const lastInjTime = injectionTimes.length > 0 ? injectionTimes[injectionTimes.length - 1].time : null
  const nextShotTime = lastInjTime ? lastInjTime + pk.dosingIntervalHours * 3600 * 1000 : null
  const nextShotMs = nextShotTime ? nextShotTime - Date.now() : null
  const nextShotDays = nextShotMs !== null ? Math.floor(nextShotMs / 86400000) : null
  const nextShotHours = nextShotMs !== null ? Math.floor((nextShotMs % 86400000) / 3600000) : null

  // SVG dimensions — taller for mobile readability
  const width = 340
  const height = 220
  const padding = { top: 20, right: 15, bottom: 35, left: 40 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const now = Date.now()
  const startTime = now - pastHours * 3600 * 1000
  const nowFrac = pastHours / totalHours // where "now" sits on the x-axis

  // Build smooth curve points — split into past (solid) and future (dashed)
  const allCurvePoints = useMemo(() => {
    return chartData.map(p => ({
      x: padding.left + (p.time / totalHours) * plotW,
      y: padding.top + plotH - (p.level / maxLevel) * plotH,
      isFuture: p.isFuture,
    }))
  }, [chartData, maxLevel, plotW, plotH, totalHours])

  const pastPoints = allCurvePoints.filter(p => !p.isFuture)
  const futurePoints = allCurvePoints.filter(p => p.isFuture)
  // Overlap: include last past point as first future point for continuity
  const futureWithBridge = pastPoints.length > 0 ? [pastPoints[pastPoints.length - 1], ...futurePoints] : futurePoints

  const pastPath = smoothPath(pastPoints)
  const futurePath = smoothPath(futureWithBridge)

  // Now dot is at the boundary
  const nowPt = pastPoints[pastPoints.length - 1]

  // Area path uses the full curve (past + future)
  const fullPath = smoothPath(allCurvePoints)
  const areaPath = fullPath +
    ` L${padding.left + plotW},${padding.top + plotH}` +
    ` L${padding.left},${padding.top + plotH} Z`

  // X-axis labels spanning past + future
  const xLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = []
    const count = timeRange === 'week' ? 8 : timeRange === 'month' ? 5 : 7
    for (let i = 0; i <= count; i++) {
      const frac = i / count
      const date = new Date(startTime + frac * totalHours * 3600 * 1000)
      labels.push({ x: padding.left + frac * plotW, label: `${date.getMonth() + 1}/${date.getDate()}` })
    }
    return labels
  }, [timeRange, startTime, totalHours, plotW])

  const yLabels = [0, 0.5, 1].map(frac => ({
    y: padding.top + plotH - frac * plotH,
    label: `${(frac * maxLevel).toFixed(1)}`,
  }))

  // Injection markers
  const injectionMarkers = injectionTimes.filter(inj => inj.time >= startTime && inj.time <= now).map(inj => {
    const hoursSinceStart = (inj.time - startTime) / (3600 * 1000)
    const x = padding.left + (hoursSinceStart / totalHours) * plotW
    const frac = hoursSinceStart / totalHours
    const idx = Math.round(frac * (chartData.length - 1))
    const point = chartData[Math.max(0, Math.min(idx, chartData.length - 1))]
    const y = point ? padding.top + plotH - (point.level / maxLevel) * plotH : padding.top + plotH
    return { x, y, dose: inj.dose, date: new Date(inj.time) }
  })

  // "Now" line position
  const nowX = padding.left + nowFrac * plotW

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
      const x = padding.left + (point.time / totalHours) * plotW
      const y = padding.top + plotH - (point.level / maxLevel) * plotH
      const isFuture = point.isFuture
      setHoveredPoint({
        x, y,
        time: (isFuture ? '(projected) ' : '') + point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + point.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        level: point.level.toFixed(2) + ' mg',
      })
    }
  }

  return (
    <div className="bg-white border border-[#EDEDEA] rounded-xl overflow-hidden">
      {/* Pulsing dot animation */}
      <style>{`
        @keyframes medPulse {
          0%, 100% { r: 4; opacity: 1; }
          50% { r: 8; opacity: 0.3; }
        }
      `}</style>

      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-sm font-bold text-[#1E1E1C]">Estimated Medication Levels</h3>
            <p className="text-[10px] text-[#B0B0A8] mt-0.5">{pk.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-[#B0B0A8] uppercase font-semibold">Est. level</p>
            <p className="text-lg font-bold" style={{ color: pk.color }}>{currentLevel.toFixed(2)}<span className="text-xs font-normal text-[#B0B0A8]"> mg</span></p>
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
                timeRange === tab.id ? 'bg-white text-[#1E1E1C] shadow-sm' : 'text-[#B0B0A8] hover:text-[#6B6B65]'
              }`}>{tab.label}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-1 relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto touch-none"
          onMouseMove={handleInteraction}
          onTouchMove={handleInteraction}
          onTouchStart={handleInteraction}
          onMouseLeave={() => setHoveredPoint(null)}
          onTouchEnd={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="medAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={pk.color} stopOpacity="0.45" />
              <stop offset="60%" stopColor={pk.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={pk.color} stopOpacity="0.02" />
            </linearGradient>
            <filter id="medGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(frac => (
            <line key={frac}
              x1={padding.left} y1={padding.top + plotH - frac * plotH}
              x2={padding.left + plotW} y2={padding.top + plotH - frac * plotH}
              stroke="#F0F0ED" strokeWidth="0.5" />
          ))}

          {/* Future zone shading */}
          <rect x={nowX} y={padding.top} width={padding.left + plotW - nowX} height={plotH} fill="#F5F5F2" opacity="0.5" />

          {/* Area fill */}
          <path d={areaPath} fill="url(#medAreaGrad)" />

          {/* Past curve (solid) */}
          <path d={pastPath} fill="none" stroke={pk.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Future curve (dashed) */}
          {futurePath && <path d={futurePath} fill="none" stroke={pk.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,4" opacity="0.6" />}

          {/* Injection markers — larger and more visible */}
          {injectionMarkers.map((m, i) => (
            <g key={i}>
              <line x1={m.x} y1={padding.top} x2={m.x} y2={padding.top + plotH} stroke={pk.color} strokeWidth="1" strokeDasharray="4,3" opacity="0.35" />
              <circle cx={m.x} cy={m.y} r="5" fill="white" stroke={pk.color} strokeWidth="2" />
              <text x={m.x} y={padding.top + plotH + 12} textAnchor="middle" fontSize="10" fill={pk.color}>💉</text>
            </g>
          ))}

          {/* "Now" dashed vertical line */}
          <line x1={nowX} y1={padding.top} x2={nowX} y2={padding.top + plotH} stroke={pk.color} strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
          <text x={nowX} y={padding.top - 6} textAnchor="middle" fontSize="8" fontWeight="600" fill={pk.color}>Now</text>

          {/* Pulsing "now" dot */}
          {nowPt && (
            <g filter="url(#medGlow)">
              <circle cx={nowPt.x} cy={nowPt.y} r="4" fill={pk.color} opacity="0.3" style={{ animation: 'medPulse 2s ease-in-out infinite' }} />
              <circle cx={nowPt.x} cy={nowPt.y} r="4" fill="white" stroke={pk.color} strokeWidth="2.5" />
            </g>
          )}

          {/* X-axis labels */}
          {xLabels.map((l, i) => (
            <text key={i} x={l.x} y={height - 8} textAnchor="middle" fontSize="8" fill="#B0B0A8">{l.label}</text>
          ))}

          {/* Y-axis labels */}
          {yLabels.map((l, i) => (
            <text key={i} x={padding.left - 4} y={l.y + 3} textAnchor="end" fontSize="7" fill="#B0B0A8">{l.label}</text>
          ))}

          {/* Hover crosshair + tooltip */}
          {hoveredPoint && (
            <g>
              {/* Vertical crosshair */}
              <line x1={hoveredPoint.x} y1={padding.top} x2={hoveredPoint.x} y2={padding.top + plotH} stroke={pk.color} strokeWidth="1" strokeDasharray="2,2" opacity="0.7" />
              {/* Horizontal crosshair */}
              <line x1={padding.left} y1={hoveredPoint.y} x2={padding.left + plotW} y2={hoveredPoint.y} stroke={pk.color} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
              {/* Point */}
              <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="white" stroke={pk.color} strokeWidth="2.5" />
              {/* Tooltip */}
              <rect x={Math.min(Math.max(hoveredPoint.x - 55, 2), width - 115)} y={Math.max(hoveredPoint.y - 40, 2)} width="110" height="32" rx="6" fill="white" stroke="#EDEDEA" strokeWidth="0.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))" />
              <text x={Math.min(Math.max(hoveredPoint.x - 50, 7), width - 110)} y={Math.max(hoveredPoint.y - 25, 15)} fontSize="9" fontWeight="700" fill="#1E1E1C">{hoveredPoint.level}</text>
              <text x={Math.min(Math.max(hoveredPoint.x - 50, 7), width - 110)} y={Math.max(hoveredPoint.y - 14, 26)} fontSize="7" fill="#B0B0A8">{hoveredPoint.time}</text>
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

      {/* Next Shot countdown */}
      {nextShotMs !== null && pk.dosingIntervalHours >= 168 && (
        <div className="px-4 py-3 border-t border-[#F5F5F2] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ backgroundColor: `${pk.color}15` }}>💉</div>
          <div className="flex-1">
            <p className="text-[10px] text-[#B0B0A8] uppercase font-semibold">Next Shot</p>
            {nextShotMs <= 0 ? (
              <p className="text-sm font-bold" style={{ color: '#C4742B' }}>Overdue</p>
            ) : nextShotDays !== null && nextShotDays === 0 ? (
              <p className="text-sm font-bold" style={{ color: pk.color }}>{nextShotHours}h remaining</p>
            ) : (
              <p className="text-sm font-bold" style={{ color: pk.color }}>{nextShotDays}d {nextShotHours}h</p>
            )}
          </div>
          {nextShotMs <= 86400000 && (
            <span className="text-[9px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: '#FFF8F0', color: '#C4742B' }}>
              {nextShotMs <= 0 ? 'Due now' : 'Due soon'}
            </span>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-4 py-2 bg-[#F5F5F2]">
        <p className="text-[8px] text-[#B0B0A8] leading-relaxed">Estimated levels based on published pharmacokinetic data ({pk.source}). Individual responses vary. Not a substitute for clinical monitoring.</p>
      </div>
    </div>
  )
}
