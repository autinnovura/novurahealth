'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

// ── Types ──────────────────────────────────────────────
interface Profile { name: string; medication: string; dose: string; start_date: string; current_weight: string; goal_weight: string; primary_goal: string; biggest_challenge: string; exercise_level: string }
interface MedLog { id: string; medication: string; dose: string; injection_site: string; notes: string; logged_at: string }
interface WeightLog { id: string; weight: number; logged_at: string }
interface SideEffectLog { id: string; symptom: string; severity: number; logged_at: string }
interface FoodLog { id: string; meal_type: string; food_name: string; calories: number; protein: number; carbs: number; fat: number; logged_at: string }
interface WaterLog { id: string; amount_oz: number; logged_at: string }
interface CheckinLog { id: string; mood: number; energy: number; notes: string; logged_at: string }
interface ExerciseLog { id: string; exercise_type: string; duration_minutes: number; notes: string; logged_at: string }

// ── Constants ──────────────────────────────────────────
const INJECTION_SITES = ['Left abdomen', 'Right abdomen', 'Left thigh', 'Right thigh', 'Left arm', 'Right arm']
const SYMPTOMS = ['Nausea', 'Constipation', 'Diarrhea', 'Fatigue', 'Headache', 'Heartburn', 'Sulfur burps', 'Injection site pain', 'Loss of appetite', 'Dizziness']
const WATER_AMOUNTS = [8, 16, 24, 32]
const EXERCISE_TYPES = ['Walking', 'Running', 'Weight training', 'Yoga', 'Swimming', 'Cycling', 'HIIT', 'Stretching', 'Other']
const MOOD_LABELS = ['Rough', 'Low', 'Okay', 'Good', 'Great']
const ENERGY_LABELS = ['Exhausted', 'Low', 'Moderate', 'High', 'Energized']

// ── Helpers ────────────────────────────────────────────
function formatTime(d: string) { return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }
function formatDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function formatDateFull(d: string) { return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }
function isSameDay(d1: Date, d2: Date) { return d1.toISOString().split('T')[0] === d2.toISOString().split('T')[0] }
function startOfDay(d: Date) { const n = new Date(d); n.setHours(0,0,0,0); return n }
function endOfDay(d: Date) { const n = new Date(d); n.setHours(23,59,59,999); return n }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfWeek(d: Date) { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r }
function isToday(d: Date) { return isSameDay(d, new Date()) }

// ── Weight Line Graph ──────────────────────────────────
function WeightGraph({ data, goalWeight }: { data: WeightLog[]; goalWeight: number | null }) {
  if (data.length < 2) return null
  const sorted = [...data].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
  const weights = sorted.map(d => d.weight)
  const allVals = goalWeight ? [...weights, goalWeight] : weights
  const min = Math.min(...allVals) - 2, max = Math.max(...allVals) + 2, range = max - min || 1
  const w = 500, h = 160, px = 40, py = 20, gw = w - px * 2, gh = h - py * 2

  const pts = sorted.map((d, i) => ({
    x: px + (i / (sorted.length - 1)) * gw,
    y: py + gh - ((d.weight - min) / range) * gh,
    weight: d.weight, date: formatDate(d.logged_at),
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area = line + ` L${pts[pts.length-1].x},${py+gh} L${pts[0].x},${py+gh} Z`
  const goalY = goalWeight ? py + gh - ((goalWeight - min) / range) * gh : null

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: '180px' }}>
      <defs><linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2D5A3D" stopOpacity="0.15"/><stop offset="100%" stopColor="#2D5A3D" stopOpacity="0"/></linearGradient></defs>
      {[0,.25,.5,.75,1].map((pct,i) => { const y=py+gh*(1-pct); return <g key={i}><line x1={px} y1={y} x2={w-px} y2={y} stroke="#E5E5E0" strokeWidth="0.5"/><text x={px-6} y={y+4} textAnchor="end" fill="#9B9B93" fontSize="9" fontFamily="system-ui">{Math.round(min+range*pct)}</text></g> })}
      {goalY!==null&&goalY>=py&&goalY<=py+gh&&<g><line x1={px} y1={goalY} x2={w-px} y2={goalY} stroke="#C4742B" strokeWidth="1" strokeDasharray="6,4"/><text x={w-px+4} y={goalY+3} fill="#C4742B" fontSize="9" fontFamily="system-ui">Goal</text></g>}
      <path d={area} fill="url(#aGrad)"/><path d={line} fill="none" stroke="#2D5A3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i) => <g key={i}><circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#2D5A3D" strokeWidth="2"/>
        {(i===0||i===pts.length-1||pts.length<=6)&&<text x={p.x} y={p.y-10} textAnchor="middle" fill="#1E1E1C" fontSize="9" fontWeight="600" fontFamily="system-ui">{p.weight}</text>}
        {(i===0||i===pts.length-1)&&<text x={p.x} y={py+gh+14} textAnchor="middle" fill="#9B9B93" fontSize="8" fontFamily="system-ui">{p.date}</text>}
      </g>)}
    </svg>
  )
}

