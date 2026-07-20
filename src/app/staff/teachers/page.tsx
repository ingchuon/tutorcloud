'use client'
// src/app/staff/teachers/page.tsx
// จัดการครู — เพิ่ม/แก้ไข/ปิดใช้งาน + ดู/รีเซ็ต PIN

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Teacher {
  id: string
  full_name: string
  subject: string | null
  pin: string | null
  is_active: boolean
}

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export default function TeachersPage() {
  const supabase = createClient()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'active' | 'inactive' | 'all'>('active')

  const [showForm, setShowForm] = useState(false)
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null)
  const [form, setForm] = useState({ full_name: '', subject: '', pin: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadTeachers() }, [])

  async function loadTeachers() {
    setLoading(true)
    const { data } = await supabase
      .from('teachers')
      .select('id, full_name, subject, pin, is_active')
      .order('full_name')
    setTeachers((data as Teacher[]) ?? [])
    setLoading(false)
  }

  function openAdd() {
    setEditTeacher(null)
    setForm({ full_name: '', subject: '', pin: randomPin() })
    setShowForm(true)
  }

  function openEdit(t: Teacher) {
    setEditTeacher(t)
    setForm({ full_name: t.full_name, subject: t.subject ?? '', pin: t.pin ?? randomPin() })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { toast.error('กรุณากรอกชื่อครู'); return }
    if (!/^\d{4}$/.test(form.pin)) { toast.error('PIN ต้องเป็นตัวเลข 4 หลัก'); return }

    setSaving(true)

    if (editTeacher) {
      const { error } = await supabase.from('teachers').update({
        full_name: form.full_name.trim(),
        subject: form.subject.trim() || null,
        pin: form.pin,
      }).eq('id', editTeacher.id)

      if (error) { toast.error('แก้ไขไม่สำเร็จ: ' + error.message); setSaving(false); return }
      toast.success('แก้ไขข้อมูลครูแล้ว ✅')
    } else {
      const { error } = await supabase.from('teachers').insert([{
        full_name: form.full_name.trim(),
        subject: form.subject.trim() || null,
        pin: form.pin,
        is_active: true,
      }])

      if (error) { toast.error('เพิ่มไม่สำเร็จ: ' + error.message); setSaving(false); return }
      toast.success(`เพิ่ม "ครู${form.full_name.trim()}" แล้ว 🎉 PIN: ${form.pin}`)
    }

    setShowForm(false)
    setSaving(false)
    loadTeachers()
  }

  async function toggleActive(t: Teacher) {
    const { error } = await supabase.from('teachers').update({ is_active: !t.is_active }).eq('id', t.id)
    if (error) { toast.error('ไม่สำเร็จ: ' + error.message); return }
    toast.success(!t.is_active ? `เปิดใช้งานครู${t.full_name} แล้ว` : `ปิดใช้งานครู${t.full_name} แล้ว`)
    loadTeachers()
  }

  function resetPin(t: Teacher) {
    setForm({ full_name: t.full_name, subject: t.subject ?? '', pin: randomPin() })
    setEditTeacher(t)
    setShowForm(true)
  }

  const filtered = teachers.filter(t => {
    if (filterActive === 'active' && !t.is_active) return false
    if (filterActive === 'inactive' && t.is_active) return false
    if (search && !t.full_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // ครูชื่อรวม (มี &) จะไม่ขึ้นในหน้า /teach อยู่แล้ว แต่ยังจัดการที่นี่ได้
  const isComboName = (name: string) => name.includes('&')

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg md:text-xl font-semibold">ครูผู้สอน</h1>
        <div className="flex gap-2">
          <a href="/teach" target="_blank" rel="noopener noreferrer"
            className="btn-outline text-sm flex items-center gap-1.5">
            🧑‍🏫 หน้าครูกรอกข้อมูล
          </a>
          <button onClick={openAdd} className="btn-brand">+ เพิ่มครู</button>
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 mb-4">
        เพิ่ม/แก้ไขข้อมูลครู ตั้งวิชาที่สอน และดู/รีเซ็ต PIN สำหรับเข้าหน้า{' '}
        <code className="text-xs bg-cream-100 px-1 rounded">/teach</code>
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <input
          className="input max-w-xs"
          placeholder="🔍 ค้นหาชื่อครู..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5">
          {(['active', 'inactive', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`btn-sm px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterActive === f
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'border-gray-200 dark:border-[#3a4560] text-gray-600 dark:text-gray-300 hover:border-brand-400'
              }`}
            >
              {f === 'active' ? 'ใช้งานอยู่' : f === 'inactive' ? 'ปิดใช้งาน' : 'ทั้งหมด'}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-400 dark:text-gray-300 ml-auto">{filtered.length} คน</span>
      </div>

      <div className="card-cream overflow-x-auto">
        {loading ? (
          <p className="text-center text-gray-400 dark:text-gray-300 py-12">กำลังโหลด...</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th>ชื่อครู</th>
                <th>วิชา</th>
                <th>PIN</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="table-row-hover">
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                        {t.full_name.slice(0, 2)}
                      </div>
                      <span className="font-medium text-sm">{t.full_name}</span>
                      {isComboName(t.full_name) && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-300 bg-gray-100 dark:bg-[#2a3245] px-1.5 py-0.5 rounded">ชื่อรวม</span>
                      )}
                    </div>
                  </td>
                  <td className="text-sm text-gray-600 dark:text-gray-300">{t.subject ?? '—'}</td>
                  <td className="text-sm font-mono tracking-widest">{t.pin ?? '—'}</td>
                  <td>
                    <span className={`badge ${t.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {t.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => resetPin(t)} className="btn-outline btn-sm" title="สุ่ม PIN ใหม่">🔑 PIN</button>
                      <button onClick={() => openEdit(t)} className="btn-outline btn-sm px-2">✎</button>
                      <button
                        onClick={() => toggleActive(t)}
                        className={`btn-outline btn-sm px-2 ${t.is_active ? 'text-red-400 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                      >
                        {t.is_active ? '✕' : '↺'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-400 dark:text-gray-300 py-8">
                  {search ? `ไม่พบ "${search}"` : 'ไม่มีรายการ'}
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <h2 className="font-semibold">{editTeacher ? `แก้ไขครู${editTeacher.full_name}` : 'เพิ่มครูใหม่'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 dark:text-gray-300">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div>
                <label className="label">ชื่อครู *</label>
                <input className="input" required placeholder="เช่น Bee, Aom"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })} />
                <p className="text-xs text-gray-400 dark:text-gray-300 mt-1">
                  ใส่ชื่อเดี่ยวๆ (ไม่มี &amp;) เพื่อให้ขึ้นในหน้า /teach อัตโนมัติ
                </p>
              </div>
              <div>
                <label className="label">วิชาที่สอน</label>
                <input className="input" placeholder="เช่น ภาษาจีน, คณิตศาสตร์, ภาษาอังกฤษ"
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div>
                <label className="label">PIN (4 หลัก)</label>
                <div className="flex gap-2">
                  <input className="input font-mono tracking-widest" maxLength={4}
                    value={form.pin}
                    onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
                  <button type="button" onClick={() => setForm({ ...form, pin: randomPin() })} className="btn-outline btn-sm whitespace-nowrap">
                    🎲 สุ่มใหม่
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-300 mt-1">
                  ครูใช้ PIN นี้เข้าหน้า /teach ครั้งแรก (เปลี่ยนเองได้ทีหลัง)
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="btn-brand flex-1 justify-center disabled:opacity-50">
                  {saving ? 'กำลังบันทึก...' : editTeacher ? 'บันทึก' : 'เพิ่มครู'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
