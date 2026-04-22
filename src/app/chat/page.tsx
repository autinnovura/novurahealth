'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import VoiceInput from '../components/VoiceInput'

interface Message { role: 'user' | 'assistant'; content: string }

const QUICK_PROMPTS = [
  "What should I eat next?",
  "How's my progress looking?",
  "Help with side effects",
  "Am I hitting my protein?",
  "What should I focus on this week?",
  "Give me a meal plan for today",
]

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin"/></div>}>
      <Chat />
    </Suspense>
  )
}

function Chat() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const autoSentRef = useRef(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Load chat history
      const { data } = await supabase
        .from('messages').select('role, content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50)

      if (data?.length) {
        setMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })))
      }
      setInitialLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || !userId) return
    setInput('')

    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => {
      const updated = [...prev, userMsg]

      // Save user message
      supabase.from('messages').insert({ user_id: userId, role: 'user', content: msg }).then()

      // Fire off the API call
      setLoading(true)
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          messages: updated.map(m => ({ role: m.role, content: m.content })),
        }),
      })
        .then(res => res.json())
        .then(({ message }) => {
          const novaMsg: Message = { role: 'assistant', content: message }
          setMessages(prev2 => [...prev2, novaMsg])
          supabase.from('messages').insert({ user_id: userId, role: 'assistant', content: message }).then()
        })
        .catch(() => {
          setMessages(prev2 => [...prev2, { role: 'assistant', content: "Having trouble connecting. Try again in a sec." }])
        })
        .finally(() => {
          setLoading(false)
          inputRef.current?.focus()
        })

      return updated
    })
  }, [userId, input])

  // Auto-send prompt from URL query param (e.g. ?prompt=What+should+I+eat)
  useEffect(() => {
    if (autoSentRef.current || initialLoading || !userId) return
    const prompt = searchParams.get('prompt')
    if (prompt) {
      autoSentRef.current = true
      sendMessage(prompt)
    }
  }, [initialLoading, userId, searchParams, sendMessage])

  if (initialLoading) {
    return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin"/></div>
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col pb-20">
      {/* Header */}
      <header className="bg-[#2D5A3D] px-5 py-4 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
              <span className="text-lg">🌿</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-base">Nova</h1>
              <p className="text-white/40 text-[10px]">Your personal health coach</p>
            </div>
          </div>
          <button onClick={() => router.push('/dashboard')} className="text-white/40 text-xs hover:text-white/70 cursor-pointer transition-colors">← Back</button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 max-w-2xl mx-auto w-full">
        {messages.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-[#E8F0EB] flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🌿</span>
            </div>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-1">Hey, I'm Nova</h2>
            <p className="text-sm text-[#8B8B83] mb-6 max-w-xs mx-auto">
              I know your data — meals, weight, meds, all of it. Ask me anything about your journey.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_PROMPTS.map(q => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="text-xs px-3.5 py-2 rounded-full border border-[#EDEDEA] bg-white text-[#6B6B65] cursor-pointer hover:border-[#2D5A3D] hover:text-[#2D5A3D] transition-colors shadow-sm">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center shrink-0 mr-2 mt-1">
                  <span className="text-xs">🌿</span>
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#2D5A3D] text-white rounded-br-md'
                  : 'bg-white border border-[#EDEDEA] text-[#1E1E1C] rounded-bl-md shadow-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
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
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 bg-white border-t border-[#EDEDEA] px-4 py-3 max-w-2xl mx-auto w-full mb-16">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask Nova anything..."
            className="flex-1 px-4 py-3 rounded-xl border border-[#EDEDEA] bg-[#FAFAF7] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"
          />
          <VoiceInput onResult={(text) => setInput(text)} />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
            className="bg-[#2D5A3D] text-white px-5 py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-30 transition-opacity active:scale-95">
            Send
          </button>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EDEDEA] px-4 py-2 flex justify-around z-50">
        <a href="/dashboard" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4"/></svg><span className="text-[10px] font-medium">Home</span></a>
        <a href="/maintenance" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg><span className="text-[10px] font-medium">Transition</span></a>
        <a href="/chat" className="flex flex-col items-center gap-0.5 text-[#2D5A3D]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg><span className="text-[10px] font-semibold">Nova</span></a>
        <a href="/savings" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span className="text-[10px] font-medium">Savings</span></a>
        <a href="/settings" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span className="text-[10px] font-medium">Settings</span></a>
      </nav>
    </div>
  )
}
