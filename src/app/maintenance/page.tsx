'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import VoiceInput from '../components/VoiceInput'
import BottomNav from '../components/BottomNav'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Download, Dumbbell, UtensilsCrossed, MessageCircle, Lock, Unlock } from 'lucide-react'

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

  // Saved plans (localStorage)
  const [savedMealPlans, setSavedMealPlans] = useState<string[]>([])
  const [showSaved, setShowSaved] = useState(false)

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

      const { data: tp } = await supabase.from('tapering_plans').select('*').eq('user_id', user.id).single()
      if (tp) {
        setPlan(tp)
        if (tp.readiness_answers) {
          setReadiness(tp.readiness_answers)
          if (tp.readiness_score !== null && tp.readiness_score !== undefined) setAssessmentSaved(true)
          if (tp.readiness_answers.__confirmed_ready) setConfirmedReady(true)
        }
      }

      // Load saved meal plans from localStorage
      try {
        const saved = localStorage.getItem('novura_saved_meals')
        if (saved) setSavedMealPlans(JSON.parse(saved))
      } catch { /* ignore */ }

      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  // ── Coach API ─────────────────────────────────────────
  async function sendToCoach(prompt: string, displayAsChat = true): Promise<string> {
    if (!userId) return ''

    const msgs = displayAsChat
      ? [...chatMessages.map(m => ({ role: m.role, content: m.content })), { role: 'user' as const, content: prompt }]
      : [{ role: 'user' as const, content: prompt }]

    const res = await fetch('/api/transition-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, userId }),
    })
    const { message } = await res.json()
    return message || 'Unable to generate plan. Try again.'
  }

  // ── Generators ────────────────────────────────────────
  async function generateTaperPlan() {
    setGenerating('taper')
    const durationLabel = TAPER_DURATIONS.find(d => d.id === taperDuration)?.label || '90 Days'
    const result = await sendToCoach(`Generate my complete tapering plan based on all my data. The user wants a ${durationLabel} tapering timeline. Include specific phases with exact week ranges, dose changes at each step, protein/exercise targets, red flags to watch for, and what to do if things go wrong. Make it personal to my medication, dose, weight, and habits.`, false)
    setTaperPlan(result)
    setGenerating(null)
  }

  async function generateMealPlan() {
    setGenerating('meal')
    const prompt = mealPlanType === 'weekly'
      ? 'Create a complete weekly meal plan for me. 7 days. Hit my protein target each day. Use foods I actually eat based on my food logs.'
      : 'Create a complete daily meal plan for me. Breakfast, lunch, snack, dinner. Hit my protein target. Use foods I actually eat.'
    const result = await sendToCoach(prompt, false)
    setMealPlan(result)
    // Save to localStorage (keep last 3)
    const updated = [result, ...savedMealPlans].slice(0, 3)
    setSavedMealPlans(updated)
    try { localStorage.setItem('novura_saved_meals', JSON.stringify(updated)) } catch { /* ignore */ }
    setGenerating(null)
  }

  async function generateRecipe() {
    if (!recipeInput.trim()) return
    setGenerating('recipe')
    const result = await sendToCoach(`Give me a recipe for ${recipeInput}. Include ingredients, steps, prep time, and macros per serving.`, false)
    setMealPlan(result)
    setRecipeInput('')
    setGenerating(null)
  }

  async function generateExercisePlan() {
    setGenerating('exercise')
    const result = await sendToCoach(`Create a complete weekly exercise plan for me. My fitness level is ${fitnessLevel}. Equipment available: ${equipment}. Include specific exercises, sets, and reps for each day.`, false)
    setExercisePlan(result)
    setGenerating(null)
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
    const checked = ALL_ASSESSMENT_ITEMS.filter(item => readiness[item]).length
    const score = Math.round((checked / ALL_ASSESSMENT_ITEMS.length) * 100)
    const payload = { readiness_score: score, readiness_answers: answers, updated_at: new Date().toISOString() }
    if (plan) {
      const { data } = await supabase.from('tapering_plans').update(payload).eq('id', plan.id).select().single()
      if (data) setPlan(data)
    } else {
      const { data } = await supabase.from('tapering_plans').insert({ user_id: userId, phase: 'exploring', ...payload }).select().single()
      if (data) setPlan(data)
    }
    setAssessmentSaved(true)
    if (confirmed) setConfirmedReady(true)
  }

  async function setPhase(phase: Phase) {
    if (!userId) return
    if (plan) {
      const { data } = await supabase.from('tapering_plans').update({ phase, updated_at: new Date().toISOString() }).eq('id', plan.id).select().single()
      if (data) setPlan(data)
    } else {
      const { data } = await supabase.from('tapering_plans').insert({ user_id: userId, phase }).select().single()
      if (data) setPlan(data)
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

  const phase = plan?.phase || 'exploring'
  const phaseIdx = PHASES.findIndex(p => p.id === phase)
  const readinessScore = plan?.readiness_score ?? null
  const checkedCount = ALL_ASSESSMENT_ITEMS.filter(item => readiness[item]).length
  const totalItems = ALL_ASSESSMENT_ITEMS.length
  const currentPct = Math.round((checkedCount / totalItems) * 100)
  const isFullyReady = checkedCount === totalItems
  const taperUnlocked = confirmedReady

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-24" style={{ fontFamily: 'var(--font-inter)' }}>
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
          {/* Phase pipeline */}
          <div className="flex items-center gap-3">
            {PHASES.map((p, i) => (
              <button key={p.id} onClick={() => setPhase(p.id)} className="flex-1 flex flex-col items-center gap-2 cursor-pointer group">
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
                <span className={`font-bold ${currentPct === 100 ? 'text-[#1F4B32]' : currentPct >= 75 ? 'text-[#C4742B]' : 'text-[#6B7A72]'}`}>{checkedCount}/{totalItems} ({currentPct}%)</span>
              </div>
              <div className="h-2.5 bg-[#F5F8F3] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${currentPct}%`,
                    background: currentPct === 100
                      ? 'linear-gradient(to right, #7FFFA4, #1F4B32)'
                      : currentPct >= 75 ? '#C4742B' : '#6B7A72',
                  }}
                />
              </div>
            </div>
            {taperUnlocked && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#EAF2EB] rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-[#1F4B32]">{readinessScore}%</p>
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
            <div className={`rounded-3xl p-6 ${isFullyReady ? 'bg-[#EAF2EB] border border-[#1F4B32]/20' : 'bg-[#F5F8F3] border border-[#EAF2EB]'}`}>
              {isFullyReady ? (
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-base font-bold text-[#1F4B32]">You're ready to taper</h3>
                  <p className="text-xs text-[#1F4B32]/70 max-w-sm mx-auto">You've checked every box. Your habits, health, and support system are in place. Confirm below to unlock your personalized tapering plan.</p>
                  <button onClick={() => saveReadiness(true)}
                    className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-4 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300 mt-2">
                    I'm Ready — Unlock My Tapering Plan
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                      {currentPct >= 75 ? <Unlock className="w-5 h-5 text-[#C4742B]" /> : <Lock className="w-5 h-5 text-[#6B7A72]" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#0D1F16]">{currentPct >= 75 ? 'Almost there' : 'Keep building habits'}</h3>
                      <p className="text-xs text-[#6B7A72]">{totalItems - checkedCount} item{totalItems - checkedCount !== 1 ? 's' : ''} remaining before you can generate a tapering plan</p>
                    </div>
                  </div>
                  <button onClick={() => saveReadiness()}
                    className="w-full bg-white text-[#1F4B32] py-2.5 rounded-2xl text-xs font-semibold cursor-pointer border border-[#1F4B32]/20 hover:bg-[#EAF2EB] transition-all duration-300">
                    Save Progress ({currentPct}%)
                  </button>
                  {currentPct >= 75 && (
                    <p className="text-[10px] text-[#6B7A72] text-center">Feeling ready despite unchecked items? Talk to Trish in the Coach tab to discuss.</p>
                  )}
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
              <input type="text" autoComplete="off" value={recipeInput} onChange={e => setRecipeInput(e.target.value)}
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

          {/* Saved plans */}
          {savedMealPlans.length > 0 && (
            <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <button onClick={() => setShowSaved(!showSaved)} className="flex justify-between items-center w-full cursor-pointer">
                <h3 className="text-sm font-semibold text-[#0D1F16]">Saved Plans ({savedMealPlans.length})</h3>
                {showSaved ? <ChevronUp className="w-4 h-4 text-[#6B7A72]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A72]" />}
              </button>
              {showSaved && (
                <div className="mt-3 space-y-3">
                  {savedMealPlans.map((sp, i) => (
                    <div key={i} className="border-t border-[#EAF2EB] pt-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-[#6B7A72] uppercase font-semibold">Plan {savedMealPlans.length - i}</span>
                        <button onClick={() => { setMealPlan(sp) }} className="text-[10px] text-[#1F4B32] font-semibold cursor-pointer">View</button>
                      </div>
                      <p className="text-xs text-[#6B7A72] line-clamp-2">{sp.slice(0, 120)}...</p>
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
        </>)}

        {/* ═══ COACH TAB ═══ */}
        {activeTab === 'coach' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
            <div ref={chatRef} className="flex-1 overflow-y-auto space-y-3 mb-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#C4742B] to-[#D4843B] flex items-center justify-center mx-auto mb-3 shadow-[0_4px_16px_-4px_rgba(196,116,43,0.4)]">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-[#0D1F16]">Ask Trish, your transition coach</p>
                  <p className="text-xs text-[#6B7A72] mt-1 max-w-xs mx-auto">Direct, data-driven plans for tapering, nutrition, exercise, and maintaining your results.</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {[
                      'Generate my tapering plan',
                      'Make me a weekly meal plan',
                      'Create an exercise plan for me',
                      'Am I ready to start tapering?',
                      "I'm gaining weight — what do I do?",
                      'Give me a high-protein recipe',
                    ].map(q => (
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

            <div className="flex gap-2 bg-white/80 backdrop-blur-md rounded-2xl p-2 border border-[#EAF2EB]">
              <input type="text" autoComplete="off" value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask Trish anything..." autoFocus
                className="flex-1 px-3 py-2.5 bg-transparent text-sm text-[#0D1F16] outline-none placeholder:text-[#6B7A72]/50"/>
              <VoiceInput onResult={(text) => setChatInput(text)} />
              <button onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}
                className="bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-30 transition-all duration-300 hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)]">
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
