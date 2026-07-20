// src/app/api/calendar/events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TokenRow = {
  account_tag: string
  email: string
  refresh_token: string
}

type GoogleEvent = {
  id: string
  summary?: string
  description?: string
  location?: string
  status?: string
  hangoutLink?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

type GoogleCalendar = {
  id: string
  summary?: string
  accessRole?: string
}

const EMAIL_TO_TAG: Record<string, string> = {
  'ingchuon12@gmail.com': 'main',
  'aomsmartlink.90@gmail.com': 'aom',
  'nalinrat19060@gmail.com': 'nalin',
}

type TokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; error: string; errorDescription: string }

async function getAccessToken(refreshToken: string): Promise<TokenResult> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  const json = await res.json()
  if (!res.ok) {
    return {
      ok: false,
      error: json.error ?? 'unknown_error',
      errorDescription: json.error_description ?? '',
    }
  }
  return { ok: true, accessToken: json.access_token }
}

async function fetchCalendarList(accessToken: string): Promise<GoogleCalendar[]> {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  )
  if (!res.ok) return []
  const json = (await res.json()) as { items?: GoogleCalendar[] }
  return json.items ?? []
}

async function fetchEventsFromCalendar(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<(GoogleEvent & { _calendarId: string })[]> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  )
  url.searchParams.set('timeMin', timeMin)
  url.searchParams.set('timeMax', timeMax)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '250')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const json = (await res.json()) as { items?: GoogleEvent[] }
  return (json.items ?? []).map((e) => ({ ...e, _calendarId: calendarId }))
}

async function fetchAllEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<(GoogleEvent & { _calendarId: string })[]> {
  const calendars = await fetchCalendarList(accessToken)
  const relevant = calendars.filter(
    (cal) =>
      cal.accessRole === 'owner' ||
      cal.accessRole === 'writer' ||
      cal.accessRole === 'reader'
  )

  const allResults = await Promise.all(
    relevant.map((cal) =>
      fetchEventsFromCalendar(accessToken, cal.id, timeMin, timeMax)
    )
  )

  const seen = new Set<string>()
  const merged: (GoogleEvent & { _calendarId: string })[] = []
  for (const items of allResults) {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        merged.push(item)
      }
    }
  }
  return merged
}

function resolveAccount(calendarId: string, fallbackTag: string): string {
  return EMAIL_TO_TAG[calendarId] ?? fallbackTag
}

async function notifyTokenExpired(email: string, errorDesc: string) {
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const lineGroupId = process.env.LINE_GROUP_ID
  if (!lineToken || !lineGroupId) return

  const msg = `⚠️ Google Calendar token หมดอายุ\nAccount: ${email}\nสาเหตุ: ${errorDesc}\n\nกรุณาไปที่ /staff/schedule/connect เพื่อเชื่อมต่อใหม่`

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lineToken}`,
    },
    body: JSON.stringify({
      to: lineGroupId,
      messages: [{ type: 'text', text: msg }],
    }),
  }).catch(() => {})
}

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'missing_supabase_env', events: [] },
      { status: 500 }
    )
  }

  // ✅ ดึง school_id จาก session ของ user ที่ login อยู่
  const userSupabase = createClient()
  const { data: { user } } = await userSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized', events: [] },
      { status: 401 }
    )
  }

  const { data: profile } = await userSupabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  const schoolId = profile?.school_id ?? null
  if (!schoolId) {
    return NextResponse.json(
      { error: 'no_school_id', events: [] },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const now = new Date()
  const timeMin = fromParam
    ? new Date(fromParam).toISOString()
    : new Date(now.getTime() - 7 * 86400000).toISOString()
  const timeMax = toParam
    ? new Date(toParam).toISOString()
    : new Date(now.getTime() + 30 * 86400000).toISOString()

  // ✅ ใช้ service_role เฉพาะตอน query tokens แต่ filter ด้วย school_id เสมอ
  const supabase = createServerClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: tokens, error } = await supabase
    .from('google_calendar_tokens')
    .select('account_tag, email, refresh_token')
    .eq('school_id', schoolId) // ✅ กรองเฉพาะ token ของสถาบันนี้เท่านั้น

  if (error) {
    return NextResponse.json(
      { error: 'db_error', detail: error.message, events: [] },
      { status: 500 }
    )
  }

  const rows = (tokens ?? []) as TokenRow[]
  if (rows.length === 0) {
    return NextResponse.json({ events: [], accounts: [], timeMin, timeMax })
  }

  const allRawResults = await Promise.all(
    rows.map(async (t) => {
      const tokenResult = await getAccessToken(t.refresh_token)

      if (!tokenResult.ok) {
        notifyTokenExpired(t.email, tokenResult.errorDescription)
        return {
          account: t.account_tag,
          email: t.email,
          ok: false,
          tokenError: tokenResult.error,
          items: [] as (GoogleEvent & { _calendarId: string })[],
        }
      }

      const items = await fetchAllEvents(tokenResult.accessToken, timeMin, timeMax)
      return { account: t.account_tag, email: t.email, ok: true, tokenError: null, items }
    })
  )

  const globalSeen = new Set<string>()
  const allEvents: any[] = []
  const accountStats: any[] = []

  for (const result of allRawResults) {
    let count = 0
    if (result.ok) {
      for (const e of result.items) {
        if (!globalSeen.has(e.id)) {
          globalSeen.add(e.id)
          const title = e.summary ?? '(ไม่มีชื่อ)'
          const resolvedAccount = resolveAccount(e._calendarId, result.account)

          allEvents.push({
            id: e.id,
            title,
            start: e.start?.dateTime ?? e.start?.date ?? '',
            end: e.end?.dateTime ?? e.end?.date ?? '',
            allDay: !e.start?.dateTime,
            account: resolvedAccount,
            email: result.email,
            description: e.description ?? '',
            location: e.location ?? '',
            meetLink: e.hangoutLink ?? '',
            cancelled: title.includes('❌'),
          })
          count++
        }
      }
    }
    accountStats.push({
      account: result.account,
      email: result.email,
      ok: result.ok,
      tokenError: result.tokenError,
      count,
    })
  }

  allEvents.sort((a, b) => a.start.localeCompare(b.start))

  return NextResponse.json({
    events: allEvents,
    accounts: accountStats,
    timeMin,
    timeMax,
  })
}
