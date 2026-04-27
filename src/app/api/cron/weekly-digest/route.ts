import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { subDays, startOfWeek, format } from 'date-fns'

const resend = new Resend(process.env.RESEND_API_KEY!)
export const maxDuration = 300

// SAFETY: Refuse to send to anyone except the developer in non-prod environments
const ALLOWED_TEST_RECIPIENTS = ['austin@terrarobotics.net']

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, medication, dose, weekly_digest_enabled')
    .eq('weekly_digest_enabled', true)

  if (!profiles?.length) return NextResponse.json({ sent: 0 })

  const { data: authData } = await supabase.auth.admin.listUsers()
  const emailMap = new Map(authData.users.map(u => [u.id, u.email]))

  // Last week window (previous Sunday 00:00 to Saturday 23:59:59 UTC)
  const now = new Date()
  const lastWeekEnd = subDays(startOfWeek(now), 1)
  const lastWeekStart = subDays(lastWeekEnd, 6)

  let sent = 0
  let skipped = 0

  for (const profile of profiles) {
    const email = emailMap.get(profile.id)
    if (!email) { skipped++; continue }

    // SAFETY: Block non-prod sends to anyone outside the allowlist
    if (process.env.VERCEL_ENV !== 'production' && !ALLOWED_TEST_RECIPIENTS.includes(email)) {
      console.log(`[digest] Skipping ${email} — not in test allowlist`)
      skipped++
      continue
    }

    const stats = await computeWeeklyStats(supabase, profile.id, lastWeekStart, lastWeekEnd)

    // Skip users with zero activity
    if (stats.totalLogs === 0) { skipped++; continue }

    const html = renderDigestHtml({
      name: profile.name?.split(' ')[0] || 'there',
      medication: profile.medication,
      dose: profile.dose,
      weekStart: lastWeekStart,
      weekEnd: lastWeekEnd,
      stats,
    })

    try {
      await resend.emails.send({
        from: 'Nova at NovuraHealth <nova@novurahealth.com>',
        to: email,
        subject: `Your week — ${stats.weightChange < 0 ? `down ${Math.abs(stats.weightChange).toFixed(1)} lbs` : 'in review'}`,
        html,
      })
      sent++
    } catch (err) {
      console.error(`Digest send failed for ${email}:`, err)
    }
  }

  return NextResponse.json({ sent, skipped, totalProfiles: profiles.length })
}

