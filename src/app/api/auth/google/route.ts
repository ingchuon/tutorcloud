// src/app/api/auth/google/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? 'main'

  const clientId    = process.env.GOOGLE_CLIENT_ID
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL

  if (!clientId || !siteUrl) {
    return NextResponse.json({
      ok: false,
      missing_env: [
        !clientId ? 'GOOGLE_CLIENT_ID' : null,
        !siteUrl ? 'NEXT_PUBLIC_SITE_URL' : null,
      ].filter(Boolean),
    }, { status: 500 })
  }

  const redirectUri = siteUrl + '/api/auth/google/callback'

  const scope = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id',              clientId)
  url.searchParams.set('redirect_uri',           redirectUri)
  url.searchParams.set('response_type',          'code')
  url.searchParams.set('scope',                  scope)
  url.searchParams.set('access_type',            'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state',                  account)

  return NextResponse.redirect(url.toString())
}
