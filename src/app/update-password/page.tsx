'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function UpdatePassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase automatically handles the token from the URL hash
    // We just need to wait for the session to be established
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // Also check if we already have a session (page refresh after token exchange)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#F5F8F3] to-[#EAF2EB] flex items-center justify-center px-4" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center mx-auto mb-4 shadow-[0_8px_32px_-8px_rgba(31,75,50,0.3)]">
            <span className="text-2xl">🌿</span>
          </div>
          <h1 className="text-2xl text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>
            {success ? 'Password Updated' : 'Set New Password'}
          </h1>
          <p className="text-sm text-[#6B7A72] mt-1">
            {success ? 'Redirecting to your dashboard...' : 'Choose a strong password for your account'}
          </p>
        </div>

        {success ? (
          <div className="bg-[#EAF2EB] rounded-3xl p-4 text-center">
            <p className="text-sm text-[#1F4B32] font-medium">✓ Your password has been updated</p>
          </div>
        ) : !ready ? (
          <div className="text-center space-y-4">
            <div className="w-7 h-7 border-2 border-[#1F4B32] border-t-transparent rounded-full animate-spin mx-auto"/>
            <p className="text-sm text-[#6B7A72]">Verifying your reset link...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" autoFocus
                className="w-full mt-1 px-4 py-3.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/50"/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password"
                className="w-full mt-1 px-4 py-3.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/50"/>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300 disabled:opacity-50">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
