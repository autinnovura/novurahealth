'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type Phase = 'exploring' | 'preparing' | 'tapering' | 'maintenance' | 'off_medication'

interface TaperPlan {
  id: string; phase: Phase; current_dose: string; target_dose: string
  taper_start_date: string; last_dose_change: string; stability_streak_days: number
  readiness_score: number; notes: string
}

interface TaperCheckin {
  id: string; phase: string; weight: number; cravings: number; hunger: number
  confidence: number; habits_maintained: string[]; notes: string; logged_at: string
}

interface ChatMsg { role: 'user' | 'nova'; content: string }

const PHASES: { id: Phase; label: string; icon: string; short: string }[] = [
  { id: 'exploring', label: 'Exploring', icon: '🔍', short: 'Learn' },
  { id: 'preparing', label: 'Preparing', icon: '📋', short: 'Prep' },
  { id: 'tapering', label: 'Tapering', icon: '📉', short: 'Taper' },
  { id: 'maintenance', label: 'Maintenance', icon: '⚖️', short: 'Maintain' },
  { id: 'off_medication', label: 'Off Medication', icon: '🎉', short: 'Free' },
]

const HABITS = [
  'Hit protein target', 'Drank 80oz+ water', 'Exercised 30+ min',
  'Slept 7+ hours', 'Tracked all meals', 'Managed stress',
]

const PHASE_INFO: Record<Phase, { title: string; desc: string; tips: string[] }> = {
  exploring: {
    title: "Thinking About Tapering?",
    desc: "It's smart to research before making changes. Most people succeed when they build strong habits before reducing their dose.",
    tips: [
      "Talk to your prescribing doctor about your interest in tapering",
      "Build consistent protein habits (0.8g per lb of goal weight daily)",
      "Establish a regular exercise routine, especially resistance training",
      "Track your habits for 4+ weeks to build a baseline",
      "Weight should be stable for at least 1 month before considering tapering",
    ],
  },
  preparing: {
    title: "Getting Ready to Taper",
    desc: "You've decided to work toward tapering. Now it's about building the foundation that will support you without medication.",
    tips: [
      "Confirm your taper plan with your doctor",
      "Ensure you're consistently hitting protein targets",
      "Exercise at least 3-4x per week including resistance training",
      "Practice mindful eating — eat slowly, stop at 80% full",
      "Build a support system (friends, family, or community)",
      "Stock your kitchen with high-protein, whole food staples",
    ],
  },
  tapering: {
    title: "Actively Tapering",
    desc: "You're reducing your dose. This is a gradual process — patience is key. Monitor your weight and hunger closely.",
    tips: [
      "Reduce dose by one step every 4-8 weeks (as directed by doctor)",
      "Weigh yourself daily at the same time — look at weekly averages, not daily fluctuations",
      "Expect some increase in appetite — this is normal",
      "If you gain more than 3-5 lbs, talk to your doctor about pausing the taper",
      "Keep protein and exercise habits locked in — these are your anchors",
      "Log hunger and cravings daily to spot trends early",
    ],
  },
  maintenance: {
    title: "Maintenance Mode",
    desc: "You're on a minimal dose or have recently stopped. Focus on weight stability and reinforcing the habits that got you here.",
    tips: [
      "Stay within 3-5 lbs of your goal weight",
      "Continue tracking food and protein for at least 6 months",
      "Don't skip exercise — it's your most powerful maintenance tool",
      "If you see 3+ lbs of regain over 2 weeks, take action immediately",
      "Monthly check-ins with your doctor for the first year off medication",
      "It's okay to go back on medication if needed — this isn't failure",
    ],
  },
  off_medication: {
    title: "Living Without GLP-1",
    desc: "You did it. The habits you've built are now carrying you. Stay vigilant, stay consistent, and be proud of how far you've come.",
    tips: [
      "Keep weighing yourself regularly — awareness prevents creep",
      "Maintain your protein and exercise routines",
      "Have a plan for holidays, travel, and stressful periods",
      "If you regain 5+ lbs, don't wait — reassess your habits or talk to your doctor",
      "Remember: maintenance is a lifelong practice, not a destination",
    ],
  },
}

