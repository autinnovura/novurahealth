'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import VoiceInput from '../components/VoiceInput'
import BottomNav from '../components/BottomNav'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Download, Dumbbell, UtensilsCrossed, MessageCircle, Lock, Unlock, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

type Phase = 'exploring' | 'preparing' | 'tapering' | 'maintenance' | 'off_medication'

interface TaperPlan {
  id: string; phase: Phase; current_dose: string; target_dose: string
  taper_start_date: string; last_dose_change: string; stability_streak_days: number
  readiness_score: number; notes: string; readiness_answers?: Record<string, boolean>
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

const PHASES: { id: Phase; label: string; short: string }[] = [
  { id: 'exploring', label: 'Exploring', short: 'Explore' },
  { id: 'preparing', label: 'Preparing', short: 'Prep' },
  { id: 'tapering', label: 'Tapering', short: 'Taper' },
  { id: 'maintenance', label: 'Maintenance', short: 'Maintain' },
  { id: 'off_medication', label: 'Off Medication', short: 'Free' },
]

const ASSESSMENT_SECTIONS = [
  {
    title: 'Weight & Medication Stability',
    items: [
      'My weight has been stable (within 3 lbs) for at least 4 weeks',
      'I have been on my current dose for at least 8 weeks',
      'I am not currently experiencing significant side effects',
    ],
  },
  {
    title: 'Nutrition Habits',
    items: [
      'I consistently hit my daily protein target',
      'I track my meals regularly (at least 5 days/week)',
      'I can prepare healthy, high-protein meals on my own',
      'I eat mindfully — I stop when full, not when the plate is empty',
    ],
  },
  {
    title: 'Exercise & Movement',
    items: [
      'I exercise at least 3 times per week',
      'My routine includes resistance/strength training',
      'I can maintain my exercise routine without external motivation',
    ],
  },
  {
    title: 'Sleep & Recovery',
    items: [
      'I sleep 7+ hours most nights',
      'I have a consistent sleep schedule',
    ],
  },
  {
    title: 'Mental & Emotional Readiness',
    items: [
      'I can manage stress without turning to food',
      'I feel confident I can handle increased appetite',
      'I have strategies for emotional eating triggers',
      'I am not making this decision due to external pressure (cost, others\' opinions)',
    ],
  },
  {
    title: 'Medical & Support',
    items: [
      'My doctor is aware I want to taper and supports the plan',
      'I have a support system (partner, friend, community, coach)',
      'I understand tapering is gradual and I may need to pause or reverse',
      'I accept that going back on medication is not failure — it is a valid option',
    ],
  },
]
const ALL_ASSESSMENT_ITEMS = ASSESSMENT_SECTIONS.flatMap(s => s.items)
const TAPER_DURATIONS = [
  { id: '30day', label: '30 Days', desc: 'Aggressive — only if on lowest dose already' },
  { id: '60day', label: '60 Days', desc: 'Moderate — standard step-down' },
  { id: '90day', label: '90 Days', desc: 'Recommended — gradual and safe' },
  { id: '6month', label: '6 Months', desc: 'Conservative — maximum stability' },
  { id: '1year', label: '1 Year', desc: 'Ultra-gradual — lowest risk of regain' },
]

const PHASE_INFO: Record<Phase, string> = {
  exploring: 'Learning the app and understanding your relationship with the medication. No active taper plan yet. Start logging consistently to build the data foundation for a successful taper.',
  preparing: 'You have a taper plan but haven\'t started reducing your dose yet. Focus on nailing protein targets, hydration, and exercise habits so your body is ready.',
  tapering: 'Actively stepping down your dose. Each phase lasts 4 weeks. Trish monitors your hunger, weight, and side effects to decide when you\'re stable enough to drop further.',
  maintenance: 'You\'ve reached your target dose (often fully off). Your body is adjusting to managing appetite without medication. This is the hardest phase — stay consistent.',
  off_medication: '30+ days off medication with stable weight. Congratulations — you\'re in long-term maintenance. The tools you built in earlier phases are what keep you here.',
}

function computePhase(
  plan: TaperPlan | null,
  latestMedDose: number | null,
  daysSinceLastDose: number | null,
): Phase {
  if (!plan) return 'exploring'
  if (!plan.taper_start_date) return 'preparing'

  const currentDose = latestMedDose ?? parseFloat(plan.current_dose || '0')
  const targetDose = parseFloat(plan.target_dose || '0')

  if (currentDose > targetDose) return 'tapering'

  if (currentDose === 0 && daysSinceLastDose !== null && daysSinceLastDose >= 30) {
    return 'off_medication'
  }

  return 'maintenance'
}

export default function Maintenance() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [plan, setPlan] = useState<TaperPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'plan' | 'nutrition' | 'exercise' | 'coach'>('plan')

  // Assessment
  const [readiness, setReadiness] = useState<Record<string, boolean>>({})
  const [assessmentSaved, setAssessmentSaved] = useState(false)
  const [confirmedReady, setConfirmedReady] = useState(false)
  const [taperDuration, setTaperDuration] = useState('90day')

