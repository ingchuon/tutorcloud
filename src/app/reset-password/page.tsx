'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setCheckingSession(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }
    if (password !== confirm) {
      setError('รหัสผ่านไม่ตรงกัน')
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      setError('ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่')
      return
    }
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <div style={{ fontFamily: "'Noto Sans Thai', 'Inter', sans-serif", background: C.bg, color: C.text, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@400;700;900&display=swap');
        *{box-sizing:border-box}
        input[type=password]{width:100%;padding:12px 14px;border:1.5px solid ${C.border};border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s;background:#fff;color:${C.text}}
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
          {checkingSession ? (
            <p style={{ fontSize: 14, color: C.textMid, textAlign: 'center', padding: '20px 0' }}>กำลังตรวจสอบลิงก์...</p>
          ) : !hasSession ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>ลิงก์หมดอายุ</h1>
              <p style={{ fontSize: 14, color: C.textMid, marginBottom: 22, lineHeight: 1.75 }}>
                ลิงก์รีเซ็ตรหัสผ่านนี้ใช้ไม่ได้แล้ว หรือเคยใช้ไปแล้ว<br />กรุณาขอลิงก์ใหม่อีกครั้ง
              </p>
              <Link href="/forgot-password" className="btn-dark" style={{ display: 'inline-block', width: 'auto', padding: '11px 28px', textAlign: 'center' }}>
                ขอลิงก์ใหม่
              </Link>
            </div>
          ) : done ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.goldLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 6" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>ตั้งรหัสผ่านใหม่สำเร็จ</h1>
              <p style={{ fontSize: 14, color: C.textMid, lineHeight: 1.75 }}>กำลังพาไปหน้าเข้าสู่ระบบ...</p>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>ตั้งรหัสผ่านใหม่</h1>
              <p style={{ fontSize: 13, color: C.textMid, marginBottom: 24, lineHeight: 1.6 }}>
                กรอกรหัสผ่านใหม่ที่ต้องการใช้ตั้งแต่ครั้งต่อไป
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>รหัสผ่านใหม่</label>
                  <input type="password" required placeholder="อย่างน้อย 6 ตัวอักษร" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>ยืนยันรหัสผ่านใหม่</label>
                  <input type="password" required placeholder="พิมพ์อีกครั้ง" value={confirm} onChange={e => setConfirm(e.target.value)} />
                </div>
                {error && <p style={{ fontSize: 13, color: '#C0392B' }}>{error}</p>}
                <button type="submit" disabled={saving} className="btn-dark">
                  {saving ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
