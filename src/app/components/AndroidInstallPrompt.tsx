'use client'

import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'novura-android-install-dismissed'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export default function AndroidInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - parseInt(dismissed, 10) < DISMISS_MS) return

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      ;(window as any).__novuraPwaPrompt = promptEvent
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setShow(false)
    setDeferredPrompt(null)
    ;(window as any).__novuraPwaPrompt = null
    if (outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex justify-center px-4"
      style={{ fontFamily: 'var(--font-inter)', paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
    >
      <div className="w-full max-w-md bg-white border border-[#EAF2EB] rounded-2xl shadow-2xl p-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>N</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#0D1F16]">Install NovuraHealth</p>
          <p className="text-[11px] text-[#6B7A72]">Quick access from your home screen</p>
        </div>
        <button
          onClick={handleInstall}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white text-xs font-semibold cursor-pointer hover:shadow-lg transition-all flex items-center gap-1.5 shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Install
        </button>
        <button onClick={dismiss} className="p-1 rounded-lg text-[#6B7A72] hover:text-[#0D1F16] cursor-pointer transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
