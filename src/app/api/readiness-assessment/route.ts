import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getAuthedUser, unauthorized } from '../../lib/auth'
import { validateRequestBody } from '../../lib/validation'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Answers are a map of question-key -> boolean. Keys starting with `__` are
// reserved for internal metadata (e.g. __confirmed_ready) and may carry any
// JSON-serializable value; only non-meta boolean answers count toward the score.
const readinessBodySchema = z
  .object({
    answers: z.record(z.unknown()),
  })
  .refine(
    (data) => Object.keys(data.answers).length > 0 && Object.keys(data.answers).length <= 100,
    { message: '`answers` must contain between 1 and 100 entries.' }
  )
  .refine(
    (data) =>
      Object.entries(data.answers).every(
        ([key, val]) => key.startsWith('__') || typeof val === 'boolean'
      ),
    { message: 'Non-meta answer values must be booleans (use __ prefix for metadata keys).' }
  )

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const validated = await validateRequestBody(req, readinessBodySchema)
  if (!validated.success) return validated.response
  const { answers } = validated.data

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
