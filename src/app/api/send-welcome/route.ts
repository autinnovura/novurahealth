import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '../../lib/email'

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json()

    if (!email || !name) {
      return NextResponse.json({ error: 'Missing email or name' }, { status: 400 })
    }

    const { error } = await sendWelcomeEmail(email, name)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
