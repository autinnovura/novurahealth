import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser, unauthorized } from '../../lib/auth'

const DRUG_PRICES: Record<string, { brand: number; generic: number | null; savings_card: string | null; max_savings: number | null }> = {
  'Ozempic': { brand: 950, generic: null, savings_card: 'Novo Nordisk Savings Card', max_savings: 150 },
  'Wegovy': { brand: 1350, generic: null, savings_card: 'Novo Nordisk Savings Card', max_savings: 225 },
  'Mounjaro': { brand: 1050, generic: null, savings_card: 'Lilly Savings Card', max_savings: 150 },
  'Zepbound': { brand: 1060, generic: null, savings_card: 'Lilly Savings Card', max_savings: 150 },
  'Saxenda': { brand: 1400, generic: null, savings_card: 'Novo Nordisk Savings Card', max_savings: 200 },
  'Rybelsus': { brand: 950, generic: null, savings_card: 'Novo Nordisk Savings Card', max_savings: 150 },
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { message, profile, savingsProfile } = await req.json()

  const med = profile?.medication || 'GLP-1'
  const pricing = DRUG_PRICES[med] || DRUG_PRICES['Ozempic']

  const systemPrompt = `You are Nova, the savings advisor inside NovuraHealth. You help GLP-1 medication users reduce their out-of-pocket costs.

USER CONTEXT:
- Medication: ${med} at ${profile?.dose || 'unknown dose'}
- Average brand cost: ~$${pricing.brand}/month
- Available manufacturer savings card: ${pricing.savings_card || 'Unknown'}
- Max savings card benefit: ~$${pricing.max_savings || '?'}/month
${savingsProfile ? `- Current monthly cost: $${savingsProfile.monthly_cost || '?'}
- Has insurance: ${savingsProfile.has_insurance ? 'Yes' : 'No'}
- Insurance provider: ${savingsProfile.insurance_provider || 'Unknown'}
- Uses manufacturer coupon: ${savingsProfile.uses_manufacturer_coupon ? 'Yes' : 'No'}
- Pharmacy type: ${savingsProfile.pharmacy_type || 'Unknown'}
- Total saved so far: $${savingsProfile.total_saved || 0}` : 'No savings profile set up yet'}

SAVINGS STRATEGIES YOU CAN RECOMMEND:
1. Manufacturer savings cards (most GLP-1 makers offer them — can save $150-500/month)
2. Prior authorization help — walk through the process step by step
3. Appeal denial letters — help draft appeal language
4. Pharmacy comparison — mail-order vs retail vs compounding pharmacies
5. Compounded semaglutide — significantly cheaper ($100-300/month) but explain tradeoffs
6. Patient assistance programs for uninsured/underinsured
7. FSA/HSA usage for GLP-1 medications
8. Switching medications if cost is the barrier
9. Canadian pharmacy options (legal gray area — mention but don't push)
10. GoodRx and similar discount platforms

RULES:
- Be direct and actionable. Give specific dollar amounts when possible.
- Don't overwhelm — give 1-2 strategies at a time based on their situation
- 2-4 sentences typically
- If they have insurance, focus on manufacturer cards + prior auth
- If uninsured, focus on patient assistance + compounding
- Never recommend stopping medication due to cost without flagging doctor consultation
- Talk like a person, not a financial advisor`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    })

    console.log('SAVINGS-CHAT ANTHROPIC STATUS:', res.status)
    if (!res.ok) {
      const errorBody = await res.text()
      console.error('SAVINGS-CHAT ANTHROPIC ERROR:', errorBody)
      return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
    }

    const result = await res.json()
    const reply = result.content?.[0]?.text
    if (!reply) {
      console.error('SAVINGS-CHAT EMPTY REPLY:', JSON.stringify(result))
      return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
    }
    return NextResponse.json({ message: reply })
  } catch (error) {
    console.error('SAVINGS-CHAT ROUTE ERROR:', error)
    return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
  }
}