// ── Streak Calendar ────────────────────────────────────
function StreakCalendar({ foodLogs }: { foodLogs: FoodLog[] }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const logDates = new Set(foodLogs.map(f => f.logged_at.split('T')[0]))

  return (
    <div className="max-w-[280px] mx-auto">
      <p className="text-xs font-semibold text-[#6B6B65] text-center mb-2">{today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      <div className="grid grid-cols-7 gap-1.5">
        {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="text-center text-[10px] text-[#B0B0A8] font-medium">{d}</div>)}
        {Array.from({ length: firstDay }, (_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const date = new Date(year, month, day)
          const dateStr = date.toISOString().split('T')[0]
          const hasData = logDates.has(dateStr)
          const isTodayDate = day === today.getDate()
          const isFuture = date > today
          return (
            <div key={day} className={`w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-medium ${
              isFuture ? 'text-[#E0E0DC]' :
              hasData ? 'bg-[#2D5A3D] text-white' :
              isTodayDate ? 'bg-[#E8F0EB] text-[#2D5A3D] border border-[#2D5A3D]/30' :
              'bg-[#F5F5F2] text-[#C5C5BE]'
            }`}>{day}</div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [medLogs, setMedLogs] = useState<MedLog[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [sideEffectLogs, setSideEffectLogs] = useState<SideEffectLog[]>([])
  const [todayFoodLogs, setTodayFoodLogs] = useState<FoodLog[]>([])
  const [allFoodLogs, setAllFoodLogs] = useState<FoodLog[]>([])
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([])
  const [checkinLogs, setCheckinLogs] = useState<CheckinLog[]>([])
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'nutrition' | 'health'>('overview')

  // Date navigation for nutrition tab
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [nutritionView, setNutritionView] = useState<'day' | 'week' | 'month'>('day')
  const [dateFoodLogs, setDateFoodLogs] = useState<FoodLog[]>([])
  const [dateWaterLogs, setDateWaterLogs] = useState<WaterLog[]>([])

  // Modals
  const [modal, setModal] = useState<'food' | 'med' | 'weight' | 'sideEffect' | 'checkin' | 'exercise' | null>(null)

  // Form states
  const [injectionSite, setInjectionSite] = useState('')
  const [medNotes, setMedNotes] = useState('')
  const [newWeight, setNewWeight] = useState('')
  const [symptom, setSymptom] = useState('')
  const [severity, setSeverity] = useState(3)
  const [mealType, setMealType] = useState('breakfast')
  const [foodName, setFoodName] = useState('')
  const [foodCalories, setFoodCalories] = useState('')
  const [foodProtein, setFoodProtein] = useState('')
  const [foodCarbs, setFoodCarbs] = useState('')
  const [foodFat, setFoodFat] = useState('')
  const [isCalculating, setIsCalculating] = useState(false)
  const [checkinMood, setCheckinMood] = useState(3)
  const [checkinEnergy, setCheckinEnergy] = useState(3)
  const [checkinNotes, setCheckinNotes] = useState('')
  const [exerciseType, setExerciseType] = useState('')
  const [exerciseDuration, setExerciseDuration] = useState('')
  const [exerciseNotes, setExerciseNotes] = useState('')
  const [streak, setStreak] = useState(0)

  const calculateStreak = useCallback((foods: FoodLog[]) => {
    const today = new Date(); today.setHours(0,0,0,0)
    let count = 0
    for (let i = 0; i < 60; i++) {
      const d = addDays(today, -i)
      const ds = d.toISOString().split('T')[0]
      const has = foods.some(f => f.logged_at.startsWith(ds))
      if (i === 0 && !has) continue
      if (has) count++; else break
    }
    return count
  }, [])

  // Fetch data for selected date range
  const fetchDateData = useCallback(async (uid: string, date: Date, view: 'day' | 'week' | 'month') => {
    let start: Date, end: Date
    if (view === 'day') {
      start = startOfDay(date); end = endOfDay(date)
    } else if (view === 'week') {
      start = startOfWeek(date); end = endOfDay(addDays(start, 6))
    } else {
      start = new Date(date.getFullYear(), date.getMonth(), 1)
      end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
    }

    const [foods, water] = await Promise.all([
      supabase.from('food_logs').select('*').eq('user_id', uid).gte('logged_at', start.toISOString()).lte('logged_at', end.toISOString()).order('logged_at', { ascending: true }),
      supabase.from('water_logs').select('*').eq('user_id', uid).gte('logged_at', start.toISOString()).lte('logged_at', end.toISOString()),
    ])
    setDateFoodLogs(foods.data || [])
    setDateWaterLogs(water.data || [])
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setProfile(p)

      const today = startOfDay(new Date())
      const monthAgo = addDays(today, -30)

      const [meds, weights, effects, todayFoods, monthFoods, water, checkins, exercises] = await Promise.all([
        supabase.from('medication_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(20),
        supabase.from('weight_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(30),
        supabase.from('side_effect_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10),
        supabase.from('food_logs').select('*').eq('user_id', user.id).gte('logged_at', today.toISOString()).order('logged_at', { ascending: true }),
        supabase.from('food_logs').select('*').eq('user_id', user.id).gte('logged_at', monthAgo.toISOString()).order('logged_at', { ascending: true }),
        supabase.from('water_logs').select('*').eq('user_id', user.id).gte('logged_at', today.toISOString()),
        supabase.from('checkin_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(7),
        supabase.from('exercise_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10),
      ])

      setMedLogs(meds.data || [])
      setWeightLogs(weights.data || [])
      setSideEffectLogs(effects.data || [])
      setTodayFoodLogs(todayFoods.data || [])
      setAllFoodLogs(monthFoods.data || [])
      setWaterLogs(water.data || [])
      setDateFoodLogs(todayFoods.data || [])
      setDateWaterLogs(water.data || [])
      setCheckinLogs(checkins.data || [])
      setExerciseLogs(exercises.data || [])
      setStreak(calculateStreak(monthFoods.data || []))
      setLoading(false)
    }
    init()
  }, [router, calculateStreak])

  // Refetch when date or view changes
  useEffect(() => {
    if (userId) fetchDateData(userId, selectedDate, nutritionView)
  }, [userId, selectedDate, nutritionView, fetchDateData])

  // ── Log Functions ──────────────────────────────────
  async function calculateMacros() {
    if (!foodName.trim()) return
    setIsCalculating(true)
    try {
      const res = await fetch('/api/food-lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ food: foodName }) })
      const data = await res.json()
      setFoodCalories(String(data.calories||0)); setFoodProtein(String(data.protein||0)); setFoodCarbs(String(data.carbs||0)); setFoodFat(String(data.fat||0))
    } catch { /* silent */ } finally { setIsCalculating(false) }
  }

  async function logFood() {
    if (!userId || !foodName) return
    const { data } = await supabase.from('food_logs').insert({ user_id: userId, meal_type: mealType, food_name: foodName, calories: parseInt(foodCalories)||0, protein: parseInt(foodProtein)||0, carbs: parseInt(foodCarbs)||0, fat: parseInt(foodFat)||0 }).select().single()
    if (data) { setTodayFoodLogs([...todayFoodLogs, data]); setAllFoodLogs([...allFoodLogs, data]); setDateFoodLogs([...dateFoodLogs, data]) }
    setModal(null); setFoodName(''); setFoodCalories(''); setFoodProtein(''); setFoodCarbs(''); setFoodFat('')
  }

  async function logMedication() {
    if (!userId || !profile) return
    const { data } = await supabase.from('medication_logs').insert({ user_id: userId, medication: profile.medication, dose: profile.dose, injection_site: injectionSite, notes: medNotes }).select().single()
    if (data) setMedLogs([data, ...medLogs])
    setModal(null); setInjectionSite(''); setMedNotes('')
  }

  async function logWeightEntry() {
    if (!userId || !newWeight) return
    const { data } = await supabase.from('weight_logs').insert({ user_id: userId, weight: parseFloat(newWeight) }).select().single()
    if (data) setWeightLogs([data, ...weightLogs])
    setModal(null); setNewWeight('')
  }

  async function logSideEffect() {
    if (!userId || !symptom) return
    const { data } = await supabase.from('side_effect_logs').insert({ user_id: userId, symptom, severity }).select().single()
    if (data) setSideEffectLogs([data, ...sideEffectLogs])
    setModal(null); setSymptom(''); setSeverity(3)
  }

  async function logWater(oz: number) {
    if (!userId) return
    const { data } = await supabase.from('water_logs').insert({ user_id: userId, amount_oz: oz }).select().single()
    if (data) { setWaterLogs([...waterLogs, data]); setDateWaterLogs([...dateWaterLogs, data]) }
  }

  async function logCheckin() {
    if (!userId) return
    const { data } = await supabase.from('checkin_logs').insert({ user_id: userId, mood: checkinMood, energy: checkinEnergy, notes: checkinNotes }).select().single()
    if (data) setCheckinLogs([data, ...checkinLogs])
    setModal(null); setCheckinMood(3); setCheckinEnergy(3); setCheckinNotes('')
  }

  async function logExercise() {
    if (!userId || !exerciseType || !exerciseDuration) return
    const { data } = await supabase.from('exercise_logs').insert({ user_id: userId, exercise_type: exerciseType, duration_minutes: parseInt(exerciseDuration)||0, notes: exerciseNotes }).select().single()
    if (data) setExerciseLogs([data, ...exerciseLogs])
    setModal(null); setExerciseType(''); setExerciseDuration(''); setExerciseNotes('')
  }

  if (loading) return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin"/></div>

  // ── Computed Stats ─────────────────────────────────
  const latestWeight = weightLogs[0]?.weight || (profile?.current_weight ? parseFloat(profile.current_weight) : null)
  const goalWeight = profile?.goal_weight ? parseFloat(profile.goal_weight) : null
  const startWeight = profile?.current_weight ? parseFloat(profile.current_weight) : null
  const weightLost = startWeight && latestWeight ? Math.round((startWeight - latestWeight) * 10) / 10 : null
  const progressPct = startWeight && goalWeight && latestWeight ? Math.min(100, Math.max(0, Math.round(((startWeight - latestWeight) / (startWeight - goalWeight)) * 100))) : null
  const proteinTarget = goalWeight ? Math.round(goalWeight * 0.8) : null
  const daysOnMed = profile?.start_date ? Math.max(1, Math.floor((Date.now() - new Date(profile.start_date).getTime()) / 86400000)) : null

  const lastInj = medLogs[0]
  const daysSinceInj = lastInj ? Math.floor((Date.now() - new Date(lastInj.logged_at).getTime()) / 86400000) : null
  const daysUntilInj = daysSinceInj !== null ? Math.max(0, 7 - daysSinceInj) : null
  const lastSite = lastInj?.injection_site || null
  const siteIdx = lastSite ? INJECTION_SITES.indexOf(lastSite) : -1
  const nextSite = INJECTION_SITES[(siteIdx + 1) % INJECTION_SITES.length]

  // Today stats (for overview)
  const todayCal = todayFoodLogs.reduce((s,f) => s+f.calories, 0)
  const todayP = todayFoodLogs.reduce((s,f) => s+f.protein, 0)
  const todayC = todayFoodLogs.reduce((s,f) => s+f.carbs, 0)
  const todayF = todayFoodLogs.reduce((s,f) => s+f.fat, 0)
  const todayWater = waterLogs.reduce((s,w) => s+w.amount_oz, 0)
  const proteinRem = proteinTarget ? Math.max(0, proteinTarget - todayP) : null
  const todayCheckin = checkinLogs.find(c => c.logged_at.startsWith(new Date().toISOString().split('T')[0]))

  // Date range stats (for nutrition tab)
  const dateCal = dateFoodLogs.reduce((s,f) => s+f.calories, 0)
  const dateP = dateFoodLogs.reduce((s,f) => s+f.protein, 0)
  const dateC = dateFoodLogs.reduce((s,f) => s+f.carbs, 0)
  const dateF = dateFoodLogs.reduce((s,f) => s+f.fat, 0)
  const dateWater = dateWaterLogs.reduce((s,w) => s+w.amount_oz, 0)

  // Weekly stats
  const weekStart = startOfWeek(new Date())
  const weekFoods = allFoodLogs.filter(f => new Date(f.logged_at) >= weekStart)
  const weekCal = weekFoods.reduce((s,f) => s+f.calories, 0)
  const weekP = weekFoods.reduce((s,f) => s+f.protein, 0)
  const daysThisWeek = Math.min(7, Math.floor((Date.now() - weekStart.getTime()) / 86400000) + 1)
  const avgDailyCal = daysThisWeek > 0 ? Math.round(weekCal / daysThisWeek) : 0
  const avgDailyP = daysThisWeek > 0 ? Math.round(weekP / daysThisWeek) : 0
  const proteinHitDays = (() => {
    let count = 0
    for (let i = 0; i < daysThisWeek; i++) {
      const d = addDays(weekStart, i)
      const ds = d.toISOString().split('T')[0]
      const dayP = allFoodLogs.filter(f => f.logged_at.startsWith(ds)).reduce((s,f) => s+f.protein, 0)
      if (proteinTarget && dayP >= proteinTarget) count++
    }
    return count
  })()

  const todayMeals = { breakfast: todayFoodLogs.filter(f => f.meal_type === 'breakfast'), lunch: todayFoodLogs.filter(f => f.meal_type === 'lunch'), dinner: todayFoodLogs.filter(f => f.meal_type === 'dinner'), snack: todayFoodLogs.filter(f => f.meal_type === 'snack') }
  const dateMeals = { breakfast: dateFoodLogs.filter(f => f.meal_type === 'breakfast'), lunch: dateFoodLogs.filter(f => f.meal_type === 'lunch'), dinner: dateFoodLogs.filter(f => f.meal_type === 'dinner'), snack: dateFoodLogs.filter(f => f.meal_type === 'snack') }

  function getProteinSuggestion(rem: number): string {
    if (rem <= 0) return "You hit your protein target! 💪"
    if (rem <= 15) return `${rem}g to go — a Greek yogurt gets you there`
    if (rem <= 30) return `${rem}g left — try a protein shake`
    if (rem <= 50) return `${rem}g remaining — chicken breast + yogurt would do it`
    return `${rem}g to go — prioritize protein at your next meal`
  }

  // Date navigation
  function navDate(dir: number) {
    if (nutritionView === 'day') setSelectedDate(addDays(selectedDate, dir))
    else if (nutritionView === 'week') setSelectedDate(addDays(selectedDate, dir * 7))
    else { const n = new Date(selectedDate); n.setMonth(n.getMonth() + dir); setSelectedDate(n) }
  }

  function getDateLabel(): string {
    if (nutritionView === 'day') {
      if (isToday(selectedDate)) return 'Today'
      if (isSameDay(selectedDate, addDays(new Date(), -1))) return 'Yesterday'
      return formatDateFull(selectedDate.toISOString())
    }
    if (nutritionView === 'week') {
      const ws = startOfWeek(selectedDate)
      return `${formatDate(ws.toISOString())} – ${formatDate(addDays(ws, 6).toISOString())}`
    }
    return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const divisor = nutritionView === 'day' ? 1 : nutritionView === 'week' ? daysThisWeek : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-16">
      {/* HEADER */}
      <header className="bg-[#2D5A3D] px-5 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold text-lg tracking-tight">Hey{profile?.name ? `, ${profile.name}` : ''}</h1>
            <p className="text-white/40 text-xs mt-0.5">{profile?.medication}{profile?.dose ? ` · ${profile.dose}` : ''}{daysOnMed ? ` · Day ${daysOnMed}` : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && <div className="bg-white/10 px-2.5 py-1 rounded-full"><span className="text-white/80 text-xs font-medium">🔥 {streak}d streak</span></div>}
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="text-white/30 text-xs hover:text-white/60 transition-colors cursor-pointer">Log out</button>
          </div>
        </div>
      </header>

      {/* TABS */}
      <div className="bg-white border-b border-[#E8E8E4] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex">
          {(['overview','nutrition','health'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${activeTab === tab ? 'text-[#2D5A3D] border-b-2 border-[#2D5A3D]' : 'text-[#B0B0A8] hover:text-[#6B6B65]'}`}>{tab}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ══════════ OVERVIEW ══════════ */}
        {activeTab === 'overview' && (<>
          {daysUntilInj !== null && daysUntilInj <= 1 && (
            <div className="bg-[#FFF8F0] border border-[#C4742B]/15 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#C4742B]/10 flex items-center justify-center shrink-0 text-lg">💉</div>
              <div className="flex-1"><p className="text-sm font-semibold text-[#1E1E1C]">{daysUntilInj === 0 ? 'Injection day' : 'Injection tomorrow'}</p><p className="text-xs text-[#8B7355]">Suggested: {nextSite}</p></div>
              <button onClick={() => { setInjectionSite(nextSite); setModal('med') }} className="bg-[#C4742B] text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">Log</button>
            </div>
          )}

          {!todayCheckin && (
            <button onClick={() => setModal('checkin')} className="w-full bg-[#F0EDE8] border border-[#E0DDD8] rounded-xl p-4 flex items-center gap-3 hover:bg-[#E8E5E0] transition-colors cursor-pointer text-left">
              <div className="text-lg">🌤️</div><div className="flex-1"><p className="text-sm font-semibold text-[#1E1E1C]">How are you feeling?</p><p className="text-xs text-[#8B8B83]">Quick mood & energy check-in</p></div><span className="text-[#B0B0A8] text-xs">→</span>
            </button>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Weight</p>
              <p className="text-xl font-bold text-[#1E1E1C] mt-1">{latestWeight ?? '—'}<span className="text-xs font-normal text-[#B0B0A8]"> lbs</span></p>
              {weightLost !== null && weightLost > 0 && <p className="text-[11px] text-[#2D5A3D] font-medium mt-0.5">↓ {weightLost}</p>}
            </div>
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Protein</p>
              <p className="text-xl font-bold text-[#2D5A3D] mt-1">{todayP}<span className="text-xs font-normal text-[#B0B0A8]">/{proteinTarget??'—'}g</span></p>
              {proteinTarget && <div className="h-1 bg-[#E8F0EB] rounded-full mt-2"><div className="h-full bg-[#2D5A3D] rounded-full" style={{ width: `${Math.min(100,(todayP/proteinTarget)*100)}%` }}/></div>}
            </div>
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Water</p>
              <p className="text-xl font-bold text-[#4A90D9] mt-1">{todayWater}<span className="text-xs font-normal text-[#B0B0A8]">/80oz</span></p>
              <div className="h-1 bg-[#E0EBF5] rounded-full mt-2"><div className="h-full bg-[#4A90D9] rounded-full" style={{ width: `${Math.min(100,(todayWater/80)*100)}%` }}/></div>
            </div>
          </div>

          {proteinRem !== null && proteinRem > 0 && <div className="bg-[#E8F0EB] rounded-xl px-4 py-3"><p className="text-xs text-[#2D5A3D] font-medium">{getProteinSuggestion(proteinRem)}</p></div>}

          {/* Weekly summary */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
            <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-3">This Week</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-lg font-bold text-[#1E1E1C]">{avgDailyCal}</p><p className="text-[9px] text-[#B0B0A8]">avg cal/day</p></div>
              <div><p className="text-lg font-bold text-[#2D5A3D]">{avgDailyP}g</p><p className="text-[9px] text-[#B0B0A8]">avg protein</p></div>
              <div><p className="text-lg font-bold text-[#C4742B]">{proteinHitDays}/{daysThisWeek}</p><p className="text-[9px] text-[#B0B0A8]">protein days</p></div>
              <div><p className="text-lg font-bold text-[#4A90D9]">{exerciseLogs.filter(e => new Date(e.logged_at) >= weekStart).length}</p><p className="text-[9px] text-[#B0B0A8]">workouts</p></div>
            </div>
          </div>

          {/* Water quick-add */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
            <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Quick Add Water</p>
            <div className="flex gap-2">{WATER_AMOUNTS.map(oz => <button key={oz} onClick={() => logWater(oz)} className="flex-1 bg-[#E0EBF5] text-[#4A90D9] py-2 rounded-lg text-xs font-semibold hover:bg-[#D0E0F0] transition-colors cursor-pointer">+{oz}oz</button>)}</div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { icon: '🍽️', label: 'Food', action: () => setModal('food'), color: 'bg-[#2D5A3D]' },
              { icon: '💉', label: 'Injection', action: () => setModal('med'), color: 'bg-[#C4742B]' },
              { icon: '⚖️', label: 'Weight', action: () => setModal('weight'), color: 'bg-[#6B6B65]' },
              { icon: '🏋️', label: 'Exercise', action: () => setModal('exercise'), color: 'bg-[#4A90D9]' },
              { icon: '🩹', label: 'Symptom', action: () => setModal('sideEffect'), color: 'bg-[#9B9B93]' },
            ].map(b => <button key={b.label} onClick={b.action} className={`${b.color} text-white rounded-xl py-3 text-center hover:opacity-90 transition-opacity cursor-pointer`}><span className="text-lg block">{b.icon}</span><span className="text-[9px] font-semibold mt-0.5 block">{b.label}</span></button>)}
          </div>

          {/* Streak calendar */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
            <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-3">Logging Streak · {new Date().toLocaleDateString('en-US', { month: 'long' })}</p>
            <StreakCalendar foodLogs={allFoodLogs} />
          </div>

          <a href="/chat" className="block bg-white border border-[#2D5A3D]/10 rounded-xl p-4 hover:border-[#2D5A3D]/30 transition-colors">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0"><span className="text-lg">🌿</span></div><div className="flex-1"><p className="text-sm font-semibold text-[#1E1E1C]">Chat with Nova</p><p className="text-xs text-[#8B8B83]">Coaching, meal ideas, side effect help</p></div><svg className="w-4 h-4 text-[#B0B0A8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M9 5l7 7-7 7"/></svg></div>
          </a>
        </>)}

        {/* ══════════ NUTRITION ══════════ */}
        {activeTab === 'nutrition' && (<>
          {/* View toggle + date nav */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-3">
            <div className="flex gap-1 mb-3">
              {(['day','week','month'] as const).map(v => (
                <button key={v} onClick={() => { setNutritionView(v); setSelectedDate(new Date()) }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-colors ${nutritionView === v ? 'bg-[#2D5A3D] text-white' : 'bg-[#F5F5F2] text-[#8B8B83] hover:text-[#6B6B65]'}`}>{v}</button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => navDate(-1)} className="w-8 h-8 rounded-lg bg-[#F5F5F2] flex items-center justify-center text-[#6B6B65] hover:bg-[#EDEDEA] cursor-pointer transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#1E1E1C]">{getDateLabel()}</p>
                {nutritionView !== 'day' && <p className="text-[10px] text-[#B0B0A8]">Daily avg shown below</p>}
              </div>
              <button onClick={() => navDate(1)} disabled={isToday(selectedDate)} className="w-8 h-8 rounded-lg bg-[#F5F5F2] flex items-center justify-center text-[#6B6B65] hover:bg-[#EDEDEA] cursor-pointer transition-colors disabled:opacity-30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>

          {/* Macros summary */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm font-semibold text-[#1E1E1C]">{nutritionView === 'day' ? 'Nutrition' : `${nutritionView === 'week' ? 'Weekly' : 'Monthly'} Totals`}</p>
              {isToday(selectedDate) && nutritionView === 'day' && <button onClick={() => setModal('food')} className="bg-[#2D5A3D] text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">+ Log Food</button>}
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { val: nutritionView === 'day' ? dateCal : Math.round(dateCal/divisor), label: nutritionView === 'day' ? 'Calories' : 'Avg Cal', color: '#1E1E1C', bg: '#F5F5F2' },
                { val: `${nutritionView === 'day' ? dateP : Math.round(dateP/divisor)}g`, label: nutritionView === 'day' ? 'Protein' : 'Avg Protein', color: '#2D5A3D', bg: '#E8F0EB' },
                { val: `${nutritionView === 'day' ? dateC : Math.round(dateC/divisor)}g`, label: nutritionView === 'day' ? 'Carbs' : 'Avg Carbs', color: '#C4742B', bg: '#FFF0E5' },
                { val: `${nutritionView === 'day' ? dateF : Math.round(dateF/divisor)}g`, label: nutritionView === 'day' ? 'Fat' : 'Avg Fat', color: '#6B6B65', bg: '#F0F0ED' },
              ].map(m => <div key={m.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: m.bg }}><p className="text-lg font-bold" style={{ color: m.color }}>{m.val}</p><p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: m.color, opacity: .5 }}>{m.label}</p></div>)}
            </div>
            {nutritionView !== 'day' && <p className="text-[10px] text-[#B0B0A8] text-center">Total: {dateCal} cal · {dateP}g protein · {dateC}g carbs · {dateF}g fat</p>}
            {proteinTarget && nutritionView === 'day' && (
              <div><div className="flex justify-between text-xs mb-1"><span className="text-[#2D5A3D] font-medium">Protein</span><span className="text-[#B0B0A8]">{dateP}/{proteinTarget}g</span></div><div className="h-2 bg-[#E8F0EB] rounded-full overflow-hidden"><div className="h-full bg-[#2D5A3D] rounded-full" style={{ width: `${Math.min(100,(dateP/proteinTarget)*100)}%` }}/></div></div>
            )}
          </div>

          {/* Water */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-[#1E1E1C]">💧 Water</h3>
              <span className="text-sm font-bold text-[#4A90D9]">{nutritionView === 'day' ? `${dateWater}/80 oz` : `${dateWater} oz total`}</span>
            </div>
            {nutritionView === 'day' && (<>
              <div className="h-2 bg-[#E0EBF5] rounded-full overflow-hidden mb-3"><div className="h-full bg-[#4A90D9] rounded-full" style={{ width: `${Math.min(100,(dateWater/80)*100)}%` }}/></div>
              {isToday(selectedDate) && <div className="flex gap-2">{WATER_AMOUNTS.map(oz => <button key={oz} onClick={() => logWater(oz)} className="flex-1 bg-[#E0EBF5] text-[#4A90D9] py-2 rounded-lg text-xs font-semibold hover:bg-[#D0E0F0] transition-colors cursor-pointer">+{oz}oz</button>)}</div>}
            </>)}
          </div>

          {/* Meals (day view only) */}
          {nutritionView === 'day' && (['breakfast','lunch','dinner','snack'] as const).map(meal => {
            const mealFoods = dateMeals[meal]
            return (
              <div key={meal} className="bg-white border border-[#EDEDEA] rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-[#1E1E1C] capitalize">{meal==='breakfast'?'🌅':meal==='lunch'?'☀️':meal==='dinner'?'🌙':'🍎'} {meal}</h3>
                  <div className="flex items-center gap-2">
                    {mealFoods.length > 0 && <span className="text-[10px] text-[#B0B0A8]">{mealFoods.reduce((s,f)=>s+f.calories,0)} cal · {mealFoods.reduce((s,f)=>s+f.protein,0)}g P</span>}
                    {isToday(selectedDate) && <button onClick={() => { setMealType(meal); setModal('food') }} className="w-6 h-6 rounded-md bg-[#F0F0ED] text-[#6B6B65] flex items-center justify-center text-sm cursor-pointer">+</button>}
                  </div>
                </div>
                {mealFoods.length === 0 ? <p className="text-xs text-[#C5C5BE] italic">Nothing logged</p> : (
                  <div className="space-y-1.5">{mealFoods.map(f => (
                    <div key={f.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F5F2]">
                      <div><span className="text-sm text-[#1E1E1C]">{f.food_name}</span><span className="text-[10px] text-[#C5C5BE] ml-2">{formatTime(f.logged_at)}</span></div>
                      <div className="flex gap-2 text-[10px]"><span className="text-[#B0B0A8]">{f.calories}cal</span><span className="text-[#2D5A3D] font-semibold">{f.protein}g P</span><span className="text-[#B0B0A8]">{f.carbs}g C</span><span className="text-[#B0B0A8]">{f.fat}g F</span></div>
                    </div>
                  ))}</div>
                )}
              </div>
            )
          })}

          {/* Weekly/Monthly food list */}
          {nutritionView !== 'day' && dateFoodLogs.length > 0 && (
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-3">All Entries</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {dateFoodLogs.map(f => (
                  <div key={f.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F5F2]">
                    <div><span className="text-sm text-[#1E1E1C]">{f.food_name}</span><span className="text-[10px] text-[#C5C5BE] ml-2">{formatDate(f.logged_at)} {formatTime(f.logged_at)}</span></div>
                    <div className="flex gap-2 text-[10px]"><span className="text-[#B0B0A8]">{f.calories}cal</span><span className="text-[#2D5A3D] font-semibold">{f.protein}g P</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>)}

        {/* ══════════ HEALTH ══════════ */}
        {activeTab === 'health' && (<>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: '💉', label: 'Injection', action: () => setModal('med'), color: 'bg-[#2D5A3D]' },
              { icon: '⚖️', label: 'Weight', action: () => setModal('weight'), color: 'bg-[#C4742B]' },
              { icon: '🏋️', label: 'Exercise', action: () => setModal('exercise'), color: 'bg-[#4A90D9]' },
              { icon: '🩹', label: 'Symptom', action: () => setModal('sideEffect'), color: 'bg-[#6B6B65]' },
            ].map(b => <button key={b.label} onClick={b.action} className={`${b.color} text-white rounded-xl py-3 text-center hover:opacity-90 cursor-pointer`}><span className="text-xl block">{b.icon}</span><span className="text-[9px] font-semibold block">{b.label}</span></button>)}
          </div>

          {/* Injection tracker */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-[#1E1E1C] mb-3">Injection Tracker</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-[#F5F5F2] rounded-lg p-3"><p className="text-[9px] text-[#B0B0A8] uppercase font-semibold">Last Site</p><p className="text-sm font-bold text-[#1E1E1C] mt-0.5">{lastSite||'—'}</p></div>
              <div className="bg-[#FFF8F0] rounded-lg p-3"><p className="text-[9px] text-[#C4742B] uppercase font-semibold">Next Site</p><p className="text-sm font-bold text-[#C4742B] mt-0.5">{nextSite}</p></div>
              <div className="bg-[#E8F0EB] rounded-lg p-3"><p className="text-[9px] text-[#2D5A3D] uppercase font-semibold">Next Dose</p><p className="text-sm font-bold text-[#2D5A3D] mt-0.5">{daysUntilInj!==null?daysUntilInj===0?'Today':`${daysUntilInj}d`:'—'}</p></div>
            </div>
            {medLogs.length > 0 && <div className="space-y-2"><p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">History</p>
              {medLogs.slice(0,8).map(m => <div key={m.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F5F2]"><div><span className="text-sm text-[#1E1E1C]">{m.injection_site||'—'}</span><span className="text-[10px] text-[#B0B0A8] ml-2">{m.dose}</span></div><span className="text-[10px] text-[#B0B0A8]">{formatDate(m.logged_at)} · {formatTime(m.logged_at)}</span></div>)}
            </div>}
          </div>

          {/* Weight graph */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold text-[#1E1E1C]">Weight Trend</h2>
              {progressPct !== null && <span className="text-[10px] text-[#2D5A3D] font-semibold bg-[#E8F0EB] px-2 py-0.5 rounded-full">{progressPct}% to goal</span>}
            </div>
            <WeightGraph data={weightLogs} goalWeight={goalWeight} />
            {weightLogs.length > 0 && <div className="space-y-1.5 mt-3">{weightLogs.slice(0,5).map(w => <div key={w.id} className="flex justify-between items-center py-1 border-t border-[#F5F5F2]"><span className="text-sm text-[#1E1E1C] font-medium">{w.weight} lbs</span><span className="text-[10px] text-[#B0B0A8]">{formatDate(w.logged_at)} · {formatTime(w.logged_at)}</span></div>)}</div>}
          </div>

          {/* Exercise */}
          {exerciseLogs.length > 0 && <div className="bg-white border border-[#EDEDEA] rounded-xl p-4"><h2 className="text-sm font-semibold text-[#1E1E1C] mb-3">Exercise</h2><div className="space-y-2">{exerciseLogs.slice(0,5).map(e => <div key={e.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F5F2]"><div><span className="text-sm text-[#1E1E1C]">{e.exercise_type}</span><span className="text-xs text-[#4A90D9] ml-2 font-medium">{e.duration_minutes}min</span></div><span className="text-[10px] text-[#B0B0A8]">{formatDate(e.logged_at)}</span></div>)}</div></div>}

          {/* Side effects */}
          {sideEffectLogs.length > 0 && <div className="bg-white border border-[#EDEDEA] rounded-xl p-4"><h2 className="text-sm font-semibold text-[#1E1E1C] mb-3">Side Effects</h2><div className="space-y-2">{sideEffectLogs.slice(0,5).map(e => <div key={e.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F5F2]"><div><span className="text-sm text-[#1E1E1C]">{e.symptom}</span><span className="text-xs text-[#C4742B] ml-2">{'●'.repeat(e.severity)}{'○'.repeat(5-e.severity)}</span></div><span className="text-[10px] text-[#B0B0A8]">{formatDate(e.logged_at)} · {formatTime(e.logged_at)}</span></div>)}</div></div>}

          {/* Mood/energy */}
          {checkinLogs.length > 0 && <div className="bg-white border border-[#EDEDEA] rounded-xl p-4"><h2 className="text-sm font-semibold text-[#1E1E1C] mb-3">Mood &amp; Energy</h2><div className="space-y-2">{checkinLogs.slice(0,5).map(c => <div key={c.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F5F2]"><div className="flex gap-3"><span className="text-xs"><span className="text-[#B0B0A8]">Mood:</span> <span className="font-medium text-[#1E1E1C]">{MOOD_LABELS[c.mood-1]}</span></span><span className="text-xs"><span className="text-[#B0B0A8]">Energy:</span> <span className="font-medium text-[#1E1E1C]">{ENERGY_LABELS[c.energy-1]}</span></span></div><span className="text-[10px] text-[#B0B0A8]">{formatDate(c.logged_at)}</span></div>)}</div></div>}
        </>)}
      </div>

      {/* ══════════ MODALS ══════════ */}

      {modal === 'food' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Log Food</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <div className="grid grid-cols-4 gap-2">{(['breakfast','lunch','dinner','snack'] as const).map(m => <button key={m} onClick={() => setMealType(m)} className={`text-xs py-2 rounded-lg border capitalize cursor-pointer ${mealType===m?'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold':'border-[#EDEDEA] text-[#8B8B83]'}`}>{m}</button>)}</div>
            <div>
              <div className="flex gap-2">
                <input type="text" value={foodName} onChange={e => setFoodName(e.target.value)} placeholder="e.g. 8 oz ribeye steak" className="flex-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"/>
                <button type="button" onClick={calculateMacros} disabled={!foodName.trim()||isCalculating} className="bg-[#2D5A3D] text-white px-3 py-2.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 whitespace-nowrap">{isCalculating?'...':'⚡ Calc'}</button>
              </div>
              <p className="text-[10px] text-[#C5C5BE] mt-1">Include quantity for accuracy</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{l:'Calories',v:foodCalories,s:setFoodCalories,c:'#1E1E1C'},{l:'Protein (g)',v:foodProtein,s:setFoodProtein,c:'#2D5A3D'},{l:'Carbs (g)',v:foodCarbs,s:setFoodCarbs,c:'#C4742B'},{l:'Fat (g)',v:foodFat,s:setFoodFat,c:'#6B6B65'}].map(f => <div key={f.l}><label className="text-[9px] font-semibold uppercase tracking-wider" style={{color:f.c}}>{f.l}</label><input type="number" value={f.v} onChange={e=>f.s(e.target.value)} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D]"/></div>)}
            </div>
            <button onClick={logFood} disabled={!foodName.trim()} className="w-full bg-[#2D5A3D] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-30">Save</button>
          </div>
        </div>
      )}

      {modal === 'med' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Log Injection</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <div className="bg-[#F5F5F2] rounded-lg px-4 py-2.5"><p className="text-[10px] text-[#B0B0A8]">Medication</p><p className="text-sm font-semibold text-[#1E1E1C]">{profile?.medication} · {profile?.dose}</p></div>
            <div><p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Injection Site</p><div className="grid grid-cols-2 gap-2">{INJECTION_SITES.map(s => <button key={s} onClick={() => setInjectionSite(s)} className={`text-xs px-3 py-2.5 rounded-lg border cursor-pointer ${injectionSite===s?'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold':'border-[#EDEDEA] text-[#8B8B83]'}`}>{s}</button>)}</div></div>
            <input type="text" value={medNotes} onChange={e => setMedNotes(e.target.value)} placeholder="Notes (optional)" className="w-full px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"/>
            <button onClick={logMedication} className="w-full bg-[#2D5A3D] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer">Save</button>
          </div>
        </div>
      )}

      {modal === 'weight' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Log Weight</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <input type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="Weight in pounds" autoFocus className="w-full px-4 py-4 rounded-lg border-2 border-[#EDEDEA] text-2xl text-center text-[#1E1E1C] font-bold outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE] placeholder:font-normal placeholder:text-base"/>
            {latestWeight&&newWeight&&<p className={`text-center text-sm font-medium ${parseFloat(newWeight)<latestWeight?'text-[#2D5A3D]':parseFloat(newWeight)>latestWeight?'text-[#C4742B]':'text-[#8B8B83]'}`}>{parseFloat(newWeight)<latestWeight?`↓ ${(latestWeight-parseFloat(newWeight)).toFixed(1)} lbs`:parseFloat(newWeight)>latestWeight?`↑ ${(parseFloat(newWeight)-latestWeight).toFixed(1)} lbs`:'Same'}</p>}
            <button onClick={logWeightEntry} disabled={!newWeight} className="w-full bg-[#C4742B] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-30">Save</button>
          </div>
        </div>
      )}

      {modal === 'sideEffect' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Log Side Effect</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <div><p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Symptom</p><div className="flex flex-wrap gap-1.5">{SYMPTOMS.map(s => <button key={s} onClick={() => setSymptom(s)} className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer ${symptom===s?'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold':'border-[#EDEDEA] text-[#8B8B83]'}`}>{s}</button>)}</div></div>
            <div><p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Severity: {severity}/5</p><div className="flex gap-2">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setSeverity(n)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold cursor-pointer ${n<=severity?'bg-[#C4742B] text-white':'bg-[#F5F5F2] text-[#C5C5BE]'}`}>{n}</button>)}</div></div>
            <button onClick={logSideEffect} disabled={!symptom} className="w-full bg-[#6B6B65] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-30">Save</button>
          </div>
        </div>
      )}

      {modal === 'checkin' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Daily Check-in</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <div><p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Mood</p><div className="flex gap-2">{MOOD_LABELS.map((l,i) => <button key={l} onClick={() => setCheckinMood(i+1)} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold cursor-pointer ${checkinMood===i+1?'bg-[#2D5A3D] text-white':'bg-[#F5F5F2] text-[#8B8B83]'}`}>{l}</button>)}</div></div>
            <div><p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Energy</p><div className="flex gap-2">{ENERGY_LABELS.map((l,i) => <button key={l} onClick={() => setCheckinEnergy(i+1)} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold cursor-pointer ${checkinEnergy===i+1?'bg-[#4A90D9] text-white':'bg-[#F5F5F2] text-[#8B8B83]'}`}>{l}</button>)}</div></div>
            <input type="text" value={checkinNotes} onChange={e => setCheckinNotes(e.target.value)} placeholder="Notes (optional)" className="w-full px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"/>
            <button onClick={logCheckin} className="w-full bg-[#2D5A3D] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer">Save</button>
          </div>
        </div>
      )}

      {modal === 'exercise' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Log Exercise</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <div><p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Type</p><div className="flex flex-wrap gap-1.5">{EXERCISE_TYPES.map(t => <button key={t} onClick={() => setExerciseType(t)} className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer ${exerciseType===t?'border-[#4A90D9] bg-[#E0EBF5] text-[#4A90D9] font-semibold':'border-[#EDEDEA] text-[#8B8B83]'}`}>{t}</button>)}</div></div>
            <div><label className="text-[9px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Minutes</label><input type="number" value={exerciseDuration} onChange={e => setExerciseDuration(e.target.value)} placeholder="30" className="w-full px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#4A90D9]"/></div>
            <input type="text" value={exerciseNotes} onChange={e => setExerciseNotes(e.target.value)} placeholder="Notes (optional)" className="w-full px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none placeholder:text-[#C5C5BE]"/>
            <button onClick={logExercise} disabled={!exerciseType||!exerciseDuration} className="w-full bg-[#4A90D9] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-30">Save</button>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EDEDEA] px-4 py-2 flex justify-around z-50">
        <a href="/dashboard" className="flex flex-col items-center gap-0.5 text-[#2D5A3D]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4"/></svg><span className="text-[10px] font-semibold">Home</span></a>
        <a href="/chat" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg><span className="text-[10px] font-medium">Nova</span></a>
        <a href="#" className="flex flex-col items-center gap-0.5 text-[#B0B0A8]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span className="text-[10px] font-medium">Savings</span></a>
      </nav>
    </div>
  )
}
