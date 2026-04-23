'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfMonth, endOfMonth, getDay, getDaysInMonth, addMonths, subMonths,
  subDays, addDays, subYears, addYears, isSameDay, isAfter, isBefore, format, startOfDay,
} from 'date-fns'
import { supabase } from '../lib/supabase'
import { localDateKey } from '../lib/dates'

interface StreakCalendarProps {
  userId: string
  refreshKey?: number
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// All log tables to check for activity
const LOG_TABLES = [
  'food_logs',
  'weight_logs',
  'medication_logs',
  'water_logs',
  'side_effect_logs',
  'exercise_logs',
] as const

export default function StreakCalendar({ userId, refreshKey }: StreakCalendarProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const today = startOfDay(now)
  const minDate = subYears(today, 5)
  const maxDate = addYears(today, 1)

  const [viewMonth, setViewMonth] = useState(startOfMonth(today))
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [showYearPicker, setShowYearPicker] = useState(false)
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1)

  // Cache fetched months to avoid re-fetching
  const cache = useRef<Record<string, Set<string>>>({})

  const cacheKey = (d: Date) => format(d, 'yyyy-MM')

  const fetchMonth = useCallback(async (monthStart: Date) => {
    const key = cacheKey(monthStart)
    if (cache.current[key]) {
      setActiveDays(cache.current[key])
      return
    }

    setLoading(true)
    const queryStart = subDays(monthStart, 1).toISOString()
    const queryEnd = addDays(endOfMonth(monthStart), 1).toISOString()

    // Query all log tables in parallel for logged_at values in this month
    const queries = LOG_TABLES.map(table =>
      supabase
        .from(table)
        .select('logged_at')
        .eq('user_id', userId)
        .gte('logged_at', queryStart)
        .lt('logged_at', queryEnd)
    )

    const results = await Promise.all(queries)

    const days = new Set<string>()
    for (const result of results) {
      for (const row of result.data || []) {
        days.add(localDateKey(row.logged_at))
      }
    }

    cache.current[key] = days
    setActiveDays(days)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchMonth(viewMonth)
  }, [viewMonth, fetchMonth])

  // H-13: Clear cache and re-fetch when refreshKey changes
  useEffect(() => {
    cache.current = {}
    fetchMonth(viewMonth)
  }, [refreshKey])  // eslint-disable-line react-hooks/exhaustive-deps

  const canGoBack = isAfter(viewMonth, startOfMonth(minDate))
  const canGoForward = isBefore(viewMonth, startOfMonth(maxDate))

  const goBack = () => {
    if (!canGoBack) return
    setSlideDirection(-1)
    setViewMonth(prev => subMonths(prev, 1))
  }

  const goForward = () => {
    if (!canGoForward) return
    setSlideDirection(1)
    setViewMonth(prev => addMonths(prev, 1))
  }

  const selectYearMonth = (year: number, month: number) => {
    const target = new Date(year, month, 1)
    setSlideDirection(target > viewMonth ? 1 : -1)
    setViewMonth(target)
    setShowYearPicker(false)
  }

  // Build the calendar grid
  const firstDayOfWeek = getDay(viewMonth)
  const daysInMonth = getDaysInMonth(viewMonth)
  const monthYear = format(viewMonth, 'MMMM yyyy')

  // Year picker range
  const minYear = minDate.getFullYear()
  const maxYear = maxDate.getFullYear()
  const [pickerYear, setPickerYear] = useState(viewMonth.getFullYear())

  useEffect(() => {
    setPickerYear(viewMonth.getFullYear())
  }, [viewMonth])

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  }

  return (
    <div className="max-w-[320px] mx-auto">
      {/* Month/year header with nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#EAF2EB] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4 text-[#1F4B32]" strokeWidth={2} />
        </button>

        <button
          onClick={() => setShowYearPicker(!showYearPicker)}
          className="text-sm font-semibold text-[#0D1F16] hover:text-[#1F4B32] transition-colors cursor-pointer"
          style={{ fontFamily: 'Fraunces, serif' }}
        >
          {monthYear}
        </button>

        <button
          onClick={goForward}
          disabled={!canGoForward}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#EAF2EB] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4 text-[#1F4B32]" strokeWidth={2} />
        </button>
      </div>

      {/* Year picker overlay */}
      <AnimatePresence>
        {showYearPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden mb-3"
          >
            <div className="bg-[#F5F8F3] rounded-2xl p-3 border border-[#EAF2EB]">
              {/* Year nav */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setPickerYear(y => Math.max(minYear, y - 1))}
                  disabled={pickerYear <= minYear}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white transition-colors disabled:opacity-20"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-[#1F4B32]" strokeWidth={2} />
                </button>
                <span className="text-xs font-semibold text-[#0D1F16]">{pickerYear}</span>
                <button
                  onClick={() => setPickerYear(y => Math.min(maxYear, y + 1))}
                  disabled={pickerYear >= maxYear}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white transition-colors disabled:opacity-20"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-[#1F4B32]" strokeWidth={2} />
                </button>
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-4 gap-1.5">
                {MONTH_LABELS.map((label, i) => {
                  const target = new Date(pickerYear, i, 1)
                  const isDisabled = isBefore(target, startOfMonth(minDate)) || isAfter(target, startOfMonth(maxDate))
                  const isCurrent = pickerYear === viewMonth.getFullYear() && i === viewMonth.getMonth()

                  return (
                    <button
                      key={label}
                      onClick={() => !isDisabled && selectYearMonth(pickerYear, i)}
                      disabled={isDisabled}
                      className={`py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        isCurrent
                          ? 'bg-[#1F4B32] text-white'
                          : isDisabled
                          ? 'text-[#6B7A72]/30 cursor-not-allowed'
                          : 'text-[#6B7A72] hover:bg-white hover:text-[#0D1F16]'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-[10px] text-[#6B7A72]/60 font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid with slide animation */}
      <AnimatePresence custom={slideDirection} mode="wait">
        <motion.div
          key={cacheKey(viewMonth)}
          custom={slideDirection}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-7 gap-1.5"
        >
          {/* Padding for first day */}
          {Array.from({ length: firstDayOfWeek }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day)
            const dateStr = format(date, 'yyyy-MM-dd')
            const hasData = activeDays.has(dateStr)
            const isToday = isSameDay(date, today)
            const isFuture = isAfter(date, today)

            return (
              <div
                key={day}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-medium transition-all duration-300 ${
                  isFuture
                    ? 'text-[#6B7A72]/20'
                    : hasData
                    ? 'bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] text-white shadow-[0_2px_8px_-2px_rgba(31,75,50,0.3)]'
                    : isToday
                    ? 'bg-[#EAF2EB] text-[#1F4B32] ring-2 ring-[#7FFFA4]'
                    : 'bg-[#F5F8F3] text-[#6B7A72]/40'
                }${loading ? ' opacity-50' : ''}`}
              >
                {day}
              </div>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
