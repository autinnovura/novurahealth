'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hey! I'm Nova, your AI wellness coach 👋 I'm here to help you navigate your GLP-1 journey — whether that's managing side effects, hitting your protein goals, building exercise habits, or planning for the future.\n\nWhat's on your mind today?"
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) })
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages([...newMessages, { role: 'assistant', content: data.error || "I'm having trouble right now. Please try again." }])
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.message }])
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: "I'm having trouble connecting right now. Please try again in a moment." }])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#FFFBF5]">
      {/* HEADER */}
      <header className="bg-[#2D5A3D] px-4 py-3 flex items-center gap-3 shrink-0">
        <a href="/" className="text-white/60 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
          <span className="text-lg">🌿</span>
        </div>
        <div>
          <h1 className="text-white font-semibold text-sm leading-tight">Nova</h1>
          <p className="text-white/50 text-xs">AI Wellness Coach</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/40 text-xs">Online</span>
        </div>
      </header>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center mr-2 mt-1 shrink-0">
                <span className="text-xs">🌿</span>
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#2D5A3D] text-white rounded-br-md'
                  : 'bg-white border border-black/[0.06] text-[#2A2A28] rounded-bl-md shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[#2D5A3D] flex items-center justify-center mr-2 mt-1 shrink-0">
              <span className="text-xs">🌿</span>
            </div>
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

      {/* QUICK REPLIES (only show at start) */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {[
            "I just started my GLP-1 — what should I know?",
            "Help me hit my protein goals",
            "I'm dealing with nausea",
            "How do I prevent muscle loss?",
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                setInput(suggestion)
                setTimeout(() => {
                  const form = document.querySelector('form')
                  form?.requestSubmit()
                }, 50)
              }}
              className="bg-[#E8F0EB] text-[#2D5A3D] text-xs font-medium px-3 py-2 rounded-full hover:bg-[#d4e5d9] transition-colors cursor-pointer"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* INPUT */}
      <div className="shrink-0 border-t border-black/5 bg-white px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Nova anything..."
            rows={1}
            className="flex-1 resize-none bg-[#F5F5F0] rounded-2xl px-4 py-3 text-sm outline-none placeholder:text-[#9B9B93] focus:ring-2 focus:ring-[#2D5A3D]/20 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-[#2D5A3D] text-white flex items-center justify-center shrink-0 hover:bg-[#3A7A52] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
        <p className="text-center text-[10px] text-[#9B9B93] mt-2">
          Nova is an AI wellness coach, not a medical professional. Always consult your healthcare provider for medical advice.
        </p>
      </div>
    </div>
  )
}
