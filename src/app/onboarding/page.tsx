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
  Ozempic: ['0.25mg', '0.5mg', '1mg', '2mg'],
  Wegovy: ['0.25mg', '0.5mg', '1mg', '1.7mg', '2.4mg'],
  Mounjaro: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
  Zepbound: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
  Saxenda: ['0.6mg', '1.2mg', '1.8mg', '2.4mg', '3mg'],
  Rybelsus: ['3mg', '7mg', '14mg'],
  Other: ['Custom'],
}

const GOALS = ['Lose weight', 'Manage blood sugar', 'Reduce appetite', 'Improve overall health', 'Build better habits']
const CHALLENGES = ['Side effects', 'Staying consistent', 'Nutrition & protein', 'Cost of medication', 'Plateau / slow progress', 'Motivation']
const EXERCISE_LEVELS = ['Sedentary', 'Light (1-2x/week)', 'Moderate (3-4x/week)', 'Active (5+/week)']

type Step = 'welcome' | 'name' | 'medication' | 'dose' | 'start_date' | 'current_weight' | 'goal_weight' | 'primary_goal' | 'biggest_challenge' | 'exercise_level' | 'complete'

interface Message {
  role: 'nova' | 'user'
  content: string
  options?: { label: string; sub?: string }[]
  inputType?: 'text' | 'number' | 'date'
  inputPlaceholder?: string
  showDateToggle?: boolean
}

