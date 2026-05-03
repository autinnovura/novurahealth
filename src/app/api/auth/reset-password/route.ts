import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resetLimiter, checkAuthRateLimit } from '../../../lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit by IP — very strict to prevent email enumeration
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = await checkAuthRateLimit(resetLimiter, `reset:${ip}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many reset requests. Please try again in 15 minutes.' },
      { status: 429 }
    )
  }

  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Always return success to prevent email enumeration
  // Supabase will only send the email if the account exists
  const origin = req.headers.get('origin') || 'https://novurahealth.com'
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/update-password`,
  })

  return NextResponse.json({ success: true })
}
