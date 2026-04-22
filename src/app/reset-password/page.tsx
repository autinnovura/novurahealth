'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Please enter your email'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#F5F8F3] to-[#EAF2EB] flex items-center justify-center px-4" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center mx-auto mb-4 shadow-[0_8px_32px_-8px_rgba(31,75,50,0.3)]">
            <span className="text-2xl">🌿</span>
          </div>
          <h1 className="text-2xl text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>Reset Password</h1>
          <p className="text-sm text-[#6B7A72] mt-1">
            {sent ? 'Check your email for a reset link' : 'Enter your email to receive a reset link'}
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-[#EAF2EB] rounded-3xl p-4 text-center">
              <p className="text-sm text-[#1F4B32] font-medium">📧 Reset link sent to {email}</p>
              <p className="text-xs text-[#1F4B32]/70 mt-1">Check your inbox and spam folder</p>
            </div>
            <button onClick={() => { setSent(false); setEmail('') }}
              className="w-full py-3 rounded-2xl border border-[#EAF2EB] text-sm text-[#6B7A72] font-medium cursor-pointer hover:bg-[#EAF2EB]/50 transition-all duration-300">
              Try a different email
            </button>
            <Link href="/login" className="block text-center text-sm text-[#1F4B32] font-semibold hover:text-[#2D6B45]">
              ← Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus
                className="w-full mt-1 px-4 py-3.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/50"/>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300 disabled:opacity-50">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <Link href="/login" className="block text-center text-sm text-[#6B7A72] hover:text-[#1F4B32]">
              ← Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
