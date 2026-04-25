import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized } from '../../lib/auth'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const body = await req.json()
  const now = new Date().toISOString()

  // Deactivate any existing active meal plans
  await supabase.from('meal_plans').update({ is_active: false, updated_at: now }).eq('user_id', user.id).eq('is_active', true)

  const { data, error } = await supabase.from('meal_plans').insert({
    user_id: user.id,
    title: body.title || 'Meal Plan',
    description: body.description || null,
    meals: body.meals || [],
    grocery_list: body.grocery_list || [],
    is_active: true,
    created_at: now,
    updated_at: now,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, plan: data })
}
