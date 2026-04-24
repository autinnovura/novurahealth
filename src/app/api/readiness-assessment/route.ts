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

  let body: { answers: Record<string, boolean> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', message: 'Invalid request.' }, { status: 400 })
  }

  const { answers } = body
  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'Missing answers', message: 'No answers provided.' }, { status: 400 })
  }

  // Count only boolean true values, excluding internal keys like __confirmed_ready
  const score = Object.entries(answers).filter(
    ([key, val]) => !key.startsWith('__') && val === true
  ).length

  const now = new Date().toISOString()
  const payload = {
    readiness_score: score,
    readiness_answers: answers,
    readiness_completed_at: now,
    updated_at: now,
  }

  // Upsert: update existing plan or create new one
  const { data: existing } = await supabaseAdmin
    .from('tapering_plans')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('tapering_plans')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) {
      console.error('Readiness update error:', error)
      return NextResponse.json({ error: 'Save failed', message: 'Could not save assessment.' }, { status: 500 })
    }
    return NextResponse.json({ score, plan: data })
  } else {
    const { data, error } = await supabaseAdmin
      .from('tapering_plans')
      .insert({ user_id: user.id, phase: 'exploring', ...payload })
      .select()
      .single()
    if (error) {
      console.error('Readiness insert error:', error)
      return NextResponse.json({ error: 'Save failed', message: 'Could not save assessment.' }, { status: 500 })
    }
    return NextResponse.json({ score, plan: data })
  }
}
