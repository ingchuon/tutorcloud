'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const C = {
  brown: '#A15C38',
  brownLight: '#f5ede9',
  brownMid: '#e8d5cc',
  dark: '#262220',
  cream: '#F7F1F0',
}

const PLAN_PRICE: Record<string, number> = {
  starter: 490,
  growth: 790,
  pro: 1990,
}

type School = {
  id: string
  name: string
  plan: string
  status: string
  slip_path: string | null
  created_at: string
  expires_at: string | null
}

export default function SubscriptionsPage() {
  const supabase = createClient()
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [slipUrl, setSlipUrl] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'active' | 'all'>('pending')

  async function load() {
    setLoading(true)
    let q = supabase.from('schools').select('*').order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setSchools((data ?? []).filter(s => s.id !== 'mando'))
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  async function viewSlip(slipPath: string) {
    const { data } = await supabase.storage.from('payment-slips').createSignedUrl(slipPath, 60)
    if (data?.signedUrl) setSlipUrl(data.signedUrl)
  }

  async function approve(school: School) {
    setApproving(school.id)
    const expires = new Date()
    expires.setMonth(expires.getMonth() + 1)

    const { error } = await supabase.from('schools').update({
      status: 'active',
      expires_at: expires.toISOString().split('T')[0],
    }).eq('id', school.id)

    if (error) {
      toast.error('อนุมัติไม่สำเร็จ: ' + error.message)
    } else {
      toast.success(`อนุมัติ ${school.name} แล้ว`)
      load()
    }
    setApproving(null)
  }

  async function reject(school: School) {
    if (!confirm(`ปฏิเสธ "${school.name}" ใช่ไหม?`)) return
    const { error } = await supabase.from('schools').update({ status: 'rejected' }).eq('id', school.id)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    toast.success('ปฏิเสธแล้ว')
    load()
  }

  async function suspend(school: School) {
    if (!confirm(`ระงับ "${school.name}" ใช่ไหม?`)) return
    const { error } = await supabase.from('schools').update({ status: 'expired' }).eq('id', school.id)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    toast.success('ระงับแล้ว')
    load()
  }

  function statusBadge(status: string) {
    const map: Record<string, { label: string; bg: string; color: string }> = {
      pending:  { label: 'รอตรวจสอบ', bg: '#FEF3C7', color: '#92400E' },
      active:   { label: 'ใช้งานอยู่',  bg: '#D1FAE5', color: '#065F46' },
      expired:  { label: 'หมดอายุ',    bg: '#FEE2E2', color: '#991B1B' },
      rejected: { label: 'ปฏิเสธ',     bg: '#F3F4F6', color: '#6B7280' },
    }
    const s = map[status] ?? { label: status, bg: '#F3F4F6', color: '#6B7280' }
    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: s.bg, color: s.color }}>
        {s.label}
      </span>
    )
  }

  const pending = schools.filter(s => s.status === 'pending').length
  const active = schools.filter(s => s.status === 'active').length
  const revenue = schools.filter(s => s.status === 'active').reduce((a, s) => a + (PLAN_PRICE[s.plan] ?? 0), 0)

  return (
    <div className="p-4 md:p-6">

      {/* Slip Modal */}
      {slipUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setSlipUrl(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 16, maxWidth: 400, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>สลิปการโอนเงิน</span>
              <button onClick={() => setSlipUrl(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            <img src={slipUrl} alt="slip" style={{ width: '100%', borderRadius: 8 }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">จัดการ Subscription</h1>
          <p className="text-sm text-gray-500 mt-0.5">อนุมัติสลิปและจัดการลูกค้า TutorCloud</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'รอตรวจสอบ', value: pending, color: '#92400E', bg: '#FEF3C7' },
          { label: 'ใช้งานอยู่', value: active, color: '#065F46', bg: '#D1FAE5' },
          { label: 'รายได้/เดือน', value: `฿${revenue.toLocaleString()}`, color: C.brown, bg: C.brownLight },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['pending', 'active', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 16px', borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1.5px solid ${filter === f ? C.brown : C.brownMid}`, background: filter === f ? C.brown : '#fff', color: filter === f ? '#fff' : C.dark, fontFamily: 'inherit', transition: 'all .15s' }}>
            {f === 'pending' ? 'รอตรวจสอบ' : f === 'active' ? 'ใช้งานอยู่' : 'ทั้งหมด'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-center text-gray-400 py-12">กำลังโหลด...</p>
        ) : schools.length === 0 ? (
          <p className="text-center text-gray-400 py-12">ไม่มีข้อมูล</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left p-3 text-sm font-semibold text-gray-500 border-b">สถาบัน</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-500 border-b">แพ็กเกจ</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-500 border-b">สถานะ</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-500 border-b">วันสมัคร</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-500 border-b">หมดอายุ</th>
                <th className="p-3 border-b"></th>
              </tr>
            </thead>
            <tbody>
              {schools.map(school => (
                <tr key={school.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-[#1e2533] transition-colors">
                  <td className="p-3">
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{school.name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{school.id}</div>
                  </td>
                  <td className="p-3">
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.brown, textTransform: 'capitalize' }}>{school.plan}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>฿{(PLAN_PRICE[school.plan] ?? 0).toLocaleString()}/เดือน</div>
                  </td>
                  <td className="p-3">{statusBadge(school.status)}</td>
                  <td className="p-3 text-sm text-gray-500">
                    {new Date(school.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="p-3 text-sm text-gray-500">
                    {school.expires_at
                      ? new Date(school.expires_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                      : '—'}
                  </td>
                  <td className="p-3">
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {school.slip_path && (
                        <button onClick={() => viewSlip(school.slip_path!)}
                          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.brownMid}`, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: C.dark }}>
                          ดูสลิป
                        </button>
                      )}
                      {school.status === 'pending' && (
                        <>
                          <button onClick={() => approve(school)} disabled={approving === school.id}
                            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: 'none', background: C.brown, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: approving === school.id ? 0.6 : 1 }}>
                            {approving === school.id ? '...' : 'อนุมัติ'}
                          </button>
                          <button onClick={() => reject(school)}
                            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#fff', color: '#991B1B', cursor: 'pointer', fontFamily: 'inherit' }}>
                            ปฏิเสธ
                          </button>
                        </>
                      )}
                      {school.status === 'active' && (
                        <button onClick={() => suspend(school)}
                          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#fff', color: '#991B1B', cursor: 'pointer', fontFamily: 'inherit' }}>
                          ระงับ
                        </button>
                      )}
                      {school.status === 'expired' && (
                        <button onClick={() => approve(school)}
                          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.brownMid}`, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: C.dark }}>
                          เปิดใหม่
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
