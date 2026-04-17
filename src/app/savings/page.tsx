'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import VoiceInput from '../components/VoiceInput'

interface ChatMsg { role: 'user' | 'nova'; content: string }

const MED_SAVINGS: Record<string, {
  brand_cost: number
  savings_card: { name: string; url: string; copay: string; details: string }
  patient_assistance: { name: string; url: string; details: string }
  self_pay: { name: string; url: string; price: string; details: string } | null
  pharmacy_compare: { name: string; url: string }[]
  upcoming: string | null
}> = {
  'Ozempic': {
    brand_cost: 1028,
    savings_card: {
      name: 'NovoCare Savings Card',
      url: 'https://www.novocare.com/ozempic/savings-card.html',
      copay: 'As low as $25/mo with commercial insurance',
      details: 'For commercially insured patients. Not valid for government insurance (Medicare, Medicaid, TRICARE).'
    },
    patient_assistance: {
      name: 'Novo Nordisk PAP',
      url: 'https://www.novocare.com/pap.html',
      details: 'Free medication for qualifying uninsured patients under income thresholds. Apply online or by phone.'
    },
    self_pay: {
      name: 'NovoCare Pharmacy',
      url: 'https://www.novocare.com/pharmacy.html',
      price: '$199/mo intro (first 2 fills), then $349/mo',
      details: 'Direct-from-manufacturer self-pay pricing. No insurance needed.'
    },
    pharmacy_compare: [
      { name: 'GoodRx — Ozempic', url: 'https://www.goodrx.com/ozempic' },
      { name: 'RxSaver — Ozempic', url: 'https://www.rxsaver.com/drugs/ozempic' },
      { name: 'Amazon Pharmacy', url: 'https://pharmacy.amazon.com' },
    ],
    upcoming: 'Novo Nordisk announced all Ozempic doses will drop to $675/mo list price effective January 1, 2027.'
  },
  'Wegovy': {
    brand_cost: 1349,
    savings_card: {
      name: 'NovoCare Savings Card',
      url: 'https://www.novocare.com/wegovy/savings-card.html',
      copay: 'As low as $25/mo with commercial insurance',
      details: 'For commercially insured patients. Not valid for government insurance.'
    },
    patient_assistance: {
      name: 'Novo Nordisk PAP',
      url: 'https://www.novocare.com/pap.html',
      details: 'Free Wegovy for qualifying uninsured patients under income thresholds.'
    },
    self_pay: {
      name: 'NovoCare Pharmacy',
      url: 'https://www.novocare.com/pharmacy.html',
      price: '$199/mo intro (first 2 fills), then $349/mo',
      details: 'Direct self-pay pricing. Subscription model also available.'
    },
    pharmacy_compare: [
      { name: 'GoodRx — Wegovy', url: 'https://www.goodrx.com/wegovy' },
      { name: 'RxSaver — Wegovy', url: 'https://www.rxsaver.com/drugs/wegovy' },
    ],
    upcoming: 'Wegovy will drop to $675/mo list price effective January 1, 2027. Medicare coverage expected mid-2026 at ~$50/mo.'
  },
  'Mounjaro': {
    brand_cost: 1069,
    savings_card: {
      name: 'Lilly Savings Card',
      url: 'https://www.mounjaro.com/savings',
      copay: 'As low as $25/fill with commercial coverage',
      details: 'Max savings ~$100/mo or $1,300/year. Up to 13 fills. Expires 12/31/2026.'
    },
    patient_assistance: {
      name: 'Lilly Cares Foundation',
      url: 'https://www.lillycares.com',
      details: 'Covers Mounjaro for diabetes patients. Does NOT cover Zepbound for weight loss.'
    },
    self_pay: null,
    pharmacy_compare: [
      { name: 'GoodRx — Mounjaro', url: 'https://www.goodrx.com/mounjaro' },
      { name: 'RxSaver — Mounjaro', url: 'https://www.rxsaver.com/drugs/mounjaro' },
    ],
    upcoming: null
  },
  'Zepbound': {
    brand_cost: 1086,
    savings_card: {
      name: 'Lilly Savings Card',
      url: 'https://zepbound.lilly.com/savings',
      copay: 'As low as $25/fill with coverage; $499/fill without',
      details: 'With coverage: max ~$100/mo. Without coverage: $499/fill for pens.'
    },
    patient_assistance: {
      name: 'LillyDirect',
      url: 'https://www.lillydirect.com',
      details: 'Self-pay vials/KwikPen at $299-449/mo via LillyDirect. Journey Program discounts for timely refills.'
    },
    self_pay: {
      name: 'LillyDirect',
      url: 'https://www.lillydirect.com',
      price: '$299-449/mo (vials/KwikPen)',
      details: 'Lower-cost vial and KwikPen options available direct from Lilly.'
    },
    pharmacy_compare: [
      { name: 'GoodRx — Zepbound', url: 'https://www.goodrx.com/zepbound' },
      { name: 'LillyDirect', url: 'https://www.lillydirect.com' },
    ],
    upcoming: 'Eli Lilly\'s oral GLP-1 Foundayo (orforglipron) now available at $149-299/mo — ask your doctor about switching.'
  },
  'Semaglutide (Ozempic)': {
    brand_cost: 1028,
    savings_card: {
      name: 'NovoCare Savings Card',
      url: 'https://www.novocare.com/ozempic/savings-card.html',
      copay: 'As low as $25/mo with commercial insurance',
      details: 'For commercially insured patients.'
    },
    patient_assistance: {
      name: 'Novo Nordisk PAP',
      url: 'https://www.novocare.com/pap.html',
      details: 'Free medication for qualifying uninsured patients.'
    },
    self_pay: {
      name: 'NovoCare Pharmacy',
      url: 'https://www.novocare.com/pharmacy.html',
      price: '$199/mo intro, then $349/mo',
      details: 'Direct self-pay pricing from Novo Nordisk.'
    },
    pharmacy_compare: [
      { name: 'GoodRx — Ozempic', url: 'https://www.goodrx.com/ozempic' },
    ],
    upcoming: 'Price dropping to $675/mo list effective January 1, 2027.'
  },
}

