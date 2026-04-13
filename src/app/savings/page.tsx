'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import VoiceInput from '../components/VoiceInput'

interface SavingsProfile {
  id: string; medication: string; monthly_cost: number; has_insurance: boolean
  insurance_provider: string; uses_manufacturer_coupon: boolean; pharmacy_type: string
  monthly_savings: number; total_saved: number; notes: string
}

interface ChatMsg { role: 'user' | 'nova'; content: string }

const DRUG_COSTS: Record<string, number> = {
  Ozempic: 950, Wegovy: 1350, Mounjaro: 1050, Zepbound: 1060, Saxenda: 1400, Rybelsus: 950,
}

const SAVINGS_TIPS: Record<string, { title: string; savings: string; desc: string }[]> = {
  insured: [
    { title: 'Manufacturer Savings Card', savings: '$150–500/mo', desc: 'Most GLP-1 makers offer savings cards that cover the majority of your copay. Works even with commercial insurance.' },
    { title: 'Prior Authorization', savings: 'Full coverage', desc: 'If denied, your doctor can submit a prior auth. Include BMI, comorbidities, and failed diet history.' },
    { title: 'Appeal a Denial', savings: 'Full coverage', desc: 'If prior auth is denied, you have the right to appeal. Nova can help you draft the appeal letter.' },
    { title: 'Step Therapy Exception', savings: 'Full coverage', desc: 'If your insurer requires trying cheaper meds first, your doctor can request an exception.' },
    { title: 'Mail-Order Pharmacy', savings: '$20–50/mo', desc: '90-day supply via mail order is usually cheaper per dose than monthly retail fills.' },
    { title: 'HSA/FSA Funds', savings: 'Pre-tax savings', desc: 'GLP-1 medications are HSA/FSA eligible. Pay with pre-tax dollars to save 20-35%.' },
  ],
  uninsured: [
    { title: 'Compounded Semaglutide', savings: '$100–300/mo', desc: 'Compounding pharmacies offer semaglutide at a fraction of brand cost. Discuss with your doctor.' },
    { title: 'Patient Assistance Programs', savings: 'Free medication', desc: 'Novo Nordisk and Eli Lilly offer programs for uninsured patients under income thresholds.' },
    { title: 'GoodRx / RxSaver', savings: '$50–200/mo', desc: 'Discount platforms can significantly reduce cash prices at retail pharmacies.' },
    { title: 'Manufacturer Savings Card', savings: 'Up to $500/mo', desc: 'Some cards work even without insurance. Check the manufacturer website for your medication.' },
    { title: 'Telehealth + Compounding', savings: '$150–350/mo total', desc: 'Services like Henry Meds, Ro, or Calibrate bundle the prescription and medication at lower cost.' },
    { title: 'State Assistance Programs', savings: 'Varies', desc: 'Some states offer prescription assistance for residents. Check your state health department.' },
  ],
}

