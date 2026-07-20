'use client'
// src/app/staff/teaching/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

/* ─── Types ─────────────────────────────────────────── */
interface Profile {
  id: string
  full_name: string
}

interface Teacher {
  id: string
  full_name: string
  subject: string | null
  is_active: boolean
}

interface Course {
  id: string
  name: string
  name_en: string | null
  type: string
}

interface Enrollment {
  id: string
  student_id: string
  course_id: string
  teacher_id: string | null
  lessons_used: number
  lessons_total: number
  status: string
  courses: Course | null
  profiles: Profile | null
  students: { id: string; full_name: string; nickname: string | null } | null
}

interface LessonLog {
  id: string
  enrollment_id: string
  student_id: string
  lesson_date: string
  lesson_number: number
  teacher_id: string | null
  teacher_name: string | null
  topic: string | null
  homework: string | null
  duration_minutes: number
  created_at: string
  enrollments: {
    courses: Course | null
    profiles: Profile | null
    students: { id: string; full_name: string; nickname: string | null } | null
  } | null
}

/* ─── Modal: บันทึกชั่วโมงการสอน ───────────────────── */
function LogModal({
  teacherId,
  onClose,
  onSaved,
}: {
  teacherId: string
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddTeacher, setShowAddTeacher] = useState(false)
  const [newTeacher, setNewTeacher] = useState({ full_name: '', subject: '' })
  const [savingTeacher, setSavingTeacher] = useState(false)

  const [form, setForm] = useState({
    enrollment_id: '',
    selected_teacher_id: teacherId,
    lesson_date: new Date().toISOString().slice(0, 10),
    duration_minutes: 60,
    topic: '',
    homework: '',
  })

  useEffect(() => {
    Promise.all([
      supabase
        .from('enrollments')
        .select(`
          id, student_id, course_id, teacher_id, lessons_used, lessons_total, status,
          courses ( id, name, name_en, type ),
          students:student_id ( id, full_name, nickname )
        `)
        .in('status', ['active', 'completed'])
        .order('created_at', { ascending: false }),
      supabase
        .from('teachers')
        .select('id, full_name, subject')
        .eq('is_active', true)
        .order('full_name'),
    ]).then(([{ data: eData, error }, { data: tData }]) => {
      if (error) toast.error('โหลดข้อมูลคอร์สล้มเหลว')
      setEnrollments((eData as unknown as Enrollment[]) ?? [])
      setTeachers((tData as Teacher[]) ?? [])
      setLoading(false)
    })
  }, [])

  async function handleAddTeacher() {
    if (!newTeacher.full_name.trim()) { toast.error('กรุณากรอกชื่อครู'); return }
    setSavingTeacher(true)
    const { data, error } = await supabase
      .from('teachers')
      .insert({
        full_name: newTeacher.full_name.trim(),
        subject: newTeacher.subject.trim() || null,
      })
      .select('id, full_name, subject')
      .single()

    if (error) {
      toast.error('เพิ่มครูไม่สำเร็จ: ' + error.message)
      setSavingTeacher(false)
      return
    }
    toast.success(`เพิ่มครู ${newTeacher.full_name} แล้ว`)
    setTeachers(prev => [...prev, data as Teacher].sort((a, b) => a.full_name.localeCompare(b.full_name, 'th')))
    setForm(f => ({ ...f, selected_teacher_id: (data as Teacher).id }))
    setNewTeacher({ full_name: '', subject: '' })
    setShowAddTeacher(false)
    setSavingTeacher(false)
  }

  async function handleSave() {
    if (!form.enrollment_id) { toast.error('กรุณาเลือกคอร์ส'); return }

    const enroll = enrollments.find(e => e.id === form.enrollment_id)
    if (!enroll) return

    setSaving(true)

    // คำนวณ lesson_number ถัดไป
    const { data: last } = await supabase
      .from('lesson_logs')
      .select('lesson_number')
      .eq('enrollment_id', form.enrollment_id)
      .order('lesson_number', { ascending: false })
      .limit(1)
      .single()

    const nextLesson = (last?.lesson_number ?? 0) + 1

    const selectedTeacher = teachers.find(t => t.id === form.selected_teacher_id)
    const { error } = await supabase.from('lesson_logs').insert({
      enrollment_id: form.enrollment_id,
      student_id: enroll.student_id,
      teacher_name: selectedTeacher?.full_name ?? null,
      lesson_date: form.lesson_date,
      lesson_number: nextLesson,
      duration_minutes: form.duration_minutes,
      topic: form.topic || null,
      homework: form.homework || null,
    })

    if (error) {
      toast.error('บันทึกไม่สำเร็จ: ' + error.message)
      setSaving(false)
      return
    }

    // อัปเดต lessons_used
    await supabase
      .from('enrollments')
      .update({ lessons_used: enroll.lessons_used + 1 })
      .eq('id', form.enrollment_id)

    toast.success('บันทึกชั่วโมงการสอนสำเร็จ')
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">+ บันทึกชั่วโมงการสอน</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-400">กำลังโหลด...</div>
        ) : (
          <div className="space-y-4">
            {/* เลือกครู */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  ครูผู้สอน <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddTeacher(v => !v)}
                  className="text-xs text-brand-500 hover:text-brand-600 font-medium"
                >
                  {showAddTeacher ? '✕ ยกเลิก' : '+ เพิ่มครูใหม่'}
                </button>
              </div>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.selected_teacher_id}
                onChange={e => setForm(f => ({ ...f, selected_teacher_id: e.target.value }))}
              >
                <option value="">— เลือกครู —</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>

              {/* Mini form เพิ่มครูใหม่ */}
              {showAddTeacher && (
                <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                  <input
                    type="text"
                    placeholder="ชื่อครู *"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={newTeacher.full_name}
                    onChange={e => setNewTeacher(v => ({ ...v, full_name: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="วิชาที่สอน เช่น ภาษาจีน, คณิตศาสตร์"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={newTeacher.subject}
                    onChange={e => setNewTeacher(v => ({ ...v, subject: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={handleAddTeacher}
                    disabled={savingTeacher}
                    className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    {savingTeacher ? 'กำลังเพิ่ม...' : 'เพิ่มครู'}
                  </button>
                </div>
              )}
            </div>

            {/* เลือกคอร์ส/นักเรียน */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                คอร์ส / นักเรียน <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.enrollment_id}
                onChange={e => setForm(f => ({ ...f, enrollment_id: e.target.value }))}
              >
                <option value="">— เลือกนักเรียน —</option>
                {enrollments.map(e => (
                  <option key={e.id} value={e.id}>
                    {((e as any).students?.nickname || (e as any).students?.full_name || e.profiles?.full_name || '?')} — {e.courses?.name ?? '?'}
                    {' '}({e.lessons_used}/{e.lessons_total})
                  </option>
                ))}
              </select>
            </div>

            {/* วันที่ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สอน</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.lesson_date}
                onChange={e => setForm(f => ({ ...f, lesson_date: e.target.value }))}
              />
            </div>

            {/* ระยะเวลา */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ระยะเวลา (นาที)</label>
              <div className="flex gap-2">
                {[30, 45, 60, 90, 120].map(m => (
                  <button
                    key={m}
                    onClick={() => setForm(f => ({ ...f, duration_minutes: m }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                      form.duration_minutes === m
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'border-gray-200 text-gray-600 hover:border-brand-400'
                    }`}
                  >
                    {m >= 60 ? `${m / 60}ชม.` : `${m}น.`}
                  </button>
                ))}
              </div>
            </div>

            {/* หัวข้อ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หัวข้อที่สอน</label>
              <input
                type="text"
                placeholder="เช่น บทที่ 3 คำศัพท์วันละคำ"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.topic}
                onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
              />
            </div>

            {/* การบ้าน */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">การบ้าน</label>
              <input
                type="text"
                placeholder="เช่น ฝึกพินอิน หน้า 20-25"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.homework}
                onChange={e => setForm(f => ({ ...f, homework: e.target.value }))}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors mt-2"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกชั่วโมงการสอน'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────── */
export default function TeachingPage() {
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [logs, setLogs] = useState<LessonLog[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedLog, setSelectedLog] = useState<LessonLog | null>(null)
  const [editingLog, setEditingLog] = useState<LessonLog | null>(null)
  const [editForm, setEditForm] = useState({ topic: '', homework: '', duration_minutes: 60 })
  const [savingEdit, setSavingEdit] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [teachersLoaded, setTeachersLoaded] = useState(false)

  /* โหลด teachers — แยกออกจาก auth */
  useEffect(() => {
    supabase
      .from('teachers')
      .select('id, full_name, subject, is_active')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => {
        setTeachers((data as Teacher[]) ?? [])
        setTeachersLoaded(true)
      })
  }, [])

  /* โหลด user profile */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', user.id)
        .single()
      if (!profile) return
      setCurrentUser(profile)
      setIsAdmin(profile.role === 'admin')
    })
  }, [])

  /* โหลด enrollments (ฝั่งขวา) */
  const fetchEnrollments = useCallback(async () => {
    const { data } = await supabase
      .from('enrollments')
      .select(`
        id, student_id, course_id, teacher_id, lessons_used, lessons_total, status,
        courses ( id, name, name_en, type ),
        students:student_id ( id, full_name, nickname )
      `)
      .in('status', ['active', 'completed'])
      .order('lessons_used', { ascending: false })
    setEnrollments((data as unknown as Enrollment[]) ?? [])
  }, [])

  /* โหลด lesson_logs — รันทุกครั้งที่ selectedTeacherId หรือ selectedMonth เปลี่ยน */
  useEffect(() => {
    if (!teachersLoaded) return  // รอ teachers โหลดก่อน

    async function loadLogs() {
      setLoadingLogs(true)

      const [year, month] = selectedMonth.split('-')
      const from = `${year}-${month}-01`
      const to   = new Date(+year, +month, 0).toISOString().slice(0, 10)

      const selectedTeacherName = teachers.find(t => t.id === selectedTeacherId)?.full_name

      let query = supabase
        .from('lesson_logs')
        .select(`
          id, enrollment_id, student_id, lesson_date, lesson_number,
          teacher_id, teacher_name, topic, homework, duration_minutes, created_at,
          enrollments (
            courses ( id, name, name_en, type ),
            students:student_id ( id, full_name, nickname )
          )
        `)
        .gte('lesson_date', from)
        .lte('lesson_date', to)
        .order('lesson_date', { ascending: false })

      if (selectedTeacherId && selectedTeacherName) {
        query = query.eq('teacher_name', selectedTeacherName)
      }

      const { data, error } = await query
      if (error) toast.error('โหลดข้อมูลล้มเหลว')
      setLogs((data as unknown as LessonLog[]) ?? [])
      setLoadingLogs(false)
    }

    loadLogs()
  }, [selectedTeacherId, selectedMonth, teachers, teachersLoaded])

  useEffect(() => {
    fetchEnrollments()
  }, [fetchEnrollments])

  /* สถิติรวม */
  const totalMinutes = logs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0)
  const totalHours   = (totalMinutes / 60).toFixed(1)
  const totalSessions = logs.length
  const uniqueStudents = new Set(logs.map(l => l.student_id)).size

  /* เดือนตัวเลือก (ย้อนหลัง 12 เดือน) */
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
    return { val, label }
  })

  /* Export Excel */
  async function handleExport() {
    toast.loading('กำลังดึงข้อมูล...')

    const [year, month] = selectedMonth.split('-')
    const from = `${year}-${month}-01`
    const to   = new Date(+year, +month, 0).toISOString().slice(0, 10)

    // ดึง log ทุกครูในเดือนนี้
    const { data: allLogs, error } = await supabase
      .from('lesson_logs')
      .select(`
        id, lesson_date, lesson_number, teacher_name, duration_minutes, topic, homework,
        enrollments (
          courses ( name ),
          students:student_id ( full_name, nickname )
        )
      `)
      .gte('lesson_date', from)
      .lte('lesson_date', to)
      .order('teacher_name', { ascending: true })
      .order('lesson_date', { ascending: true })

    toast.dismiss()

    if (error || !allLogs || allLogs.length === 0) {
      toast.error('ไม่มีข้อมูลให้ Export')
      return
    }

    const wb = XLSX.utils.book_new()

    // แยก log ตามครู
    const byTeacher: Record<string, any[]> = {}
    ;(allLogs as any[]).forEach(l => {
      const name = l.teacher_name ?? 'ไม่ระบุครู'
      if (!byTeacher[name]) byTeacher[name] = []
      byTeacher[name].push(l)
    })

    Object.entries(byTeacher).forEach(([teacherName, tLogs]) => {
      const totalMin = tLogs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0)
      const totalHr  = (totalMin / 60).toFixed(1)

      const rows = tLogs.map(l => ({
        วันที่:           l.lesson_date,
        นักเรียน:         (l.enrollments as any)?.students?.nickname || (l.enrollments as any)?.students?.full_name || '—',
        คอร์ส:            (l.enrollments as any)?.courses?.name ?? '—',
        'ครั้งที่':       l.lesson_number ?? '',
        'เวลา(นาที)':     l.duration_minutes ?? 0,
        'เวลา(ชั่วโมง)':  ((l.duration_minutes ?? 0) / 60).toFixed(2),
        หัวข้อ:           l.topic ?? '',
        การบ้าน:          l.homework ?? '',
      }))

      // แถวสรุป
      rows.push({} as any)
      rows.push({
        วันที่:           'รวมทั้งหมด',
        นักเรียน:         `${tLogs.length} ครั้ง`,
        คอร์ส:            '',
        'ครั้งที่':       '',
        'เวลา(นาที)':     totalMin,
        'เวลา(ชั่วโมง)':  totalHr,
        หัวข้อ:           '',
        การบ้าน:          '',
      } as any)

      const ws = XLSX.utils.json_to_sheet(rows)

      // ปรับความกว้างคอลัมน์
      ws['!cols'] = [
        { wch: 12 }, { wch: 16 }, { wch: 24 },
        { wch: 8 },  { wch: 12 }, { wch: 14 },
        { wch: 24 }, { wch: 24 },
      ]

      // sheet name ห้ามยาวเกิน 31 ตัว
      const sheetName = teacherName.slice(0, 31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })

    XLSX.writeFile(wb, `teaching_all_${selectedMonth}.xlsx`)
    toast.success(`Export สำเร็จ ${Object.keys(byTeacher).length} ครู`)
  }

  /* formatMinutes */
  function fmt(min: number) {
    if (min < 60) return `${min} น.`
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h}ชม. ${m}น.` : `${h} ชม.`
  }

  const displayTeacher = selectedTeacherId
    ? (teachers.find(t => t.id === selectedTeacherId)?.full_name ?? currentUser?.full_name)
    : 'ครูทุกคน'  

  return (
    <div className="min-h-screen bg-[#F5F4F0] p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">ชั่วโมงการสอน</h1>
          <p className="text-sm text-gray-500 mt-0.5">ติดตามการสอนของครูและนักเรียนแต่ละคน</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <span>📊</span> Export Excel
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          >
            <span>+</span> บันทึกชั่วโมงการสอน
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
        >
          {monthOptions.map(m => (
            <option key={m.val} value={m.val}>{m.label}</option>
          ))}
        </select>

        <select
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          value={selectedTeacherId}
          onChange={e => setSelectedTeacherId(e.target.value)}
        >
          <option value="">ครูทุกคน</option>
          {teachers.map(t => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
      </div>

      {/* Teacher card + stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Left: teacher summary + history */}
        <div className="lg:col-span-1 md:col-span-2 space-y-4">

          {/* Teacher stat card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-600 font-bold text-sm">
                {displayTeacher?.slice(0, 2) ?? '..'}
              </div>
              <div>
                <div className="font-semibold text-gray-800">{displayTeacher ?? '—'}</div>
                <div className="text-xs text-gray-400">ครูผู้สอน</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl md:text-2xl font-bold text-gray-800">{totalHours}</div>
                <div className="text-xs text-gray-400 mt-0.5">ชม.</div>
              </div>
              <div>
                <div className="text-xl md:text-2xl font-bold text-gray-800">{totalSessions}</div>
                <div className="text-xs text-gray-400 mt-0.5">ครั้ง</div>
              </div>
              <div>
                <div className="text-xl md:text-2xl font-bold text-gray-800">{uniqueStudents}</div>
                <div className="text-xs text-gray-400 mt-0.5">นักเรียน</div>
              </div>
            </div>
          </div>

          {/* Log history */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">ประวัติการสอน</h2>
              <span className="text-xs font-medium bg-brand-50 text-brand-600 px-2.5 py-1 rounded-full">
                {totalSessions} ครั้ง
              </span>
            </div>

            {loadingLogs ? (
              <div className="py-12 text-center text-gray-400 text-sm">กำลังโหลด...</div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">ยังไม่มีบันทึกการสอน</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {logs.map(log => (
                  <div key={log.id} onClick={() => setSelectedLog(log)} className="px-5 py-3.5 flex items-start gap-4 hover:bg-gray-50/50 transition-colors cursor-pointer">
                    {/* date badge */}
                    <div className="flex-shrink-0 text-center w-10">
                      <div className="text-lg font-bold text-gray-700 leading-none">
                        {new Date(log.lesson_date).getDate()}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {new Date(log.lesson_date).toLocaleDateString('th-TH', { month: 'short' })}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-800">
                          {((log.enrollments as any)?.students?.nickname || (log.enrollments as any)?.students?.full_name || (log.enrollments?.profiles?.full_name) || '—')}
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">
                          {log.enrollments?.courses?.name ?? '—'}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                          ครั้งที่ {log.lesson_number}
                        </span>
                      </div>
                      {log.topic && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate">📖 {log.topic}</div>
                      )}
                      {log.homework && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">📝 {log.homework}</div>
                      )}
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <span className="text-sm font-semibold text-brand-600">{fmt(log.duration_minutes)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: enrollments of teacher */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">คอร์สของนักเรียน</h2>
            </div>

            {enrollments.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">ไม่มีคอร์สที่กำลังเรียน</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {enrollments.map(e => {
                  const remaining = e.lessons_total - e.lessons_used
                  const pct = e.lessons_total > 0 ? (e.lessons_used / e.lessons_total) * 100 : 0
                  const low = remaining <= 3
                  return (
                    <div key={e.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <div className="text-sm font-medium text-gray-800">
                            {((e as any).students?.nickname || (e as any).students?.full_name || (e.profiles?.full_name ?? '—'))}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {e.courses?.name ?? '—'}
                          </div>
                        </div>
                        <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          low
                            ? 'bg-red-50 text-red-500'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {e.lessons_used}/{e.lessons_total}
                        </span>
                      </div>
                      {/* progress bar */}
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${low ? 'bg-red-400' : 'bg-brand-400'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      {low && (
                        <div className="text-[10px] text-red-400 mt-1">เหลือ {remaining} ครั้ง</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => { setSelectedLog(null); setEditingLog(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">รายละเอียดการสอน</h2>
              <button onClick={() => { setSelectedLog(null); setEditingLog(null) }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-3">
              {/* ครู */}
              <div className="flex items-center gap-3 p-3 bg-brand-50 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-sm">
                  {(selectedLog.teacher_name ?? '?').slice(0, 2)}
                </div>
                <div>
                  <div className="text-xs text-gray-400">ครูผู้สอน</div>
                  <div className="font-medium text-gray-800">{selectedLog.teacher_name ?? '—'}</div>
                </div>
              </div>

              {/* นักเรียน + คอร์ส */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-400 mb-0.5">นักเรียน</div>
                  <div className="font-medium text-sm text-gray-800">
                    {((selectedLog.enrollments as any)?.students?.nickname || (selectedLog.enrollments as any)?.students?.full_name) ?? '—'}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-400 mb-0.5">คอร์ส</div>
                  <div className="font-medium text-sm text-gray-800">{selectedLog.enrollments?.courses?.name ?? '—'}</div>
                </div>
              </div>

              {/* วันที่ + ครั้งที่ + เวลา */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-400 mb-0.5">วันที่</div>
                  <div className="font-medium text-sm text-gray-800">
                    {new Date(selectedLog.lesson_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-400 mb-0.5">ครั้งที่</div>
                  <div className="font-medium text-sm text-gray-800">{selectedLog.lesson_number}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-400 mb-0.5">ระยะเวลา</div>
                  {editingLog?.id === selectedLog.id ? (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {[30,45,60,90,120].map(m => (
                        <button key={m} onClick={() => setEditForm(f => ({ ...f, duration_minutes: m }))}
                          className={`text-xs px-1.5 py-0.5 rounded-lg border transition-all ${editForm.duration_minutes === m ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-600'}`}>
                          {m >= 60 ? `${m/60}ชม.` : `${m}น.`}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="font-medium text-sm text-brand-600">{fmt(selectedLog.duration_minutes)}</div>
                  )}
                </div>
              </div>

              {/* หัวข้อ */}
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="text-xs text-gray-400 mb-1">📖 หัวข้อที่สอน</div>
                {editingLog?.id === selectedLog.id ? (
                  <input type="text" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={editForm.topic}
                    onChange={e => setEditForm(f => ({ ...f, topic: e.target.value }))}
                    placeholder="หัวข้อที่สอน" />
                ) : (
                  <div className="text-sm text-gray-800">{selectedLog.topic || <span className="text-gray-400">ไม่ได้กรอก</span>}</div>
                )}
              </div>

              {/* การบ้าน */}
              <div className="p-3 bg-amber-50 rounded-xl">
                <div className="text-xs text-amber-500 mb-1">📝 การบ้าน</div>
                {editingLog?.id === selectedLog.id ? (
                  <input type="text" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={editForm.homework}
                    onChange={e => setEditForm(f => ({ ...f, homework: e.target.value }))}
                    placeholder="การบ้าน" />
                ) : (
                  <div className="text-sm text-gray-800">{selectedLog.homework || <span className="text-amber-400">ไม่ได้กรอก</span>}</div>
                )}
              </div>
            </div>

            {/* ปุ่ม */}
            {editingLog?.id === selectedLog.id ? (
              <div className="flex gap-2 mt-5">
                <button
                  onClick={async () => {
                    setSavingEdit(true)
                    const { error } = await supabase.from('lesson_logs').update({
                      topic: editForm.topic || null,
                      homework: editForm.homework || null,
                      duration_minutes: editForm.duration_minutes,
                    }).eq('id', selectedLog.id)
                    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSavingEdit(false); return }
                    toast.success('บันทึกแล้ว')
                    // update local state
                    setLogs(prev => prev.map(l => l.id === selectedLog.id
                      ? { ...l, topic: editForm.topic || null, homework: editForm.homework || null, duration_minutes: editForm.duration_minutes }
                      : l
                    ))
                    setSelectedLog(prev => prev ? { ...prev, topic: editForm.topic || null, homework: editForm.homework || null, duration_minutes: editForm.duration_minutes } : null)
                    setEditingLog(null)
                    setSavingEdit(false)
                  }}
                  disabled={savingEdit}
                  className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {savingEdit ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={() => setEditingLog(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  ยกเลิก
                </button>
              </div>
            ) : (
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => {
                    setEditingLog(selectedLog)
                    setEditForm({ topic: selectedLog.topic ?? '', homework: selectedLog.homework ?? '', duration_minutes: selectedLog.duration_minutes })
                  }}
                  className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  ✎ แก้ไข
                </button>
                <button onClick={() => setSelectedLog(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  ปิด
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <LogModal
          teacherId={selectedTeacherId || (currentUser?.id ?? '')}
          onClose={() => setShowModal(false)}
          onSaved={() => { setSelectedMonth(m => m); fetchEnrollments() }}
        />
      )}
    </div>
  )
}
