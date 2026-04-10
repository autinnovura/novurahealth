import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || !body.food) {
      return NextResponse.json({ error: 'Food description required.' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: `You are a nutrition calculator. Given a food description, estimate the macronutrients. Respond ONLY with valid JSON in this exact format, no other text:
{"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
All values should be integers (grams for macros, total for calories). Be as accurate as possible based on standard USDA nutritional data. If the description includes a quantity (like "8 oz" or "2 eggs"), calculate for that amount. If no quantity is given, assume a typical single serving.`,
      messages: [{ role: 'user', content: body.food }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    
    // Parse the JSON response
    const cleaned = text.replace(/```json|```/g, '').trim()
    const macros = JSON.parse(cleaned)

    return NextResponse.json({
      calories: Math.round(macros.calories) || 0,
      protein: Math.round(macros.protein) || 0,
      carbs: Math.round(macros.carbs) || 0,
      fat: Math.round(macros.fat) || 0,
    })

  } catch (error) {
    console.error('Food lookup error:', error)
    return NextResponse.json(
      { calories: 0, protein: 0, carbs: 0, fat: 0, error: 'Could not estimate macros.' },
      { status: 200 }
    )
  }
}
