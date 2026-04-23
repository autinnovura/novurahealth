'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import FirstRunModal from '../components/FirstRunModal'
import MedicationLevelChart from '../components/MedicationLevelChart'
import LogEntryMenu from '../components/LogEntryMenu'
import { motion } from 'framer-motion'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'
import {
  Utensils, Syringe, Scale, Dumbbell, Stethoscope,
  Droplets, ChevronLeft, ChevronRight, Plus, LogOut,
  Flame, Sparkles, TrendingUp, MessageCircle
} from 'lucide-react'
import BottomNav from '../components/BottomNav'
import StreakCalendar from '../components/StreakCalendar'
import { getDosesForBrand, findMedicationByLabel } from '../lib/medications'

// ── Types ──────────────────────────────────────────────
interface Profile { name: string; medication: string; dose: string; start_date: string; current_weight: string; goal_weight: string; primary_goal: string; biggest_challenge: string; exercise_level: string; first_run_complete?: boolean | null; protein_target_g?: number | null; water_target_oz?: number | null; injection_day?: string | null; injection_time?: string | null }
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
// Derive dose options from centralized medication library
function getMedicationDoses(medName: string): number[] {
  const doses = getDosesForBrand(medName)
  if (doses.length > 0) return doses.map(d => parseFloat(d))
  return [0.25, 0.5, 1.0, 2.0] // fallback for unknown medications
}

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

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function relativeTime(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Animation variants ────────────────────────────────
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } } }

