import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '../../lib/email'
import { getAuthedUser, unauthorized } from '../../lib/auth'
import { standardLimiter, checkRateLimit } from '../../lib/rate-limit'

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { success: allowed } = await checkRateLimit(standardLimiter, user.id)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please slow down.' }, { status: 429 })
  }

  try {
    const { name } = await req.json()

    if (!user.email || !name) {
      return NextResponse.json({ error: 'Missing email or name' }, { status: 400 })
    }

    const { error } = await sendWelcomeEmail(user.email, name)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
