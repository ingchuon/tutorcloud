import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

// GET /auth/confirm?token_hash=...&type=recovery&next=/reset-password
// This is where the link inside the "reset password" email lands.
// It verifies the token, sets the session cookie, then redirects onward.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/reset-password'

  if (token_hash && type) {
    // If your Next.js version requires it, change this line to:
    // const cookieStore = await cookies()
    const cookieStore = cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Link missing, malformed, or expired — send back to request a new one
  return NextResponse.redirect(new URL('/forgot-password?error=invalid-link', request.url))
}
