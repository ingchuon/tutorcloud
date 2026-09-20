'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

const C = {
  bg: '#F5F0E8',
  dark: '#1C2B1A',
  green: '#1C3A2A',
  gold: '#E8A020',
  goldLight: '#FEF3D0',
  text: '#2C2C2C',
  textMid: '#6B6B6B',
  border: '#E2D9CC',
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    })
    setSending(false)
    if (error) {
      setError('ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      return
    }
    setSent(true)
  }

  return (
    <div style={{ fontFamily: "'Noto Sans Thai', 'Inter', sans-serif", background: C.bg, color: C.text, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@400;700;900&display=swap');
        *{box-sizing:border-box}
        input[type=email]{width:100%;padding:12px 14px;border:1.5px solid ${C.border};border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s;background:#fff;color:${C.text}}
        input:focus{border-color:${C.green}}
        .btn-dark{background:${C.dark};color:#fff;padding:12px;border-radius:99px;font-size:14px;font-weight:600;border:none;cursor:pointer;font-family:inherit;width:100%;transition:opacity .15s}
        .btn-dark:hover{opacity:.85}
        .btn-dark:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Inter',sans-serif", color: C.gold, fontWeight: 900, fontSize: 13 }}>T</span>
          </div>
          <span style={{ fontFamily: "'Inter',sans-serif", color: C.text, fontWeight: 700, fontSize: 17 }}>
            Tutor<em style={{ fontStyle: 'italic', color: C.green }}>cloud</em>
          </span>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 20, padding: 32 }}>
          {!sent ? (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>ลืมรหัสผ่าน?</h1>
              <p style={{ fontSize: 13, color: C.textMid, marginBottom: 24, lineHeight: 1.6 }}>
                กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้ทางอีเมล
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>อีเมล</label>
                  <input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                {error && <p style={{ fontSize: 13, color: '#C0392B' }}>{error}</p>}
                <button type="submit" disabled={sending} className="btn-dark">
                  {sending ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.goldLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 6" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>ส่งอีเมลแล้ว</h1>
              <p style={{ fontSize: 14, color: C.textMid, lineHeight: 1.75 }}>
                ตรวจสอบกล่องอีเมล <strong style={{ color: C.text }}>{email}</strong><br />
                คลิกลิงก์ในอีเมลเพื่อตั้งรหัสผ่านใหม่
              </p>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/login" style={{ fontSize: 13, color: C.textMid }}>← กลับไปหน้าเข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  )
}
