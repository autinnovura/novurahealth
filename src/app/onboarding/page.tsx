'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { getMedicationChoices, findMedicationByLabel, getMedication } from '../lib/medications'
import { Syringe, Pill, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'

const { available: MEDICATIONS, comingSoon: COMING_SOON, restricted: RESTRICTED } = getMedicationChoices()

const FREQUENCIES = ['Weekly', 'Every 2 weeks', 'Daily', 'Other']
const OTHER_MED = { label: 'Other', sub: '', route: 'injection' as const, frequency: 'weekly' as const, mechanism: 'GLP-1', doses: [] as string[], isNew: false, id: 'other', notes: undefined as string | undefined }

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
  const [heightFeet, setHeightFeet] = useState('')
  const [heightInches, setHeightInches] = useState('')
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
      case 5: return heightFeet.length > 0 && currentWeight.length > 0 && goalWeight.length > 0
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
    const totalInches = (parseInt(heightFeet) || 0) * 12 + (parseInt(heightInches) || 0)
    await supabase.from('profiles').upsert({
      id: userId,
      name,
      medication,
      dose: finalDose,
      injection_frequency: frequency,
      height_inches: totalInches || null,
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
    5: "Height & Weight",
    6: "When did you start?",
    7: "Typical daily nutrition",
    8: "Water intake",
    9: "Any side effects?",
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#F5F8F3] to-[#EAF2EB] flex flex-col" style={{ fontFamily: 'var(--font-inter)' }}>
      {/* Header */}
      <header className="px-5 pt-5 pb-4 shrink-0">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#1F4B32] tracking-tight">NovuraHealth</span>
            </div>
            <span className="text-xs text-[#6B7A72]/60">{step} of {TOTAL_STEPS}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i < step ? 'bg-gradient-to-r from-[#7FFFA4] to-[#1F4B32]' : 'bg-[#EAF2EB]'}`}
                style={i < step ? { boxShadow: '0 0 8px rgba(127,255,164,0.3)' } : undefined} />
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-5 py-6 max-w-lg mx-auto w-full flex flex-col">
        <h2 className="text-xl font-bold text-[#0D1F16] mb-1" style={{ fontFamily: 'var(--font-fraunces)' }}>{stepTitles[step]}</h2>

        <div className="flex-1 mt-4">

          {/* STEP 1: Name */}
          {step === 1 && (
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canAdvance() && next()}
              placeholder="First name" autoFocus
              className="w-full px-4 py-4 rounded-2xl border-2 border-[#EAF2EB] text-lg text-[#0D1F16] font-medium outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/40 transition-colors" />
          )}

          {/* STEP 2: Medication */}
          {step === 2 && (
            <div className="space-y-3">
              {/* Available medications */}
              {[...MEDICATIONS, OTHER_MED].map(m => {
                const isSelected = medication === m.label
                const RouteIcon = m.route === 'oral' ? Pill : Syringe
                return (
                  <button key={m.id} onClick={() => {
                    setMedication(m.label)
                    setDose(''); setCustomDose('')
                    // Auto-set frequency based on medication
                    const med = findMedicationByLabel(m.label)
                    if (med) setFrequency(med.frequency === 'daily' ? 'Daily' : 'Weekly')
                  }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-3xl border-2 cursor-pointer transition-all text-left ${isSelected ? 'border-[#1F4B32] bg-[#EAF2EB] shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]' : 'border-[#EAF2EB] bg-white hover:border-[#6B7A72]/30'}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#1F4B32]/10' : 'bg-[#F5F8F3]'}`}>
                      <RouteIcon className={`w-4 h-4 ${isSelected ? 'text-[#1F4B32]' : 'text-[#6B7A72]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${isSelected ? 'text-[#1F4B32] font-semibold' : 'text-[#0D1F16]'}`}>{m.label}</span>
                        {m.isNew && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#7FFFA4]/20 text-[#1F4B32]">New</span>}
                      </div>
                      {m.sub && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-[#6B7A72]">{m.sub}</span>
                          <span className="text-[10px] text-[#6B7A72]/40">·</span>
                          <span className="text-[10px] text-[#6B7A72]">{m.frequency}</span>
                          <span className="text-[10px] text-[#6B7A72]/40">·</span>
                          <span className="text-[10px] text-[#6B7A72]">{m.mechanism}</span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}

              {/* Compounded semaglutide warning */}
              {RESTRICTED.map(r => (
                <div key={r.id} className="bg-[#FFF8F0] border border-[#C4742B]/15 rounded-3xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-[#C4742B] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[#C4742B]">{r.label}</p>
                      <p className="text-xs text-[#8B7355] mt-1 leading-relaxed">{r.notes}</p>
                      <button onClick={() => { setMedication(r.label); setDose(''); setCustomDose('') }}
                        className={`mt-2 text-[10px] font-semibold cursor-pointer transition-colors ${medication === r.label ? 'text-[#C4742B]' : 'text-[#C4742B]/60 hover:text-[#C4742B]'}`}>
                        {medication === r.label ? '(Selected — proceed with caution)' : 'I\'m currently using this'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Coming soon */}
              {COMING_SOON.length > 0 && (
                <ComingSoonSection items={COMING_SOON} />
              )}
            </div>
          )}

          {/* STEP 3: Dosage */}
          {step === 3 && (() => {
            const medInfo = [...MEDICATIONS, OTHER_MED].find(m => m.label === medication)
            const doses = medInfo?.doses || []
            const medRecord = findMedicationByLabel(medication)
            return (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7A72] mb-2">{medication} doses (mg)</p>
                {medRecord?.notes && (
                  <div className="bg-[#F5F8F3] rounded-2xl p-3 text-xs text-[#6B7A72] leading-relaxed">
                    {medRecord.notes}
                  </div>
                )}
                {doses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {doses.map(d => (
                      <button key={d} onClick={() => { setDose(d); setCustomDose('') }}
                        className={`px-5 py-3 rounded-3xl border-2 text-sm font-semibold cursor-pointer transition-all ${dose === d ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]' : 'border-[#EAF2EB] bg-white text-[#0D1F16] hover:border-[#6B7A72]/30'}`}>
                        {d}<span className="text-xs font-normal text-[#6B7A72] ml-0.5">mg</span>
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-xs text-[#6B7A72] mb-1.5">{doses.length > 0 ? 'Or enter custom dose' : 'Enter your dose'}</p>
                  <div className="flex items-center gap-2">
                    <input type="number" autoComplete="off" value={customDose} onChange={e => { setCustomDose(e.target.value); setDose('custom') }}
                      placeholder="0.0" step="0.1"
                      className="flex-1 px-4 py-3 rounded-2xl border-2 border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/40" />
                    <span className="text-sm text-[#6B7A72] font-medium">mg</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* STEP 4: Frequency */}
          {step === 4 && (
            <div className="space-y-2">
              {FREQUENCIES.map(f => (
                <button key={f} onClick={() => setFrequency(f)}
                  className={`w-full px-4 py-3.5 rounded-3xl border-2 text-sm text-left cursor-pointer transition-all ${frequency === f ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]' : 'border-[#EAF2EB] bg-white text-[#0D1F16] hover:border-[#6B7A72]/30'}`}>
                  {f}
                </button>
              ))}
            </div>
          )}

          {/* STEP 5: Height + Weight */}
          {step === 5 && (() => {
            const totalInches = (parseInt(heightFeet) || 0) * 12 + (parseInt(heightInches) || 0)
            const weightNum = parseInt(currentWeight) || 0
            const bmi = totalInches > 0 && weightNum > 0 ? Math.round((weightNum / (totalInches * totalInches)) * 703 * 10) / 10 : null
            const med = findMedicationByLabel(medication)
            const medRecord = med ? getMedication(med.id) : null
            const eligibility = medRecord?.bmi_eligibility
            let bmiTier = ''
            let bmiMessage = ''
            if (bmi && eligibility) {
              if (bmi >= eligibility.new_patient) {
                bmiTier = 'standard'
                bmiMessage = `Your BMI is ${bmi} — you qualify for standard weight-loss dosing.`
              } else if (bmi >= eligibility.transfer_patient) {
                bmiTier = 'transfer'
                bmiMessage = `Your BMI is ${bmi} — you qualify as a transfer patient (already on medication).`
              } else if (bmi >= eligibility.microdose) {
                bmiTier = 'microdose'
                bmiMessage = `Your BMI is ${bmi} — you qualify for microdose protocol.`
              } else {
                bmiTier = 'below'
                bmiMessage = `Your BMI is ${bmi}. Discuss dosing with your provider.`
              }
            }
            return (
              <div className="space-y-5">
                <div>
                  <label className="text-xs text-[#6B7A72] font-medium mb-2 block">Height</label>
                  <div className="flex items-center gap-2">
                    <input type="number" autoComplete="off" value={heightFeet} onChange={e => setHeightFeet(e.target.value)}
                      placeholder="5" min="3" max="8"
                      className="w-20 text-center px-3 py-3.5 rounded-2xl border-2 border-[#EAF2EB] text-xl font-bold text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/40 placeholder:font-normal placeholder:text-base" />
                    <span className="text-sm text-[#6B7A72] font-medium">ft</span>
                    <input type="number" autoComplete="off" value={heightInches} onChange={e => setHeightInches(e.target.value)}
                      placeholder="8" min="0" max="11"
                      className="w-20 text-center px-3 py-3.5 rounded-2xl border-2 border-[#EAF2EB] text-xl font-bold text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/40 placeholder:font-normal placeholder:text-base" />
                    <span className="text-sm text-[#6B7A72] font-medium">in</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#6B7A72] font-medium mb-2 block">Current weight</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setCurrentWeight(String(Math.max(80, (parseInt(currentWeight) || 200) - 1)))}
                      className="w-12 h-12 rounded-2xl bg-[#F5F8F3] text-[#0D1F16] flex items-center justify-center text-xl font-bold cursor-pointer hover:bg-[#EAF2EB] active:scale-95 transition-all">−</button>
                    <input ref={weightRef} type="number" autoComplete="off" value={currentWeight} onChange={e => setCurrentWeight(e.target.value)}
                      placeholder="175"
                      className="flex-1 text-center px-4 py-3.5 rounded-2xl border-2 border-[#EAF2EB] text-2xl font-bold text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/40 placeholder:font-normal placeholder:text-base" />
                    <button onClick={() => setCurrentWeight(String((parseInt(currentWeight) || 200) + 1))}
                      className="w-12 h-12 rounded-2xl bg-[#F5F8F3] text-[#0D1F16] flex items-center justify-center text-xl font-bold cursor-pointer hover:bg-[#EAF2EB] active:scale-95 transition-all">+</button>
                    <span className="text-sm text-[#6B7A72] font-medium">lbs</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#6B7A72] font-medium mb-2 block">Goal weight</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setGoalWeight(String(Math.max(80, (parseInt(goalWeight) || 160) - 1)))}
                      className="w-12 h-12 rounded-2xl bg-[#F5F8F3] text-[#0D1F16] flex items-center justify-center text-xl font-bold cursor-pointer hover:bg-[#EAF2EB] active:scale-95 transition-all">−</button>
                    <input ref={goalRef} type="number" autoComplete="off" value={goalWeight} onChange={e => setGoalWeight(e.target.value)}
                      placeholder="155"
                      className="flex-1 text-center px-4 py-3.5 rounded-2xl border-2 border-[#EAF2EB] text-2xl font-bold text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/40 placeholder:font-normal placeholder:text-base" />
                    <button onClick={() => setGoalWeight(String((parseInt(goalWeight) || 160) + 1))}
                      className="w-12 h-12 rounded-2xl bg-[#F5F8F3] text-[#0D1F16] flex items-center justify-center text-xl font-bold cursor-pointer hover:bg-[#EAF2EB] active:scale-95 transition-all">+</button>
                    <span className="text-sm text-[#6B7A72] font-medium">lbs</span>
                  </div>
                </div>
                {currentWeight && goalWeight && parseInt(currentWeight) > parseInt(goalWeight) && (
                  <div className="bg-[#EAF2EB] rounded-3xl px-4 py-3 text-center">
                    <span className="text-sm text-[#1F4B32] font-medium">{parseInt(currentWeight) - parseInt(goalWeight)} lbs to go</span>
                  </div>
                )}
                {bmi && bmiMessage && (
                  <div className={`rounded-3xl px-4 py-3 ${bmiTier === 'standard' ? 'bg-[#EAF2EB]' : bmiTier === 'microdose' ? 'bg-[#FFF4E8]' : 'bg-[#F5F8F3]'}`}>
                    <p className={`text-sm font-medium ${bmiTier === 'standard' ? 'text-[#1F4B32]' : bmiTier === 'microdose' ? 'text-[#C4742B]' : 'text-[#0D1F16]'}`}>
                      {bmiMessage}
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* STEP 6: Start date */}
          {step === 6 && (
            <div className="space-y-3">
              <div className="flex gap-2 mb-2">
                <button onClick={() => { setJustStarting(false) }}
                  className={`flex-1 py-3 rounded-3xl border-2 text-sm font-semibold cursor-pointer transition-all ${!justStarting ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>
                  I have a date
                </button>
                <button onClick={() => { setJustStarting(true); setStartDate('') }}
                  className={`flex-1 py-3 rounded-3xl border-2 text-sm font-semibold cursor-pointer transition-all ${justStarting ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>
                  Just starting
                </button>
              </div>
              {!justStarting && (
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border-2 border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32]" />
              )}
              {justStarting && (
                <div className="bg-[#EAF2EB] rounded-3xl px-4 py-3">
                  <p className="text-sm text-[#1F4B32] font-medium">Welcome to the start of your journey 🌿</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 7: Macros */}
          {step === 7 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs text-[#6B7A72] font-medium mb-2 block">Daily calories (roughly)</label>
                <div className="flex flex-wrap gap-2">
                  {CALORIE_RANGES.map(c => (
                    <button key={c} onClick={() => setAvgCalories(c)}
                      className={`px-3.5 py-2.5 rounded-3xl border-2 text-xs cursor-pointer transition-all ${avgCalories === c ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]' : 'border-[#EAF2EB] bg-white text-[#0D1F16] hover:border-[#6B7A72]/30'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[#6B7A72] font-medium mb-2 block">Daily protein</label>
                <div className="flex flex-wrap gap-2">
                  {PROTEIN_RANGES.map(p => (
                    <button key={p} onClick={() => setAvgProtein(p)}
                      className={`px-3.5 py-2.5 rounded-3xl border-2 text-xs cursor-pointer transition-all ${avgProtein === p ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]' : 'border-[#EAF2EB] bg-white text-[#0D1F16] hover:border-[#6B7A72]/30'}`}>
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
              <p className="text-xs text-[#6B7A72] mb-2">Average daily intake</p>
              {WATER_RANGES.map(w => (
                <button key={w} onClick={() => setAvgWater(w)}
                  className={`w-full px-4 py-3.5 rounded-3xl border-2 text-sm text-left cursor-pointer transition-all ${avgWater === w ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]' : 'border-[#EAF2EB] bg-white text-[#0D1F16] hover:border-[#6B7A72]/30'}`}>
                  💧 {w}
                </button>
              ))}
            </div>
          )}

          {/* STEP 9: Symptoms */}
          {step === 9 && (
            <div>
              <p className="text-xs text-[#6B7A72] mb-3">Select all that apply</p>
              <div className="flex flex-wrap gap-2">
                {SYMPTOMS.map(s => (
                  <button key={s} onClick={() => toggleSymptom(s)}
                    className={`px-3.5 py-2.5 rounded-2xl border-2 text-xs cursor-pointer transition-all ${symptoms.includes(s) ? s === 'None so far' ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold' : 'border-[#C4742B] bg-[#FFF4E8] text-[#C4742B] font-semibold' : 'border-[#EAF2EB] bg-white text-[#0D1F16] hover:border-[#6B7A72]/30'}`}>
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
              className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3.5 rounded-2xl text-sm font-semibold cursor-pointer disabled:opacity-30 transition-all active:scale-[0.98] hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)]">
              Continue
            </button>
          ) : (
            <button onClick={finish} disabled={!canAdvance() || saving}
              className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3.5 rounded-2xl text-sm font-semibold cursor-pointer disabled:opacity-30 transition-all active:scale-[0.98] hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)]">
              {saving ? 'Setting up...' : 'Go to Dashboard →'}
            </button>
          )}
          {step > 1 && (
            <button onClick={back} className="w-full py-2.5 text-sm text-[#6B7A72] cursor-pointer hover:text-[#0D1F16] transition-colors">
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ComingSoonSection({ items }: { items: { id: string; label: string; mechanism: string; weightLossPct: number; notes?: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-2 border-dashed border-[#EAF2EB] rounded-3xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-[#F5F8F3]/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#6B7A72] font-medium">Coming soon</span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EAF2EB] text-[#6B7A72]">{items.length}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#6B7A72]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A72]" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-[#F5F8F3] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-[#0D1F16]">{item.label}</span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EAF2EB] text-[#6B7A72]">{item.mechanism}</span>
              </div>
              <p className="text-xs text-[#6B7A72]">~{item.weightLossPct}% avg weight loss in trials</p>
              {item.notes && <p className="text-[10px] text-[#6B7A72]/80 mt-1.5 leading-relaxed">{item.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
