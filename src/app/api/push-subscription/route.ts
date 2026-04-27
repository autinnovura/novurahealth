import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized } from '../../lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { subscription } = await req.json()
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  // Upsert by endpoint to avoid duplicates
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
      },
      { onConflict: 'endpoint' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enable push reminders on the profile
  await supabase
    .from('profiles')
    .update({ push_reminders_enabled: true })
    .eq('id', user.id)

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  // Remove all push subscriptions for this user
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)

  // Disable push reminders
  await supabase
    .from('profiles')
    .update({ push_reminders_enabled: false, pre_shot_reminder_enabled: false })
    .eq('id', user.id)

  return NextResponse.json({ success: true })
}