export default function Onboarding() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('welcome')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isJustStarting, setIsJustStarting] = useState(false)
  const [saving, setSaving] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Profile data
  const [profile, setProfile] = useState({
    name: '', medication: '', dose: '', start_date: '',
    current_weight: '', goal_weight: '', primary_goal: '',
    biggest_challenge: '', exercise_level: '',
  })

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Check if already onboarded
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (p?.name) { router.push('/dashboard'); return }

      // Start the conversation
      fetchNovaResponse('welcome', '')
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isTyping])

  async function fetchNovaResponse(currentStep: string, data: string) {
    setIsTyping(true)
    try {
      const res = await fetch('/api/onboarding-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: currentStep, data }),
      })
      const { message } = await res.json()

      // Simulate typing delay
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800))
      setIsTyping(false)

      const novaMsg: Message = { role: 'nova', content: message }

      // Add options based on next step
      const nextStep = getNextStep(currentStep as Step)
      if (nextStep === 'name') {
        novaMsg.inputType = 'text'
        novaMsg.inputPlaceholder = 'Type your name...'
      } else if (nextStep === 'medication') {
        novaMsg.options = MEDICATIONS.map(m => ({ label: m.label, sub: m.sub }))
      } else if (nextStep === 'dose') {
        const med = profile.medication || data
        const doses = DOSES[med] || DOSES['Other']
        novaMsg.options = doses.map(d => ({ label: d }))
      } else if (nextStep === 'start_date') {
        novaMsg.inputType = 'date'
        novaMsg.showDateToggle = true
      } else if (nextStep === 'current_weight') {
        novaMsg.inputType = 'number'
        novaMsg.inputPlaceholder = 'Enter weight in lbs...'
      } else if (nextStep === 'goal_weight') {
        novaMsg.inputType = 'number'
        novaMsg.inputPlaceholder = 'Enter goal weight in lbs...'
      } else if (nextStep === 'primary_goal') {
        novaMsg.options = GOALS.map(g => ({ label: g }))
      } else if (nextStep === 'biggest_challenge') {
        novaMsg.options = CHALLENGES.map(c => ({ label: c }))
      } else if (nextStep === 'exercise_level') {
        novaMsg.options = EXERCISE_LEVELS.map(l => ({ label: l }))
      }

      setMessages(prev => [...prev, novaMsg])
      setStep(nextStep)
    } catch {
      setIsTyping(false)
      setMessages(prev => [...prev, { role: 'nova', content: "Let's keep going!" }])
    }
  }

  function getNextStep(current: Step): Step {
    const flow: Step[] = ['welcome', 'name', 'medication', 'dose', 'start_date', 'current_weight', 'goal_weight', 'primary_goal', 'biggest_challenge', 'exercise_level', 'complete']
    const idx = flow.indexOf(current)
    return flow[idx + 1] || 'complete'
  }

  async function handleAnswer(answer: string) {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: answer }])
    setInputValue('')

    // Update profile
    const updated = { ...profile }
    switch (step) {
      case 'name': updated.name = answer; break
      case 'medication': updated.medication = answer; break
      case 'dose': updated.dose = answer; break
      case 'start_date': updated.start_date = answer === 'Just starting' ? '' : answer; break
      case 'current_weight': updated.current_weight = answer.replace(/[^0-9.]/g, ''); break
      case 'goal_weight': updated.goal_weight = answer.replace(/[^0-9.]/g, ''); break
      case 'primary_goal': updated.primary_goal = answer; break
      case 'biggest_challenge': updated.biggest_challenge = answer; break
      case 'exercise_level': updated.exercise_level = answer; break
    }
    setProfile(updated)

    // If this is the last step, save and redirect
    if (step === 'exercise_level') {
      setIsTyping(true)
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800))

      // Get Nova's final message
      try {
        const res = await fetch('/api/onboarding-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'exercise_level', data: answer }),
        })
        const { message } = await res.json()
        setIsTyping(false)
        setMessages(prev => [...prev, { role: 'nova', content: message }])
      } catch {
        setIsTyping(false)
        setMessages(prev => [...prev, { role: 'nova', content: "Alright, I've got everything I need! Your dashboard is ready. Let's do this 🌿" }])
      }

      setStep('complete')

      // Save to Supabase
      setSaving(true)
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          ...updated,
        })
      }
      setSaving(false)
      return
    }

    // Fetch next Nova response
    const dataForNova = step === 'start_date' && answer === 'Just starting' ? 'just_starting' : answer
    fetchNovaResponse(step, dataForNova)
  }

  function handleSubmitInput() {
    if (!inputValue.trim()) return
    const display = step === 'current_weight' || step === 'goal_weight' ? `${inputValue} lbs` : inputValue
    handleAnswer(display)
  }

  function handleDateSubmit() {
    if (isJustStarting) {
      handleAnswer('Just starting')
    } else if (inputValue) {
      const formatted = new Date(inputValue + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      handleAnswer(formatted)
    }
  }

  const progressSteps: Step[] = ['name', 'medication', 'dose', 'start_date', 'current_weight', 'goal_weight', 'primary_goal', 'biggest_challenge', 'exercise_level']
  const progressIdx = progressSteps.indexOf(step)
  const progressPct = step === 'complete' ? 100 : step === 'welcome' ? 0 : Math.round(((progressIdx + 1) / progressSteps.length) * 100)

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      {/* Header */}
      <header className="bg-[#2D5A3D] px-5 py-4 shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                <span className="text-sm">🌿</span>
              </div>
              <div>
                <p className="text-white text-sm font-semibold">Nova</p>
                <p className="text-white/40 text-[10px]">Your health coach</p>
              </div>
            </div>
            <span className="text-white/30 text-xs">{progressPct}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white/60 rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 max-w-2xl mx-auto w-full">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i}>
              {/* Message bubble */}
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'nova' && (
                  <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0 mr-2 mt-1">
                    <span className="text-xs">🌿</span>
                  </div>
                )}
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#2D5A3D] text-white rounded-br-md'
                    : 'bg-white border border-[#EDEDEA] text-[#1E1E1C] rounded-bl-md shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>

              {/* Options (show only on last nova message) */}
              {msg.role === 'nova' && msg.options && i === messages.length - 1 && step !== 'complete' && (
                <div className="mt-3 ml-9 flex flex-wrap gap-2">
                  {msg.options.map(opt => (
                    <button key={opt.label} onClick={() => handleAnswer(opt.label)}
                      className="bg-white border border-[#EDEDEA] hover:border-[#2D5A3D] hover:bg-[#E8F0EB] px-4 py-2.5 rounded-xl text-sm text-[#1E1E1C] cursor-pointer transition-all active:scale-95 shadow-sm">
                      <span className="font-medium">{opt.label}</span>
                      {opt.sub && <span className="text-[#B0B0A8] text-xs ml-1.5">({opt.sub})</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Date input with toggle */}
              {msg.role === 'nova' && msg.showDateToggle && i === messages.length - 1 && step !== 'complete' && (
                <div className="mt-3 ml-9 space-y-3">
                  <div className="flex gap-2">
                    <button onClick={() => setIsJustStarting(false)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${!isJustStarting ? 'bg-[#2D5A3D] text-white' : 'bg-white border border-[#EDEDEA] text-[#8B8B83]'}`}>
                      I have a start date
                    </button>
                    <button onClick={() => setIsJustStarting(true)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${isJustStarting ? 'bg-[#2D5A3D] text-white' : 'bg-white border border-[#EDEDEA] text-[#8B8B83]'}`}>
                      Just starting
                    </button>
                  </div>
                  {!isJustStarting && (
                    <input type="date" value={inputValue} onChange={e => setInputValue(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#EDEDEA] bg-white text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D]" />
                  )}
                  <button onClick={handleDateSubmit} disabled={!isJustStarting && !inputValue}
                    className="w-full py-3 rounded-xl bg-[#2D5A3D] text-white text-sm font-semibold cursor-pointer disabled:opacity-30 transition-opacity">
                    Continue
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0 mr-2 mt-1">
                <span className="text-xs">🌿</span>
              </div>
              <div className="bg-white border border-[#EDEDEA] px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#B0B0A8] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#B0B0A8] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#B0B0A8] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Complete state */}
          {step === 'complete' && (
            <div className="mt-6">
              {/* Profile summary card */}
              <div className="bg-white border border-[#EDEDEA] rounded-2xl p-5 shadow-sm space-y-3 mb-4">
                <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Your Profile</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Name', value: profile.name },
                    { label: 'Medication', value: `${profile.medication} · ${profile.dose}` },
                    { label: 'Current', value: `${profile.current_weight} lbs` },
                    { label: 'Goal', value: `${profile.goal_weight} lbs` },
                    { label: 'Focus', value: profile.primary_goal },
                    { label: 'Activity', value: profile.exercise_level },
                  ].map(item => (
                    <div key={item.label} className="bg-[#F5F5F2] rounded-lg px-3 py-2">
                      <p className="text-[9px] text-[#B0B0A8] uppercase font-semibold">{item.label}</p>
                      <p className="text-sm text-[#1E1E1C] font-medium mt-0.5">{item.value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => router.push('/dashboard')} disabled={saving}
                className="w-full bg-[#2D5A3D] text-white py-4 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors disabled:opacity-50 active:scale-[0.98]">
                {saving ? 'Setting up...' : 'Go to Dashboard →'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input bar (for text/number steps) */}
      {!isTyping && step !== 'complete' && step !== 'welcome' && messages.length > 0 && (() => {
        const lastNova = [...messages].reverse().find(m => m.role === 'nova')
        if (!lastNova?.inputType || lastNova.showDateToggle) return null
        return (
          <div className="shrink-0 bg-white border-t border-[#EDEDEA] px-4 py-3 max-w-2xl mx-auto w-full">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type={lastNova.inputType === 'number' ? 'number' : 'text'}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmitInput()}
                placeholder={lastNova.inputPlaceholder || 'Type here...'}
                autoFocus
                className="flex-1 px-4 py-3 rounded-xl border border-[#EDEDEA] bg-[#FAFAF7] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"
              />
              <button onClick={handleSubmitInput} disabled={!inputValue.trim()}
                className="bg-[#2D5A3D] text-white px-5 py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-30 transition-opacity active:scale-95">
                Send
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
