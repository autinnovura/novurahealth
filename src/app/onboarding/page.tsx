'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

const medications = [
  'Ozempic (semaglutide)',
  'Wegovy (semaglutide)',
  'Mounjaro (tirzepatide)',
  'Zepbound (tirzepatide)',
  'Foundayo (orforglipron)',
  'Rybelsus (oral semaglutide)',
  'Compounded semaglutide',
  'Compounded tirzepatide',
  'Not sure / Other',
  'Not on medication yet',
]

const goals = [
  'Lose weight',
  'Manage side effects',
  'Build healthy habits',
  'Prevent muscle loss',
  'Plan my transition off medication',
  'Save money on my medication',
]

const challenges = [
  'Nausea and GI side effects',
  'Not eating enough protein',
  'No energy to exercise',
  'Hitting a weight loss plateau',
  'Cost of medication',
  'Worried about what happens when I stop',
  'Emotional relationship with food',
  'Not sure where to start',
]

const exerciseLevels = [
  'No exercise currently',
  'Walking only',
  'Light exercise 1-2x/week',
  'Moderate exercise 3-4x/week',
  'Heavy exercise 5+/week',
]

interface Step {
  question: string
  type: 'select' | 'input'
  options?: string[]
  field: string
  placeholder?: string
  inputType?: string
}

const steps: Step[] = [
  { question: "What's your first name?", type: 'input', field: 'name', placeholder: 'Your first name' },
  { question: 'Which GLP-1 medication are you on?', type: 'select', options: medications, field: 'medication' },
  { question: 'What dose are you currently on?', type: 'input', field: 'dose', placeholder: 'e.g., 0.5mg, 2.5mg, not sure' },
  { question: 'When did you start your medication?', type: 'input', field: 'start_date', placeholder: 'e.g., January 2026, 3 months ago' },
  { question: "What's your current weight?", type: 'input', field: 'current_weight', placeholder: 'In pounds', inputType: 'number' },
  { question: "What's your goal weight?", type: 'input', field: 'goal_weight', placeholder: 'In pounds', inputType: 'number' },
  { question: "What's your primary goal?", type: 'select', options: goals, field: 'primary_goal' },
  { question: "What's your biggest challenge right now?", type: 'select', options: challenges, field: 'biggest_challenge' },
  { question: 'How much are you exercising?', type: 'select', options: exerciseLevels, field: 'exercise_level' },
]

export default function Onboarding() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [inputValue, setInputValue] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/signup')
        return
      }
      setUserId(user.id)

      // Check if profile already exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (existing) {
        // Already onboarded, go to chat
        router.push('/chat')
      }
    }
    checkAuth()
  }, [router])

  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  function handleSelect(value: string) {
    const updated = { ...profile, [step.field]: value }
    setProfile(updated)
    advance(updated)
  }

  function handleInputSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inputValue.trim()) return
    const updated = { ...profile, [step.field]: inputValue.trim() }
    setProfile(updated)
    setInputValue('')
    advance(updated)
  }

  async function advance(updatedProfile: Record<string, string>) {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Save profile to Supabase
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          ...updatedProfile,
          updated_at: new Date().toISOString(),
        })
      }
      // Also save to localStorage as backup for chat
      localStorage.setItem('novura_profile', JSON.stringify(updatedProfile))
      router.push('/chat')
    }
  }

  function goBack() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      setInputValue('')
    }
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFFBF5] flex flex-col">
      <header className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {currentStep > 0 && (
            <button onClick={goBack} className="text-[#6B6B65] hover:text-[#2D5A3D] transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <span className="text-sm font-semibold text-[#2D5A3D]">
            Novura<span className="text-[#C4742B]">Health</span>
          </span>
        </div>
        <span className="text-xs text-[#9B9B93]">{currentStep + 1} of {steps.length}</span>
      </header>

      <div className="px-6 mb-8">
        <div className="h-1.5 bg-[#E8F0EB] rounded-full overflow-hidden">
          <div className="h-full bg-[#2D5A3D] rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 px-6 flex flex-col">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1E1E1C] mb-8 tracking-tight">{step.question}</h1>

        {step.type === 'input' && (
          <form onSubmit={handleInputSubmit} className="space-y-4">
            <input
              type={step.inputType || 'text'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={step.placeholder}
              autoFocus
              className="w-full px-5 py-4 rounded-2xl border-2 border-black/10 bg-white text-lg text-[#1E1E1C] outline-none focus:border-[#2D5A3D] transition-colors placeholder:text-[#9B9B93]"
            />
            <button type="submit" disabled={!inputValue.trim()} className="w-full bg-[#2D5A3D] text-white py-4 rounded-2xl text-base font-semibold hover:bg-[#3A7A52] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
              Continue
            </button>
          </form>
        )}

        {step.type === 'select' && (
          <div className="space-y-3">
            {step.options?.map((option) => (
              <button key={option} onClick={() => handleSelect(option)} className="w-full text-left px-5 py-4 rounded-2xl border-2 border-black/[0.06] bg-white text-[#2A2A28] hover:border-[#2D5A3D] hover:bg-[#E8F0EB]/30 transition-all cursor-pointer text-base">
                {option}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => { const updated = { ...profile, [step.field]: '' }; setProfile(updated); setInputValue(''); advance(updated) }}
          className="mt-6 text-sm text-[#9B9B93] hover:text-[#6B6B65] transition-colors cursor-pointer self-center"
        >
          Skip this question
        </button>
      </div>

      <div className="px-6 py-4">
        <p className="text-center text-[10px] text-[#9B9B93]">Your answers help Nova personalize your coaching experience. You can update these anytime.</p>
      </div>
    </div>
  )
}
