import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '../crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getVapidKeys() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured')
  }
  return { publicKey, privateKey }
}

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const { publicKey, privateKey } = getVapidKeys()

  webpush.setVapidDetails(
    'mailto:support@novurahealth.com',
    publicKey,
    privateKey
  )

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq('user_id', userId)

  if (!subscriptions?.length) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: decrypt(sub.p256dh_key) || '',
        auth: decrypt(sub.auth_key) || '',
      },
    }

    try {
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload)
      )
      sent++
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        // Subscription expired or unsubscribed — clean up
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
      failed++
    }
  }

  return { sent, failed }
}
