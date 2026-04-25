'use client'

import { useState, useEffect } from 'react'
import { Smartphone, Share, ChevronDown, Plus, Download, Monitor } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallAppCard() {
  const [isStandalone, setIsStandalone] = useState(true)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop')
  const [hasPrompt, setHasPrompt] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    setIsStandalone(standalone)
    if (standalone) return

    const ua = navigator.userAgent
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      setPlatform('ios')
    } else if (/Android/.test(ua)) {
      setPlatform('android')
    } else {
      setPlatform('desktop')
    }

    if ((window as any).__novuraPwaPrompt) {
      setHasPrompt(true)
    }

    function handlePrompt(e: Event) {
      e.preventDefault()
      ;(window as any).__novuraPwaPrompt = e
      setHasPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  async function handleInstall() {
    const prompt = (window as any).__novuraPwaPrompt as BeforeInstallPromptEvent | null
    if (!prompt) return
    setInstalling(true)
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') {
        setIsStandalone(true)
      }
    } finally {
      setInstalling(false)
      ;(window as any).__novuraPwaPrompt = null
      setHasPrompt(false)
    }
  }

  if (isStandalone) return null

  return (
    <div className="bg-gradient-to-br from-[#EAF2EB] to-white border border-[#D8E8D9] rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-white" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>Install App</h2>
          <p className="text-xs text-[#6B7A72]">Get the full experience on your home screen</p>
        </div>
      </div>

      {platform === 'ios' && (
        <div className="space-y-2.5">
          {[
            { icon: <Share className="w-3.5 h-3.5" />, text: 'Tap the Share button in Safari' },
            { icon: <ChevronDown className="w-3.5 h-3.5" />, text: 'Scroll down in the share menu' },
            { icon: <Plus className="w-3.5 h-3.5" />, text: 'Tap "Add to Home Screen"' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0 text-[#1F4B32] shadow-sm">
                {step.icon}
              </div>
              <p className="text-sm text-[#0D1F16]">{step.text}</p>
            </div>
          ))}
        </div>
      )}

      {platform === 'android' && (
        <div className="space-y-3">
          {hasPrompt ? (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white text-sm font-semibold cursor-pointer hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {installing ? 'Installing...' : 'Install NovuraHealth'}
            </button>
          ) : (
            <p className="text-sm text-[#0D1F16]">
              Tap the browser menu (<strong>&#8942;</strong>) and select <strong>&ldquo;Install app&rdquo;</strong>
            </p>
          )}
        </div>
      )}

      {platform === 'desktop' && (
        <div className="space-y-3">
          {hasPrompt ? (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white text-sm font-semibold cursor-pointer hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {installing ? 'Installing...' : 'Install NovuraHealth'}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0 text-[#1F4B32] shadow-sm">
                <Monitor className="w-3.5 h-3.5" />
              </div>
              <p className="text-sm text-[#0D1F16]">Click the install icon in your browser&apos;s address bar</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
