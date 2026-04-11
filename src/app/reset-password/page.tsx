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
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#2D5A3D] flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🌿</span>
          </div>
          <h1 className="text-xl font-bold text-[#1E1E1C]">Reset Password</h1>
          <p className="text-sm text-[#8B8B83] mt-1">
            {sent ? 'Check your email for a reset link' : 'Enter your email to receive a reset link'}
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-[#E8F0EB] rounded-xl p-4 text-center">
              <p className="text-sm text-[#2D5A3D] font-medium">📧 Reset link sent to {email}</p>
              <p className="text-xs text-[#2D5A3D]/70 mt-1">Check your inbox and spam folder</p>
            </div>
            <button onClick={() => { setSent(false); setEmail('') }}
              className="w-full py-3 rounded-xl border border-[#EDEDEA] text-sm text-[#6B6B65] font-medium cursor-pointer hover:bg-[#F5F5F2] transition-colors">
              Try a different email
            </button>
            <Link href="/login" className="block text-center text-sm text-[#2D5A3D] font-medium hover:text-[#3A7A52]">
              ← Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus
                className="w-full mt-1 px-4 py-3 rounded-xl border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"/>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors disabled:opacity-50">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <Link href="/login" className="block text-center text-sm text-[#8B8B83] hover:text-[#2D5A3D]">
              ← Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