// ── Progress Ring ─────────────────────────────────────
function ProgressRing({ percent, size = 80, stroke = 6 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(100, Math.max(0, percent)) / 100) * circ
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EAF2EB" strokeWidth={stroke} />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="url(#ringGrad)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      />
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7FFFA4" />
          <stop offset="100%" stopColor="#1F4B32" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Water Glass Visual ────────────────────────────────
function WaterGlass({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, (current / target) * 100)
  return (
    <div className="relative w-10 h-14 mx-auto">
      <div className="absolute inset-0 rounded-b-lg border-2 border-[#B8D4E8] border-t-0 overflow-hidden"
        style={{ borderTopLeftRadius: '2px', borderTopRightRadius: '2px' }}>
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#4A90D9] to-[#7BBFEA]"
          initial={{ height: '0%' }}
          animate={{ height: `${pct}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
        />
      </div>
      <div className="absolute -top-0.5 left-0 right-0 h-1 border-2 border-b-0 border-[#B8D4E8] rounded-t-sm" />
    </div>
  )
}

// ── Skeleton Shimmer ──────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-gradient-to-r from-[#EAF2EB] via-[#F5F8F3] to-[#EAF2EB] bg-[length:200%_100%] ${className}`} />
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
  const [medChartLogs, setMedChartLogs] = useState<MedLog[]>([])
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
  const [medDose, setMedDose] = useState('')
  const [customDose, setCustomDose] = useState('')
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
  const [showFirstRun, setShowFirstRun] = useState(false)
  const [medMenuId, setMedMenuId] = useState<string | null>(null)
  const [editingMed, setEditingMed] = useState<MedLog | null>(null)
  const [editMedDose, setEditMedDose] = useState('')
  const [editMedSite, setEditMedSite] = useState('')
  const [editMedDate, setEditMedDate] = useState('')

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
      if (!p.first_run_complete) setShowFirstRun(true)

      const today = startOfDay(new Date())
      const monthAgo = addDays(today, -30)

      const [meds, weights, effects, todayFoods, monthFoods, water, checkins, exercises, medChart] = await Promise.all([
        supabase.from('medication_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(20),
        supabase.from('weight_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(30),
        supabase.from('side_effect_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10),
        supabase.from('food_logs').select('*').eq('user_id', user.id).gte('logged_at', today.toISOString()).order('logged_at', { ascending: true }),
        supabase.from('food_logs').select('*').eq('user_id', user.id).gte('logged_at', monthAgo.toISOString()).order('logged_at', { ascending: true }),
        supabase.from('water_logs').select('*').eq('user_id', user.id).gte('logged_at', today.toISOString()),
        supabase.from('checkin_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(7),
        supabase.from('exercise_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10),
        supabase.from('medication_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: true }),
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
      setMedChartLogs(medChart.data || [])
      setStreak(calculateStreak(monthFoods.data || []))
      setLoading(false)
    }
    init()
  }, [router, calculateStreak])

  // Refetch when date or view changes
  useEffect(() => {
    if (userId) fetchDateData(userId, selectedDate, nutritionView)
  }, [userId, selectedDate, nutritionView, fetchDateData])

  // Re-fetch all data after an edit/delete
  const refreshData = useCallback(async () => {
    if (!userId) return
    const today = startOfDay(new Date())
    const monthAgo = addDays(today, -30)
    const [meds, weights, effects, todayFoods, monthFoods, water, exercises, medChart] = await Promise.all([
      supabase.from('medication_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }).limit(20),
      supabase.from('weight_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }).limit(30),
      supabase.from('side_effect_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }).limit(10),
      supabase.from('food_logs').select('*').eq('user_id', userId).gte('logged_at', today.toISOString()).order('logged_at', { ascending: true }),
      supabase.from('food_logs').select('*').eq('user_id', userId).gte('logged_at', monthAgo.toISOString()).order('logged_at', { ascending: true }),
      supabase.from('water_logs').select('*').eq('user_id', userId).gte('logged_at', today.toISOString()),
      supabase.from('exercise_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }).limit(10),
      supabase.from('medication_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: true }),
    ])
    setMedLogs(meds.data || [])
    setWeightLogs(weights.data || [])
    setSideEffectLogs(effects.data || [])
    setTodayFoodLogs(todayFoods.data || [])
    setAllFoodLogs(monthFoods.data || [])
    setWaterLogs(water.data || [])
    setExerciseLogs(exercises.data || [])
    setMedChartLogs(medChart.data || [])
    setStreak(calculateStreak(monthFoods.data || []))
    fetchDateData(userId, selectedDate, nutritionView)
  }, [userId, calculateStreak, fetchDateData, selectedDate, nutritionView])

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
    const finalDose = medDose === 'custom' ? `${customDose}mg` : medDose || profile.dose
    const { data } = await supabase.from('medication_logs').insert({ user_id: userId, medication: profile.medication, dose: finalDose, injection_site: injectionSite, notes: medNotes }).select().single()
    if (data) {
      setMedLogs([data, ...medLogs])
      // Update profile dose if changed
      if (finalDose !== profile.dose) {
        await supabase.from('profiles').update({ dose: finalDose }).eq('id', userId)
        setProfile({ ...profile, dose: finalDose })
      }
      // Re-fetch chart logs so the chart updates immediately
      const { data: updated } = await supabase.from('medication_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: true })
      if (updated) setMedChartLogs(updated)
    }
    setModal(null); setInjectionSite(''); setMedDose(''); setCustomDose(''); setMedNotes('')
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

  async function deleteMedLog(id: string) {
    if (!userId || !confirm('Delete this injection?')) return
    const res = await fetch(`/api/medication-logs/${id}?userId=${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setMedLogs(prev => prev.filter(m => m.id !== id))
      setMedChartLogs(prev => prev.filter(m => m.id !== id))
    }
    setMedMenuId(null)
  }

  function openEditMed(m: MedLog) {
    setEditingMed(m)
    setEditMedDose(m.dose)
    setEditMedSite(m.injection_site || '')
    setEditMedDate(new Date(m.logged_at).toISOString().slice(0, 16))
    setMedMenuId(null)
  }

  async function saveEditMed() {
    if (!editingMed || !userId) return
    const res = await fetch(`/api/medication-logs/${editingMed.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        dose: editMedDose,
        injection_site: editMedSite,
        logged_at: new Date(editMedDate).toISOString(),
      }),
    })
    if (res.ok) {
      const updated = { ...editingMed, dose: editMedDose, injection_site: editMedSite, logged_at: new Date(editMedDate).toISOString() }
      setMedLogs(prev => prev.map(m => m.id === editingMed.id ? updated : m))
      setMedChartLogs(prev => prev.map(m => m.id === editingMed.id ? updated : m))
    }
    setEditingMed(null)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="space-y-4 w-full max-w-md px-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )

  // ── Computed Stats ─────────────────────────────────
  const latestWeight = weightLogs[0]?.weight || (profile?.current_weight ? parseFloat(profile.current_weight) : null)
  const goalWeight = profile?.goal_weight ? parseFloat(profile.goal_weight) : null
  const startWeight = profile?.current_weight ? parseFloat(profile.current_weight) : null
  const weightLost = startWeight && latestWeight ? Math.round((startWeight - latestWeight) * 10) / 10 : null
  const progressPct = startWeight && goalWeight && latestWeight ? Math.min(100, Math.max(0, Math.round(((startWeight - latestWeight) / (startWeight - goalWeight)) * 100))) : null
  const defaultProteinTarget = goalWeight ? Math.round((goalWeight / 2.205) * 1.4) : null
  const proteinTarget = profile?.protein_target_g || defaultProteinTarget
  const waterTarget = profile?.water_target_oz || 80
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
    if (rem <= 0) return "You hit your protein target!"
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

  // Weight sparkline data for Recharts
  const sparklineData = [...weightLogs].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()).map(w => ({ weight: w.weight }))

  // Smart insight line
  const insightLine = (() => {
    if (goalWeight && latestWeight) {
      const remaining = Math.round((latestWeight - goalWeight) * 10) / 10
      if (remaining <= 0) return 'You reached your goal weight. Amazing.'
      if (weightLost && weightLost > 0) {
        const weeksOnMed = daysOnMed ? Math.max(1, Math.round(daysOnMed / 7)) : null
        if (weeksOnMed && weeksOnMed > 1) {
          const rate = weightLost / weeksOnMed
          const weeksLeft = Math.round(remaining / rate)
          if (weeksLeft > 0 && weeksLeft < 100) return `${remaining} lbs from goal. ~${weeksLeft} weeks at your pace.`
        }
        return `${remaining} lbs from goal. You're ${weightLost} lbs down.`
      }
      return `${remaining} lbs to go. Log consistently to build momentum.`
    }
    if (streak > 3) return `${streak}-day streak. Consistency is everything.`
    return 'Your health journey starts with showing up.'
  })()

  // Build recent activity feed
  const activityFeed = [
    ...todayFoodLogs.map(f => ({ icon: 'food' as const, text: `Logged ${f.food_name}`, time: f.logged_at })),
    ...waterLogs.map(w => ({ icon: 'water' as const, text: `Drank ${w.amount_oz}oz water`, time: w.logged_at })),
    ...medLogs.filter(m => isToday(new Date(m.logged_at))).map(m => ({ icon: 'med' as const, text: `${m.medication} ${m.dose}`, time: m.logged_at })),
    ...exerciseLogs.filter(e => isToday(new Date(e.logged_at))).map(e => ({ icon: 'exercise' as const, text: `${e.exercise_type} · ${e.duration_minutes}min`, time: e.logged_at })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6)

  const activityIcons = { food: Utensils, water: Droplets, med: Syringe, exercise: Dumbbell }

  // Next injection day name
  const nextInjDayName = daysUntilInj !== null ? (daysUntilInj === 0 ? 'Today' : daysUntilInj === 1 ? 'Tomorrow' : new Date(Date.now() + daysUntilInj * 86400000).toLocaleDateString('en-US', { weekday: 'short' })) : '—'

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-24" style={{ fontFamily: 'var(--font-inter)' }} onClick={() => medMenuId && setMedMenuId(null)}>
      {showFirstRun && userId && profile && (
        <FirstRunModal
          userId={userId}
          name={profile.name}
          medication={profile.medication}
          dose={profile.dose}
          currentWeight={profile.current_weight}
          onComplete={() => setShowFirstRun(false)}
        />
      )}

      {/* HEADER — subtle gradient */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-[#F5F8F3] to-[#EAF2EB]" />
        <div className="relative max-w-2xl mx-auto px-5 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#0D1F16] tracking-[-0.02em]" style={{ fontFamily: 'var(--font-fraunces)' }}>
                {getGreeting()}{profile?.name ? `, ${profile.name}` : ''}
              </h1>
              <p className="text-sm text-[#6B7A72] mt-1 max-w-[280px]">{insightLine}</p>
            </div>
            <div className="flex items-center gap-2">
              {streak > 0 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_2px_12px_-4px_rgba(31,75,50,0.3)]"
                >
                  <Flame className="w-3.5 h-3.5 text-[#7FFFA4]" />
                  <span className="text-white text-xs font-semibold tabular-nums">{streak}</span>
                </motion.div>
              )}
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="text-[#6B7A72]/40 hover:text-[#6B7A72] transition-colors cursor-pointer p-1">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-[#6B7A72]/60 mt-1">{profile?.medication}{profile?.dose ? ` · ${profile.dose}` : ''}{daysOnMed ? ` · Day ${daysOnMed}` : ''}</p>
        </div>
      </header>

      {/* TABS — segmented control */}
      <div className="bg-white/80 backdrop-blur-md border-b border-[#EAF2EB] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-2">
          <div className="relative bg-[#F5F8F3] rounded-xl p-1 flex">
            {(['overview','nutrition','health'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`relative flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200 z-10 cursor-pointer ${
                  activeTab === tab ? 'text-[#1F4B32]' : 'text-[#6B7A72]/50 hover:text-[#6B7A72]'
                }`}>
                {activeTab === tab && (
                  <motion.div
                    layoutId="dashboardTabIndicator"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10">{tab}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <motion.div className="max-w-2xl mx-auto px-4 py-5 space-y-4" initial="hidden" animate="visible" variants={stagger} key={activeTab}>

        {/* ══════════ OVERVIEW ══════════ */}
        {activeTab === 'overview' && (<>
          {/* Injection reminder */}
          {daysUntilInj !== null && daysUntilInj <= 1 && (
            <motion.div variants={fadeUp} className="bg-gradient-to-r from-[#FFF8F0] to-[#FFF4E8] border border-[#C4742B]/10 rounded-3xl p-5 flex items-center gap-4 shadow-[0_4px_24px_-8px_rgba(196,116,43,0.08)]">
              <div className="w-12 h-12 rounded-2xl bg-[#C4742B]/10 flex items-center justify-center shrink-0">
                <Syringe className="w-5 h-5 text-[#C4742B]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#0D1F16]">{daysUntilInj === 0 ? 'Injection day' : 'Injection tomorrow'}</p>
                <p className="text-xs text-[#8B7355] mt-0.5">Suggested site: {nextSite}</p>
              </div>
              <button onClick={() => { setInjectionSite(nextSite); setModal('med') }} className="bg-[#C4742B] text-white px-5 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(196,116,43,0.4)] transition-all duration-300">Log</button>
            </motion.div>
          )}

          {/* Check-in prompt */}
          {!todayCheckin && (
            <motion.button variants={fadeUp} onClick={() => setModal('checkin')} className="w-full bg-white border border-[#EAF2EB] rounded-3xl p-5 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.1)] transition-all duration-300 cursor-pointer text-left">
              <div className="w-10 h-10 rounded-2xl bg-[#EAF2EB] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#1F4B32]" />
              </div>
              <div className="flex-1"><p className="text-sm font-semibold text-[#0D1F16]">How are you feeling?</p><p className="text-xs text-[#6B7A72]">Quick mood & energy check-in</p></div>
              <ChevronRight className="w-4 h-4 text-[#6B7A72]/30" />
            </motion.button>
          )}

          {/* HERO — Weight Progress Card */}
          <motion.div variants={fadeUp} className="bg-white rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Current Weight</p>
                <p className="text-[48px] font-bold text-[#0D1F16] leading-none mt-1 tracking-[-0.02em]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {latestWeight ?? '—'}
                </p>
                <p className="text-xs text-[#6B7A72] mt-0.5">lbs</p>
                {weightLost !== null && weightLost > 0 && (
                  <p className="text-sm font-semibold text-[#7FFFA4] mt-2 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="text-[#1F4B32]">{weightLost} lbs lost{daysOnMed ? ` in ${daysOnMed} days` : ''}</span>
                  </p>
                )}
              </div>
              {progressPct !== null && (
                <div className="relative">
                  <ProgressRing percent={progressPct} size={80} stroke={6} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-[#1F4B32]" style={{ fontVariantNumeric: 'tabular-nums' }}>{progressPct}%</span>
                  </div>
                </div>
              )}
            </div>
            {sparklineData.length >= 2 && (
              <div className="mt-4 -mx-2 h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData}>
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7FFFA4" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#7FFFA4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                    <Area type="monotone" dataKey="weight" stroke="#1F4B32" strokeWidth={2} fill="url(#sparkGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {goalWeight && (
              <div className="flex items-center justify-between mt-2 text-[10px] text-[#6B7A72]">
                <span>Start: {startWeight} lbs</span>
                <span>Goal: {goalWeight} lbs</span>
              </div>
            )}
          </motion.div>

          {/* Secondary stat tiles */}
          <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
            {/* Protein */}
            <div className="bg-white rounded-3xl p-4 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)] transition-all duration-300">
              <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Protein</p>
              <p className="text-xl font-bold text-[#1F4B32] mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{todayP}<span className="text-[10px] font-normal text-[#6B7A72]">/{proteinTarget??'—'}g</span></p>
              {proteinTarget && (
                <div className="h-1.5 bg-[#EAF2EB] rounded-full mt-2 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: todayP >= proteinTarget ? 'linear-gradient(90deg, #7FFFA4, #1F4B32)' : '#1F4B32' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100,(todayP/proteinTarget)*100)}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                  />
                </div>
              )}
            </div>

            {/* Water */}
            <div className="bg-white rounded-3xl p-4 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)] transition-all duration-300">
              <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Water</p>
              <WaterGlass current={todayWater} target={waterTarget} />
              <p className="text-center text-xs font-bold text-[#4A90D9] mt-1.5" style={{ fontVariantNumeric: 'tabular-nums' }}>{todayWater}<span className="text-[10px] font-normal text-[#6B7A72]">/{waterTarget}oz</span></p>
            </div>

            {/* Next injection */}
            <div className="bg-white rounded-3xl p-4 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)] transition-all duration-300">
              <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Next Dose</p>
              <p className="text-3xl font-bold text-[#0D1F16] mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{daysUntilInj ?? '—'}</p>
              <p className="text-[10px] text-[#6B7A72]">{daysUntilInj !== null ? (daysUntilInj === 1 ? 'day' : 'days') : ''} · {nextInjDayName}</p>
            </div>
          </motion.div>

          {/* "What should I eat?" CTA */}
          <motion.a variants={fadeUp} href="/chat?prompt=What+should+I+eat+right+now%3F"
            className="block bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white font-semibold py-4 px-6 rounded-3xl text-center text-sm hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.4)] transition-all duration-300 hover:-translate-y-0.5">
            <Utensils className="w-4 h-4 inline-block mr-2 -mt-0.5" /> What should I eat?
          </motion.a>

          {/* Protein suggestion */}
          {proteinRem !== null && proteinRem > 0 && (
            <motion.div variants={fadeUp} className="bg-gradient-to-r from-[#EAF2EB] to-[#F0F7F2] rounded-3xl px-5 py-3.5 border border-[#EAF2EB]">
              <p className="text-xs text-[#1F4B32] font-medium">{getProteinSuggestion(proteinRem)}</p>
            </motion.div>
          )}

          {/* Weekly summary */}
          <motion.div variants={fadeUp} className="bg-white rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
            <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-4">This Week</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-lg font-bold text-[#0D1F16]" style={{ fontVariantNumeric: 'tabular-nums' }}>{avgDailyCal}</p><p className="text-[9px] text-[#6B7A72]">avg cal/day</p></div>
              <div><p className="text-lg font-bold text-[#1F4B32]" style={{ fontVariantNumeric: 'tabular-nums' }}>{avgDailyP}g</p><p className="text-[9px] text-[#6B7A72]">avg protein</p></div>
              <div><p className="text-lg font-bold text-[#C4742B]" style={{ fontVariantNumeric: 'tabular-nums' }}>{proteinHitDays}/{daysThisWeek}</p><p className="text-[9px] text-[#6B7A72]">protein days</p></div>
              <div><p className="text-lg font-bold text-[#4A90D9]" style={{ fontVariantNumeric: 'tabular-nums' }}>{exerciseLogs.filter(e => new Date(e.logged_at) >= weekStart).length}</p><p className="text-[9px] text-[#6B7A72]">workouts</p></div>
            </div>
          </motion.div>

          {/* Water quick-add */}
          <motion.div variants={fadeUp} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
            <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-3">Quick Add Water</p>
            <div className="flex gap-2">{WATER_AMOUNTS.map(oz => (
              <button key={oz} onClick={() => logWater(oz)} className="flex-1 bg-[#EDF5FC] text-[#4A90D9] py-2.5 rounded-2xl text-xs font-semibold hover:bg-[#D8ECFA] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">+{oz}oz</button>
            ))}</div>
          </motion.div>

          {/* Medication level chart */}
          {profile?.medication && (
            <motion.div variants={fadeUp}>
              <MedicationLevelChart
                medication={profile.medication}
                dose={profile.dose}
                injectionLogs={medChartLogs || []}
              />
            </motion.div>
          )}

          {/* Quick actions — glassmorphic pills */}
          <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {[
              { icon: Utensils, label: 'Food', action: () => setModal('food'), bg: 'bg-orange-50', iconColor: 'text-orange-500', ringColor: 'ring-orange-100' },
              { icon: Syringe, label: 'Injection', action: () => setModal('med'), bg: 'bg-emerald-50', iconColor: 'text-emerald-600', ringColor: 'ring-emerald-100' },
              { icon: Scale, label: 'Weight', action: () => setModal('weight'), bg: 'bg-slate-50', iconColor: 'text-slate-600', ringColor: 'ring-slate-100' },
              { icon: Dumbbell, label: 'Exercise', action: () => setModal('exercise'), bg: 'bg-blue-50', iconColor: 'text-blue-500', ringColor: 'ring-blue-100' },
              { icon: Stethoscope, label: 'Symptom', action: () => setModal('sideEffect'), bg: 'bg-rose-50', iconColor: 'text-rose-500', ringColor: 'ring-rose-100' },
            ].map(b => (
              <button key={b.label} onClick={b.action}
                className="flex items-center gap-2.5 bg-white/60 backdrop-blur-md border border-white rounded-2xl py-3 px-4 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.1)] transition-all duration-300 cursor-pointer shrink-0">
                <div className={`w-8 h-8 rounded-xl ${b.bg} ring-1 ${b.ringColor} flex items-center justify-center`}>
                  <b.icon className={`w-4 h-4 ${b.iconColor}`} strokeWidth={1.5} />
                </div>
                <span className="text-xs font-semibold text-[#0D1F16] whitespace-nowrap">{b.label}</span>
              </button>
            ))}
          </motion.div>

          {/* Streak calendar */}
          <motion.div variants={fadeUp} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
            <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-3">Logging Streak</p>
            {userId && <StreakCalendar userId={userId} />}
          </motion.div>

          {/* Recent activity feed */}
          {activityFeed.length > 0 && (
            <motion.div variants={fadeUp} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
              <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-4">Today&apos;s Activity</p>
              <div className="relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[#EAF2EB]" />
                <div className="space-y-3">
                  {activityFeed.map((item, i) => {
                    const Icon = activityIcons[item.icon]
                    return (
                      <div key={i} className="flex items-center gap-3 relative">
                        <div className="w-[31px] h-[31px] rounded-full bg-[#F5F8F3] border-2 border-white flex items-center justify-center z-10 shrink-0">
                          <Icon className="w-3.5 h-3.5 text-[#1F4B32]" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#0D1F16] truncate">{item.text}</p>
                        </div>
                        <span className="text-[10px] text-[#6B7A72]/60 shrink-0">{relativeTime(item.time)}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              </div>
            </motion.div>
          )}

          {/* Chat with Nova */}
          <motion.a variants={fadeUp} href="/chat" className="block bg-white border border-[#EAF2EB] rounded-3xl p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)] transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center shrink-0 shadow-[0_4px_12px_-4px_rgba(31,75,50,0.3)]">
                <MessageCircle className="w-5 h-5 text-[#7FFFA4]" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#0D1F16]">Chat with Nova</p>
                <p className="text-xs text-[#6B7A72]">Coaching, meal ideas, side effect help</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6B7A72]/30" />
            </div>
          </motion.a>
        </>)}

        {/* ══════════ NUTRITION ══════════ */}
        {activeTab === 'nutrition' && (<>
          {/* View toggle + date nav */}
          <motion.div variants={fadeUp} className="bg-white border border-[#EAF2EB] rounded-3xl p-4 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
            <div className="flex gap-1 mb-3 bg-[#F5F8F3] rounded-2xl p-1">
              {(['day','week','month'] as const).map(v => (
                <button key={v} onClick={() => { setNutritionView(v); setSelectedDate(new Date()) }}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize cursor-pointer transition-all duration-300 ${nutritionView === v ? 'bg-white text-[#1F4B32] shadow-sm' : 'text-[#6B7A72]/50 hover:text-[#6B7A72]'}`}>{v}</button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => navDate(-1)} className="w-9 h-9 rounded-xl bg-[#F5F8F3] flex items-center justify-center text-[#6B7A72] hover:bg-[#EAF2EB] cursor-pointer transition-all duration-300">
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#0D1F16]">{getDateLabel()}</p>
                {nutritionView !== 'day' && <p className="text-[10px] text-[#6B7A72]">Daily avg shown below</p>}
              </div>
              <button onClick={() => navDate(1)} disabled={isToday(selectedDate)} className="w-9 h-9 rounded-xl bg-[#F5F8F3] flex items-center justify-center text-[#6B7A72] hover:bg-[#EAF2EB] cursor-pointer transition-all duration-300 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </motion.div>

          {/* Macros summary */}
          <motion.div variants={fadeUp} className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm font-semibold text-[#0D1F16]">{nutritionView === 'day' ? 'Nutrition' : `${nutritionView === 'week' ? 'Weekly' : 'Monthly'} Totals`}</p>
              {isToday(selectedDate) && nutritionView === 'day' && (
                <button onClick={() => setModal('food')} className="bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white px-4 py-2 rounded-2xl text-xs font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.3)] transition-all duration-300">
                  <Plus className="w-3 h-3 inline-block mr-1 -mt-0.5" strokeWidth={2} /> Log Food
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { val: nutritionView === 'day' ? dateCal : Math.round(dateCal/divisor), label: nutritionView === 'day' ? 'Calories' : 'Avg Cal', color: '#0D1F16', bg: '#F5F8F3' },
                { val: `${nutritionView === 'day' ? dateP : Math.round(dateP/divisor)}g`, label: nutritionView === 'day' ? 'Protein' : 'Avg Protein', color: '#1F4B32', bg: '#EAF2EB' },
                { val: `${nutritionView === 'day' ? dateC : Math.round(dateC/divisor)}g`, label: nutritionView === 'day' ? 'Carbs' : 'Avg Carbs', color: '#C4742B', bg: '#FFF4E8' },
                { val: `${nutritionView === 'day' ? dateF : Math.round(dateF/divisor)}g`, label: nutritionView === 'day' ? 'Fat' : 'Avg Fat', color: '#6B7A72', bg: '#F5F8F3' },
              ].map(m => <div key={m.label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: m.bg }}><p className="text-lg font-bold" style={{ color: m.color, fontVariantNumeric: 'tabular-nums' }}>{m.val}</p><p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: m.color, opacity: .5 }}>{m.label}</p></div>)}
            </div>
            {nutritionView !== 'day' && <p className="text-[10px] text-[#6B7A72] text-center">Total: {dateCal} cal · {dateP}g protein · {dateC}g carbs · {dateF}g fat</p>}
            {proteinTarget && nutritionView === 'day' && (
              <div><div className="flex justify-between text-xs mb-1"><span className="text-[#1F4B32] font-medium">Protein</span><span className="text-[#6B7A72]">{dateP}/{proteinTarget}g</span></div><div className="h-2 bg-[#EAF2EB] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100,(dateP/proteinTarget)*100)}%`, background: dateP >= proteinTarget ? 'linear-gradient(90deg, #7FFFA4, #1F4B32)' : '#1F4B32' }}/></div></div>
            )}
          </motion.div>

          {/* Water */}
          <motion.div variants={fadeUp} className="bg-white border border-[#EAF2EB] rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-[#0D1F16] flex items-center gap-2">
                <Droplets className="w-4 h-4 text-[#4A90D9]" strokeWidth={1.5} /> Water
              </h3>
              <span className="text-sm font-bold text-[#4A90D9]" style={{ fontVariantNumeric: 'tabular-nums' }}>{nutritionView === 'day' ? `${dateWater}/${waterTarget} oz` : `${dateWater} oz total`}</span>
            </div>
            {nutritionView === 'day' && (<>
              <div className="h-2 bg-[#EDF5FC] rounded-full overflow-hidden mb-3"><div className="h-full bg-gradient-to-r from-[#7BBFEA] to-[#4A90D9] rounded-full transition-all duration-500" style={{ width: `${Math.min(100,(dateWater/waterTarget)*100)}%` }}/></div>
              {isToday(selectedDate) && <div className="flex gap-2 mb-3">{WATER_AMOUNTS.map(oz => <button key={oz} onClick={() => logWater(oz)} className="flex-1 bg-[#EDF5FC] text-[#4A90D9] py-2.5 rounded-2xl text-xs font-semibold hover:bg-[#D8ECFA] transition-all duration-300 cursor-pointer">+{oz}oz</button>)}</div>}
              {dateWaterLogs.length > 0 && <div className="space-y-1 mt-2">{dateWaterLogs.map(w => (
                <div key={w.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F8F3]">
                  <span className="text-xs text-[#4A90D9] font-medium">{w.amount_oz}oz</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#6B7A72]">{formatTime(w.logged_at)}</span>
                    {userId && <LogEntryMenu logType="water_logs" logId={w.id} userId={userId} onUpdate={refreshData}
                      fields={[{ key: 'amount_oz', label: 'Amount (oz)', type: 'number' }, { key: 'logged_at', label: 'Date & time', type: 'datetime-local' }]}
                      currentValues={w} />}
                  </div>
                </div>
              ))}</div>}
            </>)}
          </motion.div>

          {/* Meals (day view only) */}
          {nutritionView === 'day' && (['breakfast','lunch','dinner','snack'] as const).map(meal => {
            const mealFoods = dateMeals[meal]
            const mealIcons = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' }
            return (
              <motion.div key={meal} variants={fadeUp} className="bg-white border border-[#EAF2EB] rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-[#0D1F16] capitalize">{mealIcons[meal]} {meal}</h3>
                  <div className="flex items-center gap-2">
                    {mealFoods.length > 0 && <span className="text-[10px] text-[#6B7A72]">{mealFoods.reduce((s,f)=>s+f.calories,0)} cal · {mealFoods.reduce((s,f)=>s+f.protein,0)}g P</span>}
                    {isToday(selectedDate) && <button onClick={() => { setMealType(meal); setModal('food') }} className="w-7 h-7 rounded-xl bg-[#F5F8F3] text-[#6B7A72] flex items-center justify-center cursor-pointer hover:bg-[#EAF2EB] transition-all duration-300"><Plus className="w-3.5 h-3.5" strokeWidth={2} /></button>}
                  </div>
                </div>
                {mealFoods.length === 0 ? <p className="text-xs text-[#6B7A72]/40 italic">Nothing logged</p> : (
                  <div className="space-y-1.5">{mealFoods.map(f => (
                    <div key={f.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F8F3]">
                      <div className="flex-1 min-w-0 mr-2"><span className="text-sm text-[#0D1F16]">{f.food_name}</span><span className="text-[10px] text-[#6B7A72]/40 ml-2">{formatTime(f.logged_at)}</span></div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-2 text-[10px]"><span className="text-[#6B7A72]">{f.calories}cal</span><span className="text-[#1F4B32] font-semibold">{f.protein}g P</span><span className="text-[#6B7A72]">{f.carbs}g C</span><span className="text-[#6B7A72]">{f.fat}g F</span></div>
                        {userId && <LogEntryMenu logType="food_logs" logId={f.id} userId={userId} onUpdate={refreshData}
                          fields={[
                            { key: 'meal_type', label: 'Meal', type: 'select', options: ['breakfast','lunch','dinner','snack'] },
                            { key: 'food_name', label: 'Food', type: 'text' },
                            { key: 'calories', label: 'Calories', type: 'number' },
                            { key: 'protein', label: 'Protein (g)', type: 'number' },
                            { key: 'carbs', label: 'Carbs (g)', type: 'number' },
                            { key: 'fat', label: 'Fat (g)', type: 'number' },
                            { key: 'logged_at', label: 'Date & time', type: 'datetime-local' },
                          ]}
                          currentValues={f} />}
                      </div>
                    </div>
                  ))}</div>
                )}
              </motion.div>
            )
          })}

          {/* Weekly/Monthly food list */}
          {nutritionView !== 'day' && dateFoodLogs.length > 0 && (
            <motion.div variants={fadeUp} className="bg-white border border-[#EAF2EB] rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-3">All Entries</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {dateFoodLogs.map(f => (
                  <div key={f.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F8F3]">
                    <div className="flex-1 min-w-0 mr-2"><span className="text-sm text-[#0D1F16]">{f.food_name}</span><span className="text-[10px] text-[#6B7A72]/40 ml-2">{formatDate(f.logged_at)} {formatTime(f.logged_at)}</span></div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-2 text-[10px]"><span className="text-[#6B7A72]">{f.calories}cal</span><span className="text-[#1F4B32] font-semibold">{f.protein}g P</span></div>
                      {userId && <LogEntryMenu logType="food_logs" logId={f.id} userId={userId} onUpdate={refreshData}
                        fields={[
                          { key: 'meal_type', label: 'Meal', type: 'select', options: ['breakfast','lunch','dinner','snack'] },
                          { key: 'food_name', label: 'Food', type: 'text' },
                          { key: 'calories', label: 'Calories', type: 'number' },
                          { key: 'protein', label: 'Protein (g)', type: 'number' },
                          { key: 'carbs', label: 'Carbs (g)', type: 'number' },
                          { key: 'fat', label: 'Fat (g)', type: 'number' },
                          { key: 'logged_at', label: 'Date & time', type: 'datetime-local' },
                        ]}
                        currentValues={f} />}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>)}

        {/* ══════════ HEALTH ══════════ */}
        {activeTab === 'health' && (<>
          <motion.div variants={fadeUp} className="grid grid-cols-4 gap-2">
            {[
              { icon: Syringe, label: 'Injection', action: () => setModal('med'), bg: 'from-[#1F4B32] to-[#2D6B45]' },
              { icon: Scale, label: 'Weight', action: () => setModal('weight'), bg: 'from-[#C4742B] to-[#D4843B]' },
              { icon: Dumbbell, label: 'Exercise', action: () => setModal('exercise'), bg: 'from-[#4A90D9] to-[#5AA0E9]' },
              { icon: Stethoscope, label: 'Symptom', action: () => setModal('sideEffect'), bg: 'from-[#6B7A72] to-[#7B8A82]' },
            ].map(b => (
              <button key={b.label} onClick={b.action} className={`bg-gradient-to-br ${b.bg} text-white rounded-3xl py-4 text-center hover:-translate-y-0.5 hover:shadow-lg cursor-pointer transition-all duration-300`}>
                <b.icon className="w-5 h-5 mx-auto mb-1" strokeWidth={1.5} />
                <span className="text-[9px] font-semibold block">{b.label}</span>
              </button>
            ))}
          </motion.div>

          {/* Injection tracker */}
          <motion.div variants={fadeUp} className="bg-white border border-[#EAF2EB] rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
            <h2 className="text-sm font-semibold text-[#0D1F16] mb-4">Injection Tracker</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-[#F5F8F3] rounded-2xl p-3"><p className="text-[9px] text-[#6B7A72] uppercase font-semibold">Last Site</p><p className="text-sm font-bold text-[#0D1F16] mt-0.5">{lastSite||'—'}</p></div>
              <div className="bg-[#FFF4E8] rounded-2xl p-3"><p className="text-[9px] text-[#C4742B] uppercase font-semibold">Next Site</p><p className="text-sm font-bold text-[#C4742B] mt-0.5">{nextSite}</p></div>
              <div className="bg-[#EAF2EB] rounded-2xl p-3"><p className="text-[9px] text-[#1F4B32] uppercase font-semibold">Next Dose</p><p className="text-sm font-bold text-[#1F4B32] mt-0.5">{daysUntilInj!==null?daysUntilInj===0?'Today':`${daysUntilInj}d`:'—'}</p></div>
            </div>
            {medLogs.length > 0 && <div className="space-y-2"><p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">History</p>
              {medLogs.slice(0,8).map(m => <div key={m.id} className="flex justify-between items-center py-2 border-t border-[#F5F8F3] relative">
                <div><span className="text-sm text-[#0D1F16]">{m.injection_site||'—'}</span><span className="text-[10px] text-[#6B7A72] ml-2">{m.dose}</span></div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#6B7A72]">{formatDate(m.logged_at)} · {formatTime(m.logged_at)}</span>
                  <button onClick={e => { e.stopPropagation(); setMedMenuId(medMenuId === m.id ? null : m.id) }} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F5F8F3] cursor-pointer text-[#6B7A72]/40 hover:text-[#6B7A72] transition-all duration-300">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/></svg>
                  </button>
                  {medMenuId === m.id && (
                    <div className="absolute right-0 top-10 bg-white border border-[#EAF2EB] rounded-2xl shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)] z-10 overflow-hidden">
                      <button onClick={() => openEditMed(m)} className="w-full px-4 py-2.5 text-xs text-[#0D1F16] hover:bg-[#F5F8F3] text-left cursor-pointer flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        Edit
                      </button>
                      <button onClick={() => deleteMedLog(m.id)} className="w-full px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 text-left cursor-pointer flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>)}
            </div>}
          </motion.div>

          {/* Weight graph */}
          <motion.div variants={fadeUp} className="bg-white border border-[#EAF2EB] rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-[#0D1F16]">Weight Trend</h2>
              {progressPct !== null && <span className="text-[10px] text-[#1F4B32] font-semibold bg-[#EAF2EB] px-3 py-1 rounded-full">{progressPct}% to goal</span>}
            </div>
            {sparklineData.length >= 2 && (
              <div className="h-32 -mx-2 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData}>
                    <defs>
                      <linearGradient id="healthSparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7FFFA4" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#7FFFA4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                    <Area type="monotone" dataKey="weight" stroke="#1F4B32" strokeWidth={2} fill="url(#healthSparkGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {weightLogs.length > 0 && <div className="space-y-1.5">{weightLogs.slice(0,5).map(w => <div key={w.id} className="flex justify-between items-center py-1.5 border-t border-[#F5F8F3]">
              <span className="text-sm text-[#0D1F16] font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{w.weight} lbs</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#6B7A72]">{formatDate(w.logged_at)} · {formatTime(w.logged_at)}</span>
                {userId && <LogEntryMenu logType="weight_logs" logId={w.id} userId={userId} onUpdate={refreshData}
                  fields={[{ key: 'weight', label: 'Weight (lbs)', type: 'number' }, { key: 'logged_at', label: 'Date & time', type: 'datetime-local' }]}
                  currentValues={w} />}
              </div>
            </div>)}</div>}
          </motion.div>

          {/* Exercise */}
          {exerciseLogs.length > 0 && (
            <motion.div variants={fadeUp} className="bg-white border border-[#EAF2EB] rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <h2 className="text-sm font-semibold text-[#0D1F16] mb-3">Exercise</h2>
              <div className="space-y-2">{exerciseLogs.slice(0,5).map(e => <div key={e.id} className="flex justify-between items-center py-2 border-t border-[#F5F8F3]">
                <div><span className="text-sm text-[#0D1F16]">{e.exercise_type}</span><span className="text-xs text-[#4A90D9] ml-2 font-medium">{e.duration_minutes}min</span></div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#6B7A72]">{formatDate(e.logged_at)}</span>
                  {userId && <LogEntryMenu logType="exercise_logs" logId={e.id} userId={userId} onUpdate={refreshData}
                    fields={[{ key: 'exercise_type', label: 'Type', type: 'text' }, { key: 'duration_minutes', label: 'Minutes', type: 'number' }, { key: 'notes', label: 'Notes', type: 'text' }, { key: 'logged_at', label: 'Date & time', type: 'datetime-local' }]}
                    currentValues={e} />}
                </div>
              </div>)}</div>
            </motion.div>
          )}

          {/* Side effects */}
          {sideEffectLogs.length > 0 && (
            <motion.div variants={fadeUp} className="bg-white border border-[#EAF2EB] rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <h2 className="text-sm font-semibold text-[#0D1F16] mb-3">Side Effects</h2>
              <div className="space-y-2">{sideEffectLogs.slice(0,5).map(e => <div key={e.id} className="flex justify-between items-center py-2 border-t border-[#F5F8F3]">
                <div><span className="text-sm text-[#0D1F16]">{e.symptom}</span><span className="text-xs text-[#C4742B] ml-2">{'●'.repeat(e.severity)}{'○'.repeat(5-e.severity)}</span></div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#6B7A72]">{formatDate(e.logged_at)} · {formatTime(e.logged_at)}</span>
                  {userId && <LogEntryMenu logType="side_effect_logs" logId={e.id} userId={userId} onUpdate={refreshData}
                    fields={[{ key: 'symptom', label: 'Symptom', type: 'text' }, { key: 'severity', label: 'Severity (1-5)', type: 'severity' }, { key: 'logged_at', label: 'Date & time', type: 'datetime-local' }]}
                    currentValues={e} />}
                </div>
              </div>)}</div>
            </motion.div>
          )}

          {/* Mood/energy */}
          {checkinLogs.length > 0 && (
            <motion.div variants={fadeUp} className="bg-white border border-[#EAF2EB] rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <h2 className="text-sm font-semibold text-[#0D1F16] mb-3">Mood & Energy</h2>
              <div className="space-y-2">{checkinLogs.slice(0,5).map(c => <div key={c.id} className="flex justify-between items-center py-2 border-t border-[#F5F8F3]"><div className="flex gap-3"><span className="text-xs"><span className="text-[#6B7A72]">Mood:</span> <span className="font-medium text-[#0D1F16]">{MOOD_LABELS[c.mood-1]}</span></span><span className="text-xs"><span className="text-[#6B7A72]">Energy:</span> <span className="font-medium text-[#0D1F16]">{ENERGY_LABELS[c.energy-1]}</span></span></div><span className="text-[10px] text-[#6B7A72]">{formatDate(c.logged_at)}</span></div>)}</div>
            </motion.div>
          )}
        </>)}
      </motion.div>

      {/* ══════════ MODALS ══════════ */}

      {modal === 'food' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-[0_24px_80px_-16px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#0D1F16]">Log Food</h2><button onClick={() => setModal(null)} className="w-8 h-8 rounded-xl bg-[#F5F8F3] flex items-center justify-center text-[#6B7A72] hover:bg-[#EAF2EB] cursor-pointer transition-all duration-300">✕</button></div>
            <div className="grid grid-cols-4 gap-2">{(['breakfast','lunch','dinner','snack'] as const).map(m => <button key={m} onClick={() => setMealType(m)} className={`text-xs py-2.5 rounded-2xl border capitalize cursor-pointer transition-all duration-300 ${mealType===m?'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold':'border-[#EAF2EB] text-[#6B7A72]'}`}>{m}</button>)}</div>
            <div>
              <div className="flex gap-2">
                <input type="text" autoComplete="off" value={foodName} onChange={e => setFoodName(e.target.value)} placeholder="e.g. 8 oz ribeye steak" className="flex-1 px-4 py-3 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/40 transition-all duration-300" style={{ fontFamily: 'var(--font-inter)' }}/>
                <button type="button" onClick={calculateMacros} disabled={!foodName.trim()||isCalculating} className="bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white px-4 py-3 rounded-2xl text-xs font-semibold cursor-pointer disabled:opacity-40 whitespace-nowrap transition-all duration-300">{isCalculating?'...':'Calc'}</button>
              </div>
              <p className="text-[10px] text-[#6B7A72]/40 mt-1">Include quantity for accuracy</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{l:'Calories',v:foodCalories,s:setFoodCalories,c:'#0D1F16'},{l:'Protein (g)',v:foodProtein,s:setFoodProtein,c:'#1F4B32'},{l:'Carbs (g)',v:foodCarbs,s:setFoodCarbs,c:'#C4742B'},{l:'Fat (g)',v:foodFat,s:setFoodFat,c:'#6B7A72'}].map(f => <div key={f.l}><label className="text-[9px] font-semibold uppercase tracking-wider" style={{color:f.c}}>{f.l}</label><input type="number" autoComplete="off" value={f.v} onChange={e=>f.s(e.target.value)} placeholder="0" className="w-full px-4 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300"/></div>)}
            </div>
            <button onClick={logFood} disabled={!foodName.trim()} className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3.5 rounded-2xl text-sm font-semibold cursor-pointer disabled:opacity-30 hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300">Save</button>
          </motion.div>
        </div>
      )}

      {modal === 'med' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-[0_24px_80px_-16px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#0D1F16]">Log Injection</h2><button onClick={() => setModal(null)} className="w-8 h-8 rounded-xl bg-[#F5F8F3] flex items-center justify-center text-[#6B7A72] hover:bg-[#EAF2EB] cursor-pointer transition-all duration-300">✕</button></div>
            <div className="bg-[#F5F8F3] rounded-2xl px-4 py-3"><p className="text-[10px] text-[#6B7A72]">Medication</p><p className="text-sm font-semibold text-[#0D1F16]">{profile?.medication}</p></div>
            <div>
              <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Dose</p>
              <div className="flex flex-wrap gap-1.5">
                {getMedicationDoses(profile?.medication || '').map((d: number) => (
                  <button key={d} onClick={() => { setMedDose(`${d}mg`); setCustomDose('') }}
                    className={`text-xs px-3.5 py-2.5 rounded-2xl border cursor-pointer transition-all duration-300 ${medDose === `${d}mg` ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>{d} mg</button>
                ))}
                <button onClick={() => { setMedDose('custom'); setCustomDose('') }}
                  className={`text-xs px-3.5 py-2.5 rounded-2xl border cursor-pointer transition-all duration-300 ${medDose === 'custom' ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>Custom</button>
              </div>
              {medDose === 'custom' && (
                <input type="number" autoComplete="off" value={customDose} onChange={e => setCustomDose(e.target.value)} placeholder="Enter dose in mg" autoFocus
                  className="w-full mt-2 px-4 py-3 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/40 transition-all duration-300"/>
              )}
            </div>
            <div><p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Injection Site</p><div className="grid grid-cols-2 gap-2">{INJECTION_SITES.map(s => <button key={s} onClick={() => setInjectionSite(s)} className={`text-xs px-3 py-2.5 rounded-2xl border cursor-pointer transition-all duration-300 ${injectionSite===s?'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold':'border-[#EAF2EB] text-[#6B7A72]'}`}>{s}</button>)}</div></div>
            <input type="text" autoComplete="off" value={medNotes} onChange={e => setMedNotes(e.target.value)} placeholder="Notes (optional)" className="w-full px-4 py-3 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/40 transition-all duration-300"/>
            <button onClick={logMedication} className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3.5 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300">Save</button>
          </motion.div>
        </div>
      )}

      {modal === 'weight' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-[0_24px_80px_-16px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#0D1F16]">Log Weight</h2><button onClick={() => setModal(null)} className="w-8 h-8 rounded-xl bg-[#F5F8F3] flex items-center justify-center text-[#6B7A72] hover:bg-[#EAF2EB] cursor-pointer transition-all duration-300">✕</button></div>
            <input type="number" autoComplete="off" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="Weight in pounds" autoFocus className="w-full px-4 py-5 rounded-2xl border-2 border-[#EAF2EB] text-2xl text-center text-[#0D1F16] font-bold outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/30 placeholder:font-normal placeholder:text-base transition-all duration-300" style={{ fontVariantNumeric: 'tabular-nums' }}/>
            {latestWeight&&newWeight&&<p className={`text-center text-sm font-medium ${parseFloat(newWeight)<latestWeight?'text-[#1F4B32]':parseFloat(newWeight)>latestWeight?'text-[#C4742B]':'text-[#6B7A72]'}`}>{parseFloat(newWeight)<latestWeight?`↓ ${(latestWeight-parseFloat(newWeight)).toFixed(1)} lbs`:parseFloat(newWeight)>latestWeight?`↑ ${(parseFloat(newWeight)-latestWeight).toFixed(1)} lbs`:'Same'}</p>}
            <button onClick={logWeightEntry} disabled={!newWeight} className="w-full bg-gradient-to-r from-[#C4742B] to-[#D4843B] text-white py-3.5 rounded-2xl text-sm font-semibold cursor-pointer disabled:opacity-30 hover:shadow-[0_4px_16px_-4px_rgba(196,116,43,0.4)] transition-all duration-300">Save</button>
          </motion.div>
        </div>
      )}

      {modal === 'sideEffect' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-[0_24px_80px_-16px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#0D1F16]">Log Side Effect</h2><button onClick={() => setModal(null)} className="w-8 h-8 rounded-xl bg-[#F5F8F3] flex items-center justify-center text-[#6B7A72] hover:bg-[#EAF2EB] cursor-pointer transition-all duration-300">✕</button></div>
            <div><p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Symptom</p><div className="flex flex-wrap gap-1.5">{SYMPTOMS.map(s => <button key={s} onClick={() => setSymptom(s)} className={`text-xs px-3.5 py-2 rounded-full border cursor-pointer transition-all duration-300 ${symptom===s?'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold':'border-[#EAF2EB] text-[#6B7A72]'}`}>{s}</button>)}</div></div>
            <div><p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Severity: {severity}/5</p><div className="flex gap-2">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setSeverity(n)} className={`flex-1 py-3 rounded-2xl text-sm font-bold cursor-pointer transition-all duration-300 ${n<=severity?'bg-[#C4742B] text-white':'bg-[#F5F8F3] text-[#6B7A72]/40'}`}>{n}</button>)}</div></div>
            <button onClick={logSideEffect} disabled={!symptom} className="w-full bg-gradient-to-r from-[#6B7A72] to-[#7B8A82] text-white py-3.5 rounded-2xl text-sm font-semibold cursor-pointer disabled:opacity-30 transition-all duration-300">Save</button>
          </motion.div>
        </div>
      )}

      {modal === 'checkin' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-[0_24px_80px_-16px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#0D1F16]">Daily Check-in</h2><button onClick={() => setModal(null)} className="w-8 h-8 rounded-xl bg-[#F5F8F3] flex items-center justify-center text-[#6B7A72] hover:bg-[#EAF2EB] cursor-pointer transition-all duration-300">✕</button></div>
            <div><p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Mood</p><div className="flex gap-2">{MOOD_LABELS.map((l,i) => <button key={l} onClick={() => setCheckinMood(i+1)} className={`flex-1 py-2.5 rounded-2xl text-[10px] font-semibold cursor-pointer transition-all duration-300 ${checkinMood===i+1?'bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white':'bg-[#F5F8F3] text-[#6B7A72]'}`}>{l}</button>)}</div></div>
            <div><p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Energy</p><div className="flex gap-2">{ENERGY_LABELS.map((l,i) => <button key={l} onClick={() => setCheckinEnergy(i+1)} className={`flex-1 py-2.5 rounded-2xl text-[10px] font-semibold cursor-pointer transition-all duration-300 ${checkinEnergy===i+1?'bg-[#4A90D9] text-white':'bg-[#F5F8F3] text-[#6B7A72]'}`}>{l}</button>)}</div></div>
            <input type="text" autoComplete="off" value={checkinNotes} onChange={e => setCheckinNotes(e.target.value)} placeholder="Notes (optional)" className="w-full px-4 py-3 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/40 transition-all duration-300"/>
            <button onClick={logCheckin} className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3.5 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300">Save</button>
          </motion.div>
        </div>
      )}

      {modal === 'exercise' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-[0_24px_80px_-16px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#0D1F16]">Log Exercise</h2><button onClick={() => setModal(null)} className="w-8 h-8 rounded-xl bg-[#F5F8F3] flex items-center justify-center text-[#6B7A72] hover:bg-[#EAF2EB] cursor-pointer transition-all duration-300">✕</button></div>
            <div><p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Type</p><div className="flex flex-wrap gap-1.5">{EXERCISE_TYPES.map(t => <button key={t} onClick={() => setExerciseType(t)} className={`text-xs px-3.5 py-2 rounded-full border cursor-pointer transition-all duration-300 ${exerciseType===t?'border-[#4A90D9] bg-[#EDF5FC] text-[#4A90D9] font-semibold':'border-[#EAF2EB] text-[#6B7A72]'}`}>{t}</button>)}</div></div>
            <div><label className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Minutes</label><input type="number" autoComplete="off" value={exerciseDuration} onChange={e => setExerciseDuration(e.target.value)} placeholder="30" className="w-full px-4 py-3 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#4A90D9] transition-all duration-300"/></div>
            <input type="text" autoComplete="off" value={exerciseNotes} onChange={e => setExerciseNotes(e.target.value)} placeholder="Notes (optional)" className="w-full px-4 py-3 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none placeholder:text-[#6B7A72]/40 transition-all duration-300"/>
            <button onClick={logExercise} disabled={!exerciseType||!exerciseDuration} className="w-full bg-[#4A90D9] text-white py-3.5 rounded-2xl text-sm font-semibold cursor-pointer disabled:opacity-30 hover:shadow-[0_4px_16px_-4px_rgba(74,144,217,0.4)] transition-all duration-300">Save</button>
          </motion.div>
        </div>
      )}

      {/* Edit Injection Modal */}
      {editingMed && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setEditingMed(null) }}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-[0_24px_80px_-16px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center"><h2 className="text-base font-bold text-[#0D1F16]">Edit Injection</h2><button onClick={() => setEditingMed(null)} className="w-8 h-8 rounded-xl bg-[#F5F8F3] flex items-center justify-center text-[#6B7A72] hover:bg-[#EAF2EB] cursor-pointer transition-all duration-300">✕</button></div>
            <div className="bg-[#F5F8F3] rounded-2xl px-4 py-3"><p className="text-[10px] text-[#6B7A72]">Medication</p><p className="text-sm font-semibold text-[#0D1F16]">{editingMed.medication}</p></div>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Dose</label>
              <input type="text" autoComplete="off" value={editMedDose} onChange={e => setEditMedDose(e.target.value)} className="w-full mt-1 px-4 py-3 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300"/>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Injection Site</p>
              <div className="grid grid-cols-2 gap-2">{INJECTION_SITES.map(s => <button key={s} onClick={() => setEditMedSite(s)} className={`text-xs px-3 py-2.5 rounded-2xl border cursor-pointer transition-all duration-300 ${editMedSite===s?'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold':'border-[#EAF2EB] text-[#6B7A72]'}`}>{s}</button>)}</div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Date & Time</label>
              <input type="datetime-local" value={editMedDate} onChange={e => setEditMedDate(e.target.value)} className="w-full mt-1 px-4 py-3 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300"/>
            </div>
            <button onClick={saveEditMed} className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3.5 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300">Save Changes</button>
          </motion.div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
