import { createClient, SupabaseClient } from '@supabase/supabase-js'

const MAX_RECENT_MESSAGES = 15
const SUMMARY_MIN_MESSAGES = 20

function getAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export async function getActiveConversation(
  userId: string,
  coach: 'nova' | 'trish'
): Promise<{ id: string; summary: string | null; message_count: number } | null> {
  const db = getAdmin()
  const { data } = await db
    .from('conversations')
    .select('id, summary, message_count')
    .eq('user_id', userId)
    .eq('coach', coach)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

export async function createConversation(
  userId: string,
  coach: 'nova' | 'trish'
): Promise<{ id: string; summary: string | null; message_count: number }> {
  const db = getAdmin()
  const { data, error } = await db
    .from('conversations')
    .insert({ user_id: userId, coach, summary: null, message_count: 0, is_archived: false })
    .select('id, summary, message_count')
    .single()
  if (error || !data) throw new Error(`Failed to create conversation: ${error?.message}`)
  return data
}

export async function archiveConversation(conversationId: string): Promise<void> {
  const db = getAdmin()
  await db
    .from('conversations')
    .update({ is_archived: true })
    .eq('id', conversationId)
}

export async function getRecentMessages(
  conversationId: string,
  limit = MAX_RECENT_MESSAGES
): Promise<{ role: string; content: string; created_at: string }[]> {
  const db = getAdmin()
  const { data } = await db
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).reverse()
}

export async function getUserFacts(
  userId: string,
  limit = 30
): Promise<{ category: string; fact: string }[]> {
  const db = getAdmin()
  const { data } = await db
    .from('user_facts')
    .select('category, fact')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function saveMessage(
  userId: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const db = getAdmin()
  await db.from('messages').insert({
    user_id: userId,
    conversation_id: conversationId,
    role,
    content,
  })
  // Increment message_count (manual since RPC may not exist)
  const { data: convRow } = await db
    .from('conversations')
    .select('message_count')
    .eq('id', conversationId)
    .single()
  if (convRow) {
    await db
      .from('conversations')
      .update({ message_count: (convRow.message_count || 0) + 1 })
      .eq('id', conversationId)
  }
}

export async function saveFact(
  userId: string,
  category: string,
  fact: string,
  source: string
): Promise<{ success: boolean; error?: string }> {
  const db = getAdmin()
  // Check for duplicate facts
  const { data: existing } = await db
    .from('user_facts')
    .select('id, fact')
    .eq('user_id', userId)
    .eq('is_active', true)
    .ilike('fact', `%${fact.slice(0, 40)}%`)
    .limit(1)
  if (existing?.length) {
    // Update existing fact if similar
    const { error } = await db
      .from('user_facts')
      .update({ fact, category, source, updated_at: new Date().toISOString() })
      .eq('id', existing[0].id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  }
  const { error } = await db.from('user_facts').insert({
    user_id: userId,
    category,
    fact,
    source,
    confidence: 0.8,
    is_active: true,
    pinned: false,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function maybeUpdateSummary(conversationId: string): Promise<void> {
  const db = getAdmin()

  const { data: conv } = await db
    .from('conversations')
    .select('message_count, summary, summary_updated_at')
    .eq('id', conversationId)
    .single()

  if (!conv) return

  // Only summarize if 20+ messages AND either no summary or enough time has passed
  const needsSummary = conv.message_count >= SUMMARY_MIN_MESSAGES && (
    !conv.summary ||
    !conv.summary_updated_at ||
    (Date.now() - new Date(conv.summary_updated_at).getTime()) > 3600000
  )

  if (!needsSummary) return

  // Fetch messages older than the most recent 15
  const { data: oldMessages } = await db
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(MAX_RECENT_MESSAGES, 200)

  if (!oldMessages?.length) return

  const transcript = oldMessages
    .reverse()
    .map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n\n')

  try {
    const summaryRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: 'You summarize conversations between a GLP-1 medication coach and their user. Keep summaries tight — focus on: decisions made, preferences discovered, challenges raised, goals set, side effects reported. Skip pleasantries. Output as short dash-prefixed bullets, no prose. Max 400 words.',
        messages: [{ role: 'user', content: `Summarize this conversation:\n\n${transcript}` }],
      }),
    })

    const data = await summaryRes.json()
    const summary = data.content?.[0]?.text

    if (summary) {
      await db
        .from('conversations')
        .update({
          summary,
          summary_updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
    }
  } catch (err) {
    console.error('Summary generation failed:', err)
  }
}

export function buildContextSections(
  facts: { category: string; fact: string }[],
  summary: string | null
): { factsSection: string; summarySection: string } {
  const factsSection = facts.length
    ? `\n\nWhat you know about this user (remembered from past conversations):\n${facts.map(f => `- [${f.category}] ${f.fact}`).join('\n')}`
    : ''

  const summarySection = summary
    ? `\n\nEarlier conversation summary:\n${summary}`
    : ''

  return { factsSection, summarySection }
}

export const REMEMBER_FACT_TOOL = {
  name: 'remember_fact',
  description: 'Save an important, durable fact about the user that should be remembered across all future conversations. Use when the user shares something meaningful about their preferences, health, goals, routines, or context. DO NOT use for transient things like what they ate for lunch today.',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        enum: ['preference', 'health', 'goal', 'context', 'allergy', 'routine', 'other'],
        description: 'The category of the fact',
      },
      fact: {
        type: 'string',
        description: 'The fact written in third person, e.g. "Prefers high-protein breakfasts" or "Gets nauseous on injection days"',
      },
    },
    required: ['category', 'fact'],
  },
}

export const REMEMBER_FACT_PROMPT = `When the user shares durable information about themselves (preferences, health conditions, goals, routines, allergies, work context, family context), use the remember_fact tool to save it. These facts will be available to you in every future conversation. Only save things that will matter for more than today — not what they ate this morning.`