const READINESS_QUESTIONS = [
  { q: "I consistently hit my daily protein target", key: "protein" },
  { q: "I exercise at least 3 times per week", key: "exercise" },
  { q: "My weight has been stable for 4+ weeks", key: "stable" },
  { q: "I track my food regularly", key: "tracking" },
  { q: "I've discussed tapering with my doctor", key: "doctor" },
  { q: "I feel confident managing hunger without medication", key: "hunger" },
  { q: "I get 7+ hours of sleep most nights", key: "sleep" },
  { q: "I have strategies for emotional/stress eating", key: "stress" },
]

export default function Maintenance() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [plan, setPlan] = useState<TaperPlan | null>(null)
  const [checkins, setCheckins] = useState<TaperCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'plan' | 'checkin' | 'chat'>('plan')

  // Readiness assessment
  const [readinessAnswers, setReadinessAnswers] = useState<Record<string, boolean>>({})
  const [showReadiness, setShowReadiness] = useState(false)

  // Check-in form
  const [ciWeight, setCiWeight] = useState('')
  const [ciCravings, setCiCravings] = useState(3)
  const [ciHunger, setCiHunger] = useState(3)
  const [ciConfidence, setCiConfidence] = useState(3)
  const [ciHabits, setCiHabits] = useState<string[]>([])
  const [ciNotes, setCiNotes] = useState('')
  const [savingCheckin, setSavingCheckin] = useState(false)

  // Chat
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
      if (tp) setPlan(tp)

      const { data: tc } = await supabase.from('tapering_checkins').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(14)
      setCheckins(tc || [])

      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  async function createOrUpdatePlan(phase: Phase) {
    if (!userId) return
    const payload = { user_id: userId, phase, current_dose: profile?.dose || '', updated_at: new Date().toISOString() }
    if (plan) {
      const { data } = await supabase.from('tapering_plans').update({ phase, updated_at: new Date().toISOString() }).eq('id', plan.id).select().single()
      if (data) setPlan(data)
    } else {
      const { data } = await supabase.from('tapering_plans').insert(payload).select().single()
      if (data) setPlan(data)
    }
  }

  async function saveReadiness() {
    const score = Math.round((Object.values(readinessAnswers).filter(Boolean).length / READINESS_QUESTIONS.length) * 100)
    if (!userId) return
    if (plan) {
      const { data } = await supabase.from('tapering_plans').update({ readiness_score: score, updated_at: new Date().toISOString() }).eq('id', plan.id).select().single()
      if (data) setPlan(data)
    } else {
      const { data } = await supabase.from('tapering_plans').insert({ user_id: userId, phase: 'exploring', readiness_score: score }).select().single()
      if (data) setPlan(data)
    }
    setShowReadiness(false)
  }

  async function submitCheckin() {
    if (!userId) return
    setSavingCheckin(true)
    const { data } = await supabase.from('tapering_checkins').insert({
      user_id: userId, phase: plan?.phase || 'exploring',
      weight: parseFloat(ciWeight) || null, cravings: ciCravings,
      hunger: ciHunger, confidence: ciConfidence,
      habits_maintained: ciHabits, notes: ciNotes,
    }).select().single()
    if (data) setCheckins([data, ...checkins])
    setCiWeight(''); setCiCravings(3); setCiHunger(3); setCiConfidence(3); setCiHabits([]); setCiNotes('')
    setSavingCheckin(false)
    setActiveView('plan')
  }

  async function sendChat() {
    if (!chatInput.trim()) return
    const userMsg = chatInput.trim()
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatInput('')
    setChatLoading(true)

    try {
      const weightTrend = checkins.length >= 2
        ? `${checkins[0]?.weight || '?'} lbs (latest) vs ${checkins[checkins.length - 1]?.weight || '?'} lbs (oldest)`
        : null

      const res = await fetch('/api/maintenance-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg, profile, plan,
          recentCheckins: checkins.slice(0, 5), weightTrend,
        }),
      })
      const { message } = await res.json()
      setChatMessages(prev => [...prev, { role: 'nova', content: message }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'nova', content: "Having trouble connecting. Try again in a sec." }])
    }
    setChatLoading(false)
  }

  if (loading) return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin"/></div>

  const phase = plan?.phase || 'exploring'
  const phaseInfo = PHASE_INFO[phase]
  const phaseIdx = PHASES.findIndex(p => p.id === phase)
  const readinessScore = plan?.readiness_score ?? null
  const avgHunger = checkins.length > 0 ? Math.round(checkins.slice(0, 7).reduce((s, c) => s + (c.hunger || 3), 0) / Math.min(checkins.length, 7) * 10) / 10 : null
  const avgCravings = checkins.length > 0 ? Math.round(checkins.slice(0, 7).reduce((s, c) => s + (c.cravings || 3), 0) / Math.min(checkins.length, 7) * 10) / 10 : null

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-20">
      {/* Header */}
      <header className="bg-gradient-to-br from-[#2D5A3D] to-[#1E3F2B] px-5 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-white font-semibold text-lg tracking-tight">Transition Plan</h1>
              <p className="text-white/40 text-xs mt-0.5">Your path off GLP-1 medication</p>
            </div>
            <button onClick={() => router.push('/dashboard')} className="text-white/40 text-xs hover:text-white/70 cursor-pointer transition-colors">← Dashboard</button>
          </div>

          {/* Phase pipeline */}
          <div className="flex items-center gap-1">
            {PHASES.map((p, i) => (
              <div key={p.id} className="flex-1 flex flex-col items-center">
                <div className={`w-full h-1.5 rounded-full mb-2 ${i <= phaseIdx ? 'bg-white/80' : 'bg-white/15'}`} />
                <span className={`text-[9px] font-semibold ${i <= phaseIdx ? 'text-white' : 'text-white/30'}`}>{p.short}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* View tabs */}
      <div className="bg-white border-b border-[#E8E8E4] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex">
          {([
            { id: 'plan' as const, label: 'Plan' },
            { id: 'checkin' as const, label: 'Check-in' },
            { id: 'chat' as const, label: 'Ask Nova' },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveView(tab.id)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${activeView === tab.id ? 'text-[#2D5A3D] border-b-2 border-[#2D5A3D]' : 'text-[#B0B0A8] hover:text-[#6B6B65]'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ══════════ PLAN VIEW ══════════ */}
        {activeView === 'plan' && (<>
          {/* Current phase card */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#E8F0EB] flex items-center justify-center text-2xl shrink-0">{PHASES[phaseIdx].icon}</div>
              <div>
                <h2 className="text-base font-bold text-[#1E1E1C]">{phaseInfo.title}</h2>
                <p className="text-xs text-[#8B8B83] mt-1 leading-relaxed">{phaseInfo.desc}</p>
              </div>
            </div>

            {/* Phase selector */}
            <div className="flex gap-2 mb-4">
              {PHASES.map(p => (
                <button key={p.id} onClick={() => createOrUpdatePlan(p.id)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-semibold cursor-pointer transition-all ${phase === p.id ? 'bg-[#2D5A3D] text-white' : 'bg-[#F5F5F2] text-[#8B8B83] hover:text-[#6B6B65]'}`}>
                  {p.icon} {p.short}
                </button>
              ))}
            </div>

            {/* Quick stats */}
            {plan && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#F5F5F2] rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-[#1E1E1C]">{plan.stability_streak_days || 0}</p>
                  <p className="text-[9px] text-[#B0B0A8]">stability days</p>
                </div>
                <div className="bg-[#F5F5F2] rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-[#1E1E1C]">{readinessScore !== null ? `${readinessScore}%` : '—'}</p>
                  <p className="text-[9px] text-[#B0B0A8]">readiness</p>
                </div>
                <div className="bg-[#F5F5F2] rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-[#1E1E1C]">{checkins.length}</p>
                  <p className="text-[9px] text-[#B0B0A8]">check-ins</p>
                </div>
              </div>
            )}
          </div>

          {/* Readiness assessment */}
          {(phase === 'exploring' || phase === 'preparing') && (
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-[#1E1E1C]">Readiness Assessment</h3>
                {readinessScore !== null && !showReadiness && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${readinessScore >= 75 ? 'bg-[#E8F0EB] text-[#2D5A3D]' : readinessScore >= 50 ? 'bg-[#FFF0E5] text-[#C4742B]' : 'bg-[#F5F5F2] text-[#8B8B83]'}`}>
                    {readinessScore}% ready
                  </span>
                )}
              </div>

              {showReadiness ? (
                <div className="space-y-3">
                  {READINESS_QUESTIONS.map(rq => (
                    <button key={rq.key} onClick={() => setReadinessAnswers(prev => ({ ...prev, [rq.key]: !prev[rq.key] }))}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all text-left ${readinessAnswers[rq.key] ? 'border-[#2D5A3D] bg-[#E8F0EB]' : 'border-[#EDEDEA] hover:border-[#B0B0A8]'}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${readinessAnswers[rq.key] ? 'border-[#2D5A3D] bg-[#2D5A3D]' : 'border-[#EDEDEA]'}`}>
                        {readinessAnswers[rq.key] && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>}
                      </div>
                      <span className="text-sm text-[#1E1E1C]">{rq.q}</span>
                    </button>
                  ))}
                  <button onClick={saveReadiness} className="w-full bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer mt-2">
                    Save Assessment ({Math.round((Object.values(readinessAnswers).filter(Boolean).length / READINESS_QUESTIONS.length) * 100)}%)
                  </button>
                </div>
              ) : (
                <div>
                  {readinessScore !== null ? (
                    <div>
                      <div className="h-2.5 bg-[#E8F0EB] rounded-full overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${readinessScore}%`, backgroundColor: readinessScore >= 75 ? '#2D5A3D' : readinessScore >= 50 ? '#C4742B' : '#9B9B93' }} />
                      </div>
                      <p className="text-xs text-[#8B8B83] mb-3">
                        {readinessScore >= 75 ? "You're looking ready. Consider talking to your doctor about a taper timeline." :
                         readinessScore >= 50 ? "Getting there. Focus on the habits you haven't locked in yet." :
                         "Build more consistency before tapering. No rush — the habits are what matter."}
                      </p>
                      <button onClick={() => setShowReadiness(true)} className="text-xs text-[#2D5A3D] font-semibold cursor-pointer">Retake Assessment →</button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-[#8B8B83] mb-3">See how prepared you are to begin tapering off your medication.</p>
                      <button onClick={() => setShowReadiness(true)} className="w-full bg-[#E8F0EB] text-[#2D5A3D] py-3 rounded-xl text-sm font-semibold cursor-pointer">Take Assessment</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tips for current phase */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#1E1E1C] mb-3">Key Actions — {PHASES[phaseIdx].label}</h3>
            <div className="space-y-2.5">
              {phaseInfo.tips.map((tip, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#E8F0EB] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-[#2D5A3D]">{i + 1}</span>
                  </div>
                  <p className="text-sm text-[#6B6B65] leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hunger & cravings trend */}
          {checkins.length > 0 && (
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#1E1E1C] mb-3">Trends (Last 7 Check-ins)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#FFF0E5] rounded-lg p-3">
                  <p className="text-[9px] text-[#C4742B] uppercase font-semibold">Avg Hunger</p>
                  <p className="text-xl font-bold text-[#C4742B] mt-1">{avgHunger}<span className="text-xs font-normal">/5</span></p>
                </div>
                <div className="bg-[#F5F5F2] rounded-lg p-3">
                  <p className="text-[9px] text-[#6B6B65] uppercase font-semibold">Avg Cravings</p>
                  <p className="text-xl font-bold text-[#6B6B65] mt-1">{avgCravings}<span className="text-xs font-normal">/5</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Recent check-ins */}
          {checkins.length > 0 && (
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#1E1E1C] mb-3">Recent Check-ins</h3>
              <div className="space-y-2">
                {checkins.slice(0, 5).map(c => (
                  <div key={c.id} className="flex justify-between items-center py-2 border-t border-[#F5F5F2]">
                    <div>
                      {c.weight && <span className="text-sm font-medium text-[#1E1E1C]">{c.weight} lbs</span>}
                      <span className="text-[10px] text-[#B0B0A8] ml-2">
                        H:{c.hunger}/5 · C:{c.cravings}/5 · 💪{c.confidence}/5
                      </span>
                    </div>
                    <span className="text-[10px] text-[#B0B0A8]">{new Date(c.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA to check in */}
          <button onClick={() => setActiveView('checkin')}
            className="w-full bg-[#2D5A3D] text-white py-4 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors">
            Log Tapering Check-in
          </button>
        </>)}

        {/* ══════════ CHECK-IN VIEW ══════════ */}
        {activeView === 'checkin' && (
          <div className="space-y-4">
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-5 space-y-5">
              <h2 className="text-base font-bold text-[#1E1E1C]">Tapering Check-in</h2>

              {/* Weight */}
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Weight (optional)</label>
                <input type="number" value={ciWeight} onChange={e => setCiWeight(e.target.value)} placeholder="lbs"
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"/>
              </div>

              {/* Hunger */}
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2 block">Hunger Level: {ciHunger}/5</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setCiHunger(n)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${n <= ciHunger ? 'bg-[#C4742B] text-white' : 'bg-[#F5F5F2] text-[#C5C5BE]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-[#B0B0A8] mt-1"><span>Not hungry</span><span>Very hungry</span></div>
              </div>

              {/* Cravings */}
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2 block">Cravings: {ciCravings}/5</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setCiCravings(n)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${n <= ciCravings ? 'bg-[#6B6B65] text-white' : 'bg-[#F5F5F2] text-[#C5C5BE]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-[#B0B0A8] mt-1"><span>None</span><span>Intense</span></div>
              </div>

              {/* Confidence */}
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2 block">Confidence: {ciConfidence}/5</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setCiConfidence(n)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${n <= ciConfidence ? 'bg-[#2D5A3D] text-white' : 'bg-[#F5F5F2] text-[#C5C5BE]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-[#B0B0A8] mt-1"><span>Struggling</span><span>Crushing it</span></div>
              </div>

              {/* Habits */}
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2 block">Habits Maintained Today</label>
                <div className="flex flex-wrap gap-1.5">
                  {HABITS.map(h => (
                    <button key={h} onClick={() => setCiHabits(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h])}
                      className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all ${ciHabits.includes(h) ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Notes</label>
                <textarea value={ciNotes} onChange={e => setCiNotes(e.target.value)} placeholder="How are you feeling about your progress?"
                  rows={3} className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE] resize-none"/>
              </div>

              <button onClick={submitCheckin} disabled={savingCheckin}
                className="w-full bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50">
                {savingCheckin ? 'Saving...' : 'Save Check-in'}
              </button>
            </div>
          </div>
        )}

        {/* ══════════ CHAT VIEW ══════════ */}
        {activeView === 'chat' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
            {/* Chat messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto space-y-3 mb-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-full bg-[#E8F0EB] flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">🌿</span>
                  </div>
                  <p className="text-sm font-semibold text-[#1E1E1C]">Ask Nova about tapering</p>
                  <p className="text-xs text-[#8B8B83] mt-1 max-w-xs mx-auto">Get personalized guidance on your transition plan, managing hunger, or anything about life after GLP-1.</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {[
                      "Am I ready to start tapering?",
                      "How do I manage increased hunger?",
                      "What if I regain weight?",
                      "Help me build a taper schedule",
                    ].map(q => (
                      <button key={q} onClick={() => { setChatInput(q); }}
                        className="text-xs px-3 py-2 rounded-full border border-[#EDEDEA] text-[#6B6B65] cursor-pointer hover:border-[#2D5A3D] hover:text-[#2D5A3D] transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'nova' && (
                    <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0 mr-2 mt-1">
                      <span className="text-xs">🌿</span>
                    </div>
                  )}
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' ? 'bg-[#2D5A3D] text-white rounded-br-md' : 'bg-white border border-[#EDEDEA] text-[#1E1E1C] rounded-bl-md shadow-sm'
                  }`}>{msg.content}</div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0 mr-2 mt-1"><span className="text-xs">🌿</span></div>
                  <div className="bg-white border border-[#EDEDEA] px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#B0B0A8] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[#B0B0A8] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[#B0B0A8] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat input */}
            <div className="flex gap-2">
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask about tapering, maintenance..." autoFocus
                className="flex-1 px-4 py-3 rounded-xl border border-[#EDEDEA] bg-white text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"/>
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                className="bg-[#2D5A3D] text-white px-5 py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-30 transition-opacity">
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EDEDEA] px-4 py-2 flex justify-around z-50">
        <a href="/dashboard" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4"/></svg><span className="text-[10px] font-medium">Home</span></a>
        <a href="/chat" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg><span className="text-[10px] font-medium">Nova</span></a>
        <a href="/settings" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span className="text-[10px] font-medium">Settings</span></a>
      </nav>
    </div>
  )
}
