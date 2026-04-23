'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function Login() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/dashboard')
    })
  }, [router])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password.trim()) { setError('Please fill in all fields'); return }
    if (isSignUp && password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)

    if (isSignUp) {
      const { error: err } = await supabase.auth.signUp({ email, password })
      setLoading(false)
      if (err) { setError(err.message); return }
      router.push('/onboarding')
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (err) { setError(err.message); return }
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#F5F8F3] to-[#EAF2EB] flex items-center justify-center px-4" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center mx-auto mb-4 shadow-[0_8px_32px_-8px_rgba(31,75,50,0.3)]">
            <span className="text-2xl">🌿</span>
          </div>
          <h1 className="text-2xl text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>NovuraHealth</h1>
          <p className="text-sm text-[#6B7A72] mt-1">{isSignUp ? 'Create your account' : 'Welcome back'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus
              className="w-full mt-1 px-4 py-3.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/50"/>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              className="w-full mt-1 px-4 py-3.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/50"/>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {!isSignUp && (
            <div className="text-right">
              <Link href="/reset-password" className="text-xs text-[#1F4B32] font-semibold hover:text-[#2D6B45]">
                Forgot password?
              </Link>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3 rounded-2xl text-sm font-semibold cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300 disabled:opacity-50">
            {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <p className="text-center text-sm text-[#6B7A72] mt-6">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setIsSignUp(!isSignUp); setError('') }}
            className="text-[#1F4B32] font-semibold cursor-pointer hover:text-[#2D6B45]">
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}
