'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

interface Profile {
  name: string; medication: string; dose: string; start_date: string
  current_weight: string; goal_weight: string; primary_goal: string
  biggest_challenge: string; exercise_level: string
}
interface MedLog { id: string; medication: string; dose: string; injection_site: string; notes: string; logged_at: string }
interface WeightLog { id: string; weight: number; logged_at: string }
interface SideEffectLog { id: string; symptom: string; severity: number; logged_at: string }
interface FoodLog { id: string; meal_type: string; food_name: string; calories: number; protein: number; carbs: number; fat: number; logged_at: string }
interface WaterLog { id: string; amount_oz: number; logged_at: string }

const injectionSites = ['Left abdomen', 'Right abdomen', 'Left thigh', 'Right thigh', 'Left arm', 'Right arm']
const commonSymptoms = ['Nausea', 'Constipation', 'Diarrhea', 'Fatigue', 'Headache', 'Heartburn', 'Sulfur burps', 'Injection site pain', 'Loss of appetite', 'Dizziness']
const waterAmounts = [4, 8, 12, 16, 20, 32]

export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [medLogs, setMedLogs] = useState<MedLog[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [sideEffectLogs, setSideEffectLogs] = useState<SideEffectLog[]>([])
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([])
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'nutrition' | 'health'>('overview')

  // Modals
  const [showMedModal, setShowMedModal] = useState(false)
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [showSideEffectModal, setShowSideEffectModal] = useState(false)
  const [showFoodModal, setShowFoodModal] = useState(false)

  // Med form
  const [injectionSite, setInjectionSite] = useState('')
  const [medNotes, setMedNotes] = useState('')

  // Weight form
  const [newWeight, setNewWeight] = useState('')

  // Side effect form
  const [symptom, setSymptom] = useState('')
  const [severity, setSeverity] = useState(3)

  // Food form
  const [mealType, setMealType] = useState<string>('breakfast')
  const [foodName, setFoodName] = useState('')
  const [foodCalories, setFoodCalories] = useState('')
  const [foodProtein, setFoodProtein] = useState('')
  const [foodCarbs, setFoodCarbs] = useState('')
  const [foodFat, setFoodFat] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setProfile(p)

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      const [meds, weights, effects, foods, water] = await Promise.all([
        supabase.from('medication_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10),
        supabase.from('weight_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10),
        supabase.from('side_effect_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10),
        supabase.from('food_logs').select('*').eq('user_id', user.id).gte('logged_at', todayISO).order('logged_at', { ascending: true }),
        supabase.from('water_logs').select('*').eq('user_id', user.id).gte('logged_at', todayISO).order('logged_at', { ascending: true }),
      ])

      setMedLogs(meds.data || [])
      setWeightLogs(weights.data || [])
      setSideEffectLogs(effects.data || [])
      setFoodLogs(foods.data || [])
      setWaterLogs(water.data || [])
      setLoading(false)
    }
    init()
  }, [router])

  // Log functions
  async function logMedication() {
    if (!userId || !profile) return
    const { data } = await supabase.from('medication_logs').insert({ user_id: userId, medication: profile.medication, dose: profile.dose, injection_site: injectionSite, notes: medNotes }).select().single()
    if (data) setMedLogs([data, ...medLogs])
    setShowMedModal(false); setInjectionSite(''); setMedNotes('')
  }

  async function logWeightEntry() {
    if (!userId || !newWeight) return
    const { data } = await supabase.from('weight_logs').insert({ user_id: userId, weight: parseFloat(newWeight) }).select().single()
    if (data) setWeightLogs([data, ...weightLogs])
    setShowWeightModal(false); setNewWeight('')
  }

  async function logSideEffect() {
    if (!userId || !symptom) return
    const { data } = await supabase.from('side_effect_logs').insert({ user_id: userId, symptom, severity }).select().single()
    if (data) setSideEffectLogs([data, ...sideEffectLogs])
    setShowSideEffectModal(false); setSymptom(''); setSeverity(3)
  }

  async function logFood() {
    if (!userId || !foodName) return
    const { data } = await supabase.from('food_logs').insert({
      user_id: userId, meal_type: mealType, food_name: foodName,
      calories: parseInt(foodCalories) || 0, protein: parseInt(foodProtein) || 0,
      carbs: parseInt(foodCarbs) || 0, fat: parseInt(foodFat) || 0,
    }).select().single()
    if (data) setFoodLogs([...foodLogs, data])
    setShowFoodModal(false); setFoodName(''); setFoodCalories(''); setFoodProtein(''); setFoodCarbs(''); setFoodFat('')
  }

  async function logWater(oz: number) {
    if (!userId) return
    const { data } = await supabase.from('water_logs').insert({ user_id: userId, amount_oz: oz }).select().single()
    if (data) setWaterLogs([...waterLogs, data])
  }

  if (loading) {
    return <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin" /></div>
  }

  // Computed stats
  const daysOnMed = profile?.start_date ? Math.max(1, Math.floor((Date.now() - new Date(profile.start_date).getTime()) / 86400000)) : null
  const latestWeight = weightLogs[0]?.weight || (profile?.current_weight ? parseFloat(profile.current_weight) : null)
  const goalWeight = profile?.goal_weight ? parseFloat(profile.goal_weight) : null
  const startWeight = profile?.current_weight ? parseFloat(profile.current_weight) : null
  const weightLost = startWeight && latestWeight ? Math.round((startWeight - latestWeight) * 10) / 10 : null
  const progressPercent = startWeight && goalWeight && latestWeight ? Math.min(100, Math.round(((startWeight - latestWeight) / (startWeight - goalWeight)) * 100)) : null
  const proteinTarget = goalWeight ? Math.round(goalWeight * 0.8) : null
  const lastInjection = medLogs[0]
  const daysSinceInjection = lastInjection ? Math.floor((Date.now() - new Date(lastInjection.logged_at).getTime()) / 86400000) : null
  const lastInjectionSite = lastInjection?.injection_site || null
  const siteIndex = lastInjectionSite ? injectionSites.indexOf(lastInjectionSite) : -1
  const suggestedSite = injectionSites[(siteIndex + 1) % injectionSites.length]

  // Today's nutrition totals
  const todayCalories = foodLogs.reduce((sum, f) => sum + f.calories, 0)
  const todayProtein = foodLogs.reduce((sum, f) => sum + f.protein, 0)
  const todayCarbs = foodLogs.reduce((sum, f) => sum + f.carbs, 0)
  const todayFat = foodLogs.reduce((sum, f) => sum + f.fat, 0)
  const todayWater = waterLogs.reduce((sum, w) => sum + w.amount_oz, 0)
  const waterGoal = 80

  // Group food by meal type
  const meals = {
    breakfast: foodLogs.filter(f => f.meal_type === 'breakfast'),
    lunch: foodLogs.filter(f => f.meal_type === 'lunch'),
    dinner: foodLogs.filter(f => f.meal_type === 'dinner'),
    snack: foodLogs.filter(f => f.meal_type === 'snack'),
  }

  return (
    <div className="min-h-screen bg-[#FFFBF5] pb-20">
      {/* HEADER */}
      <header className="bg-[#2D5A3D] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">Hey{profile?.name ? `, ${profile.name}` : ''} 👋</h1>
            <p className="text-white/50 text-xs">{profile?.medication}{profile?.dose ? ` • ${profile.dose}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/chat" className="bg-white/15 text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors">Nova</a>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="text-white/40 text-xs hover:text-white transition-colors cursor-pointer">Log out</button>
          </div>
        </div>
      </header>

      {/* TAB BAR */}
      <div className="bg-white border-b border-black/5 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex">
          {[
            { id: 'overview' as const, label: 'Overview' },
            { id: 'nutrition' as const, label: 'Nutrition' },
            { id: 'health' as const, label: 'Health' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer ${activeTab === tab.id ? 'text-[#2D5A3D] border-b-2 border-[#2D5A3D]' : 'text-[#9B9B93] hover:text-[#6B6B65]'}`}
            >{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && (
          <>
            {/* Injection reminder */}
            {daysSinceInjection !== null && daysSinceInjection >= 6 && (
              <div className="bg-[#C4742B]/10 border border-[#C4742B]/20 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">💉</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#C4742B]">Injection day!</p>
                  <p className="text-xs text-[#C4742B]/70">{daysSinceInjection} days since last. Try: {suggestedSite}</p>
                </div>
                <button onClick={() => { setInjectionSite(suggestedSite); setShowMedModal(true) }} className="bg-[#C4742B] text-white px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer">Log it</button>
              </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
                <p className="text-[10px] font-semibold text-[#9B9B93] uppercase tracking-wider mb-1">Weight</p>
                <p className="text-2xl font-bold text-[#1E1E1C]">{latestWeight ? `${latestWeight} lbs` : '—'}</p>
                {weightLost !== null && weightLost > 0 && <p className="text-xs text-[#2D5A3D] font-medium mt-1">↓ {weightLost} lbs lost</p>}
                {progressPercent !== null && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-[#E8F0EB] rounded-full overflow-hidden"><div className="h-full bg-[#2D5A3D] rounded-full" style={{ width: `${progressPercent}%` }} /></div>
                    <p className="text-[10px] text-[#9B9B93] mt-1">{progressPercent}% to goal ({goalWeight} lbs)</p>
                  </div>
                )}
              </div>
              <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
                <p className="text-[10px] font-semibold text-[#9B9B93] uppercase tracking-wider mb-1">Journey</p>
                <p className="text-2xl font-bold text-[#1E1E1C]">{daysOnMed ? `Day ${daysOnMed}` : '—'}</p>
                <p className="text-xs text-[#6B6B65] mt-1">{profile?.medication}</p>
                {daysSinceInjection !== null && <p className="text-xs text-[#9B9B93] mt-1">{daysSinceInjection === 0 ? 'Injected today' : `${daysSinceInjection}d since injection`}</p>}
              </div>
            </div>

            {/* Today's summary */}
            <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
              <p className="text-[10px] font-semibold text-[#9B9B93] uppercase tracking-wider mb-3">Today&apos;s Summary</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-[#1E1E1C]">{todayCalories}</p>
                  <p className="text-[10px] text-[#9B9B93]">Calories</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[#2D5A3D]">{todayProtein}g</p>
                  <p className="text-[10px] text-[#9B9B93]">Protein</p>
                  {proteinTarget && <div className="h-1 bg-[#E8F0EB] rounded-full mt-1"><div className="h-full bg-[#2D5A3D] rounded-full" style={{ width: `${Math.min(100, (todayProtein / proteinTarget) * 100)}%` }} /></div>}
                </div>
                <div>
                  <p className="text-lg font-bold text-[#C4742B]">{todayCarbs}g</p>
                  <p className="text-[10px] text-[#9B9B93]">Carbs</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[#6B6B65]">{todayFat}g</p>
                  <p className="text-[10px] text-[#9B9B93]">Fat</p>
                </div>
              </div>
              {proteinTarget && <p className="text-[10px] text-center text-[#9B9B93] mt-2">Protein goal: {todayProtein}/{proteinTarget}g ({Math.round((todayProtein / proteinTarget) * 100)}%)</p>}
            </div>

            {/* Water tracker */}
            <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] font-semibold text-[#9B9B93] uppercase tracking-wider">Water Intake</p>
                <p className="text-sm font-bold text-[#1E1E1C]">{todayWater} / {waterGoal} oz</p>
              </div>
              <div className="h-3 bg-[#E8F0EB] rounded-full overflow-hidden mb-3">
                <div className="h-full bg-[#60A5FA] rounded-full transition-all" style={{ width: `${Math.min(100, (todayWater / waterGoal) * 100)}%` }} />
              </div>
              <div className="flex gap-2 flex-wrap">
                {waterAmounts.map(oz => (
                  <button key={oz} onClick={() => logWater(oz)}
                    className="bg-[#60A5FA]/10 text-[#60A5FA] px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#60A5FA]/20 transition-colors cursor-pointer"
                  >+{oz} oz</button>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setShowFoodModal(true)} className="bg-[#2D5A3D] text-white rounded-2xl p-3 text-center hover:bg-[#3A7A52] transition-colors cursor-pointer">
                <span className="text-xl block mb-0.5">🍽️</span><span className="text-[10px] font-semibold">Food</span>
              </button>
              <button onClick={() => setShowMedModal(true)} className="bg-[#C4742B] text-white rounded-2xl p-3 text-center hover:bg-[#a86224] transition-colors cursor-pointer">
                <span className="text-xl block mb-0.5">💉</span><span className="text-[10px] font-semibold">Injection</span>
              </button>
              <button onClick={() => setShowWeightModal(true)} className="bg-[#6B6B65] text-white rounded-2xl p-3 text-center hover:bg-[#555] transition-colors cursor-pointer">
                <span className="text-xl block mb-0.5">⚖️</span><span className="text-[10px] font-semibold">Weight</span>
              </button>
              <button onClick={() => setShowSideEffectModal(true)} className="bg-[#9B9B93] text-white rounded-2xl p-3 text-center hover:bg-[#888] transition-colors cursor-pointer">
                <span className="text-xl block mb-0.5">🩹</span><span className="text-[10px] font-semibold">Symptom</span>
              </button>
            </div>

            {/* Chat CTA */}
            <a href="/chat" className="block bg-[#E8F0EB] border border-[#2D5A3D]/10 rounded-2xl p-4 hover:bg-[#d4e5d9] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0"><span className="text-lg">🌿</span></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#2D5A3D]">Chat with Nova</p>
                  <p className="text-xs text-[#6B6B65]">Get coaching, meal ideas, or help with side effects</p>
                </div>
                <svg className="w-5 h-5 text-[#2D5A3D] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </a>
          </>
        )}

        {/* ===== NUTRITION TAB ===== */}
        {activeTab === 'nutrition' && (
          <>
            {/* Daily macros summary */}
            <div className="bg-white border border-black/[0.06] rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-[#1E1E1C]">Today&apos;s Nutrition</h2>
                <button onClick={() => setShowFoodModal(true)} className="bg-[#2D5A3D] text-white px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors">+ Log Food</button>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-[#F5F5F0] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[#1E1E1C]">{todayCalories}</p>
                  <p className="text-[10px] text-[#9B9B93] font-medium">Calories</p>
                </div>
                <div className="bg-[#E8F0EB] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[#2D5A3D]">{todayProtein}g</p>
                  <p className="text-[10px] text-[#2D5A3D]/60 font-medium">Protein</p>
                </div>
                <div className="bg-[#FFF0E5] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[#C4742B]">{todayCarbs}g</p>
                  <p className="text-[10px] text-[#C4742B]/60 font-medium">Carbs</p>
                </div>
                <div className="bg-[#F0F0F0] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[#6B6B65]">{todayFat}g</p>
                  <p className="text-[10px] text-[#6B6B65]/60 font-medium">Fat</p>
                </div>
              </div>
              {proteinTarget && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#2D5A3D] font-medium">Protein Progress</span>
                    <span className="text-[#9B9B93]">{todayProtein} / {proteinTarget}g</span>
                  </div>
                  <div className="h-2.5 bg-[#E8F0EB] rounded-full overflow-hidden">
                    <div className="h-full bg-[#2D5A3D] rounded-full transition-all" style={{ width: `${Math.min(100, (todayProtein / proteinTarget) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Meals breakdown */}
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(meal => (
              <div key={meal} className="bg-white border border-black/[0.06] rounded-2xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{meal === 'breakfast' ? '🌅' : meal === 'lunch' ? '☀️' : meal === 'dinner' ? '🌙' : '🍎'}</span>
                    <h3 className="text-sm font-bold text-[#1E1E1C] capitalize">{meal}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {meals[meal].length > 0 && (
                      <span className="text-xs text-[#9B9B93]">
                        {meals[meal].reduce((s, f) => s + f.calories, 0)} cal • {meals[meal].reduce((s, f) => s + f.protein, 0)}g P
                      </span>
                    )}
                    <button onClick={() => { setMealType(meal); setShowFoodModal(true) }}
                      className="w-7 h-7 rounded-full bg-[#E8F0EB] text-[#2D5A3D] flex items-center justify-center text-lg font-bold cursor-pointer hover:bg-[#d4e5d9] transition-colors">+</button>
                  </div>
                </div>
                {meals[meal].length === 0 ? (
                  <p className="text-xs text-[#9B9B93] py-2">No {meal} logged yet</p>
                ) : (
                  <div className="space-y-2">
                    {meals[meal].map(food => (
                      <div key={food.id} className="flex justify-between items-center py-1.5 border-t border-black/[0.04]">
                        <span className="text-sm text-[#2A2A28]">{food.food_name}</span>
                        <div className="flex gap-3 text-[10px] text-[#9B9B93]">
                          <span>{food.calories} cal</span>
                          <span className="text-[#2D5A3D] font-medium">{food.protein}g P</span>
                          <span>{food.carbs}g C</span>
                          <span>{food.fat}g F</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Water */}
            <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💧</span>
                  <h3 className="text-sm font-bold text-[#1E1E1C]">Water Intake</h3>
                </div>
                <p className="text-sm font-bold text-[#60A5FA]">{todayWater} / {waterGoal} oz</p>
              </div>
              <div className="h-3 bg-[#E8F0EB] rounded-full overflow-hidden mb-3">
                <div className="h-full bg-[#60A5FA] rounded-full transition-all" style={{ width: `${Math.min(100, (todayWater / waterGoal) * 100)}%` }} />
              </div>
              <div className="flex gap-2 flex-wrap">
                {waterAmounts.map(oz => (
                  <button key={oz} onClick={() => logWater(oz)}
                    className="bg-[#60A5FA]/10 text-[#60A5FA] px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#60A5FA]/20 transition-colors cursor-pointer"
                  >+{oz} oz</button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ===== HEALTH TAB ===== */}
        {activeTab === 'health' && (
          <>
            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => setShowMedModal(true)} className="bg-[#2D5A3D] text-white rounded-2xl p-4 text-center hover:bg-[#3A7A52] transition-colors cursor-pointer">
                <span className="text-2xl block mb-1">💉</span><span className="text-xs font-semibold">Log Injection</span>
              </button>
              <button onClick={() => setShowWeightModal(true)} className="bg-[#C4742B] text-white rounded-2xl p-4 text-center hover:bg-[#a86224] transition-colors cursor-pointer">
                <span className="text-2xl block mb-1">⚖️</span><span className="text-xs font-semibold">Log Weight</span>
              </button>
              <button onClick={() => setShowSideEffectModal(true)} className="bg-[#6B6B65] text-white rounded-2xl p-4 text-center hover:bg-[#555] transition-colors cursor-pointer">
                <span className="text-2xl block mb-1">🩹</span><span className="text-xs font-semibold">Side Effect</span>
              </button>
            </div>

            {/* Injection info */}
            <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
              <h2 className="text-sm font-bold text-[#1E1E1C] mb-3">Injection Tracker</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F5F5F0] rounded-xl p-3">
                  <p className="text-[10px] text-[#9B9B93] uppercase font-semibold mb-1">Last Injection</p>
                  <p className="text-sm font-bold text-[#1E1E1C]">{lastInjectionSite || 'None logged'}</p>
                  {daysSinceInjection !== null && <p className="text-xs text-[#9B9B93] mt-0.5">{daysSinceInjection === 0 ? 'Today' : `${daysSinceInjection} days ago`}</p>}
                </div>
                <div className="bg-[#FFF0E5] rounded-xl p-3">
                  <p className="text-[10px] text-[#C4742B] uppercase font-semibold mb-1">Next Suggested</p>
                  <p className="text-sm font-bold text-[#C4742B]">{suggestedSite}</p>
                  <p className="text-xs text-[#C4742B]/60 mt-0.5">Rotate sites each week</p>
                </div>
              </div>
            </div>

            {/* Weight trend */}
            {weightLogs.length > 0 && (
              <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
                <h2 className="text-sm font-bold text-[#1E1E1C] mb-3">Weight History</h2>
                {weightLogs.length > 1 && (
                  <div className="flex items-end gap-1 h-20 mb-3">
                    {weightLogs.slice(0, 10).reverse().map((w, i) => {
                      const min = Math.min(...weightLogs.slice(0, 10).map(l => l.weight))
                      const max = Math.max(...weightLogs.slice(0, 10).map(l => l.weight))
                      const range = max - min || 1
                      const height = Math.max(15, ((w.weight - min) / range) * 80)
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-[8px] text-[#9B9B93]">{w.weight}</span>
                          <div className="w-full rounded-t-md bg-[#2D5A3D]" style={{ height: `${height}%` }} />
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="space-y-2">
                  {weightLogs.slice(0, 5).map(w => (
                    <div key={w.id} className="flex justify-between items-center py-1 border-b border-black/[0.04] last:border-0">
                      <span className="text-sm text-[#2A2A28] font-medium">{w.weight} lbs</span>
                      <span className="text-[10px] text-[#9B9B93]">{new Date(w.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent side effects */}
            {sideEffectLogs.length > 0 && (
              <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
                <h2 className="text-sm font-bold text-[#1E1E1C] mb-3">Recent Side Effects</h2>
                <div className="space-y-2">
                  {sideEffectLogs.slice(0, 5).map(e => (
                    <div key={e.id} className="flex justify-between items-center py-1.5 border-b border-black/[0.04] last:border-0">
                      <div>
                        <span className="text-sm text-[#2A2A28]">{e.symptom}</span>
                        <span className="text-xs text-[#C4742B] ml-2">{'●'.repeat(e.severity)}{'○'.repeat(5 - e.severity)}</span>
                      </div>
                      <span className="text-[10px] text-[#9B9B93]">{new Date(e.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== MODALS ===== */}

      {/* Food Modal */}
      {showFoodModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#1E1E1C]">Log Food 🍽️</h2>
              <button onClick={() => setShowFoodModal(false)} className="text-[#9B9B93] hover:text-[#1E1E1C] cursor-pointer text-xl">&times;</button>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6B6B65] mb-2">Meal</p>
              <div className="grid grid-cols-4 gap-2">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(m => (
                  <button key={m} onClick={() => setMealType(m)}
                    className={`text-xs px-2 py-2 rounded-xl border-2 capitalize transition-all cursor-pointer ${mealType === m ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-black/[0.06] text-[#6B6B65]'}`}
                  >{m === 'breakfast' ? '🌅' : m === 'lunch' ? '☀️' : m === 'dinner' ? '🌙' : '🍎'} {m}</button>
                ))}
              </div>
            </div>
            <input type="text" value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="What did you eat?" autoFocus
              className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#9B9B93]" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-medium text-[#9B9B93] uppercase">Calories</label>
                <input type="number" value={foodCalories} onChange={(e) => setFoodCalories(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#9B9B93]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#2D5A3D] uppercase">Protein (g)</label>
                <input type="number" value={foodProtein} onChange={(e) => setFoodProtein(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#9B9B93]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#C4742B] uppercase">Carbs (g)</label>
                <input type="number" value={foodCarbs} onChange={(e) => setFoodCarbs(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#9B9B93]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#6B6B65] uppercase">Fat (g)</label>
                <input type="number" value={foodFat} onChange={(e) => setFoodFat(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#9B9B93]" />
              </div>
            </div>
            <button onClick={logFood} disabled={!foodName.trim()} className="w-full bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#3A7A52] transition-colors disabled:opacity-30 cursor-pointer">
              Save food
            </button>
          </div>
        </div>
      )}

      {/* Medication Modal */}
      {showMedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#1E1E1C]">Log Injection 💉</h2>
              <button onClick={() => setShowMedModal(false)} className="text-[#9B9B93] hover:text-[#1E1E1C] cursor-pointer text-xl">&times;</button>
            </div>
            <div className="bg-[#F5F5F0] rounded-xl px-4 py-3">
              <p className="text-xs text-[#9B9B93]">Medication</p>
              <p className="text-sm font-semibold text-[#1E1E1C]">{profile?.medication} — {profile?.dose}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6B6B65] mb-2">Injection site</p>
              <div className="grid grid-cols-2 gap-2">
                {injectionSites.map(site => (
                  <button key={site} onClick={() => setInjectionSite(site)}
                    className={`text-xs px-3 py-2 rounded-xl border-2 transition-all cursor-pointer ${injectionSite === site ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-black/[0.06] text-[#6B6B65]'}`}
                  >{site}</button>
                ))}
              </div>
            </div>
            <input type="text" value={medNotes} onChange={(e) => setMedNotes(e.target.value)} placeholder="Notes (optional)"
              className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#9B9B93]" />
            <button onClick={logMedication} className="w-full bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#3A7A52] transition-colors cursor-pointer">Save injection</button>
          </div>
        </div>
      )}

      {/* Weight Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#1E1E1C]">Log Weight ⚖️</h2>
              <button onClick={() => setShowWeightModal(false)} className="text-[#9B9B93] hover:text-[#1E1E1C] cursor-pointer text-xl">&times;</button>
            </div>
            <input type="number" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} placeholder="Weight in pounds" autoFocus
              className="w-full px-4 py-4 rounded-xl border-2 border-black/10 bg-white text-2xl text-center text-[#1E1E1C] font-bold outline-none focus:border-[#2D5A3D] placeholder:text-[#9B9B93] placeholder:font-normal placeholder:text-base" />
            {latestWeight && newWeight && (
              <p className={`text-center text-sm font-medium ${parseFloat(newWeight) < latestWeight ? 'text-[#2D5A3D]' : 'text-[#C4742B]'}`}>
                {parseFloat(newWeight) < latestWeight ? `↓ ${(latestWeight - parseFloat(newWeight)).toFixed(1)} lbs` : parseFloat(newWeight) > latestWeight ? `↑ ${(parseFloat(newWeight) - latestWeight).toFixed(1)} lbs` : 'Same as last'}
              </p>
            )}
            <button onClick={logWeightEntry} disabled={!newWeight} className="w-full bg-[#C4742B] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#a86224] transition-colors disabled:opacity-30 cursor-pointer">Save weight</button>
          </div>
        </div>
      )}

      {/* Side Effect Modal */}
      {showSideEffectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#1E1E1C]">Log Side Effect 🩹</h2>
              <button onClick={() => setShowSideEffectModal(false)} className="text-[#9B9B93] hover:text-[#1E1E1C] cursor-pointer text-xl">&times;</button>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6B6B65] mb-2">Symptom</p>
              <div className="flex flex-wrap gap-2">
                {commonSymptoms.map(s => (
                  <button key={s} onClick={() => setSymptom(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${symptom === s ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-black/[0.06] text-[#6B6B65]'}`}
                  >{s}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6B6B65] mb-2">Severity: {severity}/5</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setSeverity(n)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${n <= severity ? 'bg-[#C4742B] text-white' : 'bg-[#F5F5F0] text-[#9B9B93]'}`}
                  >{n}</button>
                ))}
              </div>
            </div>
            <button onClick={logSideEffect} disabled={!symptom} className="w-full bg-[#6B6B65] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#555] transition-colors disabled:opacity-30 cursor-pointer">Save side effect</button>
          </div>
        </div>
      )}
    </div>
  )
}
