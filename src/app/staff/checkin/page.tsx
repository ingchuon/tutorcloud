'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student, Enrollment } from '@/types'
import toast from 'react-hot-toast'

interface Teacher {
  id: string
  full_name: string
  subject: string | null
}

type StudentOption = { id: string; full_name: string; nickname?: string | null }

function StudentLookup({ students, onSelect }: {
  students: StudentOption[]
  onSelect: (s: StudentOption) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = search.trim().length > 0
    ? students.filter(s => {
        const q = search.toLowerCase()
        return (s.nickname || '').toLowerCase().includes(q) || s.full_name.toLowerCase().includes(q)
      })
    : []

  return (
    <div className="relative">
      <input
        type="text"
        className="input text-sm"
        placeholder="พิมพ์ชื่อหรือชื่อเล่นนักเรียน..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-[#2a3245] rounded-xl shadow-lg z-30 max-h-52 overflow-y-auto">
          {filtered.map(s => (
            <button
              key={s.id}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-brand-50 dark:hover:bg-[#2a3245] transition flex items-center gap-2"
              onClick={() => { onSelect(s); setSearch('') }}
            >
              <span className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-800 flex items-center justify-center text-brand-700 dark:text-brand-200 text-xs font-bold flex-shrink-0">
                {(s.nickname || s.full_name).slice(0, 2)}
              </span>
              <span className="font-medium">{s.nickname || s.full_name}</span>
              {s.nickname && <span className="text-gray-400 text-xs">{s.full_name}</span>}
            </button>
          ))}
        </div>
      )}
      {search.trim().length > 0 && filtered.length === 0 && (
        <p className="mt-2 text-sm text-gray-400">ไม่พบนักเรียน "{search}"</p>
      )}
    </div>
  )
}

