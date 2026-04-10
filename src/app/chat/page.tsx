'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

interface Message { role: 'user' | 'assistant'; content: string }
interface UserProfile { name?: string; medication?: string; dose?: string; start_date?: string; current_weight?: string; goal_weight?: string; primary_goal?: string; biggest_challenge?: string; exercise_level?: string }

export default function Chat() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userLogs, setUserLogs] = useState<Record<string, unknown> | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!profile) { router.push('/onboarding'); return }
      setUserProfile(profile)

      await refreshLogs(user.id, profile)

      const { data: savedMessages } = await supabase.from('messages').select('role, content').eq('user_id', user.id).order('created_at', { ascending: true }).limit(50)

      const name = profile.name || ''
      if (savedMessages && savedMessages.length > 0) {
        const history = savedMessages.map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        setMessages([...history, { role: 'assistant', content: `Welcome back${name ? `, ${name}` : ''}! 👋 I can see your latest logs. What would you like to work on today?` }])
      } else {
        setMessages([{
          role: 'assistant',
          content: `Hey${name ? ` ${name}` : ''}! I'm Nova, your AI wellness coach 👋 ${
            profile.medication ? `I see you're on ${profile.medication}${profile.dose ? ` at ${profile.dose}` : ''} — I've got you covered.` : "I'm here to help with your GLP-1 journey."
          }\n\n${profile.biggest_challenge ? `You mentioned ${profile.biggest_challenge.toLowerCase()} is your biggest challenge — let's work on that together. ` : ''}What would you like to work on today?`
        }])
      }
      setIsInitialized(true)
    }
    init()
  }, [router])

  async function refreshLogs(uid: string, profile: UserProfile) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const [weights, meds, foods, water, effects] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('user_id', uid).order('logged_at', { ascending: false }).limit(5),
      supabase.from('medication_logs').select('*').eq('user_id', uid).order('logged_at', { ascending: false }).limit(1),
      supabase.from('food_logs').select('*').eq('user_id', uid).gte('logged_at', todayISO).order('logged_at', { ascending: true }),
      supabase.from('water_logs').select('*').eq('user_id', uid).gte('logged_at', todayISO),
      supabase.from('side_effect_logs').select('*').eq('user_id', uid).order('logged_at', { ascending: false }).limit(5),
    ])

    const latestWeight = weights.data?.[0]?.weight || null
    const startWeight = profile?.current_weight ? parseFloat(profile.current_weight) : null
    const goalWeight = profile?.goal_weight ? parseFloat(profile.goal_weight) : null
    const proteinTarget = goalWeight ? Math.round(goalWeight * 0.8) : null

    const todayFoods = foods.data || []
    const todayProtein = todayFoods.reduce((s: number, f: { protein: number }) => s + f.protein, 0)
    const todayCalories = todayFoods.reduce((s: number, f: { calories: number }) => s + f.calories, 0)
    const todayCarbs = todayFoods.reduce((s: number, f: { carbs: number }) => s + f.carbs, 0)
    const todayFat = todayFoods.reduce((s: number, f: { fat: number }) => s + f.fat, 0)
    const todayWaterOz = (water.data || []).reduce((s: number, w: { amount_oz: number }) => s + w.amount_oz, 0)

    const lastMed = meds.data?.[0]
    const lastInjection = lastMed ? {
      date: new Date(lastMed.logged_at).toLocaleDateString(),
      site: lastMed.injection_site,
      daysAgo: Math.floor((Date.now() - new Date(lastMed.logged_at).getTime()) / 86400000)
    } : null

    const recentEffects = (effects.data || []).map((e: { symptom: string; severity: number; logged_at: string }) => ({
      symptom: e.symptom, severity: e.severity, date: new Date(e.logged_at).toLocaleDateString()
    }))

    setUserLogs({
      latestWeight,
      weightChange: startWeight && latestWeight ? Math.round((startWeight - latestWeight) * 10) / 10 : null,
      lastInjection,
      todayNutrition: {
        calories: todayCalories, protein: todayProtein, carbs: todayCarbs, fat: todayFat,
        proteinTarget, proteinRemaining: proteinTarget ? Math.max(0, proteinTarget - todayProtein) : null,
        meals: todayFoods.map((f: { meal_type: string; food_name: string; protein: number; calories: number }) => ({
          meal_type: f.meal_type, food_name: f.food_name, protein: f.protein, calories: f.calories
        }))
      },
      todayWater: todayWaterOz,
      recentSideEffects: recentEffects,
    })
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (inputRef.current) { inputRef.current.style.height = 'auto'; inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px' } }, [input])

  async function saveMessage(role: 'user' | 'assistant', content: string) {
    if (!userId) return
    await supabase.from('messages').insert({ user_id: userId, role, content })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)
    await saveMessage('user', userMessage.content)

    if (userId && userProfile) await refreshLogs(userId, userProfile)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          userProfile: userProfile || undefined,
          userLogs: userLogs || undefined,
        })
      })

      const data = await res.json()
      const content = !res.ok ? (data.error || "I'm having trouble right now.") : data.message
      setMessages([...newMessages, { role: 'assistant', content }])
      await saveMessage('assistant', content)
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: "I'm having trouble connecting. Please try again." }])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) }
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/') }

  const proteinTarget = userProfile?.goal_weight ? `${Math.round(Number(userProfile.goal_weight) * 0.8)}g` : null

  if (!isInitialized) {
    return <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center"><div className="text-center"><div className="w-8 h-8 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-[#9B9B93]">Loading your coaching session...</p></div></div>
  }

  return (
    <div className="flex flex-col h-screen bg-[#FFFBF5]">
      {/* HEADER */}
      <header className="bg-[#2D5A3D] px-4 py-3 flex items-center gap-3 shrink-0">
        <a href="/dashboard" className="text-white/60 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </a>
        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center"><span className="text-lg">🌿</span></div>
        <div>
          <h1 className="text-white font-semibold text-sm leading-tight">Nova</h1>
          <p className="text-white/50 text-xs">AI Wellness Coach</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {proteinTarget && <div className="bg-white/10 px-2.5 py-1 rounded-full hidden sm:block"><span className="text-white/70 text-[10px]">🎯 {proteinTarget}/day</span></div>}
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span className="text-white/40 text-xs">Online</span></div>
          <button onClick={handleLogout} className="text-white/40 hover:text-white text-xs transition-colors cursor-pointer">Log out</button>
        </div>
      </header>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center mr-2 mt-1 shrink-0"><span className="text-xs">🌿</span></div>}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#2D5A3D] text-white rounded-br-md' : 'bg-white border border-black/[0.06] text-[#2A2A28] rounded-bl-md shadow-sm'}`}>{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center mr-2 mt-1 shrink-0"><span className="text-xs">🌿</span></div>
            <div className="bg-white border border-black/[0.06] rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#2D5A3D]/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#2D5A3D]/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#2D5A3D]/30 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* QUICK REPLIES */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {["How's my nutrition today?", "Help me hit my protein goal", "I'm dealing with nausea", "What should I eat for dinner?"].map(s => (
            <button key={s} onClick={() => { setInput(s); setTimeout(() => document.querySelector('form')?.requestSubmit(), 50) }}
              className="bg-[#E8F0EB] text-[#2D5A3D] text-xs font-medium px-3 py-2 rounded-full hover:bg-[#d4e5d9] transition-colors cursor-pointer">{s}</button>
          ))}
        </div>
      )}

      {/* INPUT */}
      <div className="shrink-0 border-t border-black/5 bg-white px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ask Nova anything..." rows={1}
            className="flex-1 resize-none bg-[#F5F5F0] rounded-2xl px-4 py-3 text-sm text-[#1E1E1C] outline-none placeholder:text-[#9B9B93] focus:ring-2 focus:ring-[#2D5A3D]/20 transition-all" />
          <button type="submit" disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-[#2D5A3D] text-white flex items-center justify-center shrink-0 hover:bg-[#3A7A52] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </form>
        <p className="text-center text-[10px] text-[#9B9B93] mt-2">Nova is an AI wellness coach, not a medical professional. Always consult your healthcare provider for medical advice.</p>
      </div>

      {/* BOTTOM NAV */}
      <nav className="shrink-0 bg-white border-t border-black/5 px-4 py-2 flex justify-around">
        <a href="/dashboard" className="flex flex-col items-center gap-0.5 text-[#9B9B93] hover:text-[#2D5A3D] transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
          <span className="text-[10px] font-medium">Home</span>
        </a>
        <a href="/chat" className="flex flex-col items-center gap-0.5 text-[#2D5A3D]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span className="text-[10px] font-semibold">Nova</span>
        </a>
        <a href="#" className="flex flex-col items-center gap-0.5 text-[#9B9B93]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="text-[10px] font-medium">Savings</span>
        </a>
      </nav>
    </div>
  )
}
