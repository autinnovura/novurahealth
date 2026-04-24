import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized } from '../../lib/auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET — list active facts for the authed user
export async function GET() {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { data, error } = await supabaseAdmin
    .from('user_facts')
    .select('id, category, fact, source, confidence, pinned, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ facts: data })
}

// POST — manually add a fact
export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  let body: { category?: string; fact?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { category, fact } = body
  if (!category || !fact) {
    return NextResponse.json({ error: 'category and fact are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.from('user_facts').insert({
    user_id: user.id,
    category,
    fact,
    source: 'manual',
    confidence: 1.0,
    is_active: true,
    pinned: false,
  }).select('id, category, fact, source, pinned, created_at').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fact: data })
}

// PATCH — update a fact (edit text, toggle pin, soft-delete)
export async function PATCH(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  let body: { id?: string; fact?: string; pinned?: boolean; is_active?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.fact !== undefined) updates.fact = body.fact
  if (body.pinned !== undefined) updates.pinned = body.pinned
  if (body.is_active !== undefined) updates.is_active = body.is_active

  const { error } = await supabaseAdmin
    .from('user_facts')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