const DEFAULT_SAVINGS = MED_SAVINGS['Ozempic']

// Nova quick prompts for savings
const SAVINGS_PROMPTS = [
  "Walk me through getting a manufacturer savings card",
  "Help me draft an insurance appeal letter",
  "What's the cheapest way to get my medication right now?",
  "Help me with prior authorization paperwork",
  "Should I switch medications to save money?",
  "How do I apply for patient assistance?",
]

export default function Savings() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'savings' | 'tools' | 'nova'>('savings')

  // Savings setup
  const [monthlyCost, setMonthlyCost] = useState('')
  const [hasInsurance, setHasInsurance] = useState<boolean | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [savingsProfile, setSavingsProfile] = useState<any>(null)

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
        setSavingsProfile(sp)
        setMonthlyCost(String(sp.monthly_cost || ''))
        setHasInsurance(sp.has_insurance)
      }
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, chatLoading])

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
        body: JSON.stringify({ message: msg, profile, savingsProfile }),
      })
      const { message } = await res.json()
      setChatMessages(prev => [...prev, { role: 'nova', content: message }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'nova', content: "Having trouble connecting. Try again." }])
    }
    setChatLoading(false)
  }

  if (loading) return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin" /></div>

  const med = profile?.medication || 'Ozempic'
  const medData = MED_SAVINGS[med] || DEFAULT_SAVINGS
  const currentCost = savingsProfile?.monthly_cost || medData.brand_cost
  const yearlyCost = currentCost * 12

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-[#2D5A3D] to-[#1E3F2B] px-5 py-5">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-white font-semibold text-lg">Savings</h1>
          <p className="text-white/40 text-xs mt-0.5">Save money on {med}</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-[#E8E8E4] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex">
          {([
            { id: 'savings' as const, label: 'Your Savings' },
            { id: 'tools' as const, label: 'Filing Tools' },
            { id: 'nova' as const, label: 'Ask Nova' },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveView(tab.id)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${activeView === tab.id ? 'text-[#2D5A3D] border-b-2 border-[#2D5A3D]' : 'text-[#B0B0A8]'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ══════════ YOUR SAVINGS ══════════ */}
        {activeView === 'savings' && (<>
          {/* Cost snapshot */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold text-[#1E1E1C]">{med} — Cost Snapshot</h2>
              <button onClick={() => setShowSetup(true)} className="text-xs text-[#2D5A3D] font-semibold cursor-pointer">{savingsProfile ? 'Edit' : 'Set up'}</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-[#FFF0E5] rounded-lg p-3">
                <p className="text-[9px] text-[#C4742B] uppercase font-semibold">You Pay</p>
                <p className="text-2xl font-bold text-[#C4742B]">${currentCost.toLocaleString()}<span className="text-xs font-normal">/mo</span></p>
                <p className="text-[10px] text-[#C4742B]/60">${yearlyCost.toLocaleString()}/year</p>
              </div>
              <div className="bg-[#E8F0EB] rounded-lg p-3">
                <p className="text-[9px] text-[#2D5A3D] uppercase font-semibold">Brand List Price</p>
                <p className="text-2xl font-bold text-[#2D5A3D]">${medData.brand_cost.toLocaleString()}<span className="text-xs font-normal">/mo</span></p>
                <p className="text-[10px] text-[#2D5A3D]/60">${(medData.brand_cost * 12).toLocaleString()}/year</p>
              </div>
            </div>
            {medData.upcoming && (
              <div className="bg-[#F0F4FF] border border-[#4A90D9]/15 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-[#4A90D9] uppercase mb-0.5">Coming Soon</p>
                <p className="text-xs text-[#4A90D9]/80 leading-relaxed">{medData.upcoming}</p>
              </div>
            )}
          </div>

          {/* Manufacturer Savings Card */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E8F0EB] flex items-center justify-center shrink-0">
                <span className="text-lg">💳</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#1E1E1C]">{medData.savings_card.name}</h3>
                <p className="text-xs text-[#2D5A3D] font-semibold mt-0.5">{medData.savings_card.copay}</p>
                <p className="text-xs text-[#8B8B83] mt-1 leading-relaxed">{medData.savings_card.details}</p>
                <a href={medData.savings_card.url} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-3 bg-[#2D5A3D] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#3A7A52] transition-colors">
                  Apply Now →
                </a>
              </div>
            </div>
          </div>

          {/* Patient Assistance */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFF0E5] flex items-center justify-center shrink-0">
                <span className="text-lg">🏥</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#1E1E1C]">{medData.patient_assistance.name}</h3>
                <p className="text-xs text-[#C4742B] font-semibold mt-0.5">Potentially free medication</p>
                <p className="text-xs text-[#8B8B83] mt-1 leading-relaxed">{medData.patient_assistance.details}</p>
                <a href={medData.patient_assistance.url} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-3 bg-[#F5F5F2] text-[#1E1E1C] px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#EDEDEA] transition-colors">
                  Check Eligibility →
                </a>
              </div>
            </div>
          </div>

          {/* Self-Pay Option */}
          {medData.self_pay && (
            <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F0F4FF] flex items-center justify-center shrink-0">
                  <span className="text-lg">💊</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-[#1E1E1C]">{medData.self_pay.name} — Self-Pay</h3>
                  <p className="text-xs text-[#4A90D9] font-semibold mt-0.5">{medData.self_pay.price}</p>
                  <p className="text-xs text-[#8B8B83] mt-1 leading-relaxed">{medData.self_pay.details}</p>
                  <a href={medData.self_pay.url} target="_blank" rel="noopener noreferrer"
                    className="inline-block mt-3 bg-[#F5F5F2] text-[#1E1E1C] px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#EDEDEA] transition-colors">
                    View Options →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Compare Pharmacy Prices */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <h3 className="text-sm font-bold text-[#1E1E1C] mb-3">Compare Pharmacy Prices</h3>
            <div className="space-y-2">
              {medData.pharmacy_compare.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-[#F5F5F2] rounded-lg hover:bg-[#EDEDEA] transition-colors">
                  <span className="text-sm text-[#1E1E1C] font-medium">{p.name}</span>
                  <svg className="w-4 h-4 text-[#B0B0A8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* HSA/FSA reminder */}
          <div className="bg-[#F5F5F2] rounded-xl p-4 flex items-start gap-3">
            <span className="text-lg">💡</span>
            <div>
              <p className="text-sm font-semibold text-[#1E1E1C]">Don&apos;t forget HSA/FSA</p>
              <p className="text-xs text-[#6B6B65] mt-0.5 leading-relaxed">GLP-1 medications are HSA/FSA eligible. Paying with pre-tax dollars saves you 20-35% on top of any other discounts.</p>
            </div>
          </div>
        </>)}

        {/* ══════════ FILING TOOLS ══════════ */}
        {activeView === 'tools' && (<>
          {/* Prior Auth Helper */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-[#E8F0EB] flex items-center justify-center"><span className="text-sm">📋</span></div>
              <h3 className="text-sm font-bold text-[#1E1E1C]">Prior Authorization Helper</h3>
            </div>
            <p className="text-xs text-[#6B6B65] leading-relaxed mb-3">If your insurance requires prior authorization, your doctor needs to submit clinical justification. Nova can help you prepare the information your doctor needs.</p>
            <div className="bg-[#F5F5F2] rounded-lg p-3 space-y-2 mb-3">
              <p className="text-[10px] text-[#8B8B83] uppercase font-semibold">What your doctor typically needs:</p>
              <p className="text-xs text-[#6B6B65]">• Your BMI (current and history)</p>
              <p className="text-xs text-[#6B6B65]">• Comorbidities (diabetes, hypertension, sleep apnea, etc.)</p>
              <p className="text-xs text-[#6B6B65]">• Previous weight loss attempts (diets, programs, other medications)</p>
              <p className="text-xs text-[#6B6B65]">• Lab results supporting medical necessity</p>
            </div>
            <button onClick={() => { setActiveView('nova'); setChatInput('Help me prepare information for a prior authorization for ' + med) }}
              className="w-full bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors">
              Prepare with Nova
            </button>
          </div>

          {/* Insurance Appeal Generator */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-[#FFF0E5] flex items-center justify-center"><span className="text-sm">📝</span></div>
              <h3 className="text-sm font-bold text-[#1E1E1C]">Insurance Denial Appeal</h3>
            </div>
            <p className="text-xs text-[#6B6B65] leading-relaxed mb-3">Denied coverage? You have the right to appeal. Nova can help you draft an appeal letter with the clinical language and references that insurance reviewers look for.</p>
            <button onClick={() => { setActiveView('nova'); setChatInput('Help me draft an insurance appeal letter. My insurance denied coverage for ' + med) }}
              className="w-full bg-[#C4742B] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#D4843B] transition-colors">
              Draft Appeal Letter
            </button>
          </div>

          {/* Step Therapy Exception */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-[#F0F4FF] flex items-center justify-center"><span className="text-sm">⚖️</span></div>
              <h3 className="text-sm font-bold text-[#1E1E1C]">Step Therapy Exception</h3>
            </div>
            <p className="text-xs text-[#6B6B65] leading-relaxed mb-3">Some insurers require trying cheaper medications first (step therapy). Your doctor can request an exception if there&apos;s clinical justification for starting directly on {med}.</p>
            <button onClick={() => { setActiveView('nova'); setChatInput('My insurance requires step therapy before approving ' + med + '. Help me understand how to get an exception.') }}
              className="w-full bg-[#F5F5F2] text-[#1E1E1C] py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#EDEDEA] transition-colors">
              Learn More
            </button>
          </div>

          {/* Switching Medications */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-[#E8F0EB] flex items-center justify-center"><span className="text-sm">🔄</span></div>
              <h3 className="text-sm font-bold text-[#1E1E1C]">Should You Switch Medications?</h3>
            </div>
            <p className="text-xs text-[#6B6B65] leading-relaxed mb-3">Sometimes a different GLP-1 is covered by your insurance when yours isn&apos;t. Or a newer option like Foundayo (oral, $149-299/mo) could save you money. Nova can walk you through the tradeoffs.</p>
            <button onClick={() => { setActiveView('nova'); setChatInput('I\'m on ' + med + ' and want to know if switching to a different GLP-1 could save me money. What are my options?') }}
              className="w-full bg-[#F5F5F2] text-[#1E1E1C] py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#EDEDEA] transition-colors">
              Explore Options with Nova
            </button>
          </div>

          {/* Quick Links */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl overflow-hidden">
            <p className="px-5 pt-4 pb-2 text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Quick Links</p>
            {[
              { label: 'Medicare GLP-1 Coverage Info', url: 'https://www.medicare.gov' },
              { label: 'NeedyMeds — Discount Drug Programs', url: 'https://www.needymeds.org' },
              { label: 'RxAssist — Patient Assistance Finder', url: 'https://www.rxassist.org' },
              { label: 'Benefits Checkup — Benefits Finder', url: 'https://www.benefitscheckup.org' },
            ].map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F5F5F2] transition-colors border-t border-[#F5F5F2]">
                <span className="text-sm text-[#1E1E1C]">{link.label}</span>
                <svg className="w-4 h-4 text-[#B0B0A8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
        </>)}

        {/* ══════════ ASK NOVA ══════════ */}
        {activeView === 'nova' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
            <div ref={chatRef} className="flex-1 overflow-y-auto space-y-3 mb-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-[#E8F0EB] flex items-center justify-center mx-auto mb-3"><span className="text-2xl">🌿</span></div>
                  <p className="text-sm font-semibold text-[#1E1E1C]">Nova Savings Advisor</p>
                  <p className="text-xs text-[#8B8B83] mt-1 max-w-xs mx-auto">Get help with savings cards, appeals, prior auth, switching meds, and reducing your costs.</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4 px-4">
                    {SAVINGS_PROMPTS.map(q => (
                      <button key={q} onClick={() => setChatInput(q)}
                        className="text-[11px] px-3 py-2 rounded-full border border-[#EDEDEA] text-[#6B6B65] cursor-pointer hover:border-[#2D5A3D] hover:text-[#2D5A3D] transition-colors text-left">{q}</button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'nova' && <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0 mr-2 mt-1"><span className="text-xs text-white">N</span></div>}
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#2D5A3D] text-white rounded-br-md' : 'bg-white border border-[#EDEDEA] text-[#1E1E1C] rounded-bl-md shadow-sm'}`}>{msg.content}</div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0 mr-2 mt-1"><span className="text-xs text-white">N</span></div>
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
              <input type="text" autoComplete="off" value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask about savings, insurance, appeals..."
                className="flex-1 px-4 py-3 rounded-xl border border-[#EDEDEA] bg-white text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]" />
              <VoiceInput onResult={(text) => setChatInput(text)} />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                className="bg-[#2D5A3D] text-white px-5 py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-30">Send</button>
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
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">What do you pay per month? ($)</label>
              <input type="number" autoComplete="off" value={monthlyCost} onChange={e => setMonthlyCost(e.target.value)} placeholder="e.g. 250"
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-[16px] text-[#1E1E1C] outline-none focus:border-[#2D5A3D]" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider mb-2 block">Do you have insurance coverage for {med}?</label>
              <div className="flex gap-2">
                <button onClick={() => setHasInsurance(true)} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${hasInsurance === true ? 'bg-[#2D5A3D] text-white' : 'bg-[#F5F5F2] text-[#8B8B83]'}`}>Yes</button>
                <button onClick={() => setHasInsurance(false)} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${hasInsurance === false ? 'bg-[#2D5A3D] text-white' : 'bg-[#F5F5F2] text-[#8B8B83]'}`}>No</button>
              </div>
            </div>
            <button onClick={async () => {
              if (!userId) return
              const payload = { user_id: userId, medication: med, monthly_cost: parseFloat(monthlyCost) || 0, has_insurance: hasInsurance ?? false, updated_at: new Date().toISOString() }
              if (savingsProfile) { await supabase.from('savings_profiles').update(payload).eq('id', savingsProfile.id) }
              else { await supabase.from('savings_profiles').insert(payload) }
              setShowSetup(false); window.location.reload()
            }}
              className="w-full bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer">
              Save
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EDEDEA] px-4 py-2 flex justify-around z-50">
        <a href="/dashboard" className="flex flex-col items-center gap-0.5 text-[#B0B0A8]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4"/></svg><span className="text-[10px]">Home</span></a>
        <a href="/maintenance" className="flex flex-col items-center gap-0.5 text-[#B0B0A8]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg><span className="text-[10px]">Transition</span></a>
        <a href="/chat" className="flex flex-col items-center gap-0.5 text-[#B0B0A8]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg><span className="text-[10px]">Nova</span></a>
        <a href="/savings" className="flex flex-col items-center gap-0.5 text-[#2D5A3D]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span className="text-[10px] font-semibold">Savings</span></a>
        <a href="/settings" className="flex flex-col items-center gap-0.5 text-[#B0B0A8]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span className="text-[10px]">Settings</span></a>
      </nav>
    </div>
  )
}
