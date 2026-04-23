'use client'

import { useState, useRef, useEffect } from 'react'

interface VoiceInputProps {
  onResult: (text: string) => void
  className?: string
}

export default function VoiceInput({ onResult, className = '' }: VoiceInputProps) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [interim, setInterim] = useState('')
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (interimTranscript) setInterim(interimTranscript)
      if (finalTranscript) {
        setInterim('')
        setListening(false)
        onResult(finalTranscript.trim())
      }
    }

    recognition.onerror = () => {
      setListening(false)
      setInterim('')
    }

    recognition.onend = () => {
      setListening(false)
      setInterim('')
    }

    recognitionRef.current = recognition
  }, [onResult])

  function toggle() {
    if (!recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      setInterim('')
      recognitionRef.current.start()
      setListening(true)
    }
  }

  if (!supported) return null

  return (
    <div className={`relative ${className}`}>
      {interim && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-[#EDEDEA] rounded-lg px-3 py-2 shadow-sm">
          <p className="text-sm text-[#B0B0A8] italic">{interim}</p>
        </div>
      )}
      <button
        onClick={toggle}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
          listening
            ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/30'
            : 'bg-[#F5F5F2] hover:bg-[#EDEDEA]'
        }`}
        title={listening ? 'Stop recording' : 'Start voice input'}
      >
        <svg className={`w-5 h-5 ${listening ? 'text-white' : 'text-[#6B6B65]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>
    </div>
  )
}
