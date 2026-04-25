'use client'

import { useState, useEffect } from 'react'
import { X, Share, ChevronDown, Plus } from 'lucide-react'

const DISMISS_KEY = 'novura-ios-install-dismissed'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export default function IOSInstallPrompt() {
  const [show, setShow] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua)
    const isStandalone = (navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches

    if (!isIOS || !isSafari || isStandalone) return

    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - parseInt(dismissed, 10) < DISMISS_MS) return

    const timer = setTimeout(() => {
      setShow(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true))
      })
    }, 2500)

    return () => clearTimeout(timer)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setAnimateIn(false)
    setTimeout(() => setShow(false), 300)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center" style={{ fontFamily: 'var(--font-inter)' }}>
      <div
        className={`absolute inset-0 bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={dismiss}
      />
      <div
        className={`relative w-full max-w-md mx-3 mb-3 bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ease-out ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-[#F5F8F3] text-[#6B7A72] hover:text-[#0D1F16] cursor-pointer transition-colors z-10"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="px-5 pt-5 pb-4 space-y-4">
          <div className="flex items-center gap-3 pr-8">
            <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center shrink-0 shadow-md">
              <span className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>N</span>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>
                Get the full experience
              </h3>
              <p className="text-xs text-[#6B7A72]">Add NovuraHealth to your home screen</p>
            </div>
          </div>

          <div className="bg-[#F5F8F3] rounded-2xl p-4 space-y-3">
            {[
              { icon: <Share className="w-3.5 h-3.5" />, text: 'Tap the Share button', sub: 'at the bottom of Safari' },
              { icon: <ChevronDown className="w-3.5 h-3.5" />, text: 'Scroll down', sub: 'in the share menu' },
              { icon: <Plus className="w-3.5 h-3.5" />, text: 'Tap "Add to Home Screen"', sub: '' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0 text-[#1F4B32] shadow-sm">
                  {step.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#0D1F16]">{step.text}</p>
                  {step.sub && <p className="text-[11px] text-[#6B7A72]">{step.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={dismiss}
            className="w-full py-2.5 rounded-2xl bg-[#EAF2EB] text-[#1F4B32] text-sm font-semibold cursor-pointer hover:bg-[#D8E8D9] transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
