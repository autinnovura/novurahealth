import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized } from '../../../lib/auth'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { id } = await params

  const { error } = await supabase.from('side_effect_logs').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { id } = await params
  const body = await req.json()
  const { symptom, severity, logged_at } = body

  const updates: Record<string, any> = {}
  if (symptom) updates.symptom = symptom
  if (severity !== undefined) updates.severity = severity
  if (logged_at) updates.logged_at = logged_at

  const { error } = await supabase.from('side_effect_logs').update(updates).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
