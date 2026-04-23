import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized } from '../../lib/auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  try {
    // Delete all user data from every table
    const tables = [
      'messages', 'weight_logs', 'food_logs', 'medication_logs',
      'water_logs', 'side_effect_logs', 'exercise_logs', 'checkin_logs',
      'tapering_plans', 'tapering_checkins', 'savings_profiles',
    ]

    for (const table of tables) {
      await supabaseAdmin.from(table).delete().eq('user_id', user.id)
    }

    // profiles uses 'id' not 'user_id'
    await supabaseAdmin.from('profiles').delete().eq('id', user.id)

    // Delete the auth user
    await supabaseAdmin.auth.admin.deleteUser(user.id)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
