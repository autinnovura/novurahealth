'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

interface Profile {
  name: string
  medication: string
  dose: string
  start_date: string
  current_weight: string
  goal_weight: string
  primary_goal: string
  biggest_challenge: string
  exercise_level: string
}

interface MedLog {
  id: string
  medication: string
  dose: string
  injection_site: string
  notes: string
  logged_at: string
}

interface WeightLog {
  id: string
  weight: number
  logged_at: string
}

interface SideEffectLog {
  id: string
  symptom: string
  severity: number
  logged_at: string
}

const injectionSites = ['Left abdomen', 'Right abdomen', 'Left thigh', 'Right thigh', 'Left arm', 'Right arm']
const commonSymptoms = ['Nausea', 'Constipation', 'Diarrhea', 'Fatigue', 'Headache', 'Heartburn', 'Sulfur burps', 'Injection site pain', 'Loss of appetite', 'Dizziness']

export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [medLogs, setMedLogs] = useState<MedLog[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [sideEffectLogs, setSideEffectLogs] = useState<SideEffectLog[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Modal states
  const [showMedModal, setShowMedModal] = useState(false)
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [showSideEffectModal, setShowSideEffectModal] = useState(false)

  // Form states
  const [injectionSite, setInjectionSite] = useState('')
  const [medNotes, setMedNotes] = useState('')
  const [newWeight, setNewWeight] = useState('')
  const [symptom, setSymptom] = useState('')
  const [severity, setSeverity] = useState(3)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!profileData) { router.push('/onboarding'); return }
      setProfile(profileData)

      const { data: meds } = await supabase.from('medication_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10)
      setMedLogs(meds || [])

      const { data: weights } = await supabase.from('weight_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10)
      setWeightLogs(weights || [])

      const { data: effects } = await supabase.from('side_effect_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(10)
      setSideEffectLogs(effects || [])

      setLoading(false)
    }
    init()
  }, [router])

  async function logMedication() {
    if (!userId || !profile) return
    const { data } = await supabase.from('medication_logs').insert({
      user_id: userId,
      medication: profile.medication,
      dose: profile.dose,
      injection_site: injectionSite,
      notes: medNotes,
    }).select().single()
    if (data) setMedLogs([data, ...medLogs])
    setShowMedModal(false)
    setInjectionSite('')
    setMedNotes('')
  }

  async function logWeight() {
    if (!userId || !newWeight) return
    const { data } = await supabase.from('weight_logs').insert({
      user_id: userId,
      weight: parseFloat(newWeight),
    }).select().single()
    if (data) setWeightLogs([data, ...weightLogs])
    setShowWeightModal(false)
    setNewWeight('')
  }

  async function logSideEffect() {
    if (!userId || !symptom) return
    const { data } = await supabase.from('side_effect_logs').insert({
      user_id: userId,
      symptom,
      severity,
    }).select().single()
    if (data) setSideEffectLogs([data, ...sideEffectLogs])
    setShowSideEffectModal(false)
    setSymptom('')
    setSeverity(3)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Computed stats
  const daysOnMed = profile?.start_date ? Math.max(1, Math.floor((Date.now() - new Date(profile.start_date).getTime()) / 86400000)) : null
  const latestWeight = weightLogs[0]?.weight || (profile?.current_weight ? parseFloat(profile.current_weight) : null)
  const goalWeight = profile?.goal_weight ? parseFloat(profile.goal_weight) : null
  const startWeight = profile?.current_weight ? parseFloat(profile.current_weight) : null
  const weightLost = startWeight && latestWeight ? Math.round((startWeight - latestWeight) * 10) / 10 : null
  const progressPercent = startWeight && goalWeight && latestWeight
    ? Math.min(100, Math.round(((startWeight - latestWeight) / (startWeight - goalWeight)) * 100))
    : null
  const proteinTarget = goalWeight ? Math.round(goalWeight * 0.8) : null
  const lastInjection = medLogs[0]
  const daysSinceInjection = lastInjection
    ? Math.floor((Date.now() - new Date(lastInjection.logged_at).getTime()) / 86400000)
    : null
  const lastInjectionSite = lastInjection?.injection_site || null

  // Suggest next injection site (rotate)
  const siteIndex = lastInjectionSite ? injectionSites.indexOf(lastInjectionSite) : -1
  const suggestedSite = injectionSites[(siteIndex + 1) % injectionSites.length]

  return (
    <div className="min-h-screen bg-[#FFFBF5]">
      {/* HEADER */}
      <header className="bg-[#2D5A3D] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">
              Hey{profile?.name ? `, ${profile.name}` : ''} 👋
            </h1>
            <p className="text-white/50 text-xs">
              {profile?.medication}{profile?.dose ? ` • ${profile.dose}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/chat" className="bg-white/15 text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors">
              Chat with Nova
            </a>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="text-white/40 text-xs hover:text-white transition-colors cursor-pointer">
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* INJECTION REMINDER */}
        {daysSinceInjection !== null && daysSinceInjection >= 6 && (
          <div className="bg-[#C4742B]/10 border border-[#C4742B]/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C4742B]/15 flex items-center justify-center shrink-0">
              <span className="text-lg">💉</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#C4742B]">Injection day!</p>
              <p className="text-xs text-[#C4742B]/70">It&apos;s been {daysSinceInjection} days since your last injection. Suggested site: {suggestedSite}</p>
            </div>
            <button onClick={() => { setInjectionSite(suggestedSite); setShowMedModal(true) }} className="bg-[#C4742B] text-white px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer hover:bg-[#a86224] transition-colors">
              Log it
            </button>
          </div>
        )}

        {/* STAT CARDS */}
        <div className="grid grid-cols-2 gap-3">
          {/* Weight Progress */}
          <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-[#9B9B93] uppercase tracking-wider mb-1">Weight</p>
            <p className="text-2xl font-bold text-[#1E1E1C]">{latestWeight ? `${latestWeight} lbs` : '—'}</p>
            {weightLost !== null && weightLost > 0 && (
              <p className="text-xs text-[#2D5A3D] font-medium mt-1">↓ {weightLost} lbs lost</p>
            )}
            {progressPercent !== null && (
              <div className="mt-2">
                <div className="h-1.5 bg-[#E8F0EB] rounded-full overflow-hidden">
                  <div className="h-full bg-[#2D5A3D] rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
                <p className="text-[10px] text-[#9B9B93] mt-1">{progressPercent}% to goal ({goalWeight} lbs)</p>
              </div>
            )}
          </div>

          {/* Days on Medication */}
          <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-[#9B9B93] uppercase tracking-wider mb-1">Journey</p>
            <p className="text-2xl font-bold text-[#1E1E1C]">{daysOnMed ? `Day ${daysOnMed}` : '—'}</p>
            <p className="text-xs text-[#6B6B65] mt-1">{profile?.medication || 'No medication set'}</p>
            {daysSinceInjection !== null && (
              <p className="text-xs text-[#9B9B93] mt-1">{daysSinceInjection === 0 ? 'Injected today' : `${daysSinceInjection}d since last injection`}</p>
            )}
          </div>

          {/* Protein Target */}
          <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-[#9B9B93] uppercase tracking-wider mb-1">Daily Protein Goal</p>
            <p className="text-2xl font-bold text-[#2D5A3D]">{proteinTarget ? `${proteinTarget}g` : '—'}</p>
            <p className="text-xs text-[#6B6B65] mt-1">0.8g × goal weight</p>
          </div>

          {/* Last Injection Site */}
          <div className="bg-white border border-black/[0.06] rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-[#9B9B93] uppercase tracking-wider mb-1">Last Injection</p>
            <p className="text-lg font-bold text-[#1E1E1C]">{lastInjectionSite || '—'}</p>
            {suggestedSite && lastInjectionSite && (
              <p className="text-xs text-[#C4742B] mt-1">Next: {suggestedSite}</p>
            )}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => setShowMedModal(true)} className="bg-[#2D5A3D] text-white rounded-2xl p-4 text-center hover:bg-[#3A7A52] transition-colors cursor-pointer">
            <span className="text-2xl block mb-1">💉</span>
            <span className="text-xs font-semibold">Log Injection</span>
          </button>
          <button onClick={() => setShowWeightModal(true)} className="bg-[#C4742B] text-white rounded-2xl p-4 text-center hover:bg-[#a86224] transition-colors cursor-pointer">
            <span className="text-2xl block mb-1">⚖️</span>
            <span className="text-xs font-semibold">Log Weight</span>
          </button>
          <button onClick={() => setShowSideEffectModal(true)} className="bg-[#6B6B65] text-white rounded-2xl p-4 text-center hover:bg-[#555] transition-colors cursor-pointer">
            <span className="text-2xl block mb-1">🩹</span>
            <span className="text-xs font-semibold">Side Effect</span>
          </button>
        </div>

        {/* RECENT ACTIVITY */}
        <div className="bg-white border border-black/[0.06] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-[#1E1E1C] mb-3">Recent Activity</h2>
          {medLogs.length === 0 && weightLogs.length === 0 && sideEffectLogs.length === 0 ? (
            <p className="text-sm text-[#9B9B93]">No activity logged yet. Use the buttons above to start tracking!</p>
          ) : (
            <div className="space-y-3">
              {/* Merge and sort all logs by date */}
              {[
                ...medLogs.map(l => ({ type: 'med' as const, date: l.logged_at, data: l })),
                ...weightLogs.map(l => ({ type: 'weight' as const, date: l.logged_at, data: l })),
                ...sideEffectLogs.map(l => ({ type: 'effect' as const, date: l.logged_at, data: l })),
              ]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 8)
                .map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-black/[0.04] last:border-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{
                      backgroundColor: item.type === 'med' ? '#E8F0EB' : item.type === 'weight' ? '#FFF0E5' : '#F0F0F0'
                    }}>
                      {item.type === 'med' ? '💉' : item.type === 'weight' ? '⚖️' : '🩹'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1E1E1C] truncate">
                        {item.type === 'med'
                          ? `${(item.data as MedLog).medication} — ${(item.data as MedLog).dose}${(item.data as MedLog).injection_site ? ` (${(item.data as MedLog).injection_site})` : ''}`
                          : item.type === 'weight'
                          ? `Weighed in: ${(item.data as WeightLog).weight} lbs`
                          : `${(item.data as SideEffectLog).symptom} — ${'●'.repeat((item.data as SideEffectLog).severity)}${'○'.repeat(5 - (item.data as SideEffectLog).severity)}`
                        }
                      </p>
                      <p className="text-[10px] text-[#9B9B93]">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* WEIGHT HISTORY */}
        {weightLogs.length > 1 && (
          <div className="bg-white border border-black/[0.06] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-[#1E1E1C] mb-3">Weight Trend</h2>
            <div className="flex items-end gap-1 h-24">
              {weightLogs.slice(0, 10).reverse().map((w, i) => {
                const min = Math.min(...weightLogs.slice(0, 10).map(l => l.weight))
                const max = Math.max(...weightLogs.slice(0, 10).map(l => l.weight))
                const range = max - min || 1
                const height = Math.max(10, ((w.weight - min) / range) * 80)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-[#9B9B93]">{w.weight}</span>
                    <div className="w-full rounded-t-md bg-[#2D5A3D]" style={{ height: `${height}%` }} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CHAT CTA */}
        <a href="/chat" className="block bg-[#E8F0EB] border border-[#2D5A3D]/10 rounded-2xl p-5 hover:bg-[#d4e5d9] transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0">
              <span className="text-lg">🌿</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2D5A3D]">Chat with Nova</p>
              <p className="text-xs text-[#6B6B65]">Get personalized coaching, meal ideas, or help with side effects</p>
            </div>
            <svg className="w-5 h-5 text-[#2D5A3D] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>
      </div>

      {/* MEDICATION LOG MODAL */}
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
                    className={`text-xs px-3 py-2 rounded-xl border-2 transition-all cursor-pointer ${
                      injectionSite === site ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-black/[0.06] text-[#6B6B65] hover:border-[#2D5A3D]/30'
                    }`}
                  >{site}</button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={medNotes}
              onChange={(e) => setMedNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#9B9B93]"
            />
            <button onClick={logMedication} className="w-full bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#3A7A52] transition-colors cursor-pointer">
              Save injection
            </button>
          </div>
        </div>
      )}

      {/* WEIGHT LOG MODAL */}
      {showWeightModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#1E1E1C]">Log Weight ⚖️</h2>
              <button onClick={() => setShowWeightModal(false)} className="text-[#9B9B93] hover:text-[#1E1E1C] cursor-pointer text-xl">&times;</button>
            </div>
            <input
              type="number"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="Weight in pounds"
              autoFocus
              className="w-full px-4 py-4 rounded-xl border-2 border-black/10 bg-white text-2xl text-center text-[#1E1E1C] font-bold outline-none focus:border-[#2D5A3D] placeholder:text-[#9B9B93] placeholder:font-normal placeholder:text-base"
            />
            {latestWeight && newWeight && (
              <p className={`text-center text-sm font-medium ${parseFloat(newWeight) < latestWeight ? 'text-[#2D5A3D]' : 'text-[#C4742B]'}`}>
                {parseFloat(newWeight) < latestWeight
                  ? `↓ ${(latestWeight - parseFloat(newWeight)).toFixed(1)} lbs from last weigh-in`
                  : parseFloat(newWeight) > latestWeight
                  ? `↑ ${(parseFloat(newWeight) - latestWeight).toFixed(1)} lbs from last weigh-in`
                  : 'Same as last weigh-in'}
              </p>
            )}
            <button onClick={logWeight} disabled={!newWeight} className="w-full bg-[#C4742B] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#a86224] transition-colors disabled:opacity-30 cursor-pointer">
              Save weight
            </button>
          </div>
        </div>
      )}

      {/* SIDE EFFECT MODAL */}
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
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                      symptom === s ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-black/[0.06] text-[#6B6B65] hover:border-[#2D5A3D]/30'
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6B6B65] mb-2">Severity: {severity}/5</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setSeverity(n)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                      n <= severity ? 'bg-[#C4742B] text-white' : 'bg-[#F5F5F0] text-[#9B9B93]'
                    }`}
                  >{n}</button>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[#9B9B93]">Mild</span>
                <span className="text-[10px] text-[#9B9B93]">Severe</span>
              </div>
            </div>
            <button onClick={logSideEffect} disabled={!symptom} className="w-full bg-[#6B6B65] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#555] transition-colors disabled:opacity-30 cursor-pointer">
              Save side effect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
