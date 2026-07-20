// src/app/staff/schedule/connect/page.tsx
// หน้า authorize — กดปุ่มต่อ Google Calendar แต่ละ account
'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const ACCOUNTS = [
  { tag: 'main',  email: 'ingchuon12@gmail.com',      label: 'บัญชีหลัก (Ingchuon)',  color: '#3B9EE0' },
  { tag: 'aom',   email: 'aomsmartlink.90@gmail.com', label: 'ครูออม (Aom)',           color: '#F5A623' },
  { tag: 'nalin', email: 'nalinrat19060@gmail.com',   label: 'ครูบี (Nalinrat)',       color: '#7C6FF7' },
]

function ConnectContent() {
  const params = useSearchParams()
  const success = params.get('success')
  const error   = params.get('error')
  const email   = params.get('email')

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-semibold mb-1">🗓 เชื่อมต่อ Google Calendar</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        กดปุ่ม "เชื่อมต่อ" ต่อ account และล็อกอินด้วย Gmail ที่ถูกต้อง ทำครั้งเดียว ระบบจะจำไว้เอง
      </p>

      {success && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm">
          ✅ เชื่อมต่อสำเร็จ: <strong>{email}</strong>
        </div>
      )}
      {error === 'google_denied' && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
          ❌ ยกเลิกการเชื่อมต่อ กรุณาลองใหม่
        </div>
      )}
      {error === 'no_refresh_token' && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 text-sm">
          ⚠️ ไม่ได้รับ refresh token — ลองกด "เชื่อมต่อ" ใหม่อีกครั้ง (ถ้าเคย connect ไว้แล้วให้ revoke ที่ myaccount.google.com/permissions ก่อน)
        </div>
      )}

      <div className="space-y-3">
        {ACCOUNTS.map(acc => (
          <div key={acc.tag} className="card p-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-sm text-gray-800 dark:text-gray-100">{acc.label}</div>
              <div className="text-xs text-gray-400">{acc.email}</div>
            </div>
            <a
              href={`/api/auth/google?account=${acc.tag}`}
              className="btn-brand text-sm flex-shrink-0"
              style={{ background: acc.color }}
            >
              🔗 เชื่อมต่อ
            </a>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-[#1e2533] rounded-xl text-xs text-gray-500 dark:text-gray-400 space-y-1.5">
        <p className="font-medium text-gray-600 dark:text-gray-300">⚠️ ก่อนเชื่อมต่อ ต้องมีก่อน:</p>
        <p>1. Google Cloud Project + Calendar API enabled</p>
        <p>2. OAuth 2.0 Client ID/Secret ใน <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">.env.local</code></p>
        <p className="pt-1">ตัวแปรที่ต้องใส่ใน Vercel Environment Variables:</p>
        <code className="block bg-gray-200 dark:bg-gray-700 p-2 rounded text-[11px] leading-relaxed">
          GOOGLE_CLIENT_ID=...<br/>
          GOOGLE_CLIENT_SECRET=...
        </code>
      </div>

      <a href="/staff/schedule" className="btn-outline mt-4 inline-block text-sm">
        ← กลับหน้าตารางสอน
      </a>
    </div>
  )
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">กำลังโหลด...</div>}>
      <ConnectContent />
    </Suspense>
  )
}
