'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Scale, Syringe, Utensils, Droplets, Dumbbell, HeartPulse } from 'lucide-react'
import {
  startOfMonth, endOfMonth, getDay, getDaysInMonth, addMonths, subMonths,
  subDays, addDays, subYears, addYears, isSameDay, isAfter, isBefore, format, startOfDay,
} from 'date-fns'
import { supabase } from '../lib/supabase'
import { localDateKey } from '../lib/dates'

export interface DaySummary {
  date: string
  totalLogs: number
  weight?: number
  injection?: { medication: string; dose: string; site: string }
  totalCalories: number
  totalProtein: number
  totalWater: number
  exercise: { type: string; duration: number }[]
  sideEffects: string[]
}

interface StreakCalendarProps {
  userId: string
  refreshKey?: number
  showSummaries?: boolean
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LOG_TABLES = ['food_logs', 'weight_logs', 'medication_logs', 'water_logs', 'side_effect_logs', 'exercise_logs'] as const

function heatmapColor(totalLogs: number, isToday: boolean): string {
  const ring = isToday ? ' ring-2 ring-[#7FFFA4]' : ''
  if (totalLogs <= 2) return 'bg-[#1F4B32]/25 text-[#1F4B32]' + ring
  if (totalLogs <= 5) return 'bg-[#1F4B32]/55 text-white' + ring
  return 'bg-[#1F4B32] text-white shadow-[0_2px_8px_-2px_rgba(31,75,50,0.3)]' + ring
}

export default function StreakCalendar({ userId, refreshKey, showSummaries }: StreakCalendarProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id) }, [])
  const today = startOfDay(now)
  const minDate = subYears(today, 5)
  const maxDate = addYears(today, 1)

  const [viewMonth, setViewMonth] = useState(startOfMonth(today))
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set())
  const [daySummaries, setDaySummaries] = useState<Map<string, DaySummary>>(new Map())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showYearPicker, setShowYearPicker] = useState(false)
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1)

  const dayCache = useRef<Record<string, Set<string>>>({})
  const summaryCache = useRef<Record<string, Map<string, DaySummary>>>({})
  const ck = (d: Date) => format(d, 'yyyy-MM')

  // ── Data fetching ────────────────────────────────
  const fetchData = useCallback(async (monthStart: Date) => {
    const key = ck(monthStart)

    if (showSummaries && summaryCache.current[key]) {
      setDaySummaries(summaryCache.current[key])
      setActiveDays(new Set(summaryCache.current[key].keys()))
      return
    }
    if (!showSummaries && dayCache.current[key]) {
      setActiveDays(dayCache.current[key])
      return
    }

    setLoading(true)
    const qStart = subDays(monthStart, 1).toISOString()
    const qEnd = addDays(endOfMonth(monthStart), 1).toISOString()

    if (showSummaries) {
      const [food, weight, meds, water, exercise, effects] = await Promise.all([
        supabase.from('food_logs').select('logged_at, calories, protein').eq('user_id', userId).gte('logged_at', qStart).lt('logged_at', qEnd),
        supabase.from('weight_logs').select('logged_at, weight').eq('user_id', userId).gte('logged_at', qStart).lt('logged_at', qEnd),
        supabase.from('medication_logs').select('logged_at, medication, dose, injection_site').eq('user_id', userId).gte('logged_at', qStart).lt('logged_at', qEnd),
        supabase.from('water_logs').select('logged_at, amount_oz').eq('user_id', userId).gte('logged_at', qStart).lt('logged_at', qEnd),
        supabase.from('exercise_logs').select('logged_at, exercise_type, duration_minutes').eq('user_id', userId).gte('logged_at', qStart).lt('logged_at', qEnd),
        supabase.from('side_effect_logs').select('logged_at, symptom').eq('user_id', userId).gte('logged_at', qStart).lt('logged_at', qEnd),
      ])

      const map = new Map<string, DaySummary>()
      function g(dateKey: string): DaySummary {
        if (!map.has(dateKey)) map.set(dateKey, { date: dateKey, totalLogs: 0, totalCalories: 0, totalProtein: 0, totalWater: 0, exercise: [], sideEffects: [] })
        return map.get(dateKey)!
      }

      for (const r of food.data ?? []) { const d = g(localDateKey(r.logged_at)); d.totalCalories += r.calories ?? 0; d.totalProtein += r.protein ?? 0; d.totalLogs++ }
      for (const r of weight.data ?? []) { const d = g(localDateKey(r.logged_at)); d.weight = r.weight; d.totalLogs++ }
      for (const r of meds.data ?? []) { const d = g(localDateKey(r.logged_at)); d.injection = { medication: r.medication, dose: r.dose, site: r.injection_site ?? '' }; d.totalLogs++ }
      for (const r of water.data ?? []) { const d = g(localDateKey(r.logged_at)); d.totalWater += r.amount_oz; d.totalLogs++ }
      for (const r of exercise.data ?? []) { const d = g(localDateKey(r.logged_at)); d.exercise.push({ type: r.exercise_type, duration: r.duration_minutes }); d.totalLogs++ }
      for (const r of effects.data ?? []) { const d = g(localDateKey(r.logged_at)); d.sideEffects.push(r.symptom); d.totalLogs++ }

      summaryCache.current[key] = map
      setDaySummaries(map)
      setActiveDays(new Set(map.keys()))
    } else {
      const results = await Promise.all(
        LOG_TABLES.map(t => supabase.from(t).select('logged_at').eq('user_id', userId).gte('logged_at', qStart).lt('logged_at', qEnd))
      )
      const days = new Set<string>()
      for (const r of results) for (const row of r.data || []) days.add(localDateKey(row.logged_at))
      dayCache.current[key] = days
      setActiveDays(days)
    }

    setLoading(false)
  }, [userId, showSummaries])

  useEffect(() => { fetchData(viewMonth) }, [viewMonth, fetchData])
  useEffect(() => { dayCache.current = {}; summaryCache.current = {}; fetchData(viewMonth) }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSelectedDay(null) }, [viewMonth])

  // ── Navigation ───────────────────────────────────
  const canGoBack = isAfter(viewMonth, startOfMonth(minDate))
  const canGoForward = isBefore(viewMonth, startOfMonth(maxDate))
  const goBack = () => { if (canGoBack) { setSlideDirection(-1); setViewMonth(prev => subMonths(prev, 1)) } }
  const goForward = () => { if (canGoForward) { setSlideDirection(1); setViewMonth(prev => addMonths(prev, 1)) } }
  const selectYearMonth = (year: number, month: number) => {
    const target = new Date(year, month, 1)
    setSlideDirection(target > viewMonth ? 1 : -1)
    setViewMonth(target)
    setShowYearPicker(false)
  }

  // ── Grid data ────────────────────────────────────
  const firstDayOfWeek = getDay(viewMonth)
  const daysInMonth = getDaysInMonth(viewMonth)
  const monthYear = format(viewMonth, 'MMMM yyyy')
  const minYear = minDate.getFullYear()
  const maxYear = maxDate.getFullYear()
  const [pickerYear, setPickerYear] = useState(viewMonth.getFullYear())
  useEffect(() => { setPickerYear(viewMonth.getFullYear()) }, [viewMonth])

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  }

  // ── Popover content ──────────────────────────────
  const selectedSummary = selectedDay ? daySummaries.get(selectedDay) : null

  return (
    <div className="max-w-[320px] mx-auto">
      {/* Month/year header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={goBack} disabled={!canGoBack} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#EAF2EB] transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronLeft className="w-4 h-4 text-[#1F4B32]" strokeWidth={2} />
        </button>
        <button onClick={() => setShowYearPicker(!showYearPicker)} className="text-sm font-semibold text-[#0D1F16] hover:text-[#1F4B32] transition-colors cursor-pointer" style={{ fontFamily: 'Fraunces, serif' }}>
          {monthYear}
        </button>
        <button onClick={goForward} disabled={!canGoForward} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#EAF2EB] transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronRight className="w-4 h-4 text-[#1F4B32]" strokeWidth={2} />
        </button>
      </div>

      {/* Year picker */}
      <AnimatePresence>
        {showYearPicker && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden mb-3">
            <div className="bg-[#F5F8F3] rounded-2xl p-3 border border-[#EAF2EB]">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setPickerYear(y => Math.max(minYear, y - 1))} disabled={pickerYear <= minYear} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white transition-colors disabled:opacity-20">
                  <ChevronLeft className="w-3.5 h-3.5 text-[#1F4B32]" strokeWidth={2} />
                </button>
                <span className="text-xs font-semibold text-[#0D1F16]">{pickerYear}</span>
                <button onClick={() => setPickerYear(y => Math.min(maxYear, y + 1))} disabled={pickerYear >= maxYear} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white transition-colors disabled:opacity-20">
                  <ChevronRight className="w-3.5 h-3.5 text-[#1F4B32]" strokeWidth={2} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {MONTH_LABELS.map((label, i) => {
                  const target = new Date(pickerYear, i, 1)
                  const isDisabled = isBefore(target, startOfMonth(minDate)) || isAfter(target, startOfMonth(maxDate))
                  const isCurrent = pickerYear === viewMonth.getFullYear() && i === viewMonth.getMonth()
                  return (
                    <button key={label} onClick={() => !isDisabled && selectYearMonth(pickerYear, i)} disabled={isDisabled}
                      className={`py-1.5 rounded-lg text-[11px] font-medium transition-all ${isCurrent ? 'bg-[#1F4B32] text-white' : isDisabled ? 'text-[#6B7A72]/30 cursor-not-allowed' : 'text-[#6B7A72] hover:bg-white hover:text-[#0D1F16]'}`}>{label}</button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {DAY_LABELS.map((d, i) => <div key={i} className="text-center text-[10px] text-[#6B7A72]/60 font-medium">{d}</div>)}
      </div>

      {/* Calendar grid */}
      <AnimatePresence custom={slideDirection} mode="wait">
        <motion.div key={ck(viewMonth)} custom={slideDirection} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`pad-${i}`} />)}

          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day)
            const dateStr = format(date, 'yyyy-MM-dd')
            const summary = daySummaries.get(dateStr)
            const hasData = activeDays.has(dateStr)
            const isToday = isSameDay(date, today)
            const isFuture = isAfter(date, today)
            const isSelected = selectedDay === dateStr

            const cellColor = isFuture
              ? 'text-[#6B7A72]/20'
              : !hasData
                ? (isToday ? 'bg-[#EAF2EB] text-[#1F4B32] ring-2 ring-[#7FFFA4]' : 'bg-[#F5F8F3] text-[#6B7A72]/40')
                : showSummaries && summary
                  ? heatmapColor(summary.totalLogs, isToday)
                  : 'bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] text-white shadow-[0_2px_8px_-2px_rgba(31,75,50,0.3)]'

            const clickable = showSummaries && hasData && !isFuture

            return (
              <button key={day}
                onClick={() => clickable && setSelectedDay(prev => prev === dateStr ? null : dateStr)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-medium transition-all duration-300 ${cellColor}${loading ? ' opacity-50' : ''}${clickable ? ' cursor-pointer hover:scale-110' : ''}${isSelected ? ' ring-2 ring-[#0D1F16]' : ''}`}>
                {day}
              </button>
            )
          })}
        </motion.div>
      </AnimatePresence>

      {/* Day summary card (inline below calendar) */}
      <AnimatePresence mode="wait">
        {selectedSummary && (
          <motion.div key={selectedDay} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="mt-3 bg-white rounded-2xl p-3.5 border border-[#EAF2EB] shadow-lg">
              <p className="text-sm font-semibold text-[#0D1F16] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
                {format(new Date(selectedSummary.date + 'T12:00:00'), 'MMMM d')}
              </p>

              {selectedSummary.weight != null && (
                <div className="flex items-center gap-2 text-xs text-[#0D1F16] py-0.5">
                  <Scale className="w-3.5 h-3.5 text-blue-600 shrink-0" strokeWidth={1.5} />
                  <span>{selectedSummary.weight} lbs</span>
                </div>
              )}
              {selectedSummary.injection && (
                <div className="flex items-center gap-2 text-xs text-[#0D1F16] py-0.5">
                  <Syringe className="w-3.5 h-3.5 text-[#1F4B32] shrink-0" strokeWidth={1.5} />
                  <span>{selectedSummary.injection.dose} {selectedSummary.injection.medication}</span>
                </div>
              )}
              {selectedSummary.totalCalories > 0 && (
                <div className="flex items-center gap-2 text-xs text-[#0D1F16] py-0.5">
                  <Utensils className="w-3.5 h-3.5 text-amber-600 shrink-0" strokeWidth={1.5} />
                  <span>{Math.round(selectedSummary.totalCalories)} cal · {Math.round(selectedSummary.totalProtein)}g protein</span>
                </div>
              )}
              {selectedSummary.totalWater > 0 && (
                <div className="flex items-center gap-2 text-xs text-[#0D1F16] py-0.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-600 shrink-0" strokeWidth={1.5} />
                  <span>{selectedSummary.totalWater}oz water</span>
                </div>
              )}
              {selectedSummary.exercise.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-[#0D1F16] py-0.5">
                  <Dumbbell className="w-3.5 h-3.5 text-purple-600 shrink-0" strokeWidth={1.5} />
                  <span>{selectedSummary.exercise.map(e => `${e.type} ${e.duration}min`).join(', ')}</span>
                </div>
              )}
              {selectedSummary.sideEffects.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-[#0D1F16] py-0.5">
                  <HeartPulse className="w-3.5 h-3.5 text-pink-600 shrink-0" strokeWidth={1.5} />
                  <span>{selectedSummary.sideEffects.join(', ')}</span>
                </div>
              )}

              <div className="border-t border-[#EAF2EB] mt-2 pt-1.5 text-[10px] text-[#6B7A72]">
                {selectedSummary.totalLogs} {selectedSummary.totalLogs === 1 ? 'log' : 'logs'} total
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
