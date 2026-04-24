'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import VoiceInput from '../components/VoiceInput'
import BottomNav from '../components/BottomNav'
import { Send, ArrowLeft, Leaf, Sparkles, Plus, BookOpen, Pin, Clock, X } from 'lucide-react'

interface Message { role: 'user' | 'assistant'; content: string; id?: string; is_pinned?: boolean }
interface ArchivedConversation { id: string; preview: string; message_count: number; created_at: string }

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
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [messageCount, setMessageCount] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [archivedConversations, setArchivedConversations] = useState<ArchivedConversation[]>([])
  const [pinningId, setPinningId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const autoSentRef = useRef(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Fetch active conversation
      const convRes = await fetch('/api/conversations?coach=nova&archived=false')
      const convData = await convRes.json()
      const activeConv = convData.conversations?.[0]

      if (activeConv) {
        setConversationId(activeConv.id)
        setSummary(activeConv.summary)
        setMessageCount(activeConv.message_count)

        // Load messages for this conversation
        const { data } = await supabase
          .from('messages').select('id, role, content, is_pinned')
          .eq('conversation_id', activeConv.id)
          .order('created_at', { ascending: true })
          .limit(50)

        if (data?.length) {
          setMessages(data.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            id: m.id,
            is_pinned: m.is_pinned,
          })))
        }
      }
      setInitialLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const handler = () => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
    window.visualViewport?.addEventListener('resize', handler)
    return () => window.visualViewport?.removeEventListener('resize', handler)
  }, [])

  async function startNewConversation() {
    if (!userId) return
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coach: 'nova' }),
    })
    const data = await res.json()
    if (data.conversation) {
      setConversationId(data.conversation.id)
      setMessages([])
      setSummary(null)
      setMessageCount(0)
    }
  }

  async function loadArchivedConversations() {
    const res = await fetch('/api/conversations?coach=nova&archived=true')
    const data = await res.json()
    setArchivedConversations(data.conversations || [])
    setShowHistory(true)
  }

  async function openConversation(convId: string) {
    setConversationId(convId)
    setShowHistory(false)

    const { data } = await supabase
      .from('messages').select('id, role, content, is_pinned')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(50)

    setMessages(data?.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      id: m.id,
      is_pinned: m.is_pinned,
    })) || [])

    // Get summary
    const { data: conv } = await supabase
      .from('conversations')
      .select('summary, message_count, is_archived')
      .eq('id', convId)
      .single()

    setSummary(conv?.summary || null)
    setMessageCount(conv?.message_count || 0)
  }

  async function pinMessage(messageId: string, content: string) {
    if (!messageId || !userId) return
    setPinningId(messageId)

    // Set is_pinned on the message
    await supabase.from('messages').update({ is_pinned: true }).eq('id', messageId)

    // Save as a user fact
    await fetch('/api/user-facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'other',
        fact: content.length > 200 ? content.slice(0, 200) + '...' : content,
      }),
    })

    // Update local state
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: true } : m))
    setPinningId(null)
  }

  const sendMessage = useCallback(async (msg?: string) => {
    const text = (msg || input).trim()
    if (!text || !userId) return
    setInput('')

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])

    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId,
        }),
      })
      const data = await res.json()
      const novaMsg: Message = { role: 'assistant', content: data.message }
      setMessages(prev => [...prev, novaMsg])

      // Track conversation ID from response
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Having trouble connecting. Try again in a sec." }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [userId, input, conversationId])

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
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col" style={{ fontFamily: 'var(--font-inter)', paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
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
            <div className="flex items-center gap-2">
              <button onClick={loadArchivedConversations} title="Previous conversations"
                className="p-2 rounded-xl text-[#6B7A72] hover:text-[#0D1F16] hover:bg-[#EAF2EB] cursor-pointer transition-all duration-300">
                <Clock className="w-4 h-4" strokeWidth={2} />
              </button>
              <button onClick={startNewConversation} title="New conversation"
                className="p-2 rounded-xl text-[#6B7A72] hover:text-[#0D1F16] hover:bg-[#EAF2EB] cursor-pointer transition-all duration-300">
                <Plus className="w-4 h-4" strokeWidth={2} />
              </button>
              <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-[#6B7A72] text-xs hover:text-[#0D1F16] cursor-pointer transition-all duration-300">
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                Back
              </button>
            </div>
          </div>
        </div>
        <div className="relative h-px bg-gradient-to-r from-transparent via-[#EAF2EB] to-transparent" />
      </header>

      {/* Previous conversations overlay */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setShowHistory(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[#EAF2EB] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0D1F16]">Previous Conversations</h2>
              <button onClick={() => setShowHistory(false)} className="p-1 rounded-lg hover:bg-[#F5F8F3] cursor-pointer transition-colors">
                <X className="w-4 h-4 text-[#6B7A72]" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              {archivedConversations.length === 0 ? (
                <p className="text-xs text-[#6B7A72] text-center py-8">No previous conversations</p>
              ) : (
                archivedConversations.map(conv => (
                  <button key={conv.id} onClick={() => openConversation(conv.id)}
                    className="w-full text-left p-3 rounded-2xl border border-[#EAF2EB] hover:bg-[#F5F8F3] cursor-pointer transition-all duration-300">
                    <p className="text-sm text-[#0D1F16] line-clamp-2">{conv.preview}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-[#6B7A72]">
                        {new Date(conv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-[10px] text-[#6B7A72]">{conv.message_count} messages</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary modal */}
      {showSummary && summary && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSummary(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[70vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#1F4B32]" />
                <h3 className="text-sm font-semibold text-[#0D1F16]">Conversation Summary</h3>
              </div>
              <button onClick={() => setShowSummary(false)} className="p-1 rounded-lg hover:bg-[#F5F8F3] cursor-pointer transition-colors">
                <X className="w-4 h-4 text-[#6B7A72]" />
              </button>
            </div>
            <div className="text-sm text-[#0D1F16]/80 leading-relaxed whitespace-pre-wrap">{summary}</div>
          </div>
        </div>
      )}

      {/* Messages + Input — single scrollable container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 max-w-2xl mx-auto w-full flex flex-col">
        {/* Summary pill */}
        {summary && (
          <button onClick={() => setShowSummary(true)}
            className="mx-auto mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[#F5F8F3] rounded-full text-xs text-[#6B7A72] cursor-pointer hover:bg-[#EAF2EB] transition-all duration-300 border border-[#EAF2EB]">
            <BookOpen className="w-3 h-3" />
            {messageCount} earlier messages summarized
          </button>
        )}

        {messages.length === 0 && !loading ? (
          <div className="flex-1 flex items-center justify-center">
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
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center shrink-0 mr-2 mt-1">
                  <Leaf className="w-3.5 h-3.5 text-[#7FFFA4]" strokeWidth={2} />
                </div>
              )}
              <div className="relative">
                <div className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white rounded-3xl rounded-br-md'
                    : 'bg-white border border-[#EAF2EB] text-[#0D1F16] rounded-3xl rounded-bl-md shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]'
                }`}>
                  {msg.content}
                </div>
                {/* Pin button on assistant messages */}
                {msg.role === 'assistant' && msg.id && !msg.is_pinned && (
                  <button
                    onClick={() => pinMessage(msg.id!, msg.content)}
                    disabled={pinningId === msg.id}
                    className="absolute -right-1 top-1 opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-white border border-[#EAF2EB] shadow-sm text-[#6B7A72] hover:text-[#1F4B32] cursor-pointer transition-all duration-200"
                    title="Pin — Nova will remember this">
                    <Pin className="w-3 h-3" />
                  </button>
                )}
                {msg.is_pinned && (
                  <div className="absolute -right-1 top-1 p-1.5 rounded-full bg-[#EAF2EB] text-[#1F4B32]">
                    <Pin className="w-3 h-3" />
                  </div>
                )}
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

        {/* Input — flows inline at end of messages */}
        <div className="pt-4 pb-2" ref={el => { if (el) el.dataset.inputArea = 'true' }}>
          {messages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
              className="flex-1 px-4 py-3 rounded-3xl border border-[#EAF2EB] bg-white text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/50 shadow-[inset_0_1px_3px_rgba(31,75,50,0.04)] transition-all duration-300"
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
      </div>

      {/* Bottom nav */}
      <BottomNav />
    </div>
  )
}
