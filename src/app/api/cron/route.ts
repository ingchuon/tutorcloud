// src/app/api/cron/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TokenRow = {
  account_tag: string
  email: string
  refresh_token: string
}

async function checkToken(refreshToken: string): Promise<{ ok: boolean; error?: string }> {
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
  if (res.ok) return { ok: true }
  const json = await res.json()
  return { ok: false, error: json.error_description ?? json.error ?? 'unknown' }
}

async function sendLine(msg: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const groupId = process.env.LINE_GROUP_ID
  if (!token || !groupId) return

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text: msg }],
    }),
  }).catch(() => {})
}

export async function GET(req: Request) {
  // ป้องกัน unauthorized call
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: tokens } = await supabase
    .from('google_calendar_tokens')
    .select('account_tag, email, refresh_token')

  const rows = (tokens ?? []) as TokenRow[]
  const results: { account: string; email: string; ok: boolean; error?: string }[] = []
  const broken: string[] = []

  for (const t of rows) {
    const result = await checkToken(t.refresh_token)
    results.push({ account: t.account_tag, email: t.email, ...result })
    if (!result.ok) {
      broken.push(`• ${t.email} (${t.account_tag}): ${result.error}`)
    }
  }

  if (broken.length > 0) {
    const msg = [
      '⚠️ MandoHouse — Google Calendar token เสีย!',
      '',
      ...broken,
      '',
      '👉 แก้ไขได้ที่: https://mandohouse.vercel.app/staff/schedule/connect',
    ].join('\n')
    await sendLine(msg)
  }

  return NextResponse.json({
    checked: results.length,
    broken: broken.length,
    results,
    timestamp: new Date().toISOString(),
  })
}