export default function Savings() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [savings, setSavings] = useState<SavingsProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'overview' | 'strategies' | 'advisor'>('overview')

  // Setup form
  const [showSetup, setShowSetup] = useState(false)
  const [monthlyCost, setMonthlyCost] = useState('')
  const [hasInsurance, setHasInsurance] = useState(false)
  const [insuranceProvider, setInsuranceProvider] = useState('')
  const [usesCoupon, setUsesCoupon] = useState(false)
  const [pharmacyType, setPharmacyType] = useState('')
  const [savingForm, setSavingForm] = useState(false)

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

      const { data: sp } = await supabase.from('savings_profiles').select('*').eq('user_id', user.id).single()
      if (sp) {
        setSavings(sp)
        setMonthlyCost(String(sp.monthly_cost || ''))
        setHasInsurance(sp.has_insurance)
        setInsuranceProvider(sp.insurance_provider || '')
        setUsesCoupon(sp.uses_manufacturer_coupon)
        setPharmacyType(sp.pharmacy_type || '')
      }

      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  async function saveSetup() {
    if (!userId) return
    setSavingForm(true)
    const payload = {
      user_id: userId,
      medication: profile?.medication || '',
      monthly_cost: parseFloat(monthlyCost) || 0,
      has_insurance: hasInsurance,
      insurance_provider: insuranceProvider,
      uses_manufacturer_coupon: usesCoupon,
      pharmacy_type: pharmacyType,
      updated_at: new Date().toISOString(),
    }
    if (savings) {
      const { data } = await supabase.from('savings_profiles').update(payload).eq('id', savings.id).select().single()
      if (data) setSavings(data)
    } else {
      const { data } = await supabase.from('savings_profiles').insert(payload).select().single()
      if (data) setSavings(data)
    }
    setSavingForm(false)
    setShowSetup(false)
  }

  async function sendChat() {
    if (!chatInput.trim()) return
    const msg = chatInput.trim()
    setChatMessages(prev => [...prev, { role: 'user', content: msg }])
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/savings-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, profile, savingsProfile: savings }),
      })
      const { message } = await res.json()
      setChatMessages(prev => [...prev, { role: 'nova', content: message }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'nova', content: "Having trouble connecting. Try again." }])
    }
    setChatLoading(false)
  }

  if (loading) return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin"/></div>

  const brandCost = DRUG_COSTS[profile?.medication] || 1000
  const currentCost = savings?.monthly_cost || brandCost
  const yearlyCost = currentCost * 12
  const potentialSavings = hasInsurance ? Math.round(currentCost * 0.6) : Math.round(currentCost * 0.7)
  const yearlyPotentialSavings = potentialSavings * 12
  const tips = hasInsurance ? SAVINGS_TIPS.insured : SAVINGS_TIPS.uninsured

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-20">
      {/* Header */}
      <header className="bg-gradient-to-br from-[#2D5A3D] to-[#1E3F2B] px-5 py-5">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-white font-semibold text-lg tracking-tight">Savings</h1>
          <p className="text-white/40 text-xs mt-0.5">Find ways to reduce your GLP-1 costs</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-[#E8E8E4] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex">
          {([
            { id: 'overview' as const, label: 'Overview' },
            { id: 'strategies' as const, label: 'Strategies' },
            { id: 'advisor' as const, label: 'Ask Nova' },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveView(tab.id)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${activeView === tab.id ? 'text-[#2D5A3D] border-b-2 border-[#2D5A3D]' : 'text-[#B0B0A8] hover:text-[#6B6B65]'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ══════════ OVERVIEW ══════════ */}
        {activeView === 'overview' && (<>
          {/* Cost snapshot */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-[#1E1E1C]">Your Cost Snapshot</h2>
              <button onClick={() => setShowSetup(true)} className="text-xs text-[#2D5A3D] font-semibold cursor-pointer">{savings ? 'Edit' : 'Set up'}</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#FFF0E5] rounded-lg p-4">
                <p className="text-[9px] text-[#C4742B] uppercase font-semibold">Monthly Cost</p>
                <p className="text-2xl font-bold text-[#C4742B] mt-1">${currentCost.toLocaleString()}</p>
                <p className="text-[10px] text-[#C4742B]/60">{profile?.medication || 'GLP-1'}</p>
              </div>
              <div className="bg-[#E8F0EB] rounded-lg p-4">
                <p className="text-[9px] text-[#2D5A3D] uppercase font-semibold">Potential Savings</p>
                <p className="text-2xl font-bold text-[#2D5A3D] mt-1">${potentialSavings.toLocaleString()}<span className="text-sm font-normal">/mo</span></p>
                <p className="text-[10px] text-[#2D5A3D]/60">${yearlyPotentialSavings.toLocaleString()}/year</p>
              </div>
            </div>

            <div className="bg-[#F5F5F2] rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-[#6B6B65]">Annual spend at current rate</span>
                <span className="text-sm font-bold text-[#1E1E1C]">${yearlyCost.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-[#EDEDEA] rounded-full overflow-hidden">
                <div className="h-full bg-[#C4742B] rounded-full" style={{ width: `${Math.min(100, (currentCost / brandCost) * 100)}%` }} />
              </div>
              <div className="flex justify-between text-[9px] text-[#B0B0A8] mt-1">
                <span>$0</span>
                <span>Brand price: ${brandCost}/mo</span>
              </div>
            </div>
          </div>

          {/* Quick info cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-3 text-center">
              <p className="text-[9px] text-[#B0B0A8] uppercase font-semibold">Insurance</p>
              <p className="text-sm font-bold text-[#1E1E1C] mt-1">{savings ? (savings.has_insurance ? 'Yes' : 'No') : '—'}</p>
            </div>
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-3 text-center">
              <p className="text-[9px] text-[#B0B0A8] uppercase font-semibold">Savings Card</p>
              <p className="text-sm font-bold text-[#1E1E1C] mt-1">{savings ? (savings.uses_manufacturer_coupon ? 'Active' : 'No') : '—'}</p>
            </div>
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-3 text-center">
              <p className="text-[9px] text-[#B0B0A8] uppercase font-semibold">Total Saved</p>
              <p className="text-sm font-bold text-[#2D5A3D] mt-1">${savings?.total_saved?.toLocaleString() || '0'}</p>
            </div>
          </div>

          {/* Top 3 actions */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#1E1E1C] mb-3">Top Actions For You</h3>
            <div className="space-y-3">
              {tips.slice(0, 3).map((tip, i) => (
                <div key={i} className="flex gap-3 p-3 bg-[#F5F5F2] rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-[#E8F0EB] flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[#2D5A3D]">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-[#1E1E1C]">{tip.title}</p>
                      <span className="text-xs font-bold text-[#2D5A3D] bg-[#E8F0EB] px-2 py-0.5 rounded-full">{tip.savings}</span>
                    </div>
                    <p className="text-xs text-[#8B8B83] mt-1 leading-relaxed">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button onClick={() => setActiveView('advisor')}
            className="w-full bg-[#2D5A3D] text-white py-4 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors">
            Ask Nova How to Save More
          </button>
        </>)}

        {/* ══════════ STRATEGIES ══════════ */}
        {activeView === 'strategies' && (<>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setHasInsurance(true)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${hasInsurance ? 'bg-[#2D5A3D] text-white' : 'bg-white border border-[#EDEDEA] text-[#8B8B83]'}`}>
              I have insurance
            </button>
            <button onClick={() => setHasInsurance(false)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${!hasInsurance ? 'bg-[#2D5A3D] text-white' : 'bg-white border border-[#EDEDEA] text-[#8B8B83]'}`}>
              No insurance
            </button>
          </div>

          {tips.map((tip, i) => (
            <div key={i} className="bg-white border border-[#EDEDEA] rounded-xl p-5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-sm font-semibold text-[#1E1E1C]">{tip.title}</h3>
                <span className="text-xs font-bold text-[#2D5A3D] bg-[#E8F0EB] px-2 py-0.5 rounded-full shrink-0 ml-2">{tip.savings}</span>
              </div>
              <p className="text-xs text-[#6B6B65] leading-relaxed">{tip.desc}</p>
            </div>
          ))}
        </>)}

        {/* ══════════ ASK NOVA ══════════ */}
        {activeView === 'advisor' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
            <div ref={chatRef} className="flex-1 overflow-y-auto space-y-3 mb-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-full bg-[#E8F0EB] flex items-center justify-center mx-auto mb-3"><span className="text-2xl">🌿</span></div>
                  <p className="text-sm font-semibold text-[#1E1E1C]">Ask Nova about saving money</p>
                  <p className="text-xs text-[#8B8B83] mt-1 max-w-xs mx-auto">Get personalized advice on reducing your GLP-1 medication costs.</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {[
                      "How do I get a manufacturer savings card?",
                      "Help me appeal an insurance denial",
                      "Is compounded semaglutide safe?",
                      "What's the cheapest way to get my medication?",
                    ].map(q => (
                      <button key={q} onClick={() => setChatInput(q)}
                        className="text-xs px-3 py-2 rounded-full border border-[#EDEDEA] text-[#6B6B65] cursor-pointer hover:border-[#2D5A3D] hover:text-[#2D5A3D] transition-colors">{q}</button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'nova' && <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0 mr-2 mt-1"><span className="text-xs">🌿</span></div>}
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#2D5A3D] text-white rounded-br-md' : 'bg-white border border-[#EDEDEA] text-[#1E1E1C] rounded-bl-md shadow-sm'}`}>{msg.content}</div>
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

            <div className="flex gap-2">
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask about savings, insurance, coupons..."
                className="flex-1 px-4 py-3 rounded-xl border border-[#EDEDEA] bg-white text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]" />
              <VoiceInput onResult={(text) => setChatInput(text)} />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                className="bg-[#2D5A3D] text-white px-5 py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-30 transition-opacity">Send</button>
            </div>
          </div>
        )}
      </div>

      {/* Setup modal */}
      {showSetup && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setShowSetup(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-[#1E1E1C]">Your Cost Info</h2>
              <button onClick={() => setShowSetup(false)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Monthly out-of-pocket cost ($)</label>
              <input type="number" value={monthlyCost} onChange={e => setMonthlyCost(e.target.value)} placeholder="e.g. 250"
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D]" />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2 block">Do you have insurance?</label>
              <div className="flex gap-2">
                <button onClick={() => setHasInsurance(true)} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${hasInsurance ? 'bg-[#2D5A3D] text-white' : 'bg-[#F5F5F2] text-[#8B8B83]'}`}>Yes</button>
                <button onClick={() => setHasInsurance(false)} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${!hasInsurance ? 'bg-[#2D5A3D] text-white' : 'bg-[#F5F5F2] text-[#8B8B83]'}`}>No</button>
              </div>
            </div>

            {hasInsurance && (
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Insurance provider</label>
                <input type="text" value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)} placeholder="e.g. Blue Cross, Aetna"
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]" />
              </div>
            )}

            <div>
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2 block">Using a manufacturer savings card?</label>
              <div className="flex gap-2">
                <button onClick={() => setUsesCoupon(true)} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${usesCoupon ? 'bg-[#2D5A3D] text-white' : 'bg-[#F5F5F2] text-[#8B8B83]'}`}>Yes</button>
                <button onClick={() => setUsesCoupon(false)} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${!usesCoupon ? 'bg-[#2D5A3D] text-white' : 'bg-[#F5F5F2] text-[#8B8B83]'}`}>No</button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Pharmacy type</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {['Retail', 'Mail-order', 'Compounding', 'Online/telehealth'].map(p => (
                  <button key={p} onClick={() => setPharmacyType(p)}
                    className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all ${pharmacyType === p ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>{p}</button>
                ))}
              </div>
            </div>

            <button onClick={saveSetup} disabled={savingForm}
              className="w-full bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50">
              {savingForm ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EDEDEA] px-4 py-2 flex justify-around z-50">
        <a href="/dashboard" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4"/></svg><span className="text-[10px] font-medium">Home</span></a>
        <a href="/maintenance" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg><span className="text-[10px] font-medium">Transition</span></a>
        <a href="/chat" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg><span className="text-[10px] font-medium">Nova</span></a>
        <a href="/savings" className="flex flex-col items-center gap-0.5 text-[#2D5A3D]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span className="text-[10px] font-semibold">Savings</span></a>
      </nav>
    </div>
  )
}