interface WeeklyStats {
  totalLogs: number
  foodLogs: number
  proteinDaysHit: number
  avgCalsPerDay: number
  daysWithFood: number
  startWeight: number | null
  endWeight: number | null
  weightChange: number
  injections: number
  totalWaterOz: number
  avgWaterPerDay: number
  totalExerciseMin: number
  exerciseSessions: number
  topSideEffects: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeWeeklyStats(
  supabase: any,
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyStats> {
  const startISO = weekStart.toISOString()
  const endISO = weekEnd.toISOString()

  const [food, weight, meds, water, exercise, sideEffects] = await Promise.all([
    supabase.from('food_logs').select('calories, protein, logged_at').eq('user_id', userId).gte('logged_at', startISO).lte('logged_at', endISO),
    supabase.from('weight_logs').select('weight, logged_at').eq('user_id', userId).gte('logged_at', startISO).lte('logged_at', endISO).order('logged_at'),
    supabase.from('medication_logs').select('logged_at').eq('user_id', userId).gte('logged_at', startISO).lte('logged_at', endISO),
    supabase.from('water_logs').select('amount_oz').eq('user_id', userId).gte('logged_at', startISO).lte('logged_at', endISO),
    supabase.from('exercise_logs').select('duration_minutes, exercise_type').eq('user_id', userId).gte('logged_at', startISO).lte('logged_at', endISO),
    supabase.from('side_effect_logs').select('symptom').eq('user_id', userId).gte('logged_at', startISO).lte('logged_at', endISO),
  ])

  // Group food by day to count protein-target days
  const foodByDay = new Map<string, { protein: number; calories: number }>()
  for (const f of food.data ?? []) {
    const day = f.logged_at.split('T')[0]
    if (!foodByDay.has(day)) foodByDay.set(day, { protein: 0, calories: 0 })
    const entry = foodByDay.get(day)!
    entry.protein += f.protein ?? 0
    entry.calories += f.calories ?? 0
  }

  const proteinDaysHit = Array.from(foodByDay.values()).filter(d => d.protein >= 95).length
  const totalCalories = Array.from(foodByDay.values()).reduce((s, d) => s + d.calories, 0)
  const avgCalsPerDay = foodByDay.size > 0 ? Math.round(totalCalories / foodByDay.size) : 0

  const weights = weight.data ?? []
  const startWeight = weights[0]?.weight ?? null
  const endWeight = weights[weights.length - 1]?.weight ?? null
  const weightChange = (startWeight && endWeight) ? endWeight - startWeight : 0

  const totalWaterOz = (water.data ?? []).reduce((s: number, w: { amount_oz: number }) => s + (w.amount_oz ?? 0), 0)
  const totalExerciseMin = (exercise.data ?? []).reduce((s: number, e: { duration_minutes: number }) => s + (e.duration_minutes ?? 0), 0)
  const exerciseSessions = exercise.data?.length ?? 0

  const sideEffectCounts: Record<string, number> = {}
  for (const s of sideEffects.data ?? []) {
    sideEffectCounts[s.symptom] = (sideEffectCounts[s.symptom] || 0) + 1
  }
  const topSideEffects = Object.entries(sideEffectCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([s]) => s)

  return {
    totalLogs: (food.data?.length ?? 0) + (weight.data?.length ?? 0) + (meds.data?.length ?? 0) + (water.data?.length ?? 0) + (exercise.data?.length ?? 0) + (sideEffects.data?.length ?? 0),
    foodLogs: food.data?.length ?? 0,
    proteinDaysHit,
    avgCalsPerDay,
    daysWithFood: foodByDay.size,
    startWeight,
    endWeight,
    weightChange,
    injections: meds.data?.length ?? 0,
    totalWaterOz,
    avgWaterPerDay: foodByDay.size > 0 ? Math.round(totalWaterOz / foodByDay.size) : 0,
    totalExerciseMin,
    exerciseSessions,
    topSideEffects,
  }
}

function generateInsight(stats: WeeklyStats): string {
  if (stats.weightChange <= -1) {
    return `Down ${Math.abs(stats.weightChange).toFixed(1)} lbs this week — solid progress. Keep doing what you're doing.`
  }
  if (stats.proteinDaysHit >= 5) {
    return `${stats.proteinDaysHit}/7 protein-goal days is excellent. Hitting protein consistently is the single biggest predictor of muscle preservation while losing fat.`
  }
  if (stats.proteinDaysHit <= 2 && stats.foodLogs > 0) {
    return `Protein was light this week — only ${stats.proteinDaysHit}/7 days hit your goal. GLP-1 medications make appetite low, so protein has to be intentional. Try front-loading at breakfast.`
  }
  if (stats.injections === 0) {
    return `No injections logged this week. If you took your shot but didn't log it, just tap Injection on home to back-fill.`
  }
  if (stats.exerciseSessions === 0) {
    return `Movement was quiet this week. Even one 20-minute walk helps preserve muscle during weight loss.`
  }
  if (stats.totalWaterOz < 200) {
    return `Hydration was low — under 200oz across the week. GLP-1s slow gastric emptying, so dehydration shows up faster than usual.`
  }
  return `Good consistency this week — ${stats.totalLogs} total logs. Showing up is most of the battle.`
}

function renderDigestHtml(data: {
  name: string
  medication: string | null
  dose: string | null
  weekStart: Date
  weekEnd: Date
  stats: WeeklyStats
}): string {
  const { name, stats, weekStart, weekEnd } = data
  const weekLabel = `${format(weekStart, 'MMM d')} \u2013 ${format(weekEnd, 'MMM d')}`

  const weightLine = stats.startWeight && stats.endWeight
    ? `<p style="color:#6B7A72;font-size:14px;margin:8px 0">${stats.startWeight} \u2192 ${stats.endWeight} lbs (<strong style="color:${stats.weightChange < 0 ? '#1F4B32' : '#6B7A72'}">${stats.weightChange > 0 ? '+' : ''}${stats.weightChange.toFixed(1)} lbs</strong>)</p>`
    : ''

  const sideEffectsLine = stats.topSideEffects.length
    ? `<p style="color:#6B7A72;font-size:14px;margin:8px 0">Side effects logged: ${stats.topSideEffects.join(', ')}</p>`
    : ''

  const insight = generateInsight(stats)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your week with NovuraHealth</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#FFFFFF">
    <h1 style="font-family:Georgia,serif;font-size:28px;color:#0D1F16;margin:0 0 4px">Hi ${name},</h1>
    <p style="color:#6B7A72;font-size:14px;margin:0 0 24px">Your week of ${weekLabel}</p>

    <div style="background:linear-gradient(135deg,#F5F8F3,#FFFFFF);border-radius:16px;padding:24px;margin-bottom:24px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6B7A72;font-weight:600;margin-bottom:8px">Weight</div>
      ${weightLine || '<p style="color:#6B7A72;margin:0">No weigh-ins this week</p>'}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr>
        <td width="50%" style="padding-right:8px;vertical-align:top">
          <div style="background:#F5F8F3;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:24px;font-weight:bold;color:#1F4B32;font-family:Georgia,serif">${stats.proteinDaysHit}/7</div>
            <div style="font-size:12px;color:#6B7A72;margin-top:4px">Protein goal days</div>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;vertical-align:top">
          <div style="background:#F5F8F3;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:24px;font-weight:bold;color:#1F4B32;font-family:Georgia,serif">${stats.injections}</div>
            <div style="font-size:12px;color:#6B7A72;margin-top:4px">Injections logged</div>
          </div>
        </td>
      </tr>
      <tr><td colspan="2" style="height:8px"></td></tr>
      <tr>
        <td width="50%" style="padding-right:8px;vertical-align:top">
          <div style="background:#F5F8F3;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:24px;font-weight:bold;color:#1F4B32;font-family:Georgia,serif">${stats.exerciseSessions}</div>
            <div style="font-size:12px;color:#6B7A72;margin-top:4px">Workouts</div>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;vertical-align:top">
          <div style="background:#F5F8F3;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:24px;font-weight:bold;color:#1F4B32;font-family:Georgia,serif">${stats.foodLogs}</div>
            <div style="font-size:12px;color:#6B7A72;margin-top:4px">Meals logged</div>
          </div>
        </td>
      </tr>
    </table>

    ${sideEffectsLine}

    <div style="background:#FFF4E5;border-radius:12px;padding:16px;margin:24px 0">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8B6914;font-weight:600;margin-bottom:8px">Nova noticed</div>
      <p style="margin:0;color:#0D1F16;font-size:15px;line-height:1.5">${insight}</p>
    </div>

    <a href="https://novurahealth.com/dashboard" style="display:block;background:#1F4B32;color:#FFFFFF;text-decoration:none;text-align:center;padding:14px;border-radius:24px;font-weight:600;margin:24px 0">
      Open NovuraHealth
    </a>

    <p style="color:#6B7A72;font-size:12px;text-align:center;margin-top:32px;line-height:1.5">
      You're receiving this weekly summary because you've enabled it in NovuraHealth.<br>
      <a href="https://novurahealth.com/settings" style="color:#6B7A72">Manage notification settings</a>
    </p>
  </div>
</body>
</html>`
}
