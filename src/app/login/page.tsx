'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

const C = {
  cream: '#F5F0E8',
  green: '#1C3A2A',
  gold: '#E8A020',
  text: '#2C2C2C',
  textMid: '#6B6B6B',
  border: '#E2D9CC',
}

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      setLoading(false)
      return
    }

    // ดึง school_id จาก profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', data.user.id)
      .single()

    await new Promise(r => setTimeout(r, 300))

    // ทุกสถาบัน → ไปที่ /staff เหมือนกัน RLS จัดการข้อมูลให้
    window.location.assign('/staff')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.cream,
      fontFamily: "'Noto Sans Thai', 'Inter', sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .tc-input{width:100%;padding:11px 14px;border:1.5px solid ${C.border};border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s;background:#fff;color:${C.text}}
        .tc-input:focus{border-color:${C.green}}
        .tc-input::placeholder{color:#c0b0ac}
      `}</style>

      {/* bg pattern */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, rgba(28,58,42,0.04) 1px, transparent 1px)`, backgroundSize: '24px 24px', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-block', marginBottom: 8 }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-.3px' }}>
              Tutor<em style={{ fontStyle: 'italic', color: C.green }}>cloud</em>
            </span>
          </Link>
          <p style={{ fontSize: 14, color: C.textMid }}>ระบบจัดการสถาบันสอนพิเศษ</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: '32px 28px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 24 }}>เข้าสู่ระบบ</h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 7 }}>อีเมล</label>
              <input
                type="email"
                className="tc-input"
                placeholder="admin@yourschool.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 7 }}>รหัสผ่าน</label>
              <input
                type="password"
                className="tc-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? '#9a8a86' : C.green,
                color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 15,
                fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'background .15s',
                marginTop: 4,
              }}
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 24, paddingTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: C.textMid }}>
              ยังไม่มีบัญชี?{' '}
              <Link href="/register" style={{ color: C.green, fontWeight: 600 }}>
                สมัครทดลองใช้ฟรี 30 วัน
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 12, color: '#b8a8a4', marginTop: 20 }}>
          มีปัญหาเข้าสู่ระบบ?{' '}
          <a href="tel:0633595978" style={{ color: C.green, fontWeight: 500 }}>063-359-5978</a>
        </p>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#c8b8b4', marginTop: 6 }}>
          <Link href="/" style={{ color: '#c8b8b4' }}>กลับหน้าหลัก</Link>
        </p>
      </div>
    </div>
  )
}
