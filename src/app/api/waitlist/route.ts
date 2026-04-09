import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client (not exposed to browser)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Simple in-memory rate limiter (resets on deploy, which is fine for a waitlist)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const maxRequests = 5 // max 5 signups per IP per 15 minutes

  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return false
  }

  if (entry.count >= maxRequests) {
    return true
  }

  entry.count++
  return false
}

function isValidEmail(email: string): boolean {
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return false

  // Block obviously fake emails
  if (email.length > 254) return false
  if (email.includes('..')) return false

  // Block disposable email domains (add more as needed)
  const disposableDomains = [
    'mailinator.com', 'guerrillamail.com', 'tempmail.com',
    'throwaway.email', 'yopmail.com', 'sharklasers.com',
    'guerrillamailblock.com', 'grr.la', 'dispostable.com',
    'trashmail.com', '10minutemail.com', 'temp-mail.org'
  ]
  const domain = email.split('@')[1]?.toLowerCase()
  if (disposableDomains.includes(domain)) return false

  return true
}

function sanitizeInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[<>'"&]/g, '') // Strip potential XSS characters
    .slice(0, 254) // Max email length per RFC
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Check rate limit
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse and validate body
    const body = await request.json().catch(() => null)

    if (!body || !body.email) {
      return NextResponse.json(
        { error: 'Email is required.' },
        { status: 400 }
      )
    }

    // Sanitize and validate email
    const email = sanitizeInput(body.email)

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    // Sanitize source field
    const allowedSources = ['top', 'bottom']
    const source = allowedSources.includes(body.source) ? body.source : 'unknown'

    // Insert into Supabase
    const { error: dbError } = await supabase
      .from('waitlist')
      .insert({ email, source })

    if (dbError) {
      if (dbError.code === '23505') {
        return NextResponse.json(
          { error: "You're already on the list!" },
          { status: 409 }
        )
      }
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Successfully joined the waitlist!' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Waitlist API error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

// Block all other HTTP methods
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
