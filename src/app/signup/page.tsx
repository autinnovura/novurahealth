'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function Signup() {
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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    router.push('/onboarding')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#F5F8F3] to-[#EAF2EB] flex flex-col items-center justify-center px-6" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#1F4B32] to-[#2D6B45] flex items-center justify-center mx-auto mb-4 shadow-[0_8px_32px_-8px_rgba(31,75,50,0.3)]">
            <span className="text-2xl">🌿</span>
          </div>
          <h1 className="text-2xl text-[#0D1F16] mt-6 mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>Create your account</h1>
          <p className="text-[#6B7A72] text-sm">Start your personalized GLP-1 coaching journey</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full px-4 py-3.5 rounded-2xl border border-[#EAF2EB] bg-white text-[#0D1F16] text-sm outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/50"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-4 py-3.5 rounded-2xl border border-[#EAF2EB] bg-white text-[#0D1F16] text-sm outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/50"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white py-3 rounded-2xl text-sm font-semibold hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all duration-300 disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#6B7A72] mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-[#1F4B32] font-semibold hover:text-[#2D6B45]">Log in</a>
        </p>

        <p className="text-center text-[10px] text-[#6B7A72]/60 mt-8">
          By creating an account you agree to our Terms of Service and Privacy Policy.
          NovuraHealth is a wellness coaching tool, not a medical service.
        </p>
      </div>
    </div>
  )
}