  // Generated content
  const [taperPlan, setTaperPlan] = useState('')
  const [mealPlan, setMealPlan] = useState('')
  const [exercisePlan, setExercisePlan] = useState('')
  const [generating, setGenerating] = useState<string | null>(null)

  // Nutrition tab
  const [mealPlanType, setMealPlanType] = useState<'daily' | 'weekly'>('daily')
  const [recipeInput, setRecipeInput] = useState('')

  // Exercise tab
  const [fitnessLevel, setFitnessLevel] = useState('Intermediate')
  const [equipment, setEquipment] = useState('Dumbbells')

  // Override
  const [hasOverride, setHasOverride] = useState(false)
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false)

  // Saved plans (from database)
  const [savedMealPlans, setSavedMealPlans] = useState<any[]>([])
  const [savedWorkoutPlans, setSavedWorkoutPlans] = useState<any[]>([])
  const [showSaved, setShowSaved] = useState(false)
  const [expandedMealPlan, setExpandedMealPlan] = useState<string | null>(null)
  const [expandedWorkoutPlan, setExpandedWorkoutPlan] = useState<string | null>(null)

  // Phase info
  const [phaseInfoOpen, setPhaseInfoOpen] = useState<Phase | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [latestMedDose, setLatestMedDose] = useState<number | null>(null)
  const [daysSinceLastDose, setDaysSinceLastDose] = useState<number | null>(null)

  // Coach chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setProfile(p)
      if (p.tapering_override) setHasOverride(true)

      const [{ data: tp }, { data: latestMed }] = await Promise.all([
        supabase.from('tapering_plans').select('*').eq('user_id', user.id).single(),
        supabase.from('medication_logs').select('dose, logged_at').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(1).single(),
      ])

      if (latestMed) {
        const dose = parseFloat((latestMed.dose || '0').replace(/[^0-9.]/g, ''))
        setLatestMedDose(dose)
        setDaysSinceLastDose(Math.floor((Date.now() - new Date(latestMed.logged_at).getTime()) / 86400000))
      }

      if (tp) {
        setPlan(tp)
        if (tp.readiness_answers) {
          setReadiness(tp.readiness_answers)
          if (tp.readiness_score !== null && tp.readiness_score !== undefined) setAssessmentSaved(true)
          if (tp.readiness_answers.__confirmed_ready) setConfirmedReady(true)
        }
      }

      // Load saved plans from database
      const [{ data: meals }, { data: workouts }] = await Promise.all([
        supabase.from('meal_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('workout_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      ])
      if (meals) setSavedMealPlans(meals)
      if (workouts) setSavedWorkoutPlans(workouts)

      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (phaseInfoOpen) {
      document.body.style.overflow = 'hidden'
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPhaseInfoOpen(null) }
      window.addEventListener('keydown', onKey)
      return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
    }
  }, [phaseInfoOpen])

  // ── Coach API ─────────────────────────────────────────
  async function sendToCoach(prompt: string, displayAsChat = true): Promise<string> {
    if (!userId) return 'Not logged in. Please refresh and try again.'

    const msgs = displayAsChat
      ? [...chatMessages.map(m => ({ role: m.role, content: m.content })), { role: 'user' as const, content: prompt }]
      : [{ role: 'user' as const, content: prompt }]

    try {
      const res = await fetch('/api/transition-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Transition coach error:', res.status, data)
        return data.message || 'Unable to generate plan. Try again.'
      }
      return data.message || 'Unable to generate plan. Try again.'
    } catch (err) {
      console.error('Transition coach fetch error:', err)
      return 'Network error. Check your connection and try again.'
    }
  }

  // ── Generators ────────────────────────────────────────
  async function generateTaperPlan() {
    setGenerating('taper')
    try {
      const durationLabel = TAPER_DURATIONS.find(d => d.id === taperDuration)?.label || '90 Days'
      const result = await sendToCoach(`Generate my complete tapering plan based on all my data. The user wants a ${durationLabel} tapering timeline. Include specific phases with exact week ranges, dose changes at each step, protein/exercise targets, red flags to watch for, and what to do if things go wrong. Make it personal to my medication, dose, weight, and habits.`, false)
      setTaperPlan(result)
    } catch (err) {
      console.error('generateTaperPlan error:', err)
      setTaperPlan('Unable to generate plan. Please try again.')
    } finally {
      setGenerating(null)
    }
  }

  async function generateMealPlan() {
    setGenerating('meal')
    try {
      const prompt = mealPlanType === 'weekly'
        ? 'Create a complete weekly meal plan for me. 7 days. Hit my protein target each day. Use foods I actually eat based on my food logs. After generating it, save it to my account using the save_meal_plan tool.'
        : 'Create a complete daily meal plan for me. Breakfast, lunch, snack, dinner. Hit my protein target. Use foods I actually eat. After generating it, save it to my account using the save_meal_plan tool.'
      const result = await sendToCoach(prompt, false)
      setMealPlan(result)
      // Refresh saved plans from DB (Trish may have saved via tool)
      if (userId) {
        const { data } = await supabase.from('meal_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
        if (data) setSavedMealPlans(data)
      }
    } catch (err) {
      console.error('generateMealPlan error:', err)
      setMealPlan('Unable to generate meal plan. Please try again.')
    } finally {
      setGenerating(null)
    }
  }

  async function generateRecipe() {
    if (!recipeInput.trim()) return
    setGenerating('recipe')
    try {
      const result = await sendToCoach(`Give me a recipe for ${recipeInput}. Include ingredients, steps, prep time, and macros per serving.`, false)
      setMealPlan(result)
      setRecipeInput('')
    } catch (err) {
      console.error('generateRecipe error:', err)
      setMealPlan('Unable to generate recipe. Please try again.')
    } finally {
      setGenerating(null)
    }
  }

  async function generateExercisePlan() {
    setGenerating('exercise')
    try {
      const result = await sendToCoach(`Create a complete weekly exercise plan for me. My fitness level is ${fitnessLevel}. Equipment available: ${equipment}. Include specific exercises, sets, and reps for each day. After generating it, save it to my account using the save_workout_plan tool.`, false)
      setExercisePlan(result)
      // Refresh saved plans from DB
      if (userId) {
        const { data } = await supabase.from('workout_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
        if (data) setSavedWorkoutPlans(data)
      }
    } catch (err) {
      console.error('generateExercisePlan error:', err)
      setExercisePlan('Unable to generate exercise plan. Please try again.')
    } finally {
      setGenerating(null)
    }
  }

  // ── PDF Export ────────────────────────────────────────
  async function downloadPDF(type: 'taper' | 'meal' | 'exercise', content: string) {
    const res = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content, userName: profile?.name || '' }),
    })
    const html = await res.text()
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  // ── Readiness Save ────────────────────────────────────
  async function saveReadiness(confirmed = false) {
    if (!userId) return
    const answers = { ...readiness }
    if (confirmed) answers.__confirmed_ready = true

    try {
      const res = await fetch('/api/readiness-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (res.ok && data.plan) {
        setPlan(data.plan)
      }
    } catch (err) {
      console.error('Save readiness error:', err)
    }

    setAssessmentSaved(true)
    if (confirmed) setConfirmedReady(true)
  }

  async function activateOverride() {
    try {
      const res = await fetch('/api/tapering-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        setHasOverride(true)
        setShowOverrideConfirm(false)
      }
    } catch (err) {
      console.error('Override error:', err)
    }
  }

  // ── Chat ──────────────────────────────────────────────
  async function sendChat(msg?: string) {
    const text = msg || chatInput.trim()
    if (!text) return
    setChatMessages(prev => [...prev, { role: 'user', content: text }])
    setChatInput('')
    setChatLoading(true)
    const reply = await sendToCoach(text, true)
    setChatMessages(prev => [...prev, { role: 'assistant', content: reply }])
    setChatLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="space-y-4 w-full max-w-2xl px-4">
        <div className="h-32 rounded-3xl bg-gradient-to-r from-[#EAF2EB] to-[#F5F8F3] animate-pulse" />
        <div className="h-10 rounded-2xl bg-[#EAF2EB]/60 animate-pulse" />
        <div className="h-48 rounded-3xl bg-gradient-to-r from-[#EAF2EB] to-[#F5F8F3] animate-pulse" />
        <div className="h-36 rounded-3xl bg-[#EAF2EB]/40 animate-pulse" />
      </div>
    </div>
  )

  const phase = computePhase(plan, latestMedDose, daysSinceLastDose)
  const phaseIdx = PHASES.findIndex(p => p.id === phase)
  const checkedCount = ALL_ASSESSMENT_ITEMS.filter(item => readiness[item]).length
  const totalItems = ALL_ASSESSMENT_ITEMS.length
  const MIN_READINESS = 14
  const savedScore = plan?.readiness_score ?? 0
  const currentScore = Math.max(savedScore, checkedCount)
  const taperUnlocked = currentScore >= MIN_READINESS || hasOverride

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ fontFamily: 'var(--font-inter)', paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <header className="bg-gradient-to-br from-[#1F4B32] via-[#2D6B45] to-[#1F4B32] px-5 pt-5 pb-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-white font-semibold text-xl tracking-tight" style={{ fontFamily: 'var(--font-fraunces)' }}>Your transition plan</h1>
              <p className="text-white/40 text-xs mt-0.5">{profile?.medication} · {profile?.dose}</p>
            </div>
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-white/40 text-xs hover:text-white/70 cursor-pointer transition-all duration-300">
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </button>
          </div>
          {/* Phase pipeline — display only, tap for info */}
          <div className="flex items-center gap-3">
            {PHASES.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPhaseInfoOpen(p.id)}
                aria-label={`Learn about ${p.label} phase`}
                className="flex-1 flex flex-col items-center gap-2 cursor-pointer group"
              >
                <div className="relative">
                  {i < phaseIdx ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] flex items-center justify-center shadow-lg">
                      <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
                    </div>
                  ) : i === phaseIdx ? (
                    <div className="relative">
                      <div className="absolute inset-0 w-8 h-8 rounded-full bg-[#7FFFA4] animate-ping opacity-30" />
                      <div className="w-8 h-8 rounded-full bg-[#7FFFA4] flex items-center justify-center shadow-[0_0_12px_4px_rgba(127,255,164,0.3)]">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#1F4B32]" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center group-hover:border-white/40 transition-all duration-300">
                      <div className="w-2 h-2 rounded-full bg-white/20" />
                    </div>
                  )}
                </div>
                <span className={`text-[9px] font-semibold transition-all duration-300 ${i <= phaseIdx ? 'text-white' : 'text-white/30 group-hover:text-white/50'}`}>{p.short}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Phase info — responsive modal (desktop) / bottom sheet (mobile) */}
      <AnimatePresence>
        {phaseInfoOpen && (() => {
          const infoIdx = PHASES.findIndex(p => p.id === phaseInfoOpen)
          const isComplete = infoIdx < phaseIdx
          const isCurrent = phaseInfoOpen === phase
          const statusLabel = isComplete ? 'Completed' : isCurrent ? 'Current phase' : 'Upcoming'
          const dotClass = isComplete
            ? 'bg-gradient-to-r from-[#1F4B32] to-[#2D6B45]'
            : isCurrent ? 'bg-[#7FFFA4]' : 'bg-[#F5F8F3] border-2 border-[#EAF2EB]'

          const content = (
            <>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dotClass}`}>
                    {isComplete ? (
                      <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
                    ) : isCurrent ? (
                      <div className="w-3 h-3 rounded-full bg-[#1F4B32]" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#6B7A72]/30" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>{PHASES.find(p => p.id === phaseInfoOpen)?.label}</h3>
                    <p className="text-[10px] text-[#6B7A72] uppercase font-semibold tracking-wider">{statusLabel}</p>
                  </div>
                </div>
                <button onClick={() => setPhaseInfoOpen(null)} className="p-2 rounded-full hover:bg-[#F5F8F3] transition-colors cursor-pointer">
                  <X className="w-4 h-4 text-[#6B7A72]" />
                </button>
              </div>
              <p className="text-sm text-[#0D1F16]/80 leading-relaxed">{PHASE_INFO[phaseInfoOpen]}</p>
            </>
          )

          return (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                onClick={() => setPhaseInfoOpen(null)}
              />
              {isDesktop ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md bg-white rounded-3xl shadow-2xl border border-[#EAF2EB] p-6"
                >
                  {content}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.15)] p-6 pb-10"
                >
                  <div className="w-12 h-1 bg-[#D0D0CA] rounded-full mx-auto mb-4" />
                  {content}
                </motion.div>
              )}
            </>
          )
        })()}
      </AnimatePresence>

      {/* Tabs */}
      <div className="bg-white/80 backdrop-blur-md border-b border-[#EAF2EB] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex">
          {([
            { id: 'plan' as const, label: 'My Plan' },
            { id: 'nutrition' as const, label: 'Nutrition' },
            { id: 'exercise' as const, label: 'Exercise' },
            { id: 'coach' as const, label: 'Coach' },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer ${activeTab === tab.id ? 'text-[#1F4B32] border-b-2 border-[#7FFFA4]' : 'text-[#6B7A72] hover:text-[#0D1F16]'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ═══ MY PLAN TAB ═══ */}
        {activeTab === 'plan' && (<>
          {/* Current status */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-[#EAF2EB] flex items-center justify-center shrink-0">
                {taperUnlocked ? <Unlock className="w-5 h-5 text-[#1F4B32]" /> : <Lock className="w-5 h-5 text-[#6B7A72]" />}
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0D1F16]">{taperUnlocked ? `${PHASES[phaseIdx].label} Phase` : 'Readiness Assessment'}</h2>
                <p className="text-xs text-[#6B7A72]">{taperUnlocked ? `${profile?.medication} · ${profile?.dose}` : 'Complete the assessment to unlock your tapering plan'}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-[#6B7A72] font-semibold uppercase">Readiness</span>
                <span className={`font-bold ${currentScore >= MIN_READINESS ? 'text-[#1F4B32]' : currentScore >= 10 ? 'text-[#C4742B]' : 'text-[#6B7A72]'}`}>{currentScore}/{totalItems}</span>
              </div>
              <div className="h-2.5 bg-[#F5F8F3] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(currentScore / totalItems) * 100}%`,
                    background: currentScore >= MIN_READINESS
                      ? 'linear-gradient(to right, #7FFFA4, #1F4B32)'
                      : currentScore >= 10 ? '#C4742B' : '#6B7A72',
                  }}
                />
              </div>
            </div>
            {taperUnlocked && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#EAF2EB] rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-[#1F4B32]">{currentScore}/{totalItems}</p>
                  <p className="text-[9px] text-[#1F4B32]/60">readiness score</p>
                </div>
                <div className="bg-[#F5F8F3] rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-[#0D1F16]">{plan?.stability_streak_days || 0}</p>
                  <p className="text-[9px] text-[#6B7A72]">stable days</p>
                </div>
              </div>
            )}
          </div>

          {/* ── ASSESSMENT (shown until confirmed ready) ── */}
          {!taperUnlocked && (<>
            {ASSESSMENT_SECTIONS.map((section, si) => {
              const sectionChecked = section.items.filter(item => readiness[item]).length
              return (
                <div key={si} className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-[#0D1F16]">{section.title}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sectionChecked === section.items.length ? 'bg-[#EAF2EB] text-[#1F4B32]' : 'bg-[#F5F8F3] text-[#6B7A72]'}`}>
                      {sectionChecked}/{section.items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {section.items.map((item, i) => (
                      <button key={i} onClick={() => setReadiness({ ...readiness, [item]: !readiness[item] })}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all duration-300 text-left ${readiness[item] ? 'border-[#1F4B32] bg-[#EAF2EB]' : 'border-[#EAF2EB] hover:border-[#6B7A72]'}`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${readiness[item] ? 'border-transparent bg-gradient-to-r from-[#1F4B32] to-[#2D6B45]' : 'border-[#D0D0CA]'}`}>
                          {readiness[item] && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>
                        <span className="text-sm text-[#0D1F16]">{item}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Assessment result + action */}
            <div className={`rounded-3xl p-6 ${checkedCount >= MIN_READINESS ? 'bg-[#EAF2EB] border border-[#1F4B32]/20' : 'bg-[#F5F8F3] border border-[#EAF2EB]'}`}>
              {checkedCount >= MIN_READINESS ? (
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-base font-bold text-[#1F4B32]">You're ready to taper</h3>
                  <p className="text-xs text-[#1F4B32]/70 max-w-sm mx-auto">You've met {checkedCount}/{totalItems} readiness criteria (minimum {MIN_READINESS}). Your habits, health, and support system are in place.</p>
                  <button onClick={() => saveReadiness(true)}
                    className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-4 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300 mt-2">
                    Save &amp; Unlock My Tapering Plan
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                      {checkedCount >= 10 ? <Unlock className="w-5 h-5 text-[#C4742B]" /> : <Lock className="w-5 h-5 text-[#6B7A72]" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#0D1F16]">{checkedCount >= 10 ? 'Almost there' : 'Keep building habits'}</h3>
                      <p className="text-xs text-[#6B7A72]">{MIN_READINESS - checkedCount} more item{MIN_READINESS - checkedCount !== 1 ? 's' : ''} needed to unlock plan generation ({checkedCount}/{MIN_READINESS})</p>
                    </div>
                  </div>
                  <button onClick={() => saveReadiness()}
                    className="w-full bg-white text-[#1F4B32] py-2.5 rounded-2xl text-xs font-semibold cursor-pointer border border-[#1F4B32]/20 hover:bg-[#EAF2EB] transition-all duration-300">
                    Save Progress ({checkedCount}/{totalItems})
                  </button>
                  <button onClick={() => setShowOverrideConfirm(true)}
                    className="w-full text-[10px] text-[#6B7A72] py-1 cursor-pointer hover:text-[#0D1F16] transition-all duration-300">
                    I'm already tapering — let me skip
                  </button>
                </div>
              )}
            </div>
          </>)}

          {/* ── PLAN GENERATION (only after confirmed ready) ── */}
          {taperUnlocked && (<>
            {/* Duration selector */}
            <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <h3 className="text-sm font-semibold text-[#0D1F16] mb-3">Choose Your Timeline</h3>
              <div className="space-y-2">
                {TAPER_DURATIONS.map(d => (
                  <button key={d.id} onClick={() => setTaperDuration(d.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all duration-300 text-left ${taperDuration === d.id ? 'border-[#1F4B32] bg-[#EAF2EB]' : 'border-[#EAF2EB] hover:border-[#6B7A72]'}`}>
                    <div>
                      <span className={`text-sm font-semibold ${taperDuration === d.id ? 'text-[#1F4B32]' : 'text-[#0D1F16]'}`}>{d.label}</span>
                      <p className="text-[11px] text-[#6B7A72] mt-0.5">{d.desc}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${taperDuration === d.id ? 'border-[#1F4B32] bg-gradient-to-r from-[#1F4B32] to-[#2D6B45]' : 'border-[#D0D0CA]'}`}>
                      {taperDuration === d.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={generateTaperPlan} disabled={generating === 'taper'}
              className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-4 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300 disabled:opacity-30">
              {generating === 'taper' ? 'Generating your plan...' : `Generate My ${TAPER_DURATIONS.find(d => d.id === taperDuration)?.label} Tapering Plan`}
            </button>

            {/* Generated plan */}
            {taperPlan && (
              <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-[#0D1F16]">Your Tapering Plan</h3>
                  <button onClick={() => downloadPDF('taper', taperPlan)} className="flex items-center gap-1.5 text-xs text-[#1F4B32] font-semibold cursor-pointer hover:underline">
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                </div>
                <div className="text-sm text-[#0D1F16]/80 leading-relaxed whitespace-pre-wrap">{taperPlan}</div>
              </div>
            )}

            {/* Option to retake assessment */}
            <button onClick={() => { setConfirmedReady(false); setAssessmentSaved(false) }}
              className="w-full text-xs text-[#6B7A72] py-2 cursor-pointer hover:text-[#0D1F16] transition-all duration-300">
              Retake readiness assessment
            </button>
          </>)}
        </>)}

        {/* ═══ NUTRITION TAB ═══ */}
        {activeTab === 'nutrition' && (<>
          {/* Meal plan generator */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 space-y-3 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-[#1F4B32]" />
              <h3 className="text-sm font-semibold text-[#0D1F16]">Generate Meal Plan</h3>
            </div>
            <div className="bg-[#F5F8F3] rounded-2xl p-1 flex gap-1">
              {(['daily', 'weekly'] as const).map(t => (
                <button key={t} onClick={() => setMealPlanType(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize cursor-pointer transition-all duration-300 ${mealPlanType === t ? 'bg-white shadow-sm text-[#1F4B32]' : 'text-[#6B7A72]'}`}>{t}</button>
              ))}
            </div>
            <button onClick={generateMealPlan} disabled={generating === 'meal'}
              className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300 disabled:opacity-30">
              {generating === 'meal' ? 'Generating...' : `Generate ${mealPlanType} meal plan`}
            </button>
          </div>

          {/* Recipe generator */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 space-y-3 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
            <h3 className="text-sm font-semibold text-[#0D1F16]">Get a Recipe</h3>
            <div className="flex gap-2">
              <input type="text"
                name="recipe-search"
                autoComplete="off"
                data-form-type="other"
                data-1p-ignore="true"
                data-lpignore="true"
                value={recipeInput} onChange={e => setRecipeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generateRecipe()}
                placeholder="e.g. high-protein chicken stir fry"
                className="flex-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/50 transition-all duration-300"/>
              <button onClick={generateRecipe} disabled={generating === 'recipe' || !recipeInput.trim()}
                className="bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white px-4 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300 disabled:opacity-30">
                {generating === 'recipe' ? '...' : 'Go'}
              </button>
            </div>
          </div>

          {/* Generated plan */}
          {mealPlan && (
            <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-[#0D1F16]">Your Plan</h3>
                <button onClick={() => downloadPDF('meal', mealPlan)} className="flex items-center gap-1.5 text-xs text-[#1F4B32] font-semibold cursor-pointer hover:underline">
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
              </div>
              <div className="text-sm text-[#0D1F16]/80 leading-relaxed whitespace-pre-wrap">{mealPlan}</div>
            </div>
          )}

          {/* Saved plans from database */}
          {savedMealPlans.length > 0 && (
            <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <button onClick={() => setShowSaved(!showSaved)} className="flex justify-between items-center w-full cursor-pointer">
                <h3 className="text-sm font-semibold text-[#0D1F16]">Saved Meal Plans ({savedMealPlans.length})</h3>
                {showSaved ? <ChevronUp className="w-4 h-4 text-[#6B7A72]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A72]" />}
              </button>
              {showSaved && (
                <div className="mt-3 space-y-3">
                  {savedMealPlans.map((sp) => (
                    <div key={sp.id} className="border-t border-[#EAF2EB] pt-3">
                      <button onClick={() => setExpandedMealPlan(expandedMealPlan === sp.id ? null : sp.id)}
                        className="w-full flex justify-between items-center cursor-pointer">
                        <div className="text-left">
                          <span className="text-sm font-semibold text-[#0D1F16]">{sp.title}</span>
                          <p className="text-[10px] text-[#6B7A72]">{new Date(sp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        </div>
                        {expandedMealPlan === sp.id ? <ChevronUp className="w-4 h-4 text-[#6B7A72]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A72]" />}
                      </button>
                      {expandedMealPlan === sp.id && (
                        <div className="mt-3 space-y-2">
                          {sp.description && <p className="text-xs text-[#6B7A72]">{sp.description}</p>}
                          {(sp.meals || []).map((meal: any, mi: number) => (
                            <div key={mi} className="bg-[#F5F8F3] rounded-xl p-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-[#1F4B32] capitalize">{meal.meal_type}</span>
                                {(meal.estimated_protein || meal.estimated_calories) && (
                                  <span className="text-[10px] text-[#6B7A72]">
                                    {meal.estimated_protein ? `${meal.estimated_protein}g protein` : ''}
                                    {meal.estimated_protein && meal.estimated_calories ? ' · ' : ''}
                                    {meal.estimated_calories ? `${meal.estimated_calories} cal` : ''}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-[#0D1F16] mt-1">{meal.name}</p>
                              {meal.prep_notes && <p className="text-[10px] text-[#6B7A72] mt-1">{meal.prep_notes}</p>}
                            </div>
                          ))}
                          {sp.grocery_list?.length > 0 && (
                            <div className="bg-[#F5F8F3] rounded-xl p-3">
                              <span className="text-xs font-semibold text-[#1F4B32]">Grocery List</span>
                              <p className="text-xs text-[#0D1F16] mt-1">{sp.grocery_list.join(', ')}</p>
                            </div>
                          )}
                          <button onClick={async () => {
                            await supabase.from('meal_plans').delete().eq('id', sp.id)
                            setSavedMealPlans(prev => prev.filter(p => p.id !== sp.id))
                          }} className="text-[10px] text-red-500 cursor-pointer hover:text-red-700 transition-colors">Delete plan</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>)}

        {/* ═══ EXERCISE TAB ═══ */}
        {activeTab === 'exercise' && (<>
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 space-y-4 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-[#1F4B32]" />
              <h3 className="text-sm font-semibold text-[#0D1F16]">Generate Exercise Plan</h3>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Fitness Level</p>
              <div className="bg-[#F5F8F3] rounded-2xl p-1 flex gap-1">
                {['Beginner', 'Intermediate', 'Advanced'].map(l => (
                  <button key={l} onClick={() => setFitnessLevel(l)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-300 ${fitnessLevel === l ? 'bg-white shadow-sm text-[#1F4B32]' : 'text-[#6B7A72]'}`}>{l}</button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Equipment</p>
              <div className="bg-[#F5F8F3] rounded-2xl p-1 flex gap-1">
                {['None', 'Dumbbells', 'Full Gym'].map(e => (
                  <button key={e} onClick={() => setEquipment(e)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-300 ${equipment === e ? 'bg-white shadow-sm text-[#1F4B32]' : 'text-[#6B7A72]'}`}>{e}</button>
                ))}
              </div>
            </div>

            <button onClick={generateExercisePlan} disabled={generating === 'exercise'}
              className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300 disabled:opacity-30">
              {generating === 'exercise' ? 'Generating...' : 'Generate Exercise Plan'}
            </button>
          </div>

          {exercisePlan && (
            <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-[#0D1F16]">Your Exercise Plan</h3>
                <button onClick={() => downloadPDF('exercise', exercisePlan)} className="flex items-center gap-1.5 text-xs text-[#1F4B32] font-semibold cursor-pointer hover:underline">
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
              </div>
              <div className="text-sm text-[#0D1F16]/80 leading-relaxed whitespace-pre-wrap">{exercisePlan}</div>
            </div>
          )}

          {/* Saved workout plans from database */}
          {savedWorkoutPlans.length > 0 && (
            <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <h3 className="text-sm font-semibold text-[#0D1F16] mb-3">Saved Workout Plans</h3>
              <div className="space-y-3">
                {savedWorkoutPlans.map((wp) => (
                  <div key={wp.id} className="border-t border-[#EAF2EB] pt-3 first:border-0 first:pt-0">
                    <button onClick={() => setExpandedWorkoutPlan(expandedWorkoutPlan === wp.id ? null : wp.id)}
                      className="w-full flex justify-between items-center cursor-pointer">
                      <div className="text-left">
                        <span className="text-sm font-semibold text-[#0D1F16]">{wp.title}</span>
                        <p className="text-[10px] text-[#6B7A72]">
                          {wp.days_per_week ? `${wp.days_per_week}x/week · ` : ''}
                          {new Date(wp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      {expandedWorkoutPlan === wp.id ? <ChevronUp className="w-4 h-4 text-[#6B7A72]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A72]" />}
                    </button>
                    {expandedWorkoutPlan === wp.id && (
                      <div className="mt-3 space-y-2">
                        {wp.description && <p className="text-xs text-[#6B7A72]">{wp.description}</p>}
                        {(wp.workouts || []).map((day: any, di: number) => (
                          <div key={di} className="bg-[#F5F8F3] rounded-xl p-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-semibold text-[#1F4B32]">{day.day}</span>
                              {day.focus && <span className="text-[10px] text-[#6B7A72]">{day.focus}</span>}
                            </div>
                            {day.exercises?.map((ex: any, ei: number) => (
                              <p key={ei} className="text-xs text-[#0D1F16] mt-1">
                                {ex.name}{ex.sets ? ` — ${ex.sets}x${ex.reps || ''}` : ''}{ex.notes ? ` (${ex.notes})` : ''}
                              </p>
                            ))}
                            {day.duration_minutes && <p className="text-[10px] text-[#6B7A72] mt-1">{day.duration_minutes} min</p>}
                          </div>
                        ))}
                        <button onClick={async () => {
                          await supabase.from('workout_plans').delete().eq('id', wp.id)
                          setSavedWorkoutPlans(prev => prev.filter(p => p.id !== wp.id))
                        }} className="text-[10px] text-red-500 cursor-pointer hover:text-red-700 transition-colors">Delete plan</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>)}

        {/* ═══ COACH TAB ═══ */}
        {activeTab === 'coach' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
            {/* Readiness score card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#EAF2EB] mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#6B7A72] font-semibold">Tapering Readiness</div>
                  <div className="text-3xl font-bold tabular-nums text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)', fontVariantNumeric: 'tabular-nums' }}>
                    {currentScore}<span className="text-[#6B7A72] text-xl font-normal">/{totalItems}</span>
                  </div>
                </div>
                <div className={`text-sm font-semibold ${taperUnlocked ? 'text-[#1F4B32]' : 'text-[#C4742B]'}`}>
                  {taperUnlocked ? (hasOverride ? 'Override active' : 'Ready') : 'Not yet ready'}
                </div>
              </div>
              <div className="h-2 bg-[#F5F8F3] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1F4B32] to-[#7FFFA4] transition-all duration-500 rounded-full"
                  style={{ width: `${(currentScore / totalItems) * 100}%` }}
                />
              </div>
              <p className="text-xs text-[#6B7A72] mt-2">
                {taperUnlocked
                  ? 'You can generate your tapering plan below.'
                  : `Complete ${MIN_READINESS - currentScore} more criteria to unlock plan generation.`
                }
              </p>
            </div>

            <div ref={chatRef} className="flex-1 overflow-y-auto space-y-3 mb-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#C4742B] to-[#D4843B] flex items-center justify-center mx-auto mb-3 shadow-[0_4px_16px_-4px_rgba(196,116,43,0.4)]">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-[#0D1F16]">Ask Trish, your transition coach</p>
                  <p className="text-xs text-[#6B7A72] mt-1 max-w-xs mx-auto">Direct, data-driven plans for tapering, nutrition, exercise, and maintaining your results.</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {([
                      ...(taperUnlocked ? ['Generate my tapering plan'] : []),
                      'Make me a weekly meal plan',
                      'Create an exercise plan for me',
                      'Am I ready to start tapering?',
                      "I'm gaining weight — what do I do?",
                      'Give me a high-protein recipe',
                    ] as string[]).map(q => (
                      <button key={q} onClick={() => sendChat(q)}
                        className="text-xs px-3 py-2 rounded-full border border-[#EAF2EB] text-[#6B7A72] cursor-pointer hover:border-[#1F4B32] hover:text-[#1F4B32] transition-all duration-300">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#C4742B] to-[#D4843B] flex items-center justify-center shrink-0 mr-2 mt-1">
                      <MessageCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user' ? 'bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white rounded-br-md' : 'bg-white border border-[#EAF2EB] text-[#0D1F16] rounded-bl-md shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]'
                  }`}>{msg.content}</div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#C4742B] to-[#D4843B] flex items-center justify-center shrink-0 mr-2 mt-1">
                    <MessageCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white border border-[#EAF2EB] px-4 py-3 rounded-2xl rounded-bl-md shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#7FFFA4] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[#7FFFA4] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[#7FFFA4] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form autoComplete="off" onSubmit={e => { e.preventDefault(); sendChat() }} className="flex gap-2 bg-white/80 backdrop-blur-md rounded-2xl p-2 border border-[#EAF2EB]">
              <input type="text"
                name="trish-message"
                autoComplete="off"
                autoCorrect="on"
                autoCapitalize="sentences"
                spellCheck={true}
                data-form-type="other"
                data-1p-ignore="true"
                data-lpignore="true"
                value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask Trish anything..." autoFocus
                className="flex-1 px-3 py-2.5 bg-transparent text-sm text-[#0D1F16] outline-none placeholder:text-[#6B7A72]/50"/>
              <VoiceInput onResult={(text) => setChatInput(text)} />
              <button onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}
                className="bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-30 transition-all duration-300 hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)]">
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Override confirmation modal */}
      <AnimatePresence>
        {showOverrideConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowOverrideConfirm(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6 pb-10 max-w-2xl mx-auto shadow-[0_-8px_32px_rgba(0,0,0,0.15)]"
            >
              <h3 className="text-base font-bold text-[#0D1F16] mb-2">Skip readiness assessment?</h3>
              <p className="text-sm text-[#6B7A72] leading-relaxed mb-5">
                This will skip the readiness assessment. Use this only if you're already mid-taper and joined NovuraHealth later. Your provider should be aware of your tapering plan.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowOverrideConfirm(false)}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold border border-[#EAF2EB] text-[#6B7A72] cursor-pointer hover:bg-[#F5F8F3] transition-all duration-300">
                  Cancel
                </button>
                <button onClick={activateOverride}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-gradient-to-r from-[#C4742B] to-[#D4843B] text-white cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(196,116,43,0.4)] transition-all duration-300">
                  Continue — Skip Assessment
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
