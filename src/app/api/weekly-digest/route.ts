import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWeeklyDigest } from '../../lib/email'
import { timingSafeEqual } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const expected = `Bearer ${secret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, current_weight')
    .not('name', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let failed = 0

  for (const profile of profiles ?? []) {
    const { data: auth } = await supabase.auth.admin.getUserById(profile.id)
    const email = auth?.user?.email
    if (!email) continue

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const { data: logs } = await supabase
      .from('weight_logs')
      .select('weight, created_at')
      .eq('user_id', profile.id)
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false })

    const logsThisWeek = logs?.length ?? 0
    const latestWeight = logs?.[0]?.weight ?? profile.current_weight
    const oldestWeight = logs?.[logs.length - 1]?.weight
    let weightChange: string | undefined
    if (logs && logs.length >= 2) {
      const diff = parseFloat(logs[0].weight) - parseFloat(oldestWeight)
      weightChange = diff <= 0 ? `${diff} lbs` : `+${diff} lbs`
    }

    const { error: sendError } = await sendWeeklyDigest(email, profile.name, {
      currentWeight: latestWeight,
      weightChange,
      logsThisWeek,
    })

    if (sendError) {
      failed++
    } else {
      sent++
    }
  }

  return NextResponse.json({ sent, failed })
}
