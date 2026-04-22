'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import VoiceInput from '../components/VoiceInput'
import BottomNav from '../components/BottomNav'
import { Send, ArrowLeft, Leaf, Sparkles } from 'lucide-react'

interface Message { role: 'user' | 'assistant'; content: string }

const QUICK_ACTIONS = [
  { emoji: '🍽️', label: 'What should I eat?', prompt: 'What should I eat right now?' },
  { emoji: '💉', label: 'Log injection', prompt: 'I just took my injection' },
  { emoji: '⚖️', label: 'Log weight', prompt: 'Log my weight' },
  { emoji: '📊', label: "How's my progress?", prompt: 'How does my progress look?' },
  { emoji: '🥤', label: 'Protein ideas', prompt: 'Give me high protein snack ideas' },
]

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center" style={{ fontFamily: 'var(--font-inter)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-48 rounded-2xl bg-gradient-to-r from-[#EAF2EB] via-[#F5F8F3] to-[#EAF2EB] animate-pulse" />
          <div className="h-4 w-32 rounded-xl bg-gradient-to-r from-[#EAF2EB] via-[#F5F8F3] to-[#EAF2EB] animate-pulse" />
          <div className="h-4 w-24 rounded-xl bg-gradient-to-r from-[#EAF2EB] via-[#F5F8F3] to-[#EAF2EB] animate-pulse" />
        </div>
      </div>
    }>
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
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center" style={{ fontFamily: 'var(--font-inter)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-48 rounded-2xl bg-gradient-to-r from-[#EAF2EB] via-[#F5F8F3] to-[#EAF2EB] animate-pulse" />
          <div className="h-4 w-32 rounded-xl bg-gradient-to-r from-[#EAF2EB] via-[#F5F8F3] to-[#EAF2EB] animate-pulse" />
          <div className="h-4 w-24 rounded-xl bg-gradient-to-r from-[#EAF2EB] via-[#F5F8F3] to-[#EAF2EB] animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col pb-24" style={{ fontFamily: 'var(--font-inter)' }}>
      {/* Header */}
      <header className="relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-[#F5F8F3] to-[#EAF2EB]" />
        <div className="relative px-5 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
                <Leaf className="w-5 h-5 text-[#7FFFA4]" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-[#0D1F16] font-semibold text-base">Nova</h1>
                <p className="text-[#6B7A72] text-[10px]">Your personal health coach</p>
              </div>
            </div>
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-[#6B7A72] text-xs hover:text-[#0D1F16] cursor-pointer transition-all duration-300">
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
              Back
            </button>
          </div>
        </div>
        <div className="relative h-px bg-gradient-to-r from-transparent via-[#EAF2EB] to-transparent" />
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 max-w-2xl mx-auto w-full">
        {messages.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center mx-auto mb-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <Sparkles className="w-7 h-7 text-[#7FFFA4]" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-[#0D1F16] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
              Hey, what&apos;s on your mind?
            </h2>
            <p className="text-sm text-[#6B7A72] mb-8 max-w-xs mx-auto leading-relaxed">
              I know your data — meals, weight, meds, all of it. Ask me anything about your journey.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_ACTIONS.map(q => (
                <button key={q.label} onClick={() => sendMessage(q.prompt)}
                  className="text-xs px-4 py-2.5 rounded-2xl backdrop-blur-md bg-white/60 border border-white/80 text-[#0D1F16] cursor-pointer hover:bg-white/90 hover:shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] transition-all duration-300 flex items-center gap-1.5">
                  <span>{q.emoji}</span> {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center shrink-0 mr-2 mt-1">
                  <Leaf className="w-3.5 h-3.5 text-[#7FFFA4]" strokeWidth={2} />
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white rounded-3xl rounded-br-md'
                  : 'bg-white border border-[#EAF2EB] text-[#0D1F16] rounded-3xl rounded-bl-md shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center shrink-0 mr-2 mt-1">
                <Leaf className="w-3.5 h-3.5 text-[#7FFFA4]" strokeWidth={2} />
              </div>
              <div className="bg-white border border-[#EAF2EB] px-4 py-3 rounded-3xl rounded-bl-md shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#7FFFA4] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#7FFFA4] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#7FFFA4] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 bg-white/85 backdrop-blur-xl border-t border-[#EAF2EB] px-4 py-3 max-w-2xl mx-auto w-full">
        {messages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {QUICK_ACTIONS.map(q => (
              <button key={q.label} onClick={() => sendMessage(q.prompt)} disabled={loading}
                className="shrink-0 text-[11px] px-3 py-1.5 rounded-2xl backdrop-blur-md bg-white/60 border border-white/80 text-[#0D1F16] cursor-pointer hover:bg-white/90 hover:shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] transition-all duration-300 disabled:opacity-40 flex items-center gap-1">
                <span>{q.emoji}</span> {q.label}
              </button>
            ))}
          </div>
        )}
        <form autoComplete="off" onSubmit={e => { e.preventDefault(); sendMessage() }} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            name="nova-message"
            autoComplete="off"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck={true}
            data-form-type="other"
            data-1p-ignore="true"
            data-lpignore="true"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="Ask Nova anything..."
            className="flex-1 px-4 py-3 rounded-3xl border border-[#EAF2EB] bg-[#FAFAF7] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/50 shadow-[inset_0_1px_3px_rgba(31,75,50,0.04)] transition-all duration-300"
          />
          <VoiceInput onResult={(text) => setInput(text)} />
          <button type="submit" disabled={loading || !input.trim()}
            className={`px-5 py-3 rounded-3xl text-sm font-semibold cursor-pointer transition-all duration-300 active:scale-95 text-white ${
              input.trim()
                ? 'bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] shadow-[0_4px_24px_-8px_rgba(31,75,50,0.3)]'
                : 'bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] opacity-30'
            }`}>
            <Send className="w-4 h-4" strokeWidth={2} />
          </button>
        </form>
      </div>

      {/* Bottom nav */}
      <BottomNav />
    </div>
  )
}
