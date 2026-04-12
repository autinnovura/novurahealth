'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

const MEDICATIONS = [
  { label: 'Ozempic', sub: 'semaglutide' },
  { label: 'Wegovy', sub: 'semaglutide' },
  { label: 'Mounjaro', sub: 'tirzepatide' },
  { label: 'Zepbound', sub: 'tirzepatide' },
  { label: 'Saxenda', sub: 'liraglutide' },
  { label: 'Rybelsus', sub: 'oral semaglutide' },
  { label: 'Other', sub: '' },
]

const DOSES: Record<string, string[]> = {
  Ozempic: ['0.25', '0.5', '1', '2'],
  Wegovy: ['0.25', '0.5', '1', '1.7', '2.4'],
  Mounjaro: ['2.5', '5', '7.5', '10', '12.5', '15'],
  Zepbound: ['2.5', '5', '7.5', '10', '12.5', '15'],
  Saxenda: ['0.6', '1.2', '1.8', '2.4', '3'],
  Rybelsus: ['3', '7', '14'],
  Other: [],
}

const FREQUENCIES = ['Weekly', 'Every 2 weeks', 'Daily', 'Other']

const CALORIE_RANGES = ['Under 1,200', '1,200 – 1,500', '1,500 – 1,800', '1,800 – 2,200', '2,200+', 'Not sure']
const PROTEIN_RANGES = ['Under 50g', '50 – 80g', '80 – 120g', '120g+', 'Not sure']
const WATER_RANGES = ['Under 30oz/day', '30 – 50oz/day', '50 – 80oz/day', '80oz+/day', 'Not sure']

const SYMPTOMS = ['Nausea', 'Constipation', 'Diarrhea', 'Fatigue', 'Headache', 'Heartburn', 'Sulfur burps', 'Injection site pain', 'Loss of appetite', 'Dizziness', 'Vomiting', 'Hair thinning', 'None so far']

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
const TOTAL_STEPS = 9

