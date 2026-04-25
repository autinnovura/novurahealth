'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { localDateKey } from '../lib/dates'
import StreakCalendar from '../components/StreakCalendar'
import BottomNav from '../components/BottomNav'
import { motion } from 'framer-motion'
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts'
import { format, subDays, startOfDay, differenceInDays } from 'date-fns'
import ChartTooltip from '../components/ui/ChartTooltip'
import {
  ArrowLeft, Flame, Trophy, Calendar, Syringe, Scale,
  Utensils, Droplets, Dumbbell, Stethoscope, Star, Check,
  TrendingUp, Award
} from 'lucide-react'

// ── Types ──────────────────────────────────────────
interface WeightLog { id: string; weight: number; logged_at: string }
interface FoodLog { id: string; calories: number; protein: number; logged_at: string }
interface MedLog { id: string; medication: string; dose: string; injection_site: string; logged_at: string }
interface Milestone { id: string; label: string; icon: any; earned: boolean; earnedDate?: string; progress?: number; progressLabel?: string }

// ── Helpers ──────────────────────────────────────
function addDaysHelper(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } } }

// ── Streak Computation ──────────────────────────
function computeStreakFromDates(uniqueDays: number[]): { current: number; longest: number; hasLoggedToday: boolean } {
  if (uniqueDays.length === 0) return { current: 0, longest: 0, hasLoggedToday: false }

  const todayTs = startOfDay(new Date()).getTime()
  const yesterdayTs = startOfDay(subDays(new Date(), 1)).getTime()

  const hasLoggedToday = uniqueDays[0] === todayTs

  let current = 0
  let checkDay = hasLoggedToday ? todayTs : yesterdayTs

  for (const day of uniqueDays) {
    if (day === checkDay) {
      current++
      checkDay = startOfDay(subDays(new Date(checkDay), 1)).getTime()
    } else if (day < checkDay) {
      break
    }
  }

  let longest = 0
  let run = 1
  for (let i = 1; i < uniqueDays.length; i++) {
    const diff = differenceInDays(new Date(uniqueDays[i - 1]), new Date(uniqueDays[i]))
    if (diff === 1) {
      run++
      longest = Math.max(longest, run)
    } else {
      run = 1
    }
  }
  longest = Math.max(longest, current)

  return { current, longest, hasLoggedToday }
}

