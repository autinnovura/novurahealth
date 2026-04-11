'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (loginError) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    router.push('/chat')
  }

  return (
    <div className="min-h-screen bg-[#FFFBF5] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <a href="/" className="text-2xl font-bold tracking-tight text-[#2D5A3D]">
            Novura<span className="text-[#C4742B]">Health</span>
          </a>
          <h1 className="text-2xl font-bold text-[#1E1E1C] mt-6 mb-2">Welcome back</h1>
          <p className="text-[#6B6B65] text-sm">Log in to continue your coaching journey</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#2A2A28] mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-[#1E1E1C] text-sm outline-none focus:border-[#2D5A3D] transition-colors placeholder:text-[#9B9B93]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#2A2A28] mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-[#1E1E1C] text-sm outline-none focus:border-[#2D5A3D] transition-colors placeholder:text-[#9B9B93]"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#3A7A52] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="text-center text-sm text-[#6B6B65] mt-6">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-[#2D5A3D] font-semibold hover:underline">Sign up</a>
        </p>
      </div>
    </div>
  )
}
