// src/app/api/auth/google/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code    = searchParams.get('code')
  const account = searchParams.get('state') ?? 'main'
  const oauthErr = searchParams.get('error')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  const missing: string[] = []
  if (!process.env.NEXT_PUBLIC_SITE_URL)       missing.push('NEXT_PUBLIC_SITE_URL')
  if (!process.env.GOOGLE_CLIENT_ID)           missing.push('GOOGLE_CLIENT_ID')
  if (!process.env.GOOGLE_CLIENT_SECRET)       missing.push('GOOGLE_CLIENT_SECRET')
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)   missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)  missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (missing.length) {
    return NextResponse.json({
      step: 'env_check', ok: false, missing_env: missing,
      hint: 'เพิ่มตัวแปรเหล่านี้ใน Vercel → Environment Variables แล้ว Redeploy',
    }, { status: 500 })
  }

  if (oauthErr || !code) {
    return NextResponse.json({ step: 'oauth', ok: false, error: oauthErr ?? 'no_code' }, { status: 400 })
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  siteUrl + '/api/auth/google/callback',
      grant_type:    'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()
  if (!tokenRes.ok) {
    return NextResponse.json({
      step: 'token_exchange', ok: false, status: tokenRes.status,
      google_error: tokens, redirect_uri_sent: siteUrl + '/api/auth/google/callback',
    }, { status: 500 })
  }

  if (!tokens.refresh_token) {
    return NextResponse.json({
      step: 'refresh_token', ok: false,
      reason: 'Google ไม่ส่ง refresh_token กลับมา',
      hint: 'ไปที่ https://myaccount.google.com/permissions ลบสิทธิ์ MandoHouse ออกก่อน แล้ว connect ใหม่',
      got_keys: Object.keys(tokens),
    }, { status: 500 })
  }

  const userRes  = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const userInfo = await userRes.json()
  if (!userInfo.email) {
    return NextResponse.json({ step: 'userinfo', ok: false, userInfo }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { error: dbError } = await supabase
    .from('google_calendar_tokens')
    .upsert({
      account_tag:   account,
      email:         userInfo.email,
      refresh_token: tokens.refresh_token,
      scope:         tokens.scope ?? null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'account_tag' })

  if (dbError) {
    return NextResponse.json({
      step: 'supabase_upsert', ok: false, db_error: dbError,
      account_tag: account, email: userInfo.email,
    }, { status: 500 })
  }

  return NextResponse.redirect(`${siteUrl}/staff/schedule/connect?success=connected&email=${encodeURIComponent(userInfo.email)}`)
}
