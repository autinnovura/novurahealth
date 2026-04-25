import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized } from '../../../lib/auth'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { id } = await params
  const body = await req.json()

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined) updates.title = body.title
  if (body.description !== undefined) updates.description = body.description
  if (body.meals !== undefined) updates.meals = body.meals
  if (body.grocery_list !== undefined) updates.grocery_list = body.grocery_list
  if (body.is_active !== undefined) updates.is_active = body.is_active

  const { error } = await supabase.from('meal_plans').update(updates).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { id } = await params

  const { error } = await supabase.from('meal_plans').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
