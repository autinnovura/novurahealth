import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized } from '../../lib/auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET — list conversations for a coach (query: ?coach=nova&archived=true)
export async function GET(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const coach = req.nextUrl.searchParams.get('coach') || 'nova'
  const archived = req.nextUrl.searchParams.get('archived') === 'true'

  let query = supabaseAdmin
    .from('conversations')
    .select('id, coach, summary, message_count, is_archived, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('coach', coach)
    .eq('is_archived', archived)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For each conversation, fetch the first message as a title preview
  const withPreviews = await Promise.all(
    (data ?? []).map(async (conv) => {
      const { data: firstMsg } = await supabaseAdmin
        .from('messages')
        .select('content')
        .eq('conversation_id', conv.id)
        .eq('role', 'user')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()
      return {
        ...conv,
        preview: firstMsg?.content?.slice(0, 80) || 'Empty conversation',
      }
    })
  )

  return NextResponse.json({ conversations: withPreviews })
}

// POST — create a new conversation (body: { coach: "nova" | "trish" })
export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  let body: { coach?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const coach = body.coach || 'nova'

  // Archive any existing active conversations for this coach
  await supabaseAdmin
    .from('conversations')
    .update({ is_archived: true })
    .eq('user_id', user.id)
    .eq('coach', coach)
    .eq('is_archived', false)

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      user_id: user.id,
      coach,
      summary: null,
      message_count: 0,
      is_archived: false,
    })
    .select('id, coach, summary, message_count, is_archived, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversation: data })
}

// PATCH — archive or unarchive a conversation
export async function PATCH(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  let body: { id?: string; is_archived?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.is_archived !== undefined) updates.is_archived = body.is_archived

  const { error } = await supabaseAdmin
    .from('conversations')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — permanently delete a conversation and its messages
export async function DELETE(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Verify ownership
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  // Delete messages first, then conversation
  await supabaseAdmin.from('messages').delete().eq('conversation_id', id)
  await supabaseAdmin.from('conversations').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
