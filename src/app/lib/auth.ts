import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function getAuthedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // setAll is called from Server Components where cookies
            // are read-only. The middleware or next request will pick
            // up the refreshed token instead.
          }
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized', message: 'Session expired. Please refresh the page.' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