export default function StatsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  // Streak
  const [streakData, setStreakData] = useState({ current: 0, longest: 0, hasLoggedToday: false })

  // Weight
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [weightRange, setWeightRange] = useState<'30d' | '90d' | '1y' | 'all'>('90d')

  // Macros
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([])

  // Medication
  const [medLogs, setMedLogs] = useState<MedLog[]>([])

  // Milestones
  const [milestones, setMilestones] = useState<Milestone[]>([])

  // Total log count for empty state
  const [totalLogs, setTotalLogs] = useState(0)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setProfile(p)

      const yearAgo = subDays(new Date(), 365).toISOString()

      const [weights, foods, meds, waterCount, exerciseCount, sideEffectCount] = await Promise.all([
        supabase.from('weight_logs').select('id, weight, logged_at').eq('user_id', user.id).order('logged_at', { ascending: true }),
        supabase.from('food_logs').select('id, calories, protein, logged_at').eq('user_id', user.id).gte('logged_at', subDays(new Date(), 30).toISOString()).order('logged_at', { ascending: true }),
        supabase.from('medication_logs').select('id, medication, dose, injection_site, logged_at').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(50),
        supabase.from('water_logs').select('logged_at').eq('user_id', user.id).gte('logged_at', yearAgo),
        supabase.from('exercise_logs').select('logged_at').eq('user_id', user.id).gte('logged_at', yearAgo),
        supabase.from('side_effect_logs').select('logged_at').eq('user_id', user.id).gte('logged_at', yearAgo),
      ])

      setWeightLogs(weights.data || [])
      setFoodLogs(foods.data || [])
      setMedLogs(meds.data || [])

      // Compute total logs for empty state
      const total = (weights.data?.length || 0) + (foods.data?.length || 0) + (meds.data?.length || 0) + (waterCount.data?.length || 0) + (exerciseCount.data?.length || 0) + (sideEffectCount.data?.length || 0)
      setTotalLogs(total)

      // Compute streak from all log dates
      const allLogDates: Date[] = [
        ...(weights.data || []).map(r => new Date(r.logged_at)),
        ...(foods.data || []).map(r => new Date(r.logged_at)),
        ...(meds.data || []).map(r => new Date(r.logged_at)),
        ...(waterCount.data || []).map(r => new Date(r.logged_at)),
        ...(exerciseCount.data || []).map(r => new Date(r.logged_at)),
        ...(sideEffectCount.data || []).map(r => new Date(r.logged_at)),
      ]
      const uniqueDays = Array.from(new Set(allLogDates.map(d => startOfDay(d).getTime()))).sort((a, b) => b - a)
      setStreakData(computeStreakFromDates(uniqueDays))

      // Compute milestones
      const allDates = allLogDates.sort((a, b) => a.getTime() - b.getTime())
      const firstLogDate = allDates[0]
      const startWeight = p.current_weight ? parseFloat(p.current_weight) : null
      const latestWeight = weights.data?.length ? weights.data[weights.data.length - 1].weight : null
      const weightLost = startWeight && latestWeight ? startWeight - latestWeight : 0
      const firstMed = meds.data?.length ? meds.data[meds.data.length - 1] : null

      // Check if any 7-consecutive-day streak ever happened
      const streak7 = computeStreakFromDates(uniqueDays).longest >= 7
      const streak30 = computeStreakFromDates(uniqueDays).longest >= 30

      // Consistent week: any calendar week with all 7 days logged
      let hasConsistentWeek = false
      const daySet = new Set(uniqueDays.map(d => localDateKey(new Date(d))))
      const today = new Date()
      for (let w = 0; w < 52; w++) {
        const weekStart = addDaysHelper(today, -((today.getDay()) + w * 7))
        weekStart.setHours(0, 0, 0, 0)
        let allSeven = true
        for (let d = 0; d < 7; d++) {
          if (!daySet.has(localDateKey(addDaysHelper(weekStart, d)))) { allSeven = false; break }
        }
        if (allSeven) { hasConsistentWeek = true; break }
      }

      setMilestones([
        {
          id: 'first_log', label: 'First Log', icon: Star,
          earned: !!firstLogDate,
          earnedDate: firstLogDate ? format(firstLogDate, 'MMM d, yyyy') : undefined,
        },
        {
          id: 'streak_7', label: '7-Day Streak', icon: Flame,
          earned: streak7,
          progress: streak7 ? undefined : Math.min(100, Math.round((computeStreakFromDates(uniqueDays).longest / 7) * 100)),
          progressLabel: streak7 ? undefined : `${computeStreakFromDates(uniqueDays).longest}/7 days`,
        },
        {
          id: 'streak_30', label: '30-Day Streak', icon: Award,
          earned: streak30,
          progress: streak30 ? undefined : Math.min(100, Math.round((computeStreakFromDates(uniqueDays).longest / 30) * 100)),
          progressLabel: streak30 ? undefined : `${computeStreakFromDates(uniqueDays).longest}/30 days`,
        },
        {
          id: 'weight_10', label: '10 lbs Lost', icon: Scale,
          earned: weightLost >= 10,
          progress: weightLost >= 10 ? undefined : Math.min(100, Math.round((weightLost / 10) * 100)),
          progressLabel: weightLost >= 10 ? undefined : `${Math.round(weightLost * 10) / 10}/10 lbs`,
        },
        {
          id: 'first_injection', label: 'First Injection', icon: Syringe,
          earned: !!firstMed,
          earnedDate: firstMed ? format(new Date(firstMed.logged_at), 'MMM d, yyyy') : undefined,
        },
        {
          id: 'logs_100', label: '100 Logs', icon: Trophy,
          earned: total >= 100,
          progress: total >= 100 ? undefined : Math.min(100, Math.round((total / 100) * 100)),
          progressLabel: total >= 100 ? undefined : `${total}/100`,
        },
        {
          id: 'consistent_week', label: 'Consistent Week', icon: Calendar,
          earned: hasConsistentWeek,
        },
      ])

      setLoading(false)
    }
    init()
  }, [router])

  // ── Weight chart data ──────────────────────────
  const weightChartData = (() => {
    const now = new Date()
    const cutoff = weightRange === '30d' ? subDays(now, 30)
      : weightRange === '90d' ? subDays(now, 90)
      : weightRange === '1y' ? subDays(now, 365)
      : null
    const filtered = cutoff ? weightLogs.filter(w => new Date(w.logged_at) >= cutoff) : weightLogs
    return filtered.map(w => ({
      weight: w.weight,
      date: w.logged_at,
      label: format(new Date(w.logged_at), 'MMM d'),
    }))
  })()

  const startWeight = profile?.current_weight ? parseFloat(profile.current_weight) : null
  const goalWeight = profile?.goal_weight ? parseFloat(profile.goal_weight) : null

  // ── Macro chart data (daily aggregates, last 30d) ──
  const macroChartData = (() => {
    const grouped: Record<string, { protein: number; calories: number }> = {}
    for (const f of foodLogs) {
      const key = localDateKey(f.logged_at)
      if (!grouped[key]) grouped[key] = { protein: 0, calories: 0 }
      grouped[key].protein += f.protein || 0
      grouped[key].calories += f.calories || 0
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date,
        label: format(new Date(date), 'MMM d'),
        protein: vals.protein,
        calories: vals.calories,
      }))
  })()

  if (loading) return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="space-y-4 w-full max-w-md px-6">
        <div className="h-32 rounded-3xl bg-gradient-to-r from-[#EAF2EB] via-[#F5F8F3] to-[#EAF2EB] animate-pulse" />
        <div className="h-48 rounded-3xl bg-[#EAF2EB]/60 animate-pulse" />
        <div className="h-40 rounded-3xl bg-gradient-to-r from-[#EAF2EB] via-[#F5F8F3] to-[#EAF2EB] animate-pulse" />
      </div>
    </div>
  )

  // Empty state
  if (totalLogs === 0) return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col" style={{ fontFamily: 'var(--font-inter)', paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
      <header className="bg-gradient-to-br from-[#1F4B32] via-[#2D6B45] to-[#1F4B32] px-5 py-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-white/60 hover:text-white transition-all duration-300 cursor-pointer">
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <h1 className="text-white font-semibold text-xl tracking-tight" style={{ fontFamily: 'var(--font-fraunces)' }}>Your Journey</h1>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-3xl font-semibold text-[#0D1F16] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>Your journey starts here</h2>
          <p className="text-[#6B7A72] mb-6 max-w-sm mx-auto text-sm leading-relaxed">
            Log your first weight, meal, or injection and your stats will start taking shape.
          </p>
          <Link href="/dashboard"
            className="inline-block bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white rounded-full px-6 py-3 font-semibold hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.4)] transition-all duration-300">
            Start tracking
          </Link>
        </div>
      </div>
      <BottomNav />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ fontFamily: 'var(--font-inter)', paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <header className="bg-gradient-to-br from-[#1F4B32] via-[#2D6B45] to-[#1F4B32] px-5 py-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-white/60 hover:text-white transition-all duration-300 cursor-pointer">
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <h1 className="text-white font-semibold text-xl tracking-tight" style={{ fontFamily: 'var(--font-fraunces)' }}>Your Journey</h1>
        </div>
      </header>

      <motion.div className="max-w-2xl mx-auto px-4 py-5 space-y-4" initial="hidden" animate="visible" variants={stagger}>

        {/* ── STREAK HERO ── */}
        <motion.div variants={fadeUp} className="bg-white rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB] text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFF4E5] to-[#FFE4C4] flex items-center justify-center mx-auto mb-3">
            <Flame className="w-8 h-8 text-[#C4742B]" />
          </div>
          {streakData.current > 0 ? (
            <>
              <p className="text-[56px] font-bold text-[#0D1F16] leading-none tracking-[-0.02em]" style={{ fontFamily: 'var(--font-fraunces)', fontVariantNumeric: 'tabular-nums' }}>
                {streakData.current}
              </p>
              <p className="text-sm text-[#6B7A72] mt-1">day streak</p>
              {streakData.longest > streakData.current && (
                <p className="text-xs text-[#6B7A72]/60 mt-2">Longest ever: {streakData.longest} days</p>
              )}
              {!streakData.hasLoggedToday && (
                <Link href="/dashboard" className="inline-block mt-4 bg-gradient-to-r from-[#FFF4E5] to-[#FFE4C4] text-[#C4742B] px-4 py-2 rounded-full text-xs font-semibold hover:shadow-sm transition-all duration-300">
                  Log today to keep it going
                </Link>
              )}
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-[#0D1F16] mt-1">Start a new streak today</p>
              <p className="text-xs text-[#6B7A72] mt-1">
                {streakData.longest > 0 ? `Your best: ${streakData.longest} days` : 'Log something to begin'}
              </p>
              <Link href="/dashboard" className="inline-block mt-4 bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white px-5 py-2.5 rounded-full text-xs font-semibold hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300">
                Log something
              </Link>
            </>
          )}
        </motion.div>

        {/* ── STREAK CALENDAR ── */}
        <motion.div variants={fadeUp} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
          <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-3">Activity Calendar</p>
          {userId && <StreakCalendar userId={userId} refreshKey={0} showSummaries />}
        </motion.div>

        {/* ── WEIGHT TREND ── */}
        {weightLogs.length >= 2 && (
          <motion.div variants={fadeUp} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-[#0D1F16]">Weight Trend</p>
              <div className="flex gap-1">
                {(['30d', '90d', '1y', 'all'] as const).map(r => (
                  <button key={r} onClick={() => setWeightRange(r)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all duration-300 ${weightRange === r ? 'bg-[#EAF2EB] text-[#1F4B32]' : 'text-[#6B7A72]/40 hover:text-[#6B7A72]'}`}>
                    {r === 'all' ? 'All' : r}
                  </button>
                ))}
              </div>
            </div>
            {/* Reference weights */}
            <div className="flex gap-4 text-[10px] text-[#6B7A72] mb-3">
              {startWeight && <span>Start: {startWeight} lbs</span>}
              <span>Current: {weightLogs[weightLogs.length - 1].weight} lbs</span>
              {goalWeight && <span>Goal: {goalWeight} lbs</span>}
            </div>
            {weightChartData.length >= 2 ? (
              <div className="h-40 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightChartData}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7FFFA4" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#7FFFA4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip
                      content={
                        <ChartTooltip>
                          {(data) => (
                            <>
                              <div className="text-xs text-[#6B7A72] mb-1">{data.date ? format(new Date(data.date as string), 'MMM d, yyyy') : ''}</div>
                              <div className="text-xl font-bold tabular-nums text-[#1F4B32]">{data.weight as number}<span className="text-sm text-[#6B7A72] ml-1">lbs</span></div>
                            </>
                          )}
                        </ChartTooltip>
                      }
                      cursor={{ stroke: '#7FFFA4', strokeWidth: 1, strokeDasharray: '3 3' }}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Area type="monotone" dataKey="weight" stroke="#1F4B32" strokeWidth={2} fill="url(#weightGrad)" dot={false} activeDot={{ r: 5, fill: '#7FFFA4', stroke: '#1F4B32', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-[#6B7A72] text-center py-6">Not enough data for this range</p>
            )}
          </motion.div>
        )}

        {/* ── MACRO TRENDS (30d) ── */}
        {macroChartData.length >= 3 && (
          <motion.div variants={fadeUp} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
            <p className="text-sm font-semibold text-[#0D1F16] mb-1">Nutrition (30 days)</p>
            <div className="flex gap-4 text-[10px] text-[#6B7A72] mb-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#1F4B32]" /> Protein (g)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C4742B]/40" /> Calories (/10)</span>
            </div>
            <div className="h-36 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={macroChartData} barGap={0} barCategoryGap="20%">
                  <YAxis hide />
                  <Tooltip
                    content={
                      <ChartTooltip>
                        {(data) => (
                          <>
                            <div className="text-xs text-[#6B7A72] mb-1">{data.label as string}</div>
                            <div className="text-sm"><span className="font-bold text-[#1F4B32]">{data.protein as number}g</span> protein</div>
                            <div className="text-sm"><span className="font-bold text-[#C4742B]">{data.calories as number}</span> cal</div>
                          </>
                        )}
                      </ChartTooltip>
                    }
                    cursor={{ fill: 'rgba(31,75,50,0.04)' }}
                    wrapperStyle={{ outline: 'none' }}
                  />
                  <Bar dataKey="protein" fill="#1F4B32" radius={[3, 3, 0, 0]} />
                  <Bar dataKey={(d: any) => Math.round(d.calories / 10)} fill="#C4742B" fillOpacity={0.3} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* ── MEDICATION HISTORY ── */}
        {medLogs.length > 0 && (
          <motion.div variants={fadeUp} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
            <p className="text-sm font-semibold text-[#0D1F16] mb-4">Medication History</p>
            <div className="relative">
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[#EAF2EB]" />
              <div className="space-y-3">
                {medLogs.slice(0, 20).map((m, i) => {
                  const prevDose = i < medLogs.length - 1 ? medLogs[i + 1].dose : null
                  const doseChanged = prevDose && prevDose !== m.dose
                  return (
                    <div key={m.id} className="flex items-start gap-3 relative">
                      <div className={`w-[31px] h-[31px] rounded-full flex items-center justify-center z-10 shrink-0 border-2 border-white ${
                        doseChanged ? 'bg-[#7FFFA4]' : 'bg-[#F5F8F3]'
                      }`}>
                        <Syringe className={`w-3.5 h-3.5 ${doseChanged ? 'text-[#1F4B32]' : 'text-[#6B7A72]'}`} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#0D1F16] font-medium">{m.dose}</span>
                          {doseChanged && <span className="text-[9px] font-bold text-[#1F4B32] bg-[#EAF2EB] px-1.5 py-0.5 rounded uppercase">dose change</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#6B7A72]">
                          <span>{format(new Date(m.logged_at), 'MMM d, yyyy')}</span>
                          {m.injection_site && <span>· {m.injection_site}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── MILESTONES ── */}
        <motion.div variants={fadeUp} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
          <p className="text-sm font-semibold text-[#0D1F16] mb-4">Milestones</p>
          <div className="grid grid-cols-2 gap-3">
            {milestones.map(m => (
              <div key={m.id} className={`rounded-2xl p-4 ${m.earned ? 'bg-[#EAF2EB]' : 'bg-[#F5F8F3]'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${m.earned ? 'bg-gradient-to-br from-[#1F4B32] to-[#2D6B45]' : 'bg-[#EAF2EB]'}`}>
                    <m.icon className={`w-4 h-4 ${m.earned ? 'text-[#7FFFA4]' : 'text-[#6B7A72]/40'}`} strokeWidth={1.5} />
                  </div>
                  {m.earned && <Check className="w-3.5 h-3.5 text-[#1F4B32]" strokeWidth={2.5} />}
                </div>
                <p className={`text-xs font-semibold ${m.earned ? 'text-[#1F4B32]' : 'text-[#6B7A72]/60'}`}>{m.label}</p>
                {m.earned && m.earnedDate && (
                  <p className="text-[10px] text-[#1F4B32]/60 mt-0.5">{m.earnedDate}</p>
                )}
                {!m.earned && m.progress !== undefined && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-[#6B7A72]/30 rounded-full transition-all duration-500" style={{ width: `${m.progress}%` }} />
                    </div>
                    {m.progressLabel && <p className="text-[9px] text-[#6B7A72]/40 mt-1">{m.progressLabel}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

      </motion.div>
      <BottomNav />
    </div>
  )
}
