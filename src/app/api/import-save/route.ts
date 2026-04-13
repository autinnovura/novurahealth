import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(req: NextRequest) {
  try {
    const { userId, data } = await req.json()

    if (!userId || !data) {
      return NextResponse.json({ error: 'Missing userId or data' }, { status: 400 })
    }

    const results: Record<string, number> = {}

    // Import weight logs
    if (data.weight_logs?.length) {
      const rows = data.weight_logs.map((w: any) => ({
        user_id: userId,
        weight: w.unit === 'kg' ? Math.round(w.weight * 2.205 * 10) / 10 : w.weight,
        logged_at: w.date ? new Date(w.date).toISOString() : new Date().toISOString(),
      }))
      const { data: inserted, error } = await supabaseAdmin.from('weight_logs').insert(rows).select()
      if (!error) results.weight = inserted?.length || 0
    }

    // Import food logs
    if (data.food_logs?.length) {
      const rows = data.food_logs.map((f: any) => ({
        user_id: userId,
        food_name: f.food_name,
        calories: f.calories || null,
        protein: f.protein || null,
        carbs: f.carbs || null,
        fat: f.fat || null,
        logged_at: f.date ? new Date(f.date).toISOString() : new Date().toISOString(),
      }))
      const { data: inserted, error } = await supabaseAdmin.from('food_logs').insert(rows).select()
      if (!error) results.food = inserted?.length || 0
    }

    // Import medication logs
    if (data.medication_logs?.length) {
      const rows = data.medication_logs.map((m: any) => ({
        user_id: userId,
        medication: m.medication,
        dose: m.dose,
        injection_site: m.injection_site || null,
        logged_at: m.date ? new Date(m.date).toISOString() : new Date().toISOString(),
      }))
      const { data: inserted, error } = await supabaseAdmin.from('medication_logs').insert(rows).select()
      if (!error) results.medication = inserted?.length || 0
    }

    // Import water logs
    if (data.water_logs?.length) {
      const rows = data.water_logs.map((w: any) => ({
        user_id: userId,
        amount_oz: w.amount_oz,
        logged_at: w.date ? new Date(w.date).toISOString() : new Date().toISOString(),
      }))
      const { data: inserted, error } = await supabaseAdmin.from('water_logs').insert(rows).select()
      if (!error) results.water = inserted?.length || 0
    }

    // Import side effect logs
    if (data.side_effect_logs?.length) {
      const rows = data.side_effect_logs.map((s: any) => ({
        user_id: userId,
        symptom: s.symptom,
        severity: s.severity || 3,
        logged_at: s.date ? new Date(s.date).toISOString() : new Date().toISOString(),
      }))
      const { data: inserted, error } = await supabaseAdmin.from('side_effect_logs').insert(rows).select()
      if (!error) results.side_effects = inserted?.length || 0
    }

    // Import exercise logs
    if (data.exercise_logs?.length) {
      const rows = data.exercise_logs.map((e: any) => ({
        user_id: userId,
        exercise_type: e.exercise_type,
        duration_min: e.duration_min || null,
        notes: e.notes || null,
        logged_at: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
      }))
      const { data: inserted, error } = await supabaseAdmin.from('exercise_logs').insert(rows).select()
      if (!error) results.exercise = inserted?.length || 0
    }

    const total = Object.values(results).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      success: true,
      message: `Imported ${total} entries to your account.`,
      results,
    })

  } catch (error) {
    console.error('Import save error:', error)
    return NextResponse.json({ success: false, message: 'Failed to save imported data.' }, { status: 500 })
  }
}
