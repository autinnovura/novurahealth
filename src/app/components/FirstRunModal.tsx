'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

interface FirstRunModalProps {
  userId: string
  name: string
  medication: string
  dose: string
  currentWeight: string
  onComplete: () => void
}

const INJECTION_SITES = ['Left abdomen', 'Right abdomen', 'Left thigh', 'Right thigh', 'Left arm', 'Right arm']

export default function FirstRunModal({ userId, name, medication, dose, currentWeight, onComplete }: FirstRunModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)

  const startingWeight = currentWeight ? parseFloat(currentWeight) : 180
  const [weight, setWeight] = useState<number>(Number.isFinite(startingWeight) ? Math.round(startingWeight) : 180)

  const today = new Date().toISOString().split('T')[0]
  const [injectionDate, setInjectionDate] = useState<string>(today)

  async function saveWeight() {
    if (!weight || weight <= 0) return
    setSaving(true)
    try {
      await supabase.from('weight_logs').insert({ user_id: userId, weight })
      setStep(2)
    } finally {
      setSaving(false)
    }
  }

  async function saveInjection() {
    if (!injectionDate) return
    setSaving(true)
    try {
      const loggedAt = new Date(`${injectionDate}T12:00:00`).toISOString()
      await supabase.from('medication_logs').insert({
        user_id: userId,
        medication: medication || 'Medication',
        dose: dose || '',
        injection_site: INJECTION_SITES[0],
        notes: 'First-run setup',
        logged_at: loggedAt,
      })
      setStep(3)
    } finally {
      setSaving(false)
    }
  }

  async function finishAndGoToNova() {
    setSaving(true)
    try {
      const firstName = name?.split(' ')[0] || 'there'
      const med = medication || 'your medication'
      const welcome = `Hey ${firstName}! I'm Nova, your health coach. I see you're on ${med}. How's it been going so far? Any side effects or questions I can help with?`

      await Promise.all([
        supabase.from('messages').insert({ user_id: userId, role: 'assistant', content: welcome }),
        supabase.from('profiles').update({ first_run_complete: true }).eq('id', userId),
      ])
      onComplete()
      router.push('/chat')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#FAFAF7] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-[#2D5A3D] px-6 py-5">
          <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Welcome</p>
          <h2 className="text-white text-xl font-semibold tracking-tight mt-1">
            Hey{name ? `, ${name.split(' ')[0]}` : ''}! Let&apos;s get you set up.
          </h2>
          <p className="text-white/60 text-xs mt-1">This takes 60 seconds.</p>

          {/* Progress dots */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map(n => (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  n <= step ? 'bg-white' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-7">
          {step === 1 && (
            <div>
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Step 1 of 3</p>
              <h3 className="text-lg font-semibold text-[#1E1E1C] mb-6">What&apos;s your current weight?</h3>

              <div className="flex items-center justify-center gap-4 py-4">
                <button
                  type="button"
                  onClick={() => setWeight(w => Math.max(1, w - 1))}
                  className="w-14 h-14 rounded-full bg-white border border-[#EDEDEA] text-2xl font-semibold text-[#2D5A3D] hover:border-[#2D5A3D] active:scale-95 transition-all cursor-pointer"
                  aria-label="Decrease weight"
                >
                  −
                </button>
                <div className="flex flex-col items-center min-w-[140px]">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={weight}
                    onChange={e => {
                      const v = parseInt(e.target.value)
                      setWeight(Number.isFinite(v) && v > 0 ? v : 0)
                    }}
                    className="w-full text-center text-5xl font-bold text-[#1E1E1C] bg-transparent outline-none focus:text-[#2D5A3D] tabular-nums"
                  />
                  <p className="text-xs font-medium text-[#B0B0A8] uppercase tracking-wider mt-1">lbs</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWeight(w => w + 1)}
                  className="w-14 h-14 rounded-full bg-white border border-[#EDEDEA] text-2xl font-semibold text-[#2D5A3D] hover:border-[#2D5A3D] active:scale-95 transition-all cursor-pointer"
                  aria-label="Increase weight"
                >
                  +
                </button>
              </div>

              <button
                onClick={saveWeight}
                disabled={saving || !weight || weight <= 0}
                className="w-full bg-[#2D5A3D] text-white py-4 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-40 transition-opacity active:scale-[0.98] mt-6"
              >
                {saving ? 'Saving…' : 'Continue'}
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Step 2 of 3</p>
              <h3 className="text-lg font-semibold text-[#1E1E1C] mb-6">When was your last injection?</h3>

              <input
                type="date"
                value={injectionDate}
                max={today}
                onChange={e => setInjectionDate(e.target.value)}
                className="w-full px-5 py-5 rounded-xl border border-[#EDEDEA] bg-white text-lg font-semibold text-[#1E1E1C] outline-none focus:border-[#2D5A3D] transition-colors"
              />

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setStep(1)}
                  disabled={saving}
                  className="px-5 py-4 rounded-xl text-sm font-semibold text-[#6B6B65] bg-white border border-[#EDEDEA] cursor-pointer disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  onClick={saveInjection}
                  disabled={saving || !injectionDate}
                  className="flex-1 bg-[#2D5A3D] text-white py-4 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-40 transition-opacity active:scale-[0.98]"
                >
                  {saving ? 'Saving…' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2">Step 3 of 3</p>
              <h3 className="text-lg font-semibold text-[#1E1E1C] mb-2">Say hi to Nova</h3>
              <p className="text-sm text-[#6B6B65] mb-6">Your personal health coach. She already knows your setup — just start the conversation.</p>

              <div className="bg-white border border-[#EDEDEA] rounded-2xl p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#E8F0EB] flex items-center justify-center shrink-0">
                  <span className="text-2xl">🌿</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1E1E1C]">Nova</p>
                  <p className="text-xs text-[#8B8B83]">Ready when you are</p>
                </div>
              </div>

              <button
                onClick={finishAndGoToNova}
                disabled={saving}
                className="w-full bg-[#2D5A3D] text-white py-4 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-40 transition-opacity active:scale-[0.98] mt-6"
              >
                {saving ? 'Opening chat…' : 'Start chatting with Nova'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
