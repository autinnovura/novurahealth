import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized } from '../../lib/auth'
import { importLimiter, checkRateLimit } from '../../lib/rate-limit'

const MAX_FILE_SIZE = 10 * 1024 * 1024   // 10MB per file

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { success: allowed } = await checkRateLimit(importLimiter, user.id)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please slow down.' }, { status: 429 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('image') as File
    const userId = user.id
    const context = formData.get('context') as string || ''

    if (!file) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 10MB limit.' },
        { status: 413 }
      )
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = file.type || 'image/jpeg'

    // Send to Claude Vision to extract health data
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are a health data extraction assistant for NovuraHealth, a GLP-1 medication tracking app. 

The user has uploaded a screenshot or photo of their previous health tracking data (from a spreadsheet, another app, handwritten notes, etc.).

Your job is to extract ALL health data from the image and return it as a JSON object. Extract whatever is visible — don't ask for clarification, just extract what you can see.

Return ONLY a valid JSON object (no markdown, no backticks, no explanation) with this structure:
{
  "extracted": true,
  "summary": "Brief description of what you found",
  "weight_logs": [{"date": "YYYY-MM-DD", "weight": number, "unit": "lbs" or "kg"}],
  "food_logs": [{"date": "YYYY-MM-DD", "food_name": "string", "calories": number or null, "protein": number or null, "carbs": number or null, "fat": number or null}],
  "medication_logs": [{"date": "YYYY-MM-DD", "medication": "string", "dose": "string", "injection_site": "string or null"}],
  "water_logs": [{"date": "YYYY-MM-DD", "amount_oz": number}],
  "side_effect_logs": [{"date": "YYYY-MM-DD", "symptom": "string", "severity": 1-5}],
  "exercise_logs": [{"date": "YYYY-MM-DD", "exercise_type": "string", "duration_min": number or null, "notes": "string or null"}]
}

Rules:
- Only include arrays that have data. If no weight data is visible, omit weight_logs entirely.
- Dates should be in YYYY-MM-DD format. If only a day/month is visible, assume current year.
- If units aren't specified, assume lbs for weight and oz for water.
- For food, extract whatever nutritional info is visible. It's fine if only calories are shown.
- Be thorough — extract every row/entry you can see.
- If the image doesn't contain health data, return: {"extracted": false, "summary": "Description of what the image shows"}`,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 }
            },
            {
              type: 'text',
              text: context ? `User context: ${context}\n\nExtract all health data from this image.` : 'Extract all health data from this image.'
            }
          ]
        }]
      }),
    })

    const result = await res.json()
    const responseText = result.content?.[0]?.text || '{}'

    let parsed
    try {
      // Strip any markdown fences just in case
      const clean = responseText.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return NextResponse.json({
        success: false,
        message: "Couldn't parse the data from that image. Try a clearer screenshot.",
        raw: responseText
      })
    }

    if (!parsed.extracted) {
      return NextResponse.json({
        success: false,
        message: parsed.summary || "Couldn't find health data in that image.",
      })
    }

    // Count what we found
    const counts = {
      weight: parsed.weight_logs?.length || 0,
      food: parsed.food_logs?.length || 0,
      medication: parsed.medication_logs?.length || 0,
      water: parsed.water_logs?.length || 0,
      side_effects: parsed.side_effect_logs?.length || 0,
      exercise: parsed.exercise_logs?.length || 0,
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      success: true,
      message: `Found ${total} entries: ${parsed.summary}`,
      data: parsed,
      counts,
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ success: false, message: 'Something went wrong processing the image.' }, { status: 500 })
  }
}
