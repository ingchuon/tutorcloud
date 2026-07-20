'use client'
// src/components/TeacherPortal.tsx
// Shared portal: ครูเลือกชื่อตัวเอง + ใส่ PIN -> บันทึกชั่วโมงสอน

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Teacher {
  id: string
  full_name: string
  subject: string | null
  pin: string | null
}

interface Course {
  id: string
  name: string
  name_en: string | null
}

interface Enrollment {
  id: string
  student_id: string
  lessons_used: number
  lessons_total: number
  status: string
  courses: Course | null
  students: { id: string; full_name: string; nickname: string | null } | null
}

interface LessonLog {
  id: string
  enrollment_id: string
  lesson_date: string
  lesson_number: number
  topic: string | null
  homework: string | null
  duration_minutes: number
  enrollments: {
    courses: Course | null
    students: { full_name: string; nickname: string | null } | null
  } | null
}

const SELECTED_TEACHER_KEY = 'mando_teach_selected'
const PIN_KEY_PREFIX = 'mando_teach_pin_'

export default function TeacherPortal({ initialTeacherId }: { initialTeacherId?: string }) {
  const supabase = createClient()

  const [allTeachers, setAllTeachers] = useState<Teacher[]>([])
  const [loadingTeachers, setLoadingTeachers] = useState(true)
  const [teacherSearch, setTeacherSearch] = useState('')

  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)

  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [logs, setLogs] = useState<LessonLog[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [saving, setSaving] = useState(false)

  // เปลี่ยน PIN
  const [showChangePin, setShowChangePin] = useState(false)
  const [pinForm, setPinForm] = useState({ current: '', next: '', confirm: '' })
  const [changingPin, setChangingPin] = useState(false)

  const todayStr = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    enrollment_id: '',
    lesson_date: todayStr,
    duration_minutes: 60,
    subject_name: '',
    topic: '',
    homework: '',
  })
  const [studentSearch, setStudentSearch] = useState('')

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  /* โหลดรายชื่อครูทั้งหมด (ไม่รวมชื่อรวม เช่น Aom&Bee) */
  useEffect(() => {
    supabase
      .from('teachers')
      .select('id, full_name, subject, pin')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => {
        const list = ((data as Teacher[]) ?? []).filter(t => !t.full_name.includes('&'))
        setAllTeachers(list)
        setLoadingTeachers(false)

        // ถ้ามี initialTeacherId (จากลิงก์เก่า) หรือเคยเลือกไว้แล้ว
        const savedId = initialTeacherId || (() => {
          try { return localStorage.getItem(SELECTED_TEACHER_KEY) } catch { return null }
        })()

        if (savedId) {
          const found = (data as Teacher[] ?? []).find(t => t.id === savedId)
          if (found) {
            setTeacher(found)
            try {
              const savedPin = localStorage.getItem(PIN_KEY_PREFIX + found.id)
              if (savedPin && savedPin === found.pin) setUnlocked(true)
            } catch {}
          }
        }
      })
  }, [initialTeacherId])

  /* โหลดข้อมูลหลังปลดล็อก */
  useEffect(() => {
    if (!unlocked || !teacher) return
    loadAll()
  }, [unlocked, teacher])

  async function loadAll() {
    setLoadingData(true)
    const [{ data: eData }, { data: lData }] = await Promise.all([
      supabase
        .from('enrollments')
        .select(`
          id, student_id, lessons_used, lessons_total, status,
          courses ( id, name, name_en ),
          students:student_id ( id, full_name, nickname )
        `)
        .in('status', ['active', 'completed'])
        .order('created_at', { ascending: false }),
      supabase
        .from('lesson_logs')
        .select(`
          id, enrollment_id, lesson_date, lesson_number, topic, homework, duration_minutes,
          enrollments (
            courses ( id, name, name_en ),
            students:student_id ( full_name, nickname )
          )
        `)
        .eq('teacher_name', teacher!.full_name)
        .gte('lesson_date', monthStart)
        .lte('lesson_date', monthEnd)
        .order('lesson_date', { ascending: false }),
    ])
    setEnrollments((eData as unknown as Enrollment[]) ?? [])
    setLogs((lData as unknown as LessonLog[]) ?? [])
    setLoadingData(false)
  }

  function selectTeacher(t: Teacher) {
    setTeacher(t)
    setPinInput('')
    setPinError(false)
    try { localStorage.setItem(SELECTED_TEACHER_KEY, t.id) } catch {}
    // ถ้าเคยปลดล็อกไว้แล้วในเครื่องนี้
    try {
      const savedPin = localStorage.getItem(PIN_KEY_PREFIX + t.id)
      if (savedPin && savedPin === t.pin) { setUnlocked(true); return }
    } catch {}
    setUnlocked(false)
  }

  function backToTeacherList() {
    setTeacher(null)
    setUnlocked(false)
    setPinInput('')
    setPinError(false)
    try { localStorage.removeItem(SELECTED_TEACHER_KEY) } catch {}
  }

  function handlePinDigit(d: string) {
    if (pinInput.length >= 4) return
    const next = pinInput + d
    setPinInput(next)
    setPinError(false)
    if (next.length === 4) {
      setTimeout(() => {
        if (teacher && next === teacher.pin) {
          setUnlocked(true)
          try { localStorage.setItem(PIN_KEY_PREFIX + teacher.id, next) } catch {}
        } else {
          setPinError(true)
          setPinInput('')
        }
      }, 100)
    }
  }

  async function handleChangePin() {
    if (!teacher) return
    if (pinForm.current !== teacher.pin) {
      toast.error('PIN ปัจจุบันไม่ถูกต้อง')
      return
    }
    if (!/^\d{4}$/.test(pinForm.next)) {
      toast.error('PIN ใหม่ต้องเป็นตัวเลข 4 หลัก')
      return
    }
    if (pinForm.next !== pinForm.confirm) {
      toast.error('PIN ใหม่ทั้งสองช่องไม่ตรงกัน')
      return
    }
    setChangingPin(true)
    const { error } = await supabase
      .from('teachers')
      .update({ pin: pinForm.next })
      .eq('id', teacher.id)

    if (error) {
      toast.error('เปลี่ยน PIN ไม่สำเร็จ: ' + error.message)
      setChangingPin(false)
      return
    }

    const updated = { ...teacher, pin: pinForm.next }
    setTeacher(updated)
    setAllTeachers(prev => prev.map(t => t.id === updated.id ? updated : t))
    try { localStorage.setItem(PIN_KEY_PREFIX + teacher.id, pinForm.next) } catch {}

    toast.success('เปลี่ยน PIN สำเร็จ ✅')
    setPinForm({ current: '', next: '', confirm: '' })
    setShowChangePin(false)
    setChangingPin(false)
  }

  async function handleSave() {
    if (!form.enrollment_id) { toast.error('กรุณาเลือกนักเรียน'); return }
    const enroll = enrollments.find(e => e.id === form.enrollment_id)
    if (!enroll || !teacher) return

    setSaving(true)

    // ตรวจสอบว่ามีบันทึกของวันนี้ + enrollment นี้อยู่แล้วหรือไม่
    const { data: existing } = await supabase
      .from('lesson_logs')
      .select('id, teacher_name, duration_minutes, topic, subject_name')
      .eq('enrollment_id', form.enrollment_id)
      .eq('lesson_date', form.lesson_date)

    // คอร์สพิเศษ (Special 2/3 Subject) = หักครั้งเรียนแค่ 1 ครั้ง/วัน ไม่ว่ากี่ครูจะกรอก
    const courseName = enroll.courses?.name ?? ''
    const isSpecialCourse = /special/i.test(courseName)

    let skipLessonCount = false

    if (existing && existing.length > 0) {
      const studentName = enroll.students?.nickname || enroll.students?.full_name || 'นักเรียนคนนี้'
      const who = existing[0].teacher_name ? `ครู${existing[0].teacher_name}` : 'staff'
      const prevSubject = existing[0].subject_name ? ` (วิชา${existing[0].subject_name})` : ''

      if (isSpecialCourse) {
        const confirmed = confirm(
          `วันนี้มีบันทึกของ ${studentName} (${courseName}) อยู่แล้ว\n` +
          `บันทึกโดย: ${who}${prevSubject}${existing[0].duration_minutes ? ` (${existing[0].duration_minutes} นาที)` : ''}\n\n` +
          `ต้องการบันทึกชั่วโมงสอนของวิชาตัวเองเพิ่มหรือไม่?\n` +
          `(กด ตกลง = บันทึกเพิ่ม โดยไม่หักครั้งเรียนซ้ำ / ยกเลิก = ไม่บันทึก)`
        )
        if (!confirmed) { setSaving(false); return }
        skipLessonCount = true
      } else {
        // คอร์สปกติ: staff เช็กอินไปแล้ว ครูแค่เพิ่มหัวข้อ/การบ้านลงในบันทึกเดิม (ไม่สร้างใหม่)
        const confirmed = confirm(
          `วันนี้ ${who} เช็กอินไว้แล้ว (${courseName})\n\n` +
          `ต้องการเพิ่มหัวข้อที่สอน/การบ้านลงในบันทึกนั้นหรือไม่?\n` +
          `(กด ตกลง = อัปเดตบันทึกเดิม / ยกเลิก = ไม่ทำอะไร)`
        )
        if (!confirmed) { setSaving(false); return }

        // UPDATE บันทึกเดิมแทน insert ใหม่
        await supabase.from('lesson_logs').update({
          teacher_name: teacher.full_name,
          duration_minutes: form.duration_minutes,
          subject_name: form.subject_name || null,
          topic: form.topic || null,
          homework: form.homework || null,
        }).eq('id', existing[0].id)

        toast.success('เพิ่มหัวข้อสอน/การบ้านในบันทึกวันนี้แล้ว ✅')
        setForm({ enrollment_id: '', lesson_date: todayStr, duration_minutes: 60, subject_name: '', topic: '', homework: '' })
        setStudentSearch('')
        setSaving(false)
        loadAll()
        return
      }
    }

    // ตรวจสอบว่ามีการเช็กอินของวันนี้ + enrollment นี้อยู่แล้วหรือไม่ (กันขึ้นซ้ำในรายชื่อ "วันนี้มาเรียน")
    const { data: existingCheckin } = await supabase
      .from('checkins')
      .select('id')
      .eq('enrollment_id', form.enrollment_id)
      .gte('check_in_at', form.lesson_date + 'T00:00:00')
      .lt('check_in_at', form.lesson_date + 'T23:59:59')
      .limit(1)

    const { data: last } = await supabase
      .from('lesson_logs')
      .select('lesson_number')
      .eq('enrollment_id', form.enrollment_id)
      .order('lesson_number', { ascending: false })
      .limit(1)
      .single()

    const nextLesson = (last?.lesson_number ?? 0) + 1

    const { error } = await supabase.from('lesson_logs').insert({
      enrollment_id: form.enrollment_id,
      student_id: enroll.student_id,
      teacher_name: teacher.full_name,
      lesson_date: form.lesson_date,
      lesson_number: nextLesson,
      duration_minutes: form.duration_minutes,
      subject_name: form.subject_name || null,
      topic: form.topic || null,
      homework: form.homework || null,
    })

    if (error) {
      toast.error('บันทึกไม่สำเร็จ: ' + error.message)
      setSaving(false)
      return
    }

    if (!skipLessonCount) {
      await supabase
        .from('enrollments')
        .update({ lessons_used: enroll.lessons_used + 1 })
        .eq('id', form.enrollment_id)
    }

    // เพิ่มลงตาราง checkins ด้วย ถ้ายังไม่มีของวันนั้น
    if (!existingCheckin || existingCheckin.length === 0) {
      // ใช้เวลาเที่ยง (12:00) ของวัน lesson_date ตามเวลาไทย UTC+7
      const checkInTime = `${form.lesson_date}T12:00:00+07:00`
      await supabase.from('checkins').insert({
        student_id: enroll.student_id,
        enrollment_id: form.enrollment_id,
        check_in_at: checkInTime,
      })
    }

    toast.success(skipLessonCount
      ? 'บันทึกชั่วโมงสอนวิชาเพิ่มแล้ว ✅ (ไม่หักครั้งเรียนซ้ำ)'
      : 'บันทึกชั่วโมงสอนสำเร็จ ✅ หักครั้งเรียน 1 ครั้ง')
    setForm({
      enrollment_id: '',
      lesson_date: todayStr,
      duration_minutes: 60,
      subject_name: '',
      topic: '',
      homework: '',
    })
    setStudentSearch('')
    setSaving(false)
    loadAll()
  }

  const totalMinutes = logs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0)
  const totalHours = (totalMinutes / 60).toFixed(1)
  const totalSessions = logs.length
  const todayLogs = logs.filter(l => l.lesson_date === todayStr)

  function fmt(min: number) {
    if (min < 60) return `${min} น.`
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h}ชม. ${m}น.` : `${h} ชม.`
  }

  const filteredEnrollments = enrollments.filter(e => {
    if (!studentSearch) return true
    const name = (e.students?.nickname || e.students?.full_name || '').toLowerCase()
    const course = (e.courses?.name || '').toLowerCase()
    const q = studentSearch.toLowerCase()
    return name.includes(q) || course.includes(q)
  })

  const filteredTeachers = allTeachers.filter(t =>
    !teacherSearch || t.full_name.toLowerCase().includes(teacherSearch.toLowerCase())
  )

  /* ─── Loading ─── */
  if (loadingTeachers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0]">
        <div className="text-gray-400 dark:text-gray-300 text-sm">กำลังโหลด...</div>
      </div>
    )
  }

  /* ─── Step 1: เลือกชื่อครู ─── */
  if (!teacher) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0] p-6">
        <div className="bg-white dark:bg-[#242d3f] rounded-2xl shadow-sm border border-gray-100 dark:border-[#3a4560] p-6 w-full max-w-sm">
          <div className="text-center mb-5">
            <div className="text-3xl mb-2">👋</div>
            <h1 className="font-semibold text-gray-800 dark:text-gray-100 text-lg">บันทึกชั่วโมงสอน</h1>
            <p className="text-sm text-gray-400 dark:text-gray-300 mt-1">เลือกชื่อของคุณเพื่อเริ่มต้น</p>
          </div>

          <input
            type="text"
            placeholder="ค้นหาชื่อครู..."
            className="w-full border border-gray-200 dark:border-[#3a4560] rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={teacherSearch}
            onChange={e => setTeacherSearch(e.target.value)}
          />

          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {filteredTeachers.map(t => (
              <button
                key={t.id}
                onClick={() => selectTeacher(t)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-[#3a4560] hover:border-brand-300 hover:bg-brand-50/50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 font-bold text-sm flex-shrink-0">
                  {t.full_name.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">Teacher {t.full_name}</div>
                  {t.subject && <div className="text-xs text-gray-400 dark:text-gray-300 truncate">{t.subject}</div>}
                </div>
              </button>
            ))}
            {filteredTeachers.length === 0 && (
              <p className="text-center text-gray-400 dark:text-gray-300 text-sm py-6">ไม่พบชื่อครู</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ─── Step 2: PIN screen ─── */
  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0] p-6">
        <div className="bg-white dark:bg-[#242d3f] rounded-2xl shadow-sm border border-gray-100 dark:border-[#3a4560] p-8 w-full max-w-sm text-center">
          <button onClick={backToTeacherList} className="text-xs text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:text-gray-300 mb-3">
            ← เปลี่ยนชื่อ
          </button>
          <div className="w-14 h-14 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 font-bold text-lg mx-auto mb-4">
            {teacher.full_name.slice(0, 2)}
          </div>
          <h1 className="font-semibold text-gray-800 dark:text-gray-100 text-lg mb-1">สวัสดีครู {teacher.full_name}</h1>
          <p className="text-sm text-gray-400 dark:text-gray-300 mb-6">กรุณาใส่ PIN 4 หลักเพื่อเข้าใช้งาน</p>

          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  i < pinInput.length
                    ? pinError ? 'bg-red-400 border-red-400' : 'bg-brand-500 border-brand-500'
                    : 'border-gray-200 dark:border-[#3a4560]'
                }`}
              />
            ))}
          </div>

          {pinError && (
            <p className="text-red-400 text-xs mb-4">PIN ไม่ถูกต้อง ลองใหม่อีกครั้ง</p>
          )}

          <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <button
                key={d}
                onClick={() => handlePinDigit(d)}
                className="aspect-square rounded-2xl bg-gray-50 dark:bg-[#1e2533] hover:bg-gray-100 dark:bg-[#2a3245] active:bg-gray-200 text-xl font-semibold text-gray-700 dark:text-gray-200 transition-colors"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => setPinInput('')}
              className="aspect-square rounded-2xl bg-gray-50 dark:bg-[#1e2533] hover:bg-gray-100 dark:bg-[#2a3245] active:bg-gray-200 text-sm font-medium text-gray-400 dark:text-gray-300 transition-colors"
            >
              ล้าง
            </button>
            <button
              onClick={() => handlePinDigit('0')}
              className="aspect-square rounded-2xl bg-gray-50 dark:bg-[#1e2533] hover:bg-gray-100 dark:bg-[#2a3245] active:bg-gray-200 text-xl font-semibold text-gray-700 dark:text-gray-200 transition-colors"
            >
              0
            </button>
            <button
              onClick={() => setPinInput(p => p.slice(0, -1))}
              className="aspect-square rounded-2xl bg-gray-50 dark:bg-[#1e2533] hover:bg-gray-100 dark:bg-[#2a3245] active:bg-gray-200 text-lg text-gray-400 dark:text-gray-300 transition-colors"
            >
              ⌫
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Step 3: Main page ─── */
  return (
    <div className="min-h-screen bg-[#F5F4F0] p-4 pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-[#242d3f] rounded-2xl shadow-sm border border-gray-100 dark:border-[#3a4560] p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 font-bold">
              {teacher.full_name.slice(0, 2)}
            </div>
            <div>
              <div className="font-semibold text-gray-800 dark:text-gray-100">ครู{teacher.full_name}</div>
              <div className="text-xs text-gray-400 dark:text-gray-300">{teacher.subject || 'บันทึกชั่วโมงสอน'}</div>
            </div>
          </div>
          <button onClick={backToTeacherList} className="text-xs text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:text-gray-300">
            เปลี่ยนครู
          </button>
        </div>
        <button
          onClick={() => setShowChangePin(true)}
          className="text-xs text-brand-500 hover:text-brand-600 font-medium mb-3"
        >
          🔑 เปลี่ยน PIN
        </button>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-brand-50 rounded-xl py-3">
            <div className="text-2xl font-bold text-brand-700">{totalHours}</div>
            <div className="text-xs text-brand-500 mt-0.5">ชั่วโมงเดือนนี้</div>
          </div>
          <div className="bg-gray-50 dark:bg-[#1e2533] rounded-xl py-3">
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">{totalSessions}</div>
            <div className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">ครั้งเดือนนี้</div>
          </div>
        </div>
      </div>

      {/* รายชื่อนักเรียนวันนี้ */}
      <div className="bg-white dark:bg-[#242d3f] rounded-2xl shadow-sm border border-gray-100 dark:border-[#3a4560] p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">📋 นักเรียนวันนี้</h2>
          <span className="text-xs text-gray-400 dark:text-gray-300">{todayLogs.length} คน</span>
        </div>
        {loadingData ? (
          <p className="text-xs text-gray-400 dark:text-gray-300 text-center py-3">กำลังโหลด...</p>
        ) : todayLogs.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-300 text-center py-3">ยังไม่มีนักเรียนวันนี้ — กรอกด้านล่างได้เลย</p>
        ) : (
          <div className="space-y-2">
            {todayLogs.map(l => {
              const name = l.enrollments?.students?.nickname || l.enrollments?.students?.full_name || '?'
              const course = l.enrollments?.courses?.name ?? ''
              const hasTopic = !!(l.topic || l.homework)
              return (
                <div key={l.id} className={`rounded-xl px-3 py-2.5 border ${hasTopic ? 'bg-brand-50 border-brand-100' : 'bg-amber-50 border-amber-100'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand-200 flex items-center justify-center text-brand-700 text-[10px] font-bold flex-shrink-0">
                        {name.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{name}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-300">{course}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${hasTopic ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700'}`}>
                      {hasTopic ? '✓ กรอกแล้ว' : '⚠️ ยังไม่กรอก'}
                    </span>
                  </div>
                  {l.topic && <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-300 mt-1 ml-8">📖 {l.topic}</div>}
                  {l.homework && <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-300 mt-0.5 ml-8">✏️ {l.homework}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Form บันทึกใหม่ */}
      <div className="bg-white dark:bg-[#242d3f] rounded-2xl shadow-sm border border-gray-100 dark:border-[#3a4560] p-5 mb-4">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">+ บันทึกชั่วโมงสอน</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            นักเรียน / คอร์ส <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="ค้นหาชื่อนักเรียนหรือคอร์ส..."
            className="w-full border border-gray-200 dark:border-[#3a4560] rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
          />

          {/* รายชื่อนักเรียนแบบกดเลือก */}
          <div className="border border-gray-200 dark:border-[#3a4560] rounded-xl max-h-60 overflow-y-auto divide-y divide-gray-50">
            {filteredEnrollments.length === 0 && (
              <p className="text-center text-gray-400 dark:text-gray-300 text-sm py-4">ไม่พบนักเรียน</p>
            )}
            {filteredEnrollments.map(e => {
              const selected = form.enrollment_id === e.id
              const name = e.students?.nickname || e.students?.full_name || '?'
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, enrollment_id: e.id }))}
                  className={`w-full text-left px-3 py-2.5 transition-colors flex items-center justify-between gap-2 ${
                    selected ? 'bg-brand-50' : 'hover:bg-gray-50 dark:bg-[#1e2533]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${selected ? 'text-brand-700' : 'text-gray-800 dark:text-gray-100'}`}>
                      {name}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-300 truncate">
                      {e.courses?.name ?? '?'} ({e.lessons_used}/{e.lessons_total})
                    </div>
                  </div>
                  {selected && <span className="text-brand-500 text-base flex-shrink-0">✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">วันที่สอน</label>
          <input
            type="date"
            className="w-full border border-gray-200 dark:border-[#3a4560] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={form.lesson_date}
            max={todayStr}
            onChange={e => setForm(f => ({ ...f, lesson_date: e.target.value }))}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">วิชาที่สอน (ถ้ามี)</label>
          <div className="grid grid-cols-2 gap-2">
            {['ภาษาจีน', 'คณิตศาสตร์', 'ภาษาอังกฤษ', 'วิทยาศาสตร์'].map(subj => (
              <button
                key={subj}
                type="button"
                onClick={() => setForm(f => ({ ...f, subject_name: f.subject_name === subj ? '' : subj }))}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  form.subject_name === subj
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'border-gray-200 dark:border-[#3a4560] text-gray-600 dark:text-gray-300 hover:border-brand-400'
                }`}
              >
                {subj}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-300 mt-1">
            ใส่ตอนสอนคอร์สพิเศษหลายวิชา เพื่อให้นับชั่วโมงสอนแยกตามวิชาได้ถูกต้อง
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">ระยะเวลา</label>
          <div className="grid grid-cols-5 gap-2">
            {[30, 45, 60, 90, 120].map(m => (
              <button
                key={m}
                onClick={() => setForm(f => ({ ...f, duration_minutes: m }))}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  form.duration_minutes === m
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'border-gray-200 dark:border-[#3a4560] text-gray-600 dark:text-gray-300 hover:border-brand-400'
                }`}
              >
                {m >= 60 ? `${m / 60}ชม.` : `${m}น.`}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">หัวข้อที่สอน</label>
          <input
            type="text"
            placeholder="เช่น บทที่ 3 คำศัพท์วันละคำ"
            className="w-full border border-gray-200 dark:border-[#3a4560] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={form.topic}
            onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">การบ้าน</label>
          <input
            type="text"
            placeholder="เช่น ฝึกพินอิน หน้า 20-25"
            className="w-full border border-gray-200 dark:border-[#3a4560] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={form.homework}
            onChange={e => setForm(f => ({ ...f, homework: e.target.value }))}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !form.enrollment_id}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors text-base"
        >
          {saving ? 'กำลังบันทึก...' : '✓ บันทึกชั่วโมงสอน'}
        </button>
      </div>

      {/* ประวัติเดือนนี้ */}
      <div className="bg-white dark:bg-[#242d3f] rounded-2xl shadow-sm border border-gray-100 dark:border-[#3a4560] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">ประวัติเดือนนี้</h2>
          <span className="text-xs font-medium bg-brand-50 text-brand-600 px-2.5 py-1 rounded-full">
            {totalSessions} ครั้ง
          </span>
        </div>
        {loadingData ? (
          <div className="py-10 text-center text-gray-400 dark:text-gray-300 text-sm">กำลังโหลด...</div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-gray-400 dark:text-gray-300 text-sm">ยังไม่มีบันทึกในเดือนนี้</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map(log => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-shrink-0 text-center w-9">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200 leading-none">
                    {new Date(log.lesson_date).getDate()}
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-300">
                    {new Date(log.lesson_date).toLocaleDateString('th-TH', { month: 'short' })}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-sm text-gray-800 dark:text-gray-100">
                      {log.enrollments?.students?.nickname || log.enrollments?.students?.full_name || '—'}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-300">·</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-300">{log.enrollments?.courses?.name ?? '—'}</span>
                  </div>
                  {log.topic && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-300 mt-0.5 truncate">📖 {log.topic}</div>
                  )}
                </div>
                <div className="flex-shrink-0 text-sm font-semibold text-brand-600">
                  {fmt(log.duration_minutes)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-300 mt-6">Mando House — ระบบบันทึกชั่วโมงสอน</p>

      {/* Modal: เปลี่ยน PIN */}
      {showChangePin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowChangePin(false)}>
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">🔑 เปลี่ยน PIN</h2>
              <button onClick={() => setShowChangePin(false)} className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:text-gray-300 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">PIN ปัจจุบัน</label>
                <input
                  type="tel" inputMode="numeric" maxLength={4}
                  className="w-full border border-gray-200 dark:border-[#3a4560] rounded-xl px-3 py-2.5 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={pinForm.current}
                  onChange={e => setPinForm(f => ({ ...f, current: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">PIN ใหม่ (4 หลัก)</label>
                <input
                  type="tel" inputMode="numeric" maxLength={4}
                  className="w-full border border-gray-200 dark:border-[#3a4560] rounded-xl px-3 py-2.5 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={pinForm.next}
                  onChange={e => setPinForm(f => ({ ...f, next: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">ยืนยัน PIN ใหม่</label>
                <input
                  type="tel" inputMode="numeric" maxLength={4}
                  className="w-full border border-gray-200 dark:border-[#3a4560] rounded-xl px-3 py-2.5 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={pinForm.confirm}
                  onChange={e => setPinForm(f => ({ ...f, confirm: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  placeholder="••••"
                />
              </div>
              <button
                onClick={handleChangePin}
                disabled={changingPin}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm mt-2"
              >
                {changingPin ? 'กำลังบันทึก...' : 'บันทึก PIN ใหม่'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
