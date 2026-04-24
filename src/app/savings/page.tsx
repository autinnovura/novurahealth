'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import VoiceInput from '../components/VoiceInput'
import BottomNav from '../components/BottomNav'
import {
  CreditCard, Building2, Pill, ExternalLink, Lightbulb,
  FileText, Scale, RefreshCw, ArrowRight, DollarSign, Send, Leaf,
  ChevronRight,
} from 'lucide-react'

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

  if (loading) return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="space-y-4 w-full max-w-2xl px-4">
        <div className="h-32 rounded-3xl bg-gradient-to-r from-[#EAF2EB] to-[#F0F7F2] animate-pulse" />
        <div className="h-48 rounded-3xl bg-white border border-[#EAF2EB] animate-pulse" />
        <div className="h-40 rounded-3xl bg-white border border-[#EAF2EB] animate-pulse" />
        <div className="h-40 rounded-3xl bg-white border border-[#EAF2EB] animate-pulse" />
      </div>
    </div>
  )

  const med = profile?.medication || 'Ozempic'
  const medData = MED_SAVINGS[med] || DEFAULT_SAVINGS
  const currentCost = savingsProfile?.monthly_cost || medData.brand_cost
  const yearlyCost = currentCost * 12

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ fontFamily: 'var(--font-inter)', paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <header className="bg-gradient-to-br from-[#1F4B32] via-[#2D6B45] to-[#1F4B32] px-5 pt-14 pb-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)' }}>Your savings</h1>
          <p className="text-white/50 text-sm mt-1">Save money on {med}</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white/80 backdrop-blur-md border-b border-[#EAF2EB] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex">
          {([
            { id: 'savings' as const, label: 'Your Savings' },
            { id: 'tools' as const, label: 'Filing Tools' },
            { id: 'nova' as const, label: 'Ask Nova' },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveView(tab.id)}
              className={`flex-1 py-3.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer ${activeView === tab.id ? 'text-[#1F4B32] border-b-2 border-[#7FFFA4]' : 'text-[#6B7A72]/50'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ══════════ YOUR SAVINGS ══════════ */}
        {activeView === 'savings' && (<>
          {/* Cost snapshot */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-[#0D1F16]">{med} — Cost Snapshot</h2>
              <button onClick={() => setShowSetup(true)} className="text-xs text-[#1F4B32] font-semibold cursor-pointer hover:text-[#2D6B45] transition-all duration-300">{savingsProfile ? 'Edit' : 'Set up'}</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#FFF4E8] rounded-2xl p-4">
                <p className="text-[9px] text-[#C4742B] uppercase font-semibold tracking-wider">You Pay</p>
                <p className="text-[36px] font-bold text-[#C4742B] leading-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>${currentCost.toLocaleString()}</p>
                <p className="text-xs text-[#C4742B]/60">/month &middot; ${yearlyCost.toLocaleString()}/yr</p>
              </div>
              <div className="bg-[#EAF2EB] rounded-2xl p-4">
                <p className="text-[9px] text-[#1F4B32] uppercase font-semibold tracking-wider">Brand List Price</p>
                <p className="text-[36px] font-bold text-[#1F4B32] leading-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>${medData.brand_cost.toLocaleString()}</p>
                <p className="text-xs text-[#1F4B32]/60">/month &middot; ${(medData.brand_cost * 12).toLocaleString()}/yr</p>
              </div>
            </div>
            {medData.upcoming && (
              <div className="bg-[#F0F4FF] border border-[#4A90D9]/15 rounded-2xl p-3.5">
                <p className="text-[10px] font-semibold text-[#4A90D9] uppercase mb-0.5 tracking-wider">Coming Soon</p>
                <p className="text-xs text-[#4A90D9]/80 leading-relaxed">{medData.upcoming}</p>
              </div>
            )}
          </div>

          {/* Manufacturer Savings Card */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF2EB] flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-[#1F4B32]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#0D1F16]">{medData.savings_card.name}</h3>
                <p className="text-xs text-[#1F4B32] font-semibold mt-0.5">{medData.savings_card.copay}</p>
                <p className="text-xs text-[#6B7A72] mt-1.5 leading-relaxed">{medData.savings_card.details}</p>
                <a href={medData.savings_card.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white px-5 py-2.5 rounded-2xl text-xs font-semibold hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300">
                  Apply Now <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Patient Assistance */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF4E8] flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-[#C4742B]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#0D1F16]">{medData.patient_assistance.name}</h3>
                <p className="text-xs text-[#C4742B] font-semibold mt-0.5">Potentially free medication</p>
                <p className="text-xs text-[#6B7A72] mt-1.5 leading-relaxed">{medData.patient_assistance.details}</p>
                <a href={medData.patient_assistance.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 bg-[#F5F8F3] text-[#0D1F16] px-5 py-2.5 rounded-2xl text-xs font-semibold hover:bg-[#EAF2EB] transition-all duration-300">
                  Check Eligibility <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Self-Pay Option */}
          {medData.self_pay && (
            <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#F0F4FF] flex items-center justify-center shrink-0">
                  <Pill className="w-5 h-5 text-[#4A90D9]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-[#0D1F16]">{medData.self_pay.name} — Self-Pay</h3>
                  <p className="text-xs text-[#4A90D9] font-semibold mt-0.5">{medData.self_pay.price}</p>
                  <p className="text-xs text-[#6B7A72] mt-1.5 leading-relaxed">{medData.self_pay.details}</p>
                  <a href={medData.self_pay.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 bg-[#F5F8F3] text-[#0D1F16] px-5 py-2.5 rounded-2xl text-xs font-semibold hover:bg-[#EAF2EB] transition-all duration-300">
                    View Options <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Compare Pharmacy Prices */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)]">
            <h3 className="text-sm font-bold text-[#0D1F16] mb-3">Compare Pharmacy Prices</h3>
            <div className="space-y-2">
              {medData.pharmacy_compare.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 bg-[#F5F8F3] rounded-2xl hover:bg-[#EAF2EB] transition-all duration-300">
                  <span className="text-sm text-[#0D1F16] font-medium">{p.name}</span>
                  <ExternalLink className="w-4 h-4 text-[#6B7A72]/50" />
                </a>
              ))}
            </div>
          </div>

          {/* HSA/FSA reminder */}
          <div className="bg-gradient-to-r from-[#EAF2EB] to-[#F0F7F2] rounded-3xl p-5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-white/60 flex items-center justify-center shrink-0">
              <Lightbulb className="w-5 h-5 text-[#1F4B32]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0D1F16]">Don&apos;t forget HSA/FSA</p>
              <p className="text-xs text-[#6B7A72] mt-0.5 leading-relaxed">GLP-1 medications are HSA/FSA eligible. Paying with pre-tax dollars saves you 20-35% on top of any other discounts.</p>
            </div>
          </div>
        </>)}

        {/* ══════════ FILING TOOLS ══════════ */}
        {activeView === 'tools' && (<>
          {/* Prior Auth Helper */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#EAF2EB] flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#1F4B32]" />
              </div>
              <h3 className="text-sm font-bold text-[#0D1F16]">Prior Authorization Helper</h3>
            </div>
            <p className="text-xs text-[#6B7A72] leading-relaxed mb-3">If your insurance requires prior authorization, your doctor needs to submit clinical justification. Nova can help you prepare the information your doctor needs.</p>
            <div className="bg-[#F5F8F3] rounded-2xl p-3.5 space-y-2 mb-4">
              <p className="text-[10px] text-[#6B7A72] uppercase font-semibold tracking-wider">What your doctor typically needs:</p>
              <p className="text-xs text-[#6B7A72]">• Your BMI (current and history)</p>
              <p className="text-xs text-[#6B7A72]">• Comorbidities (diabetes, hypertension, sleep apnea, etc.)</p>
              <p className="text-xs text-[#6B7A72]">• Previous weight loss attempts (diets, programs, other medications)</p>
              <p className="text-xs text-[#6B7A72]">• Lab results supporting medical necessity</p>
            </div>
            <button onClick={() => { setActiveView('nova'); setChatInput('Help me prepare information for a prior authorization for ' + med) }}
              className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300">
              Prepare with Nova
            </button>
          </div>

          {/* Insurance Appeal Generator */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF4E8] flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#C4742B]" />
              </div>
              <h3 className="text-sm font-bold text-[#0D1F16]">Insurance Denial Appeal</h3>
            </div>
            <p className="text-xs text-[#6B7A72] leading-relaxed mb-3">Denied coverage? You have the right to appeal. Nova can help you draft an appeal letter with the clinical language and references that insurance reviewers look for.</p>
            <button onClick={() => { setActiveView('nova'); setChatInput('Help me draft an insurance appeal letter. My insurance denied coverage for ' + med) }}
              className="w-full bg-gradient-to-r from-[#C4742B] to-[#D4843B] text-white py-3 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(196,116,43,0.4)] transition-all duration-300">
              Draft Appeal Letter
            </button>
          </div>

          {/* Step Therapy Exception */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F0F4FF] flex items-center justify-center">
                <Scale className="w-5 h-5 text-[#4A90D9]" />
              </div>
              <h3 className="text-sm font-bold text-[#0D1F16]">Step Therapy Exception</h3>
            </div>
            <p className="text-xs text-[#6B7A72] leading-relaxed mb-3">Some insurers require trying cheaper medications first (step therapy). Your doctor can request an exception if there&apos;s clinical justification for starting directly on {med}.</p>
            <button onClick={() => { setActiveView('nova'); setChatInput('My insurance requires step therapy before approving ' + med + '. Help me understand how to get an exception.') }}
              className="w-full bg-[#F5F8F3] text-[#0D1F16] py-3 rounded-2xl text-sm font-semibold cursor-pointer hover:bg-[#EAF2EB] transition-all duration-300">
              Learn More
            </button>
          </div>

          {/* Switching Medications */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(31,75,50,0.15)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#EAF2EB] flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-[#1F4B32]" />
              </div>
              <h3 className="text-sm font-bold text-[#0D1F16]">Should You Switch Medications?</h3>
            </div>
            <p className="text-xs text-[#6B7A72] leading-relaxed mb-3">Sometimes a different GLP-1 is covered by your insurance when yours isn&apos;t. Or a newer option like Foundayo (oral, $149-299/mo) could save you money. Nova can walk you through the tradeoffs.</p>
            <button onClick={() => { setActiveView('nova'); setChatInput('I\'m on ' + med + ' and want to know if switching to a different GLP-1 could save me money. What are my options?') }}
              className="w-full bg-[#F5F8F3] text-[#0D1F16] py-3 rounded-2xl text-sm font-semibold cursor-pointer hover:bg-[#EAF2EB] transition-all duration-300">
              Explore Options with Nova
            </button>
          </div>

          {/* Quick Links */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] overflow-hidden">
            <p className="px-6 pt-5 pb-2 text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Quick Links</p>
            {[
              { label: 'Medicare GLP-1 Coverage Info', url: 'https://www.medicare.gov' },
              { label: 'NeedyMeds — Discount Drug Programs', url: 'https://www.needymeds.org' },
              { label: 'RxAssist — Patient Assistance Finder', url: 'https://www.rxassist.org' },
              { label: 'Benefits Checkup — Benefits Finder', url: 'https://www.benefitscheckup.org' },
            ].map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between px-6 py-4 hover:bg-[#F5F8F3] transition-all duration-300 border-t border-[#EAF2EB]">
                <span className="text-sm text-[#0D1F16]">{link.label}</span>
                <ChevronRight className="w-4 h-4 text-[#6B7A72]/40" />
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
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center mx-auto mb-3 shadow-[0_4px_16px_-4px_rgba(31,75,50,0.3)]">
                    <Leaf className="w-6 h-6 text-[#7FFFA4]" />
                  </div>
                  <p className="text-sm font-semibold text-[#0D1F16]">Nova Savings Advisor</p>
                  <p className="text-xs text-[#6B7A72] mt-1 max-w-xs mx-auto">Get help with savings cards, appeals, prior auth, switching meds, and reducing your costs.</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4 px-4">
                    {SAVINGS_PROMPTS.map(q => (
                      <button key={q} onClick={() => setChatInput(q)}
                        className="text-[11px] px-3.5 py-2 rounded-full border border-[#EAF2EB] text-[#6B7A72] cursor-pointer hover:border-[#1F4B32] hover:text-[#1F4B32] transition-all duration-300 text-left">{q}</button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'nova' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center shrink-0 mr-2 mt-1">
                      <Leaf className="w-3.5 h-3.5 text-[#7FFFA4]" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white rounded-br-md' : 'bg-white border border-[#EAF2EB] text-[#0D1F16] rounded-bl-md shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]'}`}>{msg.content}</div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center shrink-0 mr-2 mt-1">
                    <Leaf className="w-3.5 h-3.5 text-[#7FFFA4]" />
                  </div>
                  <div className="bg-white border border-[#EAF2EB] px-4 py-3 rounded-2xl rounded-bl-md shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#7FFFA4] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[#7FFFA4] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[#7FFFA4] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 bg-white/70 backdrop-blur-xl border border-[#EAF2EB] rounded-2xl p-2 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <input type="text"
                name="savings-message"
                autoComplete="off"
                autoCorrect="on"
                autoCapitalize="sentences"
                spellCheck={true}
                data-form-type="other"
                data-1p-ignore="true"
                data-lpignore="true"
                value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask about savings, insurance, appeals..."
                className="flex-1 px-3 py-2.5 bg-transparent text-sm text-[#0D1F16] outline-none placeholder:text-[#6B7A72]/40" />
              <VoiceInput onResult={(text) => setChatInput(text)} />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                className="bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-30 hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Setup modal */}
      {showSetup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setShowSetup(false) }}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-[0_24px_80px_-16px_rgba(31,75,50,0.2)] animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-[#0D1F16]">Your Cost Info</h2>
              <button onClick={() => setShowSetup(false)} className="text-[#6B7A72] hover:text-[#0D1F16] cursor-pointer text-lg transition-all duration-300">✕</button>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">What do you pay per month? ($)</label>
              <input type="number" autoComplete="off" value={monthlyCost} onChange={e => setMonthlyCost(e.target.value)} placeholder="e.g. 250"
                className="w-full mt-1.5 px-4 py-3 rounded-2xl border border-[#EAF2EB] text-[16px] text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2 block">Do you have insurance coverage for {med}?</label>
              <div className="flex gap-2">
                <button onClick={() => setHasInsurance(true)} className={`flex-1 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer transition-all duration-300 ${hasInsurance === true ? 'bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white' : 'bg-[#F5F8F3] text-[#6B7A72]'}`}>Yes</button>
                <button onClick={() => setHasInsurance(false)} className={`flex-1 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer transition-all duration-300 ${hasInsurance === false ? 'bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white' : 'bg-[#F5F8F3] text-[#6B7A72]'}`}>No</button>
              </div>
            </div>
            <button onClick={async () => {
              if (!userId) return
              const payload = { user_id: userId, medication: med, monthly_cost: parseFloat(monthlyCost) || 0, has_insurance: hasInsurance ?? false, updated_at: new Date().toISOString() }
              if (savingsProfile) { await supabase.from('savings_profiles').update(payload).eq('id', savingsProfile.id) }
              else { await supabase.from('savings_profiles').insert(payload) }
              setShowSetup(false); window.location.reload()
            }}
              className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300">
              Save
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
