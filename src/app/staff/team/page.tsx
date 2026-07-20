'use client'
// src/app/staff/team/page.tsx

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function TeamPage() {
  const supabase = createClient()
  const [team, setTeam] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', phone: '', line_id: '' })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stats, setStats] = useState<Record<string, any>>({})

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const [{ data: profiles }, { data: enrollments }, { data: reviews }, { data: checkins }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'staff').order('created_at'),
      supabase.from('enrollments').select('teacher_id, status, student_id'),
      supabase.from('reviews').select('teacher_id, created_at').order('created_at', { ascending: false }),
      supabase.from('checkins').select('recorded_by, check_in_at').gte('check_in_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    const s: Record<string, any> = {}
    ;(profiles ?? []).forEach(p => {
      const myEnrollments = (enrollments ?? []).filter(e => e.teacher_id === p.id)
      const myStudents = new Set(myEnrollments.map(e => e.student_id))
      const myReviews = (reviews ?? []).filter(r => r.teacher_id === p.id)
      const myCheckins = (checkins ?? []).filter(c => c.recorded_by === p.id)
      const lastActive = myReviews[0]?.created_at ?? myCheckins[0]?.check_in_at
      s[p.id] = {
        active_students: myStudents.size,
        active_enrollments: myEnrollments.filter(e => e.status === 'active').length,
        reviews_count: myReviews.length,
        checkins_30d: myCheckins.length,
        last_active: lastActive,
      }
    })

    setTeam(profiles ?? [])
    setStats(s)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function openEdit(member: any) {
    setEditingId(member.id)
    setForm({ full_name: member.full_name, phone: member.phone ?? '', line_id: member.line_id ?? '' })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (editingId) {
      const { error } = await supabase.from('profiles')
        .update({ full_name: form.full_name, phone: form.phone, line_id: form.line_id })
        .eq('id', editingId)
      if (error) { toast.error('แก้ไขไม่สำเร็จ'); setSaving(false); return }
      toast.success('แก้ไขข้อมูลแล้ว')
    }
    setShowForm(false); setEditingId(null)
    setForm({ full_name: '', phone: '', line_id: '' })
    setSaving(false)
    loadData()
  }

  const sqlSnippet = `INSERT INTO profiles (id, role, full_name, phone)
VALUES (
  'USER_ID_จาก_Auth',
  'staff',
  '${form.full_name || 'ชื่อ-นามสกุล'}',
  '${form.phone || '0812345678'}'
);`

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-start justify-between mb-2 gap-3">
        <div>
          <h1 className="text-xl font-semibold">จัดการทีมงาน</h1>
          <p className="text-sm text-gray-500 mt-0.5">{team.length} / 15 คน · ทุกคนสิทธิ์เท่ากัน</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm({ full_name: '', phone: '', line_id: '' }); setShowForm(true) }}
          className="btn-brand flex-shrink-0"
        >
          + เพิ่มเจ้าหน้าที่
        </button>
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 mb-5 flex gap-2.5 text-sm text-brand-800">
        <span>ทุกคนในทีมมีสิทธิ์เท่ากัน — เช็กอิน บันทึกบทเรียน เขียนรีวิว ออกใบเสร็จ แจ้งเตือน ได้ทุกอย่าง</span>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-12">กำลังโหลด...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {team.map(member => {
            const st = stats[member.id] ?? {}
            const isMe = member.id === currentUserId
            return (
              <div key={member.id} className={`card p-4 ${isMe ? 'ring-1 ring-brand-200' : ''}`}>
                {/* แถวบน: avatar + ชื่อ + ปุ่มแก้ไข */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-base flex-shrink-0">
                    {getInitials(member.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white">{member.full_name}</span>
                      {isMe && <span className="badge badge-green text-[10px]">คุณ</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-0.5">
                      {member.phone && <span>{member.phone}</span>}
                      {member.line_id && <span>LINE: {member.line_id}</span>}
                      <span>เข้าร่วม {formatDate(member.created_at)}</span>
                    </div>
                  </div>
                  <button onClick={() => openEdit(member)} className="btn-outline btn-sm flex-shrink-0">
                    แก้ไข
                  </button>
                </div>

                {/* แถวล่าง: สถิติ 4 ช่อง */}
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-100 dark:border-[#2a3245]">
                  <div className="text-center">
                    <div className="text-base font-semibold text-gray-700 dark:text-gray-200">{st.active_students ?? 0}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">นักเรียน</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold text-brand-600">{st.active_enrollments ?? 0}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Active</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold text-gray-700 dark:text-gray-200">{st.reviews_count ?? 0}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">รีวิว</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold text-gray-700 dark:text-gray-200">{st.checkins_30d ?? 0}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">เช็กอิน 30ว</div>
                  </div>
                </div>

                {st.last_active && (
                  <div className="text-xs text-brand-500 mt-2 text-right">
                    ใช้งานล่าสุด {formatDate(st.last_active)}
                  </div>
                )}
              </div>
            )
          })}
          {team.length === 0 && (
            <div className="card p-12 text-center text-gray-400">ยังไม่มีทีมงาน</div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <h2 className="font-semibold">{editingId ? 'แก้ไขข้อมูล' : 'เพิ่มเจ้าหน้าที่ใหม่'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-lg">X</button>
            </div>
            <div className="p-5 space-y-4">
              {!editingId && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <div className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">วิธีเพิ่มเจ้าหน้าที่</div>
                  <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                    <li>Supabase - Authentication - Users - Add User</li>
                    <li>ใส่อีเมลและรหัสผ่าน แล้วคัดลอก User ID</li>
                    <li>รัน SQL ด้านล่างใน SQL Editor</li>
                  </ol>
                </div>
              )}
              <div>
                <label className="label">ชื่อ-นามสกุล *</label>
                <input className="input" required value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="ครูสมชาย ใจดี" />
              </div>
              <div>
                <label className="label">เบอร์โทร</label>
                <input className="input" type="tel" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="081-234-5678" />
              </div>
              <div>
                <label className="label">LINE ID</label>
                <input className="input" value={form.line_id}
                  onChange={e => setForm({ ...form, line_id: e.target.value })} placeholder="@somchai" />
              </div>
              {!editingId && (
                <div>
                  <label className="label">SQL สำหรับรันใน Supabase</label>
                  <pre className="bg-gray-50 dark:bg-[#1a2030] border border-gray-100 dark:border-[#2a3245] rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap select-all leading-relaxed">{sqlSnippet}</pre>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                {editingId ? (
                  <button
                    onClick={handleSave as any}
                    disabled={saving}
                    className="btn-brand flex-1 justify-center"
                  >
                    {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                ) : (
                  <button type="button" onClick={() => setShowForm(false)} className="btn-brand flex-1 justify-center">
                    รับทราบ ปิด
                  </button>
                )}
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline flex-1 justify-center">
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
