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

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Weight Line Graph Component ────────────────────────
function WeightGraph({ data, goalWeight }: { data: WeightLog[]; goalWeight: number | null }) {
  if (data.length < 2) return null
  const sorted = [...data].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
  const weights = sorted.map(d => d.weight)
  const allValues = goalWeight ? [...weights, goalWeight] : weights
  const min = Math.min(...allValues) - 2
  const max = Math.max(...allValues) + 2
  const range = max - min || 1

  const w = 500, h = 160, padX = 40, padY = 20
  const graphW = w - padX * 2, graphH = h - padY * 2

  const points = sorted.map((d, i) => ({
    x: padX + (i / (sorted.length - 1)) * graphW,
    y: padY + graphH - ((d.weight - min) / range) * graphH,
    weight: d.weight,
    date: formatDate(d.logged_at),
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = linePath + ` L${points[points.length - 1].x},${padY + graphH} L${points[0].x},${padY + graphH} Z`
  const goalY = goalWeight ? padY + graphH - ((goalWeight - min) / range) * graphH : null

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: '180px' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2D5A3D" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#2D5A3D" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padY + graphH * (1 - pct)
        const val = Math.round(min + range * pct)
        return (
          <g key={i}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="#E5E5E0" strokeWidth="0.5" />
            <text x={padX - 6} y={y + 4} textAnchor="end" fill="#9B9B93" fontSize="9" fontFamily="system-ui">{val}</text>
          </g>
        )
      })}
      {/* Goal line */}
      {goalY !== null && goalY >= padY && goalY <= padY + graphH && (
        <g>
          <line x1={padX} y1={goalY} x2={w - padX} y2={goalY} stroke="#C4742B" strokeWidth="1" strokeDasharray="6,4" />
          <text x={w - padX + 4} y={goalY + 3} fill="#C4742B" fontSize="9" fontFamily="system-ui">Goal</text>
        </g>
      )}
      {/* Area + Line */}
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke="#2D5A3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#2D5A3D" strokeWidth="2" />
          {(i === 0 || i === points.length - 1 || points.length <= 6) && (
            <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#1E1E1C" fontSize="9" fontWeight="600" fontFamily="system-ui">{p.weight}</text>
          )}
          {(i === 0 || i === points.length - 1) && (
            <text x={p.x} y={padY + graphH + 14} textAnchor="middle" fill="#9B9B93" fontSize="8" fontFamily="system-ui">{p.date}</text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ── Main Dashboard ─────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [medLogs, setMedLogs] = useState<MedLog[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [sideEffectLogs, setSideEffectLogs] = useState<SideEffectLog[]>([])
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([])
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([])
  const [checkinLogs, setCheckinLogs] = useState<CheckinLog[]>([])
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'nutrition' | 'health'>('overview')

  // Modal states
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

  // Streak calculation
  const [streak, setStreak] = useState(0)

  const calculateStreak = useCallback((foods: FoodLog[]) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let count = 0
    for (let i = 0; i < 60; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - i)
      const dateStr = checkDate.toISOString().split('T')[0]
      const hasFood = foods.some(f => f.logged_at.startsWith(dateStr))
      if (i === 0 && !hasFood) continue // today hasn't been logged yet, keep going
      if (hasFood) count++
      else break
    }
    return count
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setProfile(p)

      const today = new Date(); today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()
      const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)

      const [meds, weights, effects, foods, todayFoods, water, checkins, exercises] = await Promise.all([
        supabase.from('medication_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(20),
        supabase.from('weight_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(30),
        supabase.from('side_effect_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10),
        supabase.from('food_logs').select('*').eq('user_id', user.id).gte('logged_at', weekAgo.toISOString()).order('logged_at', { ascending: true }),
        supabase.from('food_logs').select('*').eq('user_id', user.id).gte('logged_at', todayISO).order('logged_at', { ascending: true }),
        supabase.from('water_logs').select('*').eq('user_id', user.id).gte('logged_at', todayISO),
        supabase.from('checkin_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(7),
        supabase.from('exercise_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10),
      ])

      setMedLogs(meds.data || [])
      setWeightLogs(weights.data || [])
      setSideEffectLogs(effects.data || [])
      setFoodLogs(todayFoods.data || [])
      setWaterLogs(water.data || [])
      setCheckinLogs(checkins.data || [])
      setExerciseLogs(exercises.data || [])
      setStreak(calculateStreak(foods.data || []))
      setLoading(false)
    }
    init()
  }, [router, calculateStreak])

  // ── Log Functions ──────────────────────────────────
  async function calculateMacros() {
    if (!foodName.trim()) return
    setIsCalculating(true)
    try {
      const res = await fetch('/api/food-lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ food: foodName }) })
      const data = await res.json()
      setFoodCalories(String(data.calories || 0)); setFoodProtein(String(data.protein || 0)); setFoodCarbs(String(data.carbs || 0)); setFoodFat(String(data.fat || 0))
    } catch { /* silent */ } finally { setIsCalculating(false) }
  }

  async function logFood() {
    if (!userId || !foodName) return
    const { data } = await supabase.from('food_logs').insert({ user_id: userId, meal_type: mealType, food_name: foodName, calories: parseInt(foodCalories) || 0, protein: parseInt(foodProtein) || 0, carbs: parseInt(foodCarbs) || 0, fat: parseInt(foodFat) || 0 }).select().single()
    if (data) setFoodLogs([...foodLogs, data])
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
    if (data) setWaterLogs([...waterLogs, data])
  }

  async function logCheckin() {
    if (!userId) return
    const { data } = await supabase.from('checkin_logs').insert({ user_id: userId, mood: checkinMood, energy: checkinEnergy, notes: checkinNotes }).select().single()
    if (data) setCheckinLogs([data, ...checkinLogs])
    setModal(null); setCheckinMood(3); setCheckinEnergy(3); setCheckinNotes('')
  }

  async function logExercise() {
    if (!userId || !exerciseType || !exerciseDuration) return
    const { data } = await supabase.from('exercise_logs').insert({ user_id: userId, exercise_type: exerciseType, duration_minutes: parseInt(exerciseDuration) || 0, notes: exerciseNotes }).select().single()
    if (data) setExerciseLogs([data, ...exerciseLogs])
    setModal(null); setExerciseType(''); setExerciseDuration(''); setExerciseNotes('')
  }

  if (loading) return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin" /></div>

  // ── Computed Stats ─────────────────────────────────
  const latestWeight = weightLogs[0]?.weight || (profile?.current_weight ? parseFloat(profile.current_weight) : null)
  const goalWeight = profile?.goal_weight ? parseFloat(profile.goal_weight) : null
  const startWeight = profile?.current_weight ? parseFloat(profile.current_weight) : null
  const weightLost = startWeight && latestWeight ? Math.round((startWeight - latestWeight) * 10) / 10 : null
  const progressPct = startWeight && goalWeight && latestWeight ? Math.min(100, Math.max(0, Math.round(((startWeight - latestWeight) / (startWeight - goalWeight)) * 100))) : null
  const proteinTarget = goalWeight ? Math.round(goalWeight * 0.8) : null
  const daysOnMed = profile?.start_date ? Math.max(1, Math.floor((Date.now() - new Date(profile.start_date).getTime()) / 86400000)) : null

  const lastInjection = medLogs[0]
  const daysSinceInjection = lastInjection ? Math.floor((Date.now() - new Date(lastInjection.logged_at).getTime()) / 86400000) : null
  const daysUntilInjection = daysSinceInjection !== null ? Math.max(0, 7 - daysSinceInjection) : null
  const lastInjectionSite = lastInjection?.injection_site || null
  const siteIdx = lastInjectionSite ? INJECTION_SITES.indexOf(lastInjectionSite) : -1
  const suggestedSite = INJECTION_SITES[(siteIdx + 1) % INJECTION_SITES.length]

  const todayCal = foodLogs.reduce((s, f) => s + f.calories, 0)
  const todayP = foodLogs.reduce((s, f) => s + f.protein, 0)
  const todayC = foodLogs.reduce((s, f) => s + f.carbs, 0)
  const todayF = foodLogs.reduce((s, f) => s + f.fat, 0)
  const todayWater = waterLogs.reduce((s, w) => s + w.amount_oz, 0)
  const proteinRemaining = proteinTarget ? Math.max(0, proteinTarget - todayP) : null
  const todayCheckin = checkinLogs.find(c => c.logged_at.startsWith(new Date().toISOString().split('T')[0]))

  const meals = { breakfast: foodLogs.filter(f => f.meal_type === 'breakfast'), lunch: foodLogs.filter(f => f.meal_type === 'lunch'), dinner: foodLogs.filter(f => f.meal_type === 'dinner'), snack: foodLogs.filter(f => f.meal_type === 'snack') }

  // ── Protein suggestion ─────────────────────────────
  function getProteinSuggestion(remaining: number): string {
    if (remaining <= 0) return "You hit your protein target! 💪"
    if (remaining <= 15) return `${remaining}g to go — a Greek yogurt or string cheese gets you there`
    if (remaining <= 30) return `${remaining}g left — try a protein shake or 4oz chicken breast`
    if (remaining <= 50) return `${remaining}g remaining — a chicken breast + Greek yogurt would nail it`
    return `${remaining}g to go — prioritize protein at your next meal`
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-16">
      {/* ── HEADER ── */}
      <header className="bg-[#2D5A3D] px-5 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold text-lg tracking-tight">Hey{profile?.name ? `, ${profile.name}` : ''}</h1>
            <p className="text-white/40 text-xs mt-0.5">{profile?.medication}{profile?.dose ? ` · ${profile.dose}` : ''}{daysOnMed ? ` · Day ${daysOnMed}` : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && <div className="bg-white/10 px-2.5 py-1 rounded-full"><span className="text-white/80 text-xs font-medium">🔥 {streak} day streak</span></div>}
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="text-white/30 text-xs hover:text-white/60 transition-colors cursor-pointer">Log out</button>
          </div>
        </div>
      </header>

      {/* ── TABS ── */}
      <div className="bg-white border-b border-[#E8E8E4] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex">
          {(['overview', 'nutrition', 'health'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${activeTab === tab ? 'text-[#2D5A3D] border-b-2 border-[#2D5A3D]' : 'text-[#B0B0A8] hover:text-[#6B6B65]'}`}
            >{tab}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ══════════ OVERVIEW TAB ══════════ */}
        {activeTab === 'overview' && (<>

          {/* Injection countdown */}
          {daysUntilInjection !== null && daysUntilInjection <= 1 && (
            <div className="bg-[#FFF8F0] border border-[#C4742B]/15 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#C4742B]/10 flex items-center justify-center shrink-0 text-lg">💉</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1E1E1C]">{daysUntilInjection === 0 ? 'Injection day' : 'Injection tomorrow'}</p>
                <p className="text-xs text-[#8B7355]">Suggested site: {suggestedSite}</p>
              </div>
              <button onClick={() => { setInjectionSite(suggestedSite); setModal('med') }} className="bg-[#C4742B] text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#a86224] transition-colors">Log</button>
            </div>
          )}

          {/* Daily check-in prompt */}
          {!todayCheckin && (
            <button onClick={() => setModal('checkin')} className="w-full bg-[#F0EDE8] border border-[#E0DDD8] rounded-xl p-4 flex items-center gap-3 hover:bg-[#E8E5E0] transition-colors cursor-pointer text-left">
              <div className="text-lg">🌤️</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1E1E1C]">How are you feeling today?</p>
                <p className="text-xs text-[#8B8B83]">Quick mood &amp; energy check-in</p>
              </div>
              <span className="text-[#B0B0A8] text-xs">Tap →</span>
            </button>
          )}

          {/* Stat grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Weight</p>
              <p className="text-xl font-bold text-[#1E1E1C] mt-1">{latestWeight ?? '—'}<span className="text-xs font-normal text-[#B0B0A8]"> lbs</span></p>
              {weightLost !== null && weightLost > 0 && <p className="text-[11px] text-[#2D5A3D] font-medium mt-0.5">↓ {weightLost} lost</p>}
            </div>
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Protein</p>
              <p className="text-xl font-bold text-[#2D5A3D] mt-1">{todayP}<span className="text-xs font-normal text-[#B0B0A8]">/{proteinTarget ?? '—'}g</span></p>
              {proteinTarget && <div className="h-1 bg-[#E8F0EB] rounded-full mt-2"><div className="h-full bg-[#2D5A3D] rounded-full transition-all" style={{ width: `${Math.min(100, (todayP / proteinTarget) * 100)}%` }} /></div>}
            </div>
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Water</p>
              <p className="text-xl font-bold text-[#4A90D9] mt-1">{todayWater}<span className="text-xs font-normal text-[#B0B0A8]">/80 oz</span></p>
              <div className="h-1 bg-[#E0EBF5] rounded-full mt-2"><div className="h-full bg-[#4A90D9] rounded-full transition-all" style={{ width: `${Math.min(100, (todayWater / 80) * 100)}%` }} /></div>
            </div>
          </div>

          {/* Protein suggestion */}
          {proteinRemaining !== null && proteinRemaining > 0 && (
            <div className="bg-[#E8F0EB] rounded-xl px-4 py-3">
              <p className="text-xs text-[#2D5A3D] font-medium">{getProteinSuggestion(proteinRemaining)}</p>
            </div>
          )}

          {/* Today's macros */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
            <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-3">Today&apos;s Intake</p>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div><p className="text-lg font-bold text-[#1E1E1C]">{todayCal}</p><p className="text-[10px] text-[#B0B0A8]">cal</p></div>
              <div><p className="text-lg font-bold text-[#2D5A3D]">{todayP}g</p><p className="text-[10px] text-[#2D5A3D]/50]">protein</p></div>
              <div><p className="text-lg font-bold text-[#C4742B]">{todayC}g</p><p className="text-[10px] text-[#C4742B]/50">carbs</p></div>
              <div><p className="text-lg font-bold text-[#6B6B65]">{todayF}g</p><p className="text-[10px] text-[#6B6B65]/50">fat</p></div>
            </div>
          </div>

          {/* Water quick-add */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Quick Add Water</p>
            </div>
            <div className="flex gap-2">
              {WATER_AMOUNTS.map(oz => (
                <button key={oz} onClick={() => logWater(oz)} className="flex-1 bg-[#E0EBF5] text-[#4A90D9] py-2 rounded-lg text-xs font-semibold hover:bg-[#D0E0F0] transition-colors cursor-pointer">+{oz}oz</button>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { icon: '🍽️', label: 'Food', action: () => setModal('food'), color: 'bg-[#2D5A3D]' },
              { icon: '💉', label: 'Injection', action: () => setModal('med'), color: 'bg-[#C4742B]' },
              { icon: '⚖️', label: 'Weight', action: () => setModal('weight'), color: 'bg-[#6B6B65]' },
              { icon: '🏋️', label: 'Exercise', action: () => setModal('exercise'), color: 'bg-[#4A90D9]' },
              { icon: '🩹', label: 'Symptom', action: () => setModal('sideEffect'), color: 'bg-[#9B9B93]' },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} className={`${btn.color} text-white rounded-xl py-3 text-center hover:opacity-90 transition-opacity cursor-pointer`}>
                <span className="text-lg block">{btn.icon}</span>
                <span className="text-[9px] font-semibold mt-0.5 block">{btn.label}</span>
              </button>
            ))}
          </div>

          {/* Nova CTA */}
          <a href="/chat" className="block bg-white border border-[#2D5A3D]/10 rounded-xl p-4 hover:border-[#2D5A3D]/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0"><span className="text-lg">🌿</span></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1E1E1C]">Chat with Nova</p>
                <p className="text-xs text-[#8B8B83]">Coaching, meal ideas, side effect help</p>
              </div>
              <svg className="w-4 h-4 text-[#B0B0A8] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M9 5l7 7-7 7" /></svg>
            </div>
          </a>
        </>)}

        {/* ══════════ NUTRITION TAB ══════════ */}
        {activeTab === 'nutrition' && (<>
          {/* Macros summary */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm font-semibold text-[#1E1E1C]">Today&apos;s Nutrition</p>
              <button onClick={() => setModal('food')} className="bg-[#2D5A3D] text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors">+ Log Food</button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { val: todayCal, label: 'Calories', color: '#1E1E1C', bg: '#F5F5F2' },
                { val: `${todayP}g`, label: 'Protein', color: '#2D5A3D', bg: '#E8F0EB' },
                { val: `${todayC}g`, label: 'Carbs', color: '#C4742B', bg: '#FFF0E5' },
                { val: `${todayF}g`, label: 'Fat', color: '#6B6B65', bg: '#F0F0ED' },
              ].map(m => (
                <div key={m.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: m.bg }}>
                  <p className="text-lg font-bold" style={{ color: m.color }}>{m.val}</p>
                  <p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: m.color, opacity: 0.5 }}>{m.label}</p>
                </div>
              ))}
            </div>
            {proteinTarget && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#2D5A3D] font-medium">Protein</span>
                  <span className="text-[#B0B0A8]">{todayP} / {proteinTarget}g</span>
                </div>
                <div className="h-2 bg-[#E8F0EB] rounded-full overflow-hidden"><div className="h-full bg-[#2D5A3D] rounded-full transition-all" style={{ width: `${Math.min(100, (todayP / proteinTarget) * 100)}%` }} /></div>
                {proteinRemaining !== null && proteinRemaining > 0 && <p className="text-[10px] text-[#2D5A3D] mt-1.5">{getProteinSuggestion(proteinRemaining)}</p>}
              </div>
            )}
          </div>

          {/* Meals */}
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(meal => (
            <div key={meal} className="bg-white border border-[#EDEDEA] rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-[#1E1E1C] capitalize">{meal === 'breakfast' ? '🌅 Breakfast' : meal === 'lunch' ? '☀️ Lunch' : meal === 'dinner' ? '🌙 Dinner' : '🍎 Snack'}</h3>
                <div className="flex items-center gap-2">
                  {meals[meal].length > 0 && <span className="text-[10px] text-[#B0B0A8] font-medium">{meals[meal].reduce((s, f) => s + f.calories, 0)} cal · {meals[meal].reduce((s, f) => s + f.protein, 0)}g P</span>}
                  <button onClick={() => { setMealType(meal); setModal('food') }} className="w-6 h-6 rounded-md bg-[#F0F0ED] text-[#6B6B65] flex items-center justify-center text-sm cursor-pointer hover:bg-[#E5E5E0] transition-colors">+</button>
                </div>
              </div>
              {meals[meal].length === 0 ? (
                <p className="text-xs text-[#C5C5BE] py-1 italic">Nothing logged</p>
              ) : (
                <div className="space-y-1.5">
                  {meals[meal].map(food => (
                    <div key={food.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F5F2]">
                      <div>
                        <span className="text-sm text-[#1E1E1C]">{food.food_name}</span>
                        <span className="text-[10px] text-[#C5C5BE] ml-2">{formatTime(food.logged_at)}</span>
                      </div>
                      <div className="flex gap-2 text-[10px]">
                        <span className="text-[#B0B0A8]">{food.calories}cal</span>
                        <span className="text-[#2D5A3D] font-semibold">{food.protein}g P</span>
                        <span className="text-[#B0B0A8]">{food.carbs}g C</span>
                        <span className="text-[#B0B0A8]">{food.fat}g F</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Water */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-[#1E1E1C]">💧 Water</h3>
              <span className="text-sm font-bold text-[#4A90D9]">{todayWater} / 80 oz</span>
            </div>
            <div className="h-2 bg-[#E0EBF5] rounded-full overflow-hidden mb-3"><div className="h-full bg-[#4A90D9] rounded-full transition-all" style={{ width: `${Math.min(100, (todayWater / 80) * 100)}%` }} /></div>
            <div className="flex gap-2">
              {WATER_AMOUNTS.map(oz => (
                <button key={oz} onClick={() => logWater(oz)} className="flex-1 bg-[#E0EBF5] text-[#4A90D9] py-2 rounded-lg text-xs font-semibold hover:bg-[#D0E0F0] transition-colors cursor-pointer">+{oz}oz</button>
              ))}
            </div>
          </div>
        </>)}

        {/* ══════════ HEALTH TAB ══════════ */}
        {activeTab === 'health' && (<>
          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: '💉', label: 'Injection', action: () => setModal('med'), color: 'bg-[#2D5A3D]' },
              { icon: '⚖️', label: 'Weight', action: () => setModal('weight'), color: 'bg-[#C4742B]' },
              { icon: '🏋️', label: 'Exercise', action: () => setModal('exercise'), color: 'bg-[#4A90D9]' },
              { icon: '🩹', label: 'Symptom', action: () => setModal('sideEffect'), color: 'bg-[#6B6B65]' },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} className={`${btn.color} text-white rounded-xl py-3 text-center hover:opacity-90 transition-opacity cursor-pointer`}>
                <span className="text-xl block">{btn.icon}</span>
                <span className="text-[9px] font-semibold mt-0.5 block">{btn.label}</span>
              </button>
            ))}
          </div>

          {/* Injection tracker */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-[#1E1E1C] mb-3">Injection Tracker</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-[#F5F5F2] rounded-lg p-3">
                <p className="text-[9px] text-[#B0B0A8] uppercase font-semibold">Last Site</p>
                <p className="text-sm font-bold text-[#1E1E1C] mt-0.5">{lastInjectionSite || '—'}</p>
              </div>
              <div className="bg-[#FFF8F0] rounded-lg p-3">
                <p className="text-[9px] text-[#C4742B] uppercase font-semibold">Next Site</p>
                <p className="text-sm font-bold text-[#C4742B] mt-0.5">{suggestedSite}</p>
              </div>
              <div className="bg-[#E8F0EB] rounded-lg p-3">
                <p className="text-[9px] text-[#2D5A3D] uppercase font-semibold">Next Dose</p>
                <p className="text-sm font-bold text-[#2D5A3D] mt-0.5">{daysUntilInjection !== null ? daysUntilInjection === 0 ? 'Today' : `${daysUntilInjection}d` : '—'}</p>
              </div>
            </div>
            {/* Injection history */}
            {medLogs.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Recent Injections</p>
                {medLogs.slice(0, 5).map(m => (
                  <div key={m.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F5F2]">
                    <div>
                      <span className="text-sm text-[#1E1E1C]">{m.injection_site || 'No site'}</span>
                      <span className="text-[10px] text-[#B0B0A8] ml-2">{m.dose}</span>
                    </div>
                    <span className="text-[10px] text-[#B0B0A8]">{formatDate(m.logged_at)} · {formatTime(m.logged_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weight graph */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold text-[#1E1E1C]">Weight Trend</h2>
              {progressPct !== null && <span className="text-[10px] text-[#2D5A3D] font-semibold bg-[#E8F0EB] px-2 py-0.5 rounded-full">{progressPct}% to goal</span>}
            </div>
            <WeightGraph data={weightLogs} goalWeight={goalWeight} />
            {weightLogs.length > 0 && (
              <div className="space-y-1.5 mt-3">
                {weightLogs.slice(0, 5).map(w => (
                  <div key={w.id} className="flex justify-between items-center py-1 border-t border-[#F5F5F2]">
                    <span className="text-sm text-[#1E1E1C] font-medium">{w.weight} lbs</span>
                    <span className="text-[10px] text-[#B0B0A8]">{formatDate(w.logged_at)} · {formatTime(w.logged_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Exercise log */}
          {exerciseLogs.length > 0 && (
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[#1E1E1C] mb-3">Recent Exercise</h2>
              <div className="space-y-2">
                {exerciseLogs.slice(0, 5).map(e => (
                  <div key={e.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F5F2]">
                    <div>
                      <span className="text-sm text-[#1E1E1C]">{e.exercise_type}</span>
                      <span className="text-xs text-[#4A90D9] ml-2 font-medium">{e.duration_minutes} min</span>
                    </div>
                    <span className="text-[10px] text-[#B0B0A8]">{formatDate(e.logged_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent side effects */}
          {sideEffectLogs.length > 0 && (
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[#1E1E1C] mb-3">Side Effects</h2>
              <div className="space-y-2">
                {sideEffectLogs.slice(0, 5).map(e => (
                  <div key={e.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F5F2]">
                    <div>
                      <span className="text-sm text-[#1E1E1C]">{e.symptom}</span>
                      <span className="text-xs text-[#C4742B] ml-2">{'●'.repeat(e.severity)}{'○'.repeat(5 - e.severity)}</span>
                    </div>
                    <span className="text-[10px] text-[#B0B0A8]">{formatDate(e.logged_at)} · {formatTime(e.logged_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mood/energy history */}
          {checkinLogs.length > 0 && (
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[#1E1E1C] mb-3">Mood &amp; Energy</h2>
              <div className="space-y-2">
                {checkinLogs.slice(0, 5).map(c => (
                  <div key={c.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F5F2]">
                    <div className="flex gap-3">
                      <span className="text-xs"><span className="text-[#B0B0A8]">Mood:</span> <span className="font-medium text-[#1E1E1C]">{MOOD_LABELS[c.mood - 1]}</span></span>
                      <span className="text-xs"><span className="text-[#B0B0A8]">Energy:</span> <span className="font-medium text-[#1E1E1C]">{ENERGY_LABELS[c.energy - 1]}</span></span>
                    </div>
                    <span className="text-[10px] text-[#B0B0A8]">{formatDate(c.logged_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>)}
      </div>

      {/* ══════════ MODALS ══════════ */}

      {/* Food Modal */}
      {modal === 'food' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Log Food</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <div className="grid grid-cols-4 gap-2">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(m => (
                <button key={m} onClick={() => setMealType(m)} className={`text-xs py-2 rounded-lg border capitalize transition-all cursor-pointer ${mealType === m ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>{m}</button>
              ))}
            </div>
            <div>
              <div className="flex gap-2">
                <input type="text" value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="e.g. 8 oz ribeye steak" className="flex-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] bg-white text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]" />
                <button type="button" onClick={calculateMacros} disabled={!foodName.trim() || isCalculating} className="bg-[#2D5A3D] text-white px-3 py-2.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 hover:bg-[#3A7A52] transition-colors whitespace-nowrap">{isCalculating ? '...' : '⚡ Calc'}</button>
              </div>
              <p className="text-[10px] text-[#C5C5BE] mt-1">Include quantity for accurate results</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Calories', val: foodCalories, set: setFoodCalories, color: '#1E1E1C' },
                { label: 'Protein (g)', val: foodProtein, set: setFoodProtein, color: '#2D5A3D' },
                { label: 'Carbs (g)', val: foodCarbs, set: setFoodCarbs, color: '#C4742B' },
                { label: 'Fat (g)', val: foodFat, set: setFoodFat, color: '#6B6B65' },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: f.color }}>{f.label}</label>
                  <input type="number" value={f.val} onChange={(e) => f.set(e.target.value)} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D]" />
                </div>
              ))}
            </div>
            <button onClick={logFood} disabled={!foodName.trim()} className="w-full bg-[#2D5A3D] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-30 hover:bg-[#3A7A52] transition-colors">Save</button>
          </div>
        </div>
      )}

      {/* Medication Modal */}
      {modal === 'med' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Log Injection</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <div className="bg-[#F5F5F2] rounded-lg px-4 py-2.5"><p className="text-[10px] text-[#B0B0A8]">Medication</p><p className="text-sm font-semibold text-[#1E1E1C]">{profile?.medication} · {profile?.dose}</p></div>
            <div>
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Injection Site</p>
              <div className="grid grid-cols-2 gap-2">
                {INJECTION_SITES.map(site => (
                  <button key={site} onClick={() => setInjectionSite(site)} className={`text-xs px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${injectionSite === site ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>{site}</button>
                ))}
              </div>
            </div>
            <input type="text" value={medNotes} onChange={(e) => setMedNotes(e.target.value)} placeholder="Notes (optional)" className="w-full px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]" />
            <button onClick={logMedication} className="w-full bg-[#2D5A3D] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors">Save</button>
          </div>
        </div>
      )}

      {/* Weight Modal */}
      {modal === 'weight' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Log Weight</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <input type="number" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} placeholder="Weight in pounds" autoFocus className="w-full px-4 py-4 rounded-lg border-2 border-[#EDEDEA] bg-white text-2xl text-center text-[#1E1E1C] font-bold outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE] placeholder:font-normal placeholder:text-base" />
            {latestWeight && newWeight && (
              <p className={`text-center text-sm font-medium ${parseFloat(newWeight) < latestWeight ? 'text-[#2D5A3D]' : parseFloat(newWeight) > latestWeight ? 'text-[#C4742B]' : 'text-[#8B8B83]'}`}>
                {parseFloat(newWeight) < latestWeight ? `↓ ${(latestWeight - parseFloat(newWeight)).toFixed(1)} lbs from last` : parseFloat(newWeight) > latestWeight ? `↑ ${(parseFloat(newWeight) - latestWeight).toFixed(1)} lbs from last` : 'Same as last'}
              </p>
            )}
            <button onClick={logWeightEntry} disabled={!newWeight} className="w-full bg-[#C4742B] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-30 hover:bg-[#a86224] transition-colors">Save</button>
          </div>
        </div>
      )}

      {/* Side Effect Modal */}
      {modal === 'sideEffect' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Log Side Effect</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <div>
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Symptom</p>
              <div className="flex flex-wrap gap-1.5">
                {SYMPTOMS.map(s => (
                  <button key={s} onClick={() => setSymptom(s)} className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${symptom === s ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Severity: {severity}/5</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setSeverity(n)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold cursor-pointer transition-all ${n <= severity ? 'bg-[#C4742B] text-white' : 'bg-[#F5F5F2] text-[#C5C5BE]'}`}>{n}</button>
                ))}
              </div>
              <div className="flex justify-between mt-1"><span className="text-[9px] text-[#C5C5BE]">Mild</span><span className="text-[9px] text-[#C5C5BE]">Severe</span></div>
            </div>
            <button onClick={logSideEffect} disabled={!symptom} className="w-full bg-[#6B6B65] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-30 hover:bg-[#555] transition-colors">Save</button>
          </div>
        </div>
      )}

      {/* Check-in Modal */}
      {modal === 'checkin' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Daily Check-in</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <div>
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Mood</p>
              <div className="flex gap-2">
                {MOOD_LABELS.map((label, i) => (
                  <button key={label} onClick={() => setCheckinMood(i + 1)} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold cursor-pointer transition-all ${checkinMood === i + 1 ? 'bg-[#2D5A3D] text-white' : 'bg-[#F5F5F2] text-[#8B8B83]'}`}>{label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Energy</p>
              <div className="flex gap-2">
                {ENERGY_LABELS.map((label, i) => (
                  <button key={label} onClick={() => setCheckinEnergy(i + 1)} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold cursor-pointer transition-all ${checkinEnergy === i + 1 ? 'bg-[#4A90D9] text-white' : 'bg-[#F5F5F2] text-[#8B8B83]'}`}>{label}</button>
                ))}
              </div>
            </div>
            <input type="text" value={checkinNotes} onChange={(e) => setCheckinNotes(e.target.value)} placeholder="Anything else? (optional)" className="w-full px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]" />
            <button onClick={logCheckin} className="w-full bg-[#2D5A3D] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors">Save Check-in</button>
          </div>
        </div>
      )}

      {/* Exercise Modal */}
      {modal === 'exercise' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#1E1E1C]">Log Exercise</h2><button onClick={() => setModal(null)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button></div>
            <div>
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Type</p>
              <div className="flex flex-wrap gap-1.5">
                {EXERCISE_TYPES.map(t => (
                  <button key={t} onClick={() => setExerciseType(t)} className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${exerciseType === t ? 'border-[#4A90D9] bg-[#E0EBF5] text-[#4A90D9] font-semibold' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Duration (minutes)</label>
              <input type="number" value={exerciseDuration} onChange={(e) => setExerciseDuration(e.target.value)} placeholder="30" className="w-full px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#4A90D9]" />
            </div>
            <input type="text" value={exerciseNotes} onChange={(e) => setExerciseNotes(e.target.value)} placeholder="Notes (optional)" className="w-full px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#4A90D9] placeholder:text-[#C5C5BE]" />
            <button onClick={logExercise} disabled={!exerciseType || !exerciseDuration} className="w-full bg-[#4A90D9] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-30 hover:bg-[#3A7DBF] transition-colors">Save</button>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EDEDEA] px-4 py-2 flex justify-around z-50">
        <a href="/dashboard" className="flex flex-col items-center gap-0.5 text-[#2D5A3D]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
          <span className="text-[10px] font-semibold">Home</span>
        </a>
        <a href="/chat" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span className="text-[10px] font-medium">Nova</span>
        </a>
        <a href="#" className="flex flex-col items-center gap-0.5 text-[#B0B0A8]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="text-[10px] font-medium">Savings</span>
        </a>
      </nav>
    </div>
  )
}