export default function Onboarding() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)

  // Form data
  const [name, setName] = useState('')
  const [medication, setMedication] = useState('')
  const [dose, setDose] = useState('')
  const [customDose, setCustomDose] = useState('')
  const [frequency, setFrequency] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [goalWeight, setGoalWeight] = useState('')
  const [startDate, setStartDate] = useState('')
  const [justStarting, setJustStarting] = useState(false)
  const [avgCalories, setAvgCalories] = useState('')
  const [avgProtein, setAvgProtein] = useState('')
  const [avgWater, setAvgWater] = useState('')
  const [symptoms, setSymptoms] = useState<string[]>([])

  const weightRef = useRef<HTMLInputElement>(null)
  const goalRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (p?.name) { router.push('/dashboard'); return }
    }
    checkAuth()
  }, [router])

  function next() { if (step < TOTAL_STEPS) setStep((step + 1) as Step) }
  function back() { if (step > 1) setStep((step - 1) as Step) }

  function canAdvance(): boolean {
    switch (step) {
      case 1: return name.trim().length > 0
      case 2: return medication.length > 0
      case 3: return dose.length > 0 || customDose.length > 0
      case 4: return frequency.length > 0
      case 5: return currentWeight.length > 0 && goalWeight.length > 0
      case 6: return justStarting || startDate.length > 0
      case 7: return avgCalories.length > 0 && avgProtein.length > 0
      case 8: return avgWater.length > 0
      case 9: return symptoms.length > 0
      default: return false
    }
  }

  async function finish() {
    if (!userId) return
    setSaving(true)
    const finalDose = dose === 'custom' ? `${customDose}mg` : `${dose}mg`
    await supabase.from('profiles').upsert({
      id: userId,
      name,
      medication,
      dose: finalDose,
      injection_frequency: frequency,
      current_weight: currentWeight,
      goal_weight: goalWeight,
      start_date: justStarting ? new Date().toISOString().split('T')[0] : startDate,
      avg_calories: avgCalories,
      avg_protein: avgProtein,
      avg_water: avgWater,
      initial_symptoms: symptoms,
      primary_goal: 'Lose weight',
      exercise_level: '',
      biggest_challenge: '',
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      fetch('/api/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name }),
      }).catch(() => {})
    }

    setSaving(false)
    router.push('/dashboard')
  }

  function toggleSymptom(s: string) {
    if (s === 'None so far') { setSymptoms(['None so far']); return }
    setSymptoms(prev => {
      const filtered = prev.filter(x => x !== 'None so far')
      return filtered.includes(s) ? filtered.filter(x => x !== s) : [...filtered, s]
    })
  }

  const stepTitles: Record<Step, string> = {
    1: "What's your name?",
    2: "Which GLP-1 are you on?",
    3: "What's your dosage?",
    4: "How often do you inject?",
    5: "Weight",
    6: "When did you start?",
    7: "Typical daily nutrition",
    8: "Water intake",
    9: "Any side effects?",
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      {/* Header */}
      <header className="bg-[#2D5A3D] px-5 pt-5 pb-4 shrink-0">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center"><span className="text-sm">🌿</span></div>
              <span className="text-white/80 text-sm font-medium">NovuraHealth</span>
            </div>
            <span className="text-white/40 text-xs">{step} of {TOTAL_STEPS}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i < step ? 'bg-white/80' : 'bg-white/15'}`} />
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-5 py-6 max-w-lg mx-auto w-full flex flex-col">
        <h2 className="text-xl font-bold text-[#1E1E1C] mb-1">{stepTitles[step]}</h2>

        <div className="flex-1 mt-4">

          {/* STEP 1: Name */}
          {step === 1 && (
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canAdvance() && next()}
              placeholder="First name" autoFocus
              className="w-full px-4 py-4 rounded-xl border-2 border-[#EDEDEA] text-lg text-[#1E1E1C] font-medium outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE] transition-colors" />
          )}

          {/* STEP 2: Medication */}
          {step === 2 && (
            <div className="space-y-2">
              {MEDICATIONS.map(m => (
                <button key={m.label} onClick={() => { setMedication(m.label); setDose(''); setCustomDose('') }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all ${medication === m.label ? 'border-[#2D5A3D] bg-[#E8F0EB]' : 'border-[#EDEDEA] bg-white hover:border-[#B0B0A8]'}`}>
                  <span className={`text-sm ${medication === m.label ? 'text-[#2D5A3D] font-semibold' : 'text-[#1E1E1C]'}`}>{m.label}</span>
                  {m.sub && <span className="text-xs text-[#B0B0A8]">{m.sub}</span>}
                </button>
              ))}
            </div>
          )}

          {/* STEP 3: Dosage */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-[#8B8B83] mb-2">{medication} doses (mg)</p>
              {DOSES[medication]?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {DOSES[medication].map(d => (
                    <button key={d} onClick={() => { setDose(d); setCustomDose('') }}
                      className={`px-5 py-3 rounded-xl border-2 text-sm font-semibold cursor-pointer transition-all ${dose === d ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D]' : 'border-[#EDEDEA] bg-white text-[#1E1E1C] hover:border-[#B0B0A8]'}`}>
                      {d}<span className="text-xs font-normal text-[#B0B0A8] ml-0.5">mg</span>
                    </button>
                  ))}
                </div>
              )}
              <div>
                <p className="text-xs text-[#B0B0A8] mb-1.5">{DOSES[medication]?.length > 0 ? 'Or enter custom dose' : 'Enter your dose'}</p>
                <div className="flex items-center gap-2">
                  <input type="number" value={customDose} onChange={e => { setCustomDose(e.target.value); setDose('custom') }}
                    placeholder="0.0" step="0.1"
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]" />
                  <span className="text-sm text-[#8B8B83] font-medium">mg</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Frequency */}
          {step === 4 && (
            <div className="space-y-2">
              {FREQUENCIES.map(f => (
                <button key={f} onClick={() => setFrequency(f)}
                  className={`w-full px-4 py-3.5 rounded-xl border-2 text-sm text-left cursor-pointer transition-all ${frequency === f ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] bg-white text-[#1E1E1C] hover:border-[#B0B0A8]'}`}>
                  {f}
                </button>
              ))}
            </div>
          )}

          {/* STEP 5: Weight */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs text-[#8B8B83] font-medium mb-2 block">Current weight</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCurrentWeight(String(Math.max(80, (parseInt(currentWeight) || 200) - 1)))}
                    className="w-11 h-11 rounded-full bg-[#F5F5F2] text-[#6B6B65] flex items-center justify-center text-xl font-bold cursor-pointer hover:bg-[#EDEDEA] active:scale-95 transition-all">−</button>
                  <input ref={weightRef} type="number" value={currentWeight} onChange={e => setCurrentWeight(e.target.value)}
                    placeholder="175"
                    className="flex-1 text-center px-4 py-3.5 rounded-xl border-2 border-[#EDEDEA] text-2xl font-bold text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE] placeholder:font-normal placeholder:text-base" />
                  <button onClick={() => setCurrentWeight(String((parseInt(currentWeight) || 200) + 1))}
                    className="w-11 h-11 rounded-full bg-[#F5F5F2] text-[#6B6B65] flex items-center justify-center text-xl font-bold cursor-pointer hover:bg-[#EDEDEA] active:scale-95 transition-all">+</button>
                  <span className="text-sm text-[#B0B0A8] font-medium">lbs</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#8B8B83] font-medium mb-2 block">Goal weight</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setGoalWeight(String(Math.max(80, (parseInt(goalWeight) || 160) - 1)))}
                    className="w-11 h-11 rounded-full bg-[#F5F5F2] text-[#6B6B65] flex items-center justify-center text-xl font-bold cursor-pointer hover:bg-[#EDEDEA] active:scale-95 transition-all">−</button>
                  <input ref={goalRef} type="number" value={goalWeight} onChange={e => setGoalWeight(e.target.value)}
                    placeholder="155"
                    className="flex-1 text-center px-4 py-3.5 rounded-xl border-2 border-[#EDEDEA] text-2xl font-bold text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE] placeholder:font-normal placeholder:text-base" />
                  <button onClick={() => setGoalWeight(String((parseInt(goalWeight) || 160) + 1))}
                    className="w-11 h-11 rounded-full bg-[#F5F5F2] text-[#6B6B65] flex items-center justify-center text-xl font-bold cursor-pointer hover:bg-[#EDEDEA] active:scale-95 transition-all">+</button>
                  <span className="text-sm text-[#B0B0A8] font-medium">lbs</span>
                </div>
              </div>
              {currentWeight && goalWeight && parseInt(currentWeight) > parseInt(goalWeight) && (
                <div className="bg-[#E8F0EB] rounded-xl px-4 py-3 text-center">
                  <span className="text-sm text-[#2D5A3D] font-medium">{parseInt(currentWeight) - parseInt(goalWeight)} lbs to go</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Start date */}
          {step === 6 && (
            <div className="space-y-3">
              <div className="flex gap-2 mb-2">
                <button onClick={() => { setJustStarting(false) }}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold cursor-pointer transition-all ${!justStarting ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D]' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>
                  I have a date
                </button>
                <button onClick={() => { setJustStarting(true); setStartDate('') }}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold cursor-pointer transition-all ${justStarting ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D]' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>
                  Just starting
                </button>
              </div>
              {!justStarting && (
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D]" />
              )}
              {justStarting && (
                <div className="bg-[#E8F0EB] rounded-xl px-4 py-3">
                  <p className="text-sm text-[#2D5A3D] font-medium">Welcome to the start of your journey 🌿</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 7: Macros */}
          {step === 7 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs text-[#8B8B83] font-medium mb-2 block">Daily calories (roughly)</label>
                <div className="flex flex-wrap gap-2">
                  {CALORIE_RANGES.map(c => (
                    <button key={c} onClick={() => setAvgCalories(c)}
                      className={`px-3.5 py-2.5 rounded-xl border-2 text-xs cursor-pointer transition-all ${avgCalories === c ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] bg-white text-[#1E1E1C] hover:border-[#B0B0A8]'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[#8B8B83] font-medium mb-2 block">Daily protein</label>
                <div className="flex flex-wrap gap-2">
                  {PROTEIN_RANGES.map(p => (
                    <button key={p} onClick={() => setAvgProtein(p)}
                      className={`px-3.5 py-2.5 rounded-xl border-2 text-xs cursor-pointer transition-all ${avgProtein === p ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] bg-white text-[#1E1E1C] hover:border-[#B0B0A8]'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: Water */}
          {step === 8 && (
            <div className="space-y-2">
              <p className="text-xs text-[#8B8B83] mb-2">Average daily intake</p>
              {WATER_RANGES.map(w => (
                <button key={w} onClick={() => setAvgWater(w)}
                  className={`w-full px-4 py-3.5 rounded-xl border-2 text-sm text-left cursor-pointer transition-all ${avgWater === w ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] bg-white text-[#1E1E1C] hover:border-[#B0B0A8]'}`}>
                  💧 {w}
                </button>
              ))}
            </div>
          )}

          {/* STEP 9: Symptoms */}
          {step === 9 && (
            <div>
              <p className="text-xs text-[#8B8B83] mb-3">Select all that apply</p>
              <div className="flex flex-wrap gap-2">
                {SYMPTOMS.map(s => (
                  <button key={s} onClick={() => toggleSymptom(s)}
                    className={`px-3.5 py-2.5 rounded-xl border-2 text-xs cursor-pointer transition-all ${symptoms.includes(s) ? s === 'None so far' ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#C4742B] bg-[#FFF0E5] text-[#C4742B] font-semibold' : 'border-[#EDEDEA] bg-white text-[#1E1E1C] hover:border-[#B0B0A8]'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="shrink-0 pt-4 space-y-2">
          {step < TOTAL_STEPS ? (
            <button onClick={next} disabled={!canAdvance()}
              className="w-full bg-[#2D5A3D] text-white py-3.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-30 transition-all active:scale-[0.98] hover:bg-[#3A7A52]">
              Continue
            </button>
          ) : (
            <button onClick={finish} disabled={!canAdvance() || saving}
              className="w-full bg-[#2D5A3D] text-white py-3.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-30 transition-all active:scale-[0.98] hover:bg-[#3A7A52]">
              {saving ? 'Setting up...' : 'Go to Dashboard →'}
            </button>
          )}
          {step > 1 && (
            <button onClick={back} className="w-full py-2.5 text-sm text-[#8B8B83] cursor-pointer hover:text-[#1E1E1C] transition-colors">
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  )
}