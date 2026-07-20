'use client'
// src/app/staff/study-hours/page.tsx
// สรุปชั่วโมงเรียนของนักเรียนแต่ละคน จาก lesson_logs

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LessonLog {
  id: string
  student_id: string
  lesson_date: string
  duration_minutes: number
  topic: string | null
  homework: string | null
  teacher_name: string | null
  enrollments: {
    courses: { name: string } | null
  } | null
}

interface Student {
  id: string
  full_name: string
  nickname: string | null
}

const todayStr = new Date().toISOString().slice(0, 10)

export default function StudyHoursPage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [logs, setLogs] = useState<LessonLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // ช่วงเวลาที่ดู
  const now = new Date()
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const [dateFrom, setDateFrom] = useState(defaultStart)
  const [dateTo, setDateTo] = useState(todayStr)

  // detail modal
  const [detailStudent, setDetailStudent] = useState<Student | null>(null)

  useEffect(() => { loadData() }, [dateFrom, dateTo])

  async function loadData() {
    setLoading(true)
    const [{ data: sData }, { data: lData }] = await Promise.all([
      supabase.from('students').select('id, full_name, nickname').eq('is_active', true).order('nickname'),
      supabase
        .from('lesson_logs')
        .select(`
          id, student_id, lesson_date, duration_minutes, topic, homework, teacher_name,
          enrollments ( courses ( name ) )
        `)
        .gte('lesson_date', dateFrom)
        .lte('lesson_date', dateTo)
        .order('lesson_date', { ascending: false }),
    ])
    setStudents((sData as Student[]) ?? [])
    setLogs((lData as unknown as LessonLog[]) ?? [])
    setLoading(false)
  }

  function fmtHours(min: number) {
    const h = (min / 60).toFixed(1)
    return `${h} ชม.`
  }

  function fmtDuration(min: number) {
    if (min < 60) return `${min} น.`
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h}ชม. ${m}น.` : `${h} ชม.`
  }

  // group logs by student
  const summaryByStudent = students.map(s => {
    const studentLogs = logs.filter(l => l.student_id === s.id)
    const totalMinutes = studentLogs.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0)
    const sessionCount = studentLogs.length
    const lastDate = studentLogs[0]?.lesson_date ?? null
    return { student: s, totalMinutes, sessionCount, lastDate, logs: studentLogs }
  }).filter(row => row.sessionCount > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes)

  const filtered = summaryByStudent.filter(row => {
    if (!search) return true
    const name = (row.student.nickname || row.student.full_name).toLowerCase()
    return name.includes(search.toLowerCase())
  })

  const grandTotalMinutes = filtered.reduce((s, r) => s + r.totalMinutes, 0)
  const grandTotalSessions = filtered.reduce((s, r) => s + r.sessionCount, 0)

  function fmtDateTH(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg md:text-xl font-semibold">ชั่วโมงเรียน</h1>
        <span className="text-sm text-gray-400">{filtered.length} คน</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">สรุปชั่วโมงเรียนสะสมของนักเรียนแต่ละคน (ข้อมูลจากการบันทึกชั่วโมงสอน)</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="label">ตั้งแต่วันที่</label>
          <input type="date" className="input" value={dateFrom} max={dateTo}
            onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">ถึงวันที่</label>
          <input type="date" className="input" value={dateTo} max={todayStr} min={dateFrom}
            onChange={e => setDateTo(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="label">ค้นหานักเรียน</label>
          <input className="input" placeholder="พิมพ์ชื่อ..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          onClick={() => {
            setDateFrom(defaultStart)
            setDateTo(todayStr)
          }}
          className="btn-outline btn-sm h-[38px] px-3"
        >
          เดือนนี้
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div className="card p-4">
          <div className="text-2xl font-bold text-brand-700">{(grandTotalMinutes / 60).toFixed(1)}</div>
          <div className="text-xs text-gray-400 mt-0.5">ชั่วโมงรวมทั้งหมด</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-700">{grandTotalSessions}</div>
          <div className="text-xs text-gray-400 mt-0.5">ครั้งเรียนรวม</div>
        </div>
        <div className="card p-4 hidden md:block">
          <div className="text-2xl font-bold text-gray-700">{filtered.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">นักเรียนที่มีบันทึก</div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">ไม่มีข้อมูลในช่วงเวลาที่เลือก</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(row => (
              <button
                key={row.student.id}
                onClick={() => setDetailStudent(row.student)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                  {(row.student.nickname || row.student.full_name).slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900">
                    {row.student.nickname || row.student.full_name}
                  </div>
                  {row.lastDate && (
                    <div className="text-xs text-gray-400">เรียนล่าสุด {fmtDateTH(row.lastDate)}</div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold text-brand-600">{fmtHours(row.totalMinutes)}</div>
                  <div className="text-xs text-gray-400">{row.sessionCount} ครั้ง</div>
                </div>
                <span className="text-gray-300 flex-shrink-0">›</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailStudent(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-semibold">{detailStudent.nickname || detailStudent.full_name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(() => {
                    const row = summaryByStudent.find(r => r.student.id === detailStudent.id)
                    return row ? `${fmtHours(row.totalMinutes)} · ${row.sessionCount} ครั้ง` : ''
                  })()}
                </p>
              </div>
              <button onClick={() => setDetailStudent(null)} className="text-gray-400">✕</button>
            </div>
            <div className="overflow-y-auto divide-y divide-gray-50">
              {summaryByStudent.find(r => r.student.id === detailStudent.id)?.logs.map(log => (
                <div key={log.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{fmtDateTH(log.lesson_date)}</span>
                      <span className="text-xs text-gray-400">{log.enrollments?.courses?.name ?? ''}</span>
                    </div>
                    <span className="text-sm font-semibold text-brand-600">{fmtDuration(log.duration_minutes)}</span>
                  </div>
                  {log.teacher_name && (
                    <div className="text-xs text-gray-400 mb-1">ครู{log.teacher_name}</div>
                  )}
                  {log.topic && (
                    <div className="text-xs text-gray-600 bg-yellow-50 rounded-lg px-2.5 py-1.5 mt-1 border border-yellow-100">
                      📖 {log.topic}
                    </div>
                  )}
                  {log.homework && (
                    <div className="text-xs text-gray-600 bg-blue-50 rounded-lg px-2.5 py-1.5 mt-1 border border-blue-100">
                      ✏️ การบ้าน: {log.homework}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