export default function CheckinPage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [checkins, setCheckins] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [customDate, setCustomDate] = useState('')
  const [isBackdate, setIsBackdate] = useState(false)
  const [checkinSummary, setCheckinSummary] = useState<{
    studentName: string
    courseName: string
    lessonDate: string
    lessonNumber: number
    lessonsUsed: number
    lessonsTotal: number
    lessonHistory: { lesson_number: number; lesson_date: string; topic?: string }[]
    isCompleted: boolean
  } | null>(null)
  const [listStudentFilter, setListStudentFilter] = useState('')
  const [checkinPanelTab, setCheckinPanelTab] = useState<'list' | 'lookup'>('list')
  const [studentSummary, setStudentSummary] = useState<{
    name: string
    courses: {
      courseName: string
      lessonsUsed: number
      lessonsTotal: number
      history: { lesson_number: number; lesson_date: string; topic?: string }[]
    }[]
  } | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [now, setNow] = useState(new Date())
  const [editCheckin, setEditCheckin] = useState<any>(null)
  const [editForm, setEditForm] = useState({ check_in_at: '', check_out_at: '', lesson_note: '' })
  const [noteCheckin, setNoteCheckin] = useState<any>(null)
  const [noteText, setNoteText] = useState('')

  const [durationMinutes, setDurationMinutes] = useState(60)
  const [subjectName, setSubjectName] = useState('')
  const [topic, setTopic] = useState('')
  const [homework, setHomework] = useState('')

  const todayStr = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const isToday = selectedDate === todayStr

  useEffect(() => {
    loadStudentsAndEnrollments()
    loadTeachers()
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { loadCheckins(selectedDate) }, [selectedDate])

  useEffect(() => {
    if (!selectedStudent) { setSelectedEnrollmentId(''); return }
    const list = enrollments.filter(e => e.student_id === selectedStudent)
    if (list.length === 1) setSelectedEnrollmentId(list[0].id)
    else setSelectedEnrollmentId('')
  }, [selectedStudent, enrollments])

  async function loadStudentsAndEnrollments() {
    const [{ data: s }, { data: e }] = await Promise.all([
      supabase.from('students').select('*').eq('is_active', true).order('nickname'),
      supabase.from('enrollments').select('*, course:courses(name)').eq('status', 'active'),
    ])
    setStudents(s ?? [])
    setEnrollments(e ?? [])
  }

  async function loadTeachers() {
    const { data } = await supabase
      .from('teachers').select('id, full_name, subject')
      .eq('is_active', true).not('full_name', 'ilike', '%&%').order('full_name')
    setTeachers((data as Teacher[]) ?? [])
  }

  async function loadCheckins(date: string) {
    if (date === todayStr) {
      try { await supabase.rpc('close_overnight_checkins') } catch (_) {}
    }
    const { data: c } = await supabase
      .from('checkins')
      .select('*, student:students(full_name, nickname), enrollment:enrollments(*, course:courses(name))')
      .gte('check_in_at', date + 'T00:00:00+07:00')
      .lt('check_in_at', date + 'T23:59:59+07:00')
      .order('check_in_at', { ascending: false })
    setCheckins(c ?? [])
  }

  async function loadData() {
    await Promise.all([loadStudentsAndEnrollments(), loadCheckins(selectedDate)])
  }

  function resetForm() {
    setSelectedStudent(''); setSelectedEnrollmentId(''); setSelectedTeacherId('')
    setStudentSearch(''); setCustomDate(''); setDurationMinutes(60)
    setSubjectName(''); setTopic(''); setHomework('')
  }

  async function handleCheckin() {
    if (!selectedStudent) { toast.error('กรุณาเลือกนักเรียน'); return }
    const list = enrollments.filter(e => e.student_id === selectedStudent)
    if (list.length > 1 && !selectedEnrollmentId) { toast.error('กรุณาเลือกคอร์สที่จะเช็กอิน'); return }
    if (isBackdate && !customDate) { toast.error('กรุณาเลือกวันที่และเวลา'); return }

    setLoading(true)
    const enrollmentId = selectedEnrollmentId || list[0]?.id || null
    const checkinTime = isBackdate && customDate ? new Date(customDate).toISOString() : new Date().toISOString()
    const lessonDate = checkinTime.slice(0, 10)
    const enroll = enrollments.find(e => e.id === enrollmentId)
    const teacher = teachers.find(t => t.id === selectedTeacherId)

    // ── จุดที่ 1: ตรวจสอบว่าครบจำนวนครั้งแล้วหรือยัง ──
    if (enroll && enroll.lessons_total > 0 && enroll.lessons_used >= enroll.lessons_total) {
      const st = students.find(s => s.id === selectedStudent)
      const name = st?.nickname || st?.full_name || 'นักเรียน'
      toast.error(
        `${name} เรียนครบ ${enroll.lessons_total} ครั้งแล้ว\nกรุณาซื้อคอร์สใหม่ก่อนเช็กอิน`,
        { duration: 5000 }
      )
      setLoading(false)
      return
    }

    const { error } = await supabase.from('checkins').insert({
      student_id: selectedStudent,
      enrollment_id: enrollmentId,
      check_in_at: checkinTime,
    })
    if (error) { toast.error('เช็กอินไม่สำเร็จ'); setLoading(false); return }

    if (enrollmentId && (teacher || topic || homework)) {
      const { data: existing } = await supabase
        .from('lesson_logs').select('id, teacher_name, duration_minutes, subject_name')
        .eq('enrollment_id', enrollmentId).eq('lesson_date', lessonDate)

      const courseName = enroll?.course?.name ?? ''
      const isSpecialCourse = /special/i.test(courseName)
      let skipLessonCount = false

      if (existing && existing.length > 0) {
        const who = existing[0].teacher_name ? `ครู${existing[0].teacher_name}` : 'staff'
        const prevSubject = existing[0].subject_name ? ` (วิชา${existing[0].subject_name})` : ''

        if (isSpecialCourse) {
          const confirmed = confirm(
            `วันนี้มีบันทึกชั่วโมงสอนของคอร์สนี้อยู่แล้ว (${courseName})\n` +
            `บันทึกโดย: ${who}${prevSubject}${existing[0].duration_minutes ? ` (${existing[0].duration_minutes} นาที)` : ''}\n\n` +
            `ต้องการเช็กอิน + บันทึกชั่วโมงสอนของวิชานี้เพิ่มหรือไม่?\n` +
            `(กด ตกลง = บันทึกเพิ่ม โดยไม่หักครั้งเรียนซ้ำ / ยกเลิก = เช็กอินอย่างเดียว)`
          )
          if (!confirmed) {
            toast.success(isBackdate ? 'บันทึกย้อนหลังสำเร็จ (เช็กอินอย่างเดียว)' : 'เช็กอินสำเร็จ (ไม่บันทึกชั่วโมงสอนซ้ำ)')
            if (isBackdate && customDate) setSelectedDate(customDate.slice(0, 10))
            resetForm(); loadData(); setLoading(false); return
          }
          skipLessonCount = true
        } else {
          const confirmed = confirm(
            `วันนี้มีบันทึกชั่วโมงสอนของคอร์สนี้อยู่แล้ว (${courseName})\n` +
            `บันทึกโดย: ${who}${existing[0].duration_minutes ? ` (${existing[0].duration_minutes} นาที)` : ''}\n\n` +
            `ต้องการเช็กอิน + บันทึกชั่วโมงสอนซ้ำอีกครั้งหรือไม่?\n(กด ตกลง = บันทึกเพิ่ม / ยกเลิก = เช็กอินอย่างเดียว)`
          )
          if (!confirmed) {
            toast.success(isBackdate ? 'บันทึกย้อนหลังสำเร็จ (เช็กอินอย่างเดียว)' : 'เช็กอินสำเร็จ (ไม่บันทึกชั่วโมงสอนซ้ำ)')
            if (isBackdate && customDate) setSelectedDate(customDate.slice(0, 10))
            resetForm(); loadData(); setLoading(false); return
          }
        }
      }

      const { count: checkinsBefore } = await supabase
        .from('checkins').select('*', { count: 'exact', head: true })
        .eq('enrollment_id', enrollmentId).lte('check_in_at', checkinTime)
      const nextLesson = checkinsBefore ?? 1

      const { error: logError } = await supabase.from('lesson_logs').insert({
        enrollment_id: enrollmentId,
        student_id: selectedStudent,
        teacher_name: teacher?.full_name ?? null,
        lesson_date: lessonDate,
        lesson_number: nextLesson,
        duration_minutes: durationMinutes,
        subject_name: subjectName || null,
        topic: topic || null,
        homework: homework || null,
      })

      if (isBackdate && !logError) {
        const { data: allLogs } = await supabase
          .from('lesson_logs').select('id, lesson_date')
          .eq('enrollment_id', enrollmentId).order('lesson_date', { ascending: true })
        if (allLogs) {
          for (let i = 0; i < allLogs.length; i++) {
            await supabase.from('lesson_logs').update({ lesson_number: i + 1 }).eq('id', allLogs[i].id)
          }
        }
      }

      if (!logError && enroll && !skipLessonCount) {
        const { count: totalCheckins } = await supabase
          .from('checkins').select('*', { count: 'exact', head: true }).eq('enrollment_id', enrollmentId)
        await supabase.from('enrollments')
          .update({ lessons_used: totalCheckins ?? enroll.lessons_used + 1 }).eq('id', enrollmentId)
      }
    }

    // ── ดึงข้อมูล enrollment ล่าสุดหลังอัปเดต ──
    const { data: freshEnroll } = await supabase
      .from('enrollments').select('lessons_used, lessons_total').eq('id', enrollmentId ?? '').single()
    const newLessonsUsed = freshEnroll?.lessons_used ?? (enroll?.lessons_used ?? 0)
    const newLessonsTotal = freshEnroll?.lessons_total ?? enroll?.lessons_total ?? 0

    // ── จุดที่ 2: auto-complete เมื่อครบจำนวนครั้ง ──
    const isNowCompleted = newLessonsTotal > 0 && newLessonsUsed >= newLessonsTotal
    if (isNowCompleted && enrollmentId) {
      await supabase.from('enrollments')
        .update({ status: 'completed' })
        .eq('id', enrollmentId)
      // reload เพื่อเอา enrollment นี้ออกจาก list active
      await loadStudentsAndEnrollments()
    }

    const { data: lastLog } = await supabase
      .from('lesson_logs').select('lesson_number').eq('enrollment_id', enrollmentId ?? '')
      .order('lesson_number', { ascending: false }).limit(1).single()

    const st = students.find(s => s.id === selectedStudent)
    const studentName = st?.nickname || st?.full_name || ''
    const checkinDateStr = isBackdate && customDate ? customDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
    const courseName = enroll?.course?.name ?? ''

    const { data: historyData } = await supabase
      .from('lesson_logs').select('lesson_number, lesson_date, topic')
      .eq('enrollment_id', enrollmentId ?? '').order('lesson_number', { ascending: true })

    if (isBackdate) {
      toast.success('บันทึกย้อนหลังสำเร็จ!')
    } else {
      setCheckinSummary({
        studentName, courseName, lessonDate: checkinDateStr,
        lessonNumber: lastLog?.lesson_number ?? newLessonsUsed,
        lessonsUsed: newLessonsUsed,
        lessonsTotal: newLessonsTotal,
        lessonHistory: historyData ?? [],
        isCompleted: isNowCompleted,
      })
    }

    if (isBackdate && customDate) setSelectedDate(customDate.slice(0, 10))
    resetForm(); loadData(); setLoading(false)
  }

  async function handleDelete(id: string) {
    const item = checkins.find(c => c.id === id)
    if (!item) return
    const lessonDate = item.check_in_at.slice(0, 10)
    const { data: relatedLogs } = await supabase
      .from('lesson_logs').select('id, enrollment_id, lesson_number')
      .eq('enrollment_id', item.enrollment_id).eq('lesson_date', lessonDate)

    setCheckins(prev => prev.filter(c => c.id !== id))
    let undone = false
    const timeoutId = setTimeout(async () => {
      if (undone) return
      const { error } = await supabase.from('checkins').delete().eq('id', id)
      if (error) { toast.error('ลบไม่สำเร็จ'); loadCheckins(selectedDate); return }
      if (relatedLogs && relatedLogs.length > 0) {
        await supabase.from('lesson_logs').delete().in('id', relatedLogs.map(l => l.id))
        if (item.enrollment_id) {
          const { data: enroll } = await supabase.from('enrollments')
            .select('lessons_used, status').eq('id', item.enrollment_id).single()
          if (enroll) {
            const updates: any = { lessons_used: Math.max(0, (enroll.lessons_used ?? 0) - relatedLogs.length) }
            // ถ้า enrollment เคย completed แล้วถูกลบ checkin → คืนสถานะเป็น active
            if (enroll.status === 'completed') updates.status = 'active'
            await supabase.from('enrollments').update(updates).eq('id', item.enrollment_id)
          }
        }
      }
    }, 6000)

    const studentName = item.student?.nickname || item.student?.full_name || 'นักเรียน'
    const logCount = relatedLogs?.length ?? 0
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          <span>
            ลบเช็กอิน {studentName} แล้ว
            {logCount > 0 && <span className="text-xs text-gray-400 ml-1">(คืน {logCount} ครั้ง)</span>}
          </span>
          <button
            onClick={() => {
              undone = true; clearTimeout(timeoutId)
              setCheckins(prev => {
                if (prev.some(c => c.id === item.id)) return prev
                return [item, ...prev].sort((a, b) => new Date(b.check_in_at).getTime() - new Date(a.check_in_at).getTime())
              })
              toast.dismiss(t.id); toast.success('เลิกทำแล้ว')
            }}
            className="font-medium text-brand-600 underline whitespace-nowrap"
          >เลิกทำ (Undo)</button>
        </span>
      ),
      { duration: 6000 }
    )
  }

  function openEdit(c: any) {
    setEditCheckin(c)
    const toLocal = (iso: string) => {
      const d = new Date(iso)
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    }
    setEditForm({
      check_in_at: toLocal(c.check_in_at),
      check_out_at: c.check_out_at ? toLocal(c.check_out_at) : '',
      lesson_note: c.lesson_note || '',
    })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('checkins').update({
      check_in_at: new Date(editForm.check_in_at).toISOString(),
      check_out_at: editForm.check_out_at ? new Date(editForm.check_out_at).toISOString() : null,
      lesson_note: editForm.lesson_note || null,
    }).eq('id', editCheckin.id)
    if (error) { toast.error('แก้ไขไม่สำเร็จ'); return }
    toast.success('แก้ไขแล้ว'); setEditCheckin(null); loadCheckins(selectedDate)
  }

  function openNote(c: any) { setNoteCheckin(c); setNoteText(c.lesson_note || '') }

  async function handleSaveNote() {
    const { error } = await supabase.from('checkins').update({ lesson_note: noteText }).eq('id', noteCheckin.id)
    if (error) { toast.error('บันทึกไม่สำเร็จ'); return }
    toast.success('บันทึกบทเรียนแล้ว'); setNoteCheckin(null); loadCheckins(selectedDate)
  }

  function goDate(offset: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    const next = d.toISOString().split('T')[0]
    if (next <= todayStr) setSelectedDate(next)
  }

  function formatDateTH(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00')
    if (dateStr === todayStr) return 'วันนี้'
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'เมื่อวาน'
    return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  async function loadStudentSummaryById(studentId: string, name: string) {
    setLoadingSummary(true); setStudentSummary(null)
    const { data: enrolls } = await supabase
      .from('enrollments').select('id, lessons_used, lessons_total, course:courses(name)')
      .eq('student_id', studentId).eq('status', 'active').order('created_at', { ascending: true })

    if (!enrolls || enrolls.length === 0) {
      toast.error('ไม่พบคอร์สที่กำลังเรียนอยู่'); setLoadingSummary(false); return
    }

    const courses = await Promise.all(enrolls.map(async (en: any) => {
      const { data: hist } = await supabase
        .from('lesson_logs').select('lesson_number, lesson_date, topic')
        .eq('enrollment_id', en.id).order('lesson_number', { ascending: true })
      return {
        courseName: (en.course as any)?.name || '—',
        lessonsUsed: en.lessons_used ?? 0,
        lessonsTotal: en.lessons_total ?? 0,
        history: hist ?? [],
      }
    }))
    setStudentSummary({ name, courses }); setLoadingSummary(false)
  }

  async function loadStudentSummary(c: any) {
    const name = c.student?.nickname || c.student?.full_name || '?'
    if (c.student_id) await loadStudentSummaryById(c.student_id, name)
  }

  const presentCount = checkins.length
  const checkedOutCount = checkins.filter(c => c.check_out_at).length
  const stillInCount = checkins.filter(c => !c.check_out_at).length

  const filteredCheckins = listStudentFilter
    ? checkins.filter(c => {
        const name = (c.student?.nickname || c.student?.full_name || '').toLowerCase()
        return name.includes(listStudentFilter.toLowerCase())
      })
    : checkins

  const filteredStudents = students.filter(s =>
    !studentSearch ||
    (s.nickname ?? '').toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.full_name.toLowerCase().includes(studentSearch.toLowerCase())
  )

  const studentEnrollments = selectedStudent ? enrollments.filter(e => e.student_id === selectedStudent) : []
  const hasMultipleCourses = studentEnrollments.length > 1
  const autoEnrollment = studentEnrollments.length === 1 ? studentEnrollments[0] : null

  // แสดง warning ถ้าคอร์สที่เลือกครบแล้ว
  const selectedEnroll = enrollments.find(e =>
    e.id === (selectedEnrollmentId || autoEnrollment?.id)
  )
  const isEnrollFull = selectedEnroll && selectedEnroll.lessons_total > 0
    && selectedEnroll.lessons_used >= selectedEnroll.lessons_total

  const checkinDisabled = loading || !selectedStudent || !selectedTeacherId
    || (hasMultipleCourses && !selectedEnrollmentId) || (isBackdate && !customDate)
    || !!isEnrollFull

  const fmt = (d: Date) => d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="p-4 md:p-6">

      {/* Popup สรุปหลังเช็กอิน */}
      {checkinSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl text-center max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-1">
              {checkinSummary.isCompleted ? 'จบคอร์สแล้ว!' : 'เช็กอินสำเร็จ'}
            </h3>
            <p className="text-brand-600 font-semibold text-base mb-4">{checkinSummary.studentName}</p>

            {/* แสดง banner จบคอร์ส */}
            {checkinSummary.isCompleted && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 mb-4 text-sm text-green-700 dark:text-green-400 font-medium">
                เรียนครบทุกครั้งแล้ว คอร์สนี้ถูกบันทึกเป็น Completed อัตโนมัติ
                กรุณาแจ้งผู้ปกครองซื้อคอร์สใหม่เพื่อเรียนต่อ
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-5 text-left space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">คอร์ส</span>
                <span className="font-medium text-right max-w-[60%]">{checkinSummary.courseName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">วันที่</span>
                <span className="font-medium">{new Date(checkinSummary.lessonDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">ครั้งที่</span>
                <span className="font-semibold text-brand-600 text-base">{checkinSummary.lessonNumber}</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-500">เรียนไปแล้ว</span>
                  <span className="font-semibold">{checkinSummary.lessonsUsed} / {checkinSummary.lessonsTotal} ครั้ง</span>
                </div>
                {checkinSummary.lessonsTotal > 0 && (
                  <>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          checkinSummary.isCompleted ? 'bg-green-500'
                          : checkinSummary.lessonsTotal - checkinSummary.lessonsUsed <= 2 ? 'bg-red-500'
                          : checkinSummary.lessonsTotal - checkinSummary.lessonsUsed <= 4 ? 'bg-amber-400'
                          : 'bg-brand-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.round((checkinSummary.lessonsUsed / checkinSummary.lessonsTotal) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{Math.round((checkinSummary.lessonsUsed / checkinSummary.lessonsTotal) * 100)}%</span>
                      <span className={checkinSummary.isCompleted ? 'text-green-600 font-medium' : checkinSummary.lessonsTotal - checkinSummary.lessonsUsed <= 2 ? 'text-red-500 font-medium' : ''}>
                        {checkinSummary.isCompleted ? 'ครบแล้ว' : `เหลือ ${checkinSummary.lessonsTotal - checkinSummary.lessonsUsed} ครั้ง`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {!checkinSummary.isCompleted && checkinSummary.lessonsTotal - checkinSummary.lessonsUsed <= 2 && checkinSummary.lessonsTotal > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm rounded-xl px-4 py-2.5 mb-4">
                เหลือครั้งเรียนน้อยมาก แนะนำต่อคอร์สเพิ่ม
              </div>
            )}

            {checkinSummary.lessonHistory.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-4 max-h-40 overflow-y-auto text-left">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">ประวัติการเรียน</div>
                <div className="space-y-1.5">
                  {checkinSummary.lessonHistory.map(h => {
                    const d = new Date(h.lesson_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                    const isCurrent = h.lesson_number === checkinSummary.lessonNumber
                    return (
                      <div key={h.lesson_number} className={`flex items-baseline gap-2 text-xs ${isCurrent ? 'text-brand-600 font-semibold' : 'text-gray-600 dark:text-gray-300'}`}>
                        <span className="w-16 shrink-0">ครั้งที่ {h.lesson_number}</span>
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                        <span>{d}</span>
                        {h.topic && <span className="text-gray-400 dark:text-gray-500 truncate">({h.topic})</span>}
                        {isCurrent && <span className="ml-auto shrink-0">← วันนี้</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <button
              className="btn-outline w-full mb-2"
              onClick={async () => {
                const dateStr = new Date(checkinSummary.lessonDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
                const remaining = checkinSummary.lessonsTotal - checkinSummary.lessonsUsed
                const historyLines = checkinSummary.lessonHistory.map(h => {
                  const d = new Date(h.lesson_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                  return `  ครั้งที่ ${h.lesson_number} — ${d}${h.topic ? ` (${h.topic})` : ''}`
                }).join('\n')
                const msg = [
                  `สรุปการเรียน Mando House`,
                  `น้อง${checkinSummary.studentName}`,
                  `${checkinSummary.courseName}`,
                  ``,
                  `ประวัติการเรียน`,
                  historyLines,
                  ``,
                  `วันนี้: ครั้งที่ ${checkinSummary.lessonNumber} (${dateStr})`,
                  `เรียนไปแล้ว ${checkinSummary.lessonsUsed}/${checkinSummary.lessonsTotal} ครั้ง`,
                  checkinSummary.isCompleted
                    ? `เรียนครบทุกครั้งแล้ว กรุณาติดต่อสมัครคอร์สใหม่เพื่อเรียนต่อได้เลยนะคะ`
                    : remaining <= 2
                    ? `เหลือครั้งเรียนน้อยมาก แนะนำต่อคอร์สเพิ่มนะคะ`
                    : `ขอบคุณที่ไว้วางใจ Mando House นะคะ`,
                ].join('\n')
                await navigator.clipboard.writeText(msg)
                alert('คัดลอกข้อความแล้ว นำไปวางใน LINE ผู้ปกครองได้เลย')
              }}
            >
              คัดลอกส่งผู้ปกครอง
            </button>
            <button className="btn-brand w-full" onClick={() => setCheckinSummary(null)}>รับทราบ</button>
          </div>
        </div>
      )}

      {/* Modal สรุปรายคน */}
      {(loadingSummary || studentSummary) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
            {loadingSummary ? (
              <p className="text-center text-gray-400 py-8">กำลังโหลด...</p>
            ) : studentSummary && (
              <>
                <div className="text-center mb-4">
                  <h3 className="font-semibold text-lg">{studentSummary.name}</h3>
                  <p className="text-xs text-gray-400">{studentSummary.courses.length} คอร์สที่กำลังเรียน</p>
                </div>
                {studentSummary.courses.map((course, ci) => {
                  const remaining = course.lessonsTotal - course.lessonsUsed
                  const pct = course.lessonsTotal > 0 ? Math.round((course.lessonsUsed / course.lessonsTotal) * 100) : 0
                  return (
                    <div key={ci} className="mb-4 border border-gray-100 dark:border-gray-700 rounded-xl p-3">
                      <div className="font-medium text-sm text-brand-700 dark:text-brand-300 mb-2">{course.courseName}</div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-gray-500">เรียนไปแล้ว</span>
                        <span className="font-semibold">{course.lessonsUsed} / {course.lessonsTotal} ครั้ง</span>
                      </div>
                      {course.lessonsTotal > 0 && (
                        <>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
                            <div className={`h-2 rounded-full ${remaining <= 2 ? 'bg-red-500' : remaining <= 4 ? 'bg-amber-400' : 'bg-brand-500'}`}
                              style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-gray-400 mb-2">
                            <span>{pct}%</span>
                            <span className={remaining <= 2 ? 'text-red-500 font-medium' : ''}>เหลือ {remaining} ครั้ง</span>
                          </div>
                        </>
                      )}
                      {course.history.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5 max-h-36 overflow-y-auto">
                          <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">ประวัติการเรียน</div>
                          <div className="space-y-1">
                            {course.history.map(h => {
                              const d = new Date(h.lesson_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                              return (
                                <div key={h.lesson_number} className="flex items-baseline gap-2 text-xs text-gray-600 dark:text-gray-300">
                                  <span className="w-14 shrink-0 font-medium">ครั้งที่ {h.lesson_number}</span>
                                  <span className="text-gray-400">—</span>
                                  <span>{d}</span>
                                  {h.topic && <span className="text-gray-400 truncate">({h.topic})</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {remaining <= 2 && course.lessonsTotal > 0 && (
                        <div className={`text-xs rounded-lg px-3 py-2 mt-2 ${course.lessonsUsed >= course.lessonsTotal ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
                          {course.lessonsUsed >= course.lessonsTotal ? 'หมดคอร์สแล้ว แนะนำต่อคอร์ส' : 'เหลือน้อยมาก แนะนำต่อคอร์ส'}
                        </div>
                      )}
                    </div>
                  )
                })}
                <button
                  className="btn-outline w-full mb-2"
                  onClick={async () => {
                    const blocks = studentSummary.courses.map(course => {
                      const remaining = course.lessonsTotal - course.lessonsUsed
                      const historyLines = course.history.map(h => {
                        const d = new Date(h.lesson_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                        return `  ครั้งที่ ${h.lesson_number} — ${d}${h.topic ? ` (${h.topic})` : ''}`
                      }).join('\n')
                      const note = course.lessonsUsed >= course.lessonsTotal
                        ? '  หมดคอร์สแล้ว กรุณาต่อคอร์สนะคะ'
                        : remaining <= 2 ? '  เหลือน้อยมาก แนะนำต่อคอร์สนะคะ' : ''
                      return [`${course.courseName}`, historyLines || '  (ยังไม่มีประวัติ)',
                        `  เรียนไปแล้ว ${course.lessonsUsed}/${course.lessonsTotal} ครั้ง (เหลือ ${remaining} ครั้ง)`, note,
                      ].filter(Boolean).join('\n')
                    }).join('\n\n')
                    const msg = [`สรุปการเรียน Mando House`, `น้อง${studentSummary.name}`, ``, blocks, ``, `ขอบคุณที่ไว้วางใจ Mando House นะคะ`].join('\n')
                    await navigator.clipboard.writeText(msg)
                    alert('คัดลอกข้อความแล้ว นำไปวางใน LINE ผู้ปกครองได้เลย')
                  }}
                >คัดลอกส่งผู้ปกครอง</button>
                <button className="btn-brand w-full" onClick={() => setStudentSummary(null)}>ปิด</button>
              </>
            )}
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">บันทึกเวลาเข้าออกของนักเรียน พร้อมข้อมูลการสอน</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* เช็กอินด่วน */}
        <div className="card">
          <div className="card-header"><h3 className="font-medium">เช็กอินด่วน</h3></div>
          <div className="p-5 space-y-4">
            <div className="text-center bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4">
              <div className="text-3xl font-semibold text-brand-700 dark:text-brand-300">{fmt(now)}</div>
              <div className="text-xs text-brand-600 dark:text-brand-400 mt-1">เวลาปัจจุบัน</div>
            </div>

            <div>
              <label className="label">ค้นหานักเรียน</label>
              <input className="input mb-2" placeholder="พิมพ์ชื่อหรือชื่อเล่น..."
                value={studentSearch}
                onChange={e => { setStudentSearch(e.target.value); setSelectedStudent(''); setSelectedEnrollmentId('') }}
              />
              <select className="input" value={selectedStudent}
                onChange={e => { setSelectedStudent(e.target.value); setStudentSearch('') }}
                size={Math.min(filteredStudents.length + 1, 6)}
              >
                <option value="">— เลือกนักเรียน —</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nickname || s.full_name}{s.nickname ? ` (${s.full_name})` : ''}
                  </option>
                ))}
              </select>
              {studentSearch && filteredStudents.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-300 mt-1">ไม่พบนักเรียน</p>
              )}
            </div>

            {selectedStudent && (
              <div className="space-y-3">
                {autoEnrollment && (
                  <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-900/20 rounded-xl px-3 py-2.5">
                    <span className="text-brand-500 text-base">✓</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-brand-700 dark:text-brand-300 truncate">
                        {autoEnrollment.course?.name || 'ไม่มีชื่อคอร์ส'}
                      </div>
                      <div className="text-xs text-brand-400">เลือกอัตโนมัติ (คอร์สเดียว)</div>
                    </div>
                  </div>
                )}

                {hasMultipleCourses && (
                  <div>
                    <label className="label flex items-center gap-1.5">
                      เลือกคอร์สที่จะเช็กอิน
                      <span className="text-orange-500 text-xs font-normal">* จำเป็น</span>
                    </label>
                    <div className="flex flex-col gap-2">
                      {studentEnrollments.map(enr => (
                        <button key={enr.id} onClick={() => setSelectedEnrollmentId(enr.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                            selectedEnrollmentId === enr.id
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                              : 'border-gray-200 dark:border-[#3a4560] hover:border-gray-300 bg-white dark:bg-[#242d3f]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selectedEnrollmentId === enr.id ? 'border-brand-500' : 'border-gray-300'}`}>
                              {selectedEnrollmentId === enr.id && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                            </div>
                            <span className={`text-sm font-medium truncate ${selectedEnrollmentId === enr.id ? 'text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-200'}`}>
                              {enr.course?.name || 'ไม่มีชื่อคอร์ส'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {studentEnrollments.length === 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 text-sm text-orange-700">
                    นักเรียนไม่มีคอร์ส active
                  </div>
                )}

                {/* แสดง warning ถ้าครบครั้งแล้ว */}
                {isEnrollFull && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                    เรียนครบ {selectedEnroll?.lessons_total} ครั้งแล้ว — กรุณาซื้อคอร์สใหม่ก่อนเช็กอิน
                  </div>
                )}

                <div>
                  <label className="label">ครูผู้สอน <span className="text-red-400">*</span></label>
                  <select className="input" value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.full_name}{t.subject ? ` (${t.subject})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">วิชาที่สอน (ถ้ามี)</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['ภาษาจีน', 'คณิตศาสตร์', 'ภาษาอังกฤษ', 'วิทยาศาสตร์'].map(subj => (
                      <button key={subj} onClick={() => setSubjectName(prev => prev === subj ? '' : subj)}
                        className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                          subjectName === subj
                            ? 'bg-brand-500 text-white border-brand-500'
                            : 'border-gray-200 dark:border-[#3a4560] text-gray-600 dark:text-gray-300 hover:border-brand-400'
                        }`}
                      >{subj}</button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-300 mt-1">ใส่สำหรับคอร์สพิเศษหลายวิชา (Special)</p>
                </div>

                <div>
                  <label className="label">ระยะเวลาเรียน</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[30, 45, 60, 90, 120].map(m => (
                      <button key={m} onClick={() => setDurationMinutes(m)}
                        className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                          durationMinutes === m
                            ? 'bg-brand-500 text-white border-brand-500'
                            : 'border-gray-200 dark:border-[#3a4560] text-gray-600 dark:text-gray-300 hover:border-brand-400'
                        }`}
                      >{m >= 60 ? `${m / 60}ชม.` : `${m}น.`}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">สอนอะไรบ้าง (ถ้ามี)</label>
                  <input className="input" placeholder="เช่น บทที่ 3 คำศัพท์เรื่องครอบครัว"
                    value={topic} onChange={e => setTopic(e.target.value)} />
                </div>

                <div>
                  <label className="label">การบ้าน (ถ้ามี)</label>
                  <input className="input" placeholder="เช่น ฝึกพินอิน หน้า 20-25"
                    value={homework} onChange={e => setHomework(e.target.value)} />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setIsBackdate(!isBackdate); setCustomDate('') }}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${isBackdate ? 'bg-brand-500' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isBackdate ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-300">บันทึกย้อนหลัง</span>
            </div>

            {isBackdate && (
              <div>
                <label className="label">วันที่และเวลา</label>
                <input type="datetime-local" className="input" value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 16)} />
              </div>
            )}

            {selectedStudent && !selectedTeacherId && !isEnrollFull && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-700">
                กรุณาเลือกครูผู้สอนก่อนกดเช็กอิน
              </div>
            )}

            <button onClick={handleCheckin} disabled={checkinDisabled} className="btn-brand w-full justify-center py-2.5 disabled:opacity-50">
              {loading ? 'กำลังบันทึก...' : isBackdate ? 'บันทึกย้อนหลัง' : 'เช็กอิน'}
            </button>
          </div>
        </div>

        {/* รายชื่อผู้เข้าเรียน */}
        <div className="md:col-span-2 card">
          <div className="card-header gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
              <button onClick={() => goDate(-1)} className="btn-outline btn-sm px-2.5 py-1">←</button>
              <input type="date" className="input text-sm py-1.5 w-auto" value={selectedDate} max={todayStr}
                onChange={e => e.target.value && setSelectedDate(e.target.value)} />
              <button onClick={() => goDate(1)} disabled={selectedDate >= todayStr}
                className="btn-outline btn-sm px-2.5 py-1 disabled:opacity-30">→</button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                {formatDateTH(selectedDate)}
              </span>
              {!isToday && (
                <button onClick={() => setSelectedDate(todayStr)}
                  className="btn-outline btn-sm px-2.5 py-1 text-brand-600 border-brand-200 hover:bg-brand-50">
                  วันนี้
                </button>
              )}
            </div>
            <span className="badge badge-green">{presentCount} คน</span>
          </div>

          <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-gray-100 dark:border-[#2a3245]">
            <button onClick={() => setCheckinPanelTab('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-all -mb-px border-b-2 ${checkinPanelTab === 'list' ? 'border-brand-600 text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >รายชื่อวันนี้</button>
            <button onClick={() => setCheckinPanelTab('lookup')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-all -mb-px border-b-2 ${checkinPanelTab === 'lookup' ? 'border-brand-600 text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >สรุปรายคน</button>
          </div>

          {checkinPanelTab === 'list' && (
            <>
              {presentCount > 1 && (
                <div className="px-4 pt-3 pb-1">
                  <div className="relative">
                    <input type="text" className="input text-sm pl-4 py-1.5" placeholder="ค้นหาชื่อนักเรียน..."
                      value={listStudentFilter} onChange={e => setListStudentFilter(e.target.value)} />
                    {listStudentFilter && (
                      <button onClick={() => setListStudentFilter('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">X</button>
                    )}
                  </div>
                  {listStudentFilter && (
                    <p className="text-xs text-gray-400 mt-1.5 px-1">แสดง {filteredCheckins.length} จาก {presentCount} คน</p>
                  )}
                </div>
              )}

              {presentCount > 0 && (
                <div className="px-5 py-3 border-b border-gray-50 dark:border-[#2a3245] flex gap-4 text-sm flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-500 inline-block"></span>
                    <span className="text-gray-600 dark:text-gray-300">มาเรียน</span>
                    <span className="font-semibold text-brand-700">{presentCount} คน</span>
                  </div>
                  {checkedOutCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>
                      <span className="text-gray-600 dark:text-gray-300">ออกแล้ว</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-200">{checkedOutCount} คน</span>
                    </div>
                  )}
                  {stillInCount > 0 && isToday && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
                      <span className="text-gray-600 dark:text-gray-300">ยังอยู่</span>
                      <span className="font-semibold text-yellow-700">{stillInCount} คน</span>
                    </div>
                  )}
                </div>
              )}

              <div className="divide-y divide-gray-50 dark:divide-[#2a3245]">
                {checkins.length === 0 && (
                  <p className="text-center text-gray-400 dark:text-gray-300 py-10 text-sm">
                    {isToday ? 'ยังไม่มีการเช็กอินวันนี้' : `ไม่มีข้อมูลวันที่ ${formatDateTH(selectedDate)}`}
                  </p>
                )}
                {checkins.length > 0 && filteredCheckins.length === 0 && (
                  <p className="text-center text-gray-400 dark:text-gray-300 py-10 text-sm">ไม่พบ "{listStudentFilter}"</p>
                )}
                {filteredCheckins.map(c => {
                  const name = c.student?.nickname || c.student?.full_name || '?'
                  const inTime = new Date(c.check_in_at)
                  const outTime = c.check_out_at ? new Date(c.check_out_at) : null
                  const duration = outTime ? Math.round((outTime.getTime() - inTime.getTime()) / 60000) : null
                  return (
                    <div key={c.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-300 text-xs font-bold flex-shrink-0">
                          {name.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{name}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-300 truncate">
                            {c.enrollment?.course?.name || 'ไม่มีคอร์ส'}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm whitespace-nowrap">
                            <span className="text-brand-600 font-medium">{fmt(inTime)}</span>
                            {outTime && <span className="text-gray-400 dark:text-gray-300"> → {fmt(outTime)}</span>}
                          </div>
                          {duration && <div className="text-xs text-gray-400 dark:text-gray-300">{duration} นาที</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 ml-12 flex-wrap">
                        {c.check_out_at
                          ? <span className="badge badge-gray text-xs">ออกแล้ว</span>
                          : <span className="badge badge-green text-xs">อยู่</span>
                        }
                        <button onClick={() => openNote(c)}
                          className={`btn-outline btn-sm px-2 text-xs ${c.lesson_note ? 'text-green-600' : 'text-gray-400 dark:text-gray-300'}`}
                        >บันทึก</button>
                        <button onClick={() => openEdit(c)} className="btn-outline btn-sm px-2 text-xs">แก้ไข</button>
                        <button onClick={() => handleDelete(c.id)} className="btn-outline btn-sm px-2 text-xs text-red-400 hover:bg-red-50">ลบ</button>
                        <button onClick={() => loadStudentSummary(c)} className="btn-outline btn-sm px-2 text-xs text-brand-500">สรุป</button>
                      </div>
                      {c.lesson_note && (
                        <div className="mt-2 ml-12 text-xs text-gray-500 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg px-3 py-2 border border-yellow-100 dark:border-yellow-900/30">
                          {c.lesson_note}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {checkinPanelTab === 'lookup' && (
            <div className="p-4">
              <StudentLookup
                students={students}
                onSelect={(student) => {
                  const name = student.nickname || student.full_name || '?'
                  loadStudentSummaryById(student.id, name)
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal บันทึกบทเรียน */}
      {noteCheckin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <div>
                <h2 className="font-semibold">บันทึกบทเรียน</h2>
                <p className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">
                  {noteCheckin.student?.nickname || noteCheckin.student?.full_name} — {noteCheckin.enrollment?.course?.name || 'ไม่มีคอร์ส'}
                </p>
              </div>
              <button onClick={() => setNoteCheckin(null)} className="text-gray-400 dark:text-gray-300">X</button>
            </div>
            <div className="p-5 space-y-3">
              <label className="label">เนื้อหาที่สอนวันนี้</label>
              <textarea className="input min-h-[120px] resize-none"
                placeholder="เช่น บทที่ 3 คำศัพท์เรื่องครอบครัว, ฝึกอ่านประโยค..."
                value={noteText} onChange={e => setNoteText(e.target.value)} />
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveNote} className="btn-brand flex-1 justify-center">บันทึก</button>
                <button onClick={() => setNoteCheckin(null)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal แก้ไขเวลา */}
      {editCheckin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <h2 className="font-semibold">แก้ไขเวลา</h2>
              <button onClick={() => setEditCheckin(null)} className="text-gray-400 dark:text-gray-300">X</button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-3">
              <div>
                <label className="label">เวลาเช็กอิน</label>
                <input type="datetime-local" className="input" value={editForm.check_in_at}
                  onChange={e => setEditForm({ ...editForm, check_in_at: e.target.value })} />
              </div>
              <div>
                <label className="label">เวลาเช็กเอาท์ (ถ้ามี)</label>
                <input type="datetime-local" className="input" value={editForm.check_out_at}
                  onChange={e => setEditForm({ ...editForm, check_out_at: e.target.value })} />
              </div>
              <div>
                <label className="label">บันทึกบทเรียน</label>
                <textarea className="input min-h-[80px] resize-none" placeholder="เนื้อหาที่สอน..."
                  value={editForm.lesson_note} onChange={e => setEditForm({ ...editForm, lesson_note: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-brand flex-1 justify-center">บันทึก</button>
                <button type="button" onClick={() => setEditCheckin(null)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
