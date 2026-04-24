import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized } from '../../lib/auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      tapering_override: true,
      tapering_override_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('Tapering override error:', error)
    return NextResponse.json({ error: 'Update failed', message: 'Could not save override.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
