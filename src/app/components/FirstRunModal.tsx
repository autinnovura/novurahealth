'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { MessageCircle, BarChart3, Utensils, X, ChevronRight, Syringe, Settings } from 'lucide-react'

interface DashboardTutorialProps {
  userId: string
  name: string
  onComplete: () => void
}

const TOUR_STEPS = [
  {
    icon: Syringe,
    title: 'Track your injections',
    desc: 'Log each shot with the site, dose, and time. Your medication level chart updates automatically so you always know where you stand.',
    color: '#1F4B32',
    bg: '#EAF2EB',
  },
  {
    icon: Utensils,
    title: 'Log meals & water',
    desc: 'Quick-log what you eat and drink. Nova can estimate nutrition from a description — no calorie counting needed.',
    color: '#C4742B',
    bg: '#FFF4E8',
  },
  {
    icon: BarChart3,
    title: 'Watch your progress',
    desc: 'The Stats page tracks your weight trend, streaks, macros, and milestones. Check in weekly to see how far you\'ve come.',
    color: '#2D5A3D',
    bg: '#E8F0EB',
  },
  {
    icon: MessageCircle,
    title: 'Chat with Nova',
    desc: 'Your AI health coach. Ask about side effects, get meal ideas, or just vent. She remembers your history and adapts to you.',
    color: '#1F4B32',
    bg: '#EAF2EB',
  },
  {
    icon: Settings,
    title: 'Set up reminders',
    desc: 'Head to Settings to enable push notifications for injection reminders and set your preferred injection day and time.',
    color: '#6B7A72',
    bg: '#F5F8F3',
  },
]

export default function FirstRunModal({ userId, name, onComplete }: DashboardTutorialProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [exiting, setExiting] = useState(false)

  const firstName = name?.split(' ')[0] || 'there'

  async function dismiss() {
    setExiting(true)
    await supabase.from('profiles').update({ first_run_complete: true }).eq('id', userId)
    setTimeout(() => onComplete(), 200)
  }

  async function finishTour() {
    setExiting(true)
    await supabase.from('profiles').update({ first_run_complete: true }).eq('id', userId)
    setTimeout(() => onComplete(), 200)
  }

  async function goToNova() {
    await supabase.from('profiles').update({ first_run_complete: true }).eq('id', userId)
    router.push('/chat')
  }

  const current = TOUR_STEPS[step]
  const Icon = current.icon

  return (
    <div className={`fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-200 ${exiting ? 'opacity-0' : 'opacity-100'}`}>
      <div className="bg-[#FAFAF7] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-[#2D5A3D] px-6 py-5 relative">
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors"
            aria-label="Skip tour"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>

          {step === 0 ? (
            <>
              <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">You&apos;re all set</p>
              <h2 className="text-white text-xl font-semibold tracking-tight mt-1">
                Welcome, {firstName}!
              </h2>
              <p className="text-white/60 text-xs mt-1">Here&apos;s a quick look at what you can do.</p>
            </>
          ) : (
            <>
              <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Quick tour</p>
              <h2 className="text-white text-lg font-semibold tracking-tight mt-1">
                {step} of {TOUR_STEPS.length - 1}
              </h2>
            </>
          )}

          {/* Progress dots */}
          <div className="flex gap-1.5 mt-4">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-white' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-7">
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: current.bg }}
            >
              <Icon className="w-5 h-5" style={{ color: current.color }} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1E1E1C] mb-1">{current.title}</h3>
              <p className="text-sm text-[#6B6B65] leading-relaxed">{current.desc}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {step < TOUR_STEPS.length - 1 ? (
              <>
                <button
                  onClick={dismiss}
                  className="px-5 py-3.5 rounded-xl text-sm font-semibold text-[#6B6B65] bg-white border border-[#EDEDEA] cursor-pointer hover:border-[#6B6B65]/30 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="flex-1 bg-[#2D5A3D] text-white py-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={finishTour}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-[#2D5A3D] bg-[#EAF2EB] cursor-pointer hover:bg-[#dde8df] transition-colors"
                >
                  Explore dashboard
                </button>
                <button
                  onClick={goToNova}
                  className="flex-1 bg-[#2D5A3D] text-white py-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  Chat with Nova <MessageCircle className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
