import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '../../../lib/push/send'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, injection_day, injection_time, timezone, medication, dose, push_reminders_enabled, pre_shot_reminder_enabled')
    .eq('push_reminders_enabled', true)
    .eq('pre_shot_reminder_enabled', true)
    .not('injection_day', 'is', null)
    .not('injection_time', 'is', null)

  if (!profiles?.length) return NextResponse.json({ checked: 0, sent: 0 })

  let totalSent = 0
  let totalChecked = 0

  for (const profile of profiles) {
    totalChecked++

    const userTz = profile.timezone || 'America/Chicago'
    const nextInjection = computeNextInjectionDate(
      profile.injection_day,
      profile.injection_time,
      userTz
    )

    const hoursUntil = (nextInjection.getTime() - Date.now()) / (1000 * 60 * 60)

    // Window: 23.5 to 24.5 hours away (1-hour band, since cron runs hourly)
    if (hoursUntil < 23.5 || hoursUntil > 24.5) continue

    // Idempotency: don't double-fire for same scheduled injection
    const { data: existing } = await supabase
      .from('reminder_log')
      .select('id')
      .eq('user_id', profile.id)
      .eq('reminder_type', 'pre_shot')
      .eq('scheduled_for', nextInjection.toISOString())
      .maybeSingle()

    if (existing) continue

    const result = await sendPushToUser(profile.id, {
      title: 'Shot day tomorrow',
      body: `Your ${profile.dose || ''} ${profile.medication || 'GLP-1'} is scheduled for tomorrow. Make sure it's out of the fridge.`,
      url: '/dashboard',
      tag: `pre-shot-${nextInjection.toISOString()}`,
      requireInteraction: false,
    })

    await supabase.from('reminder_log').insert({
      user_id: profile.id,
      reminder_type: 'pre_shot',
      scheduled_for: nextInjection.toISOString(),
      success: result.sent > 0,
    })

    if (result.sent > 0) totalSent++
  }

  return NextResponse.json({ checked: totalChecked, sent: totalSent })
}

// Map time-of-day labels stored in profiles to approximate hours
const TIME_LABEL_TO_HOUR: Record<string, number> = {
  morning: 8,
  afternoon: 13,
  evening: 18,
  night: 21,
}

function computeNextInjectionDate(
  dayInput: string | number,
  timeInput: string,
  timezone: string
): Date {
  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  }
  const targetDay = typeof dayInput === 'number'
    ? dayInput
    : dayMap[dayInput.toLowerCase()] ?? 1

  // Support both "HH:MM" and label format ("Morning", "Afternoon", etc.)
  let targetH: number
  let targetM: number
  if (timeInput.includes(':')) {
    ;[targetH, targetM] = timeInput.split(':').map(Number)
  } else {
    targetH = TIME_LABEL_TO_HOUR[timeInput.toLowerCase()] ?? 9
    targetM = 0
  }

  // Get current time in user's timezone
  const now = new Date()
  const userNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))

  // Find next occurrence of that day+time
  const result = new Date(userNow)
  result.setHours(targetH, targetM, 0, 0)

  let daysUntil = (targetDay - userNow.getDay() + 7) % 7
  if (daysUntil === 0 && result.getTime() <= userNow.getTime()) {
    daysUntil = 7 // already passed today, next week
  }
  result.setDate(userNow.getDate() + daysUntil)

  // Convert back to UTC for comparison with Date.now()
  const tzOffset = now.getTime() - userNow.getTime()
  return new Date(result.getTime() + tzOffset)
}
