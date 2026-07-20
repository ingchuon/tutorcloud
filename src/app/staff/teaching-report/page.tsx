'use client'
// src/app/staff/teaching-report/page.tsx
// รายงานชั่วโมงสอนของครู — ดูรายเดือน + Export Excel แยกชีทต่อครู

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

interface LessonLog {
  id: string
  enrollment_id: string | null
  lesson_date: string
  duration_minutes: number | null
  topic: string | null
  homework: string | null
  teacher_name: string | null
  enrollments: {
    students: { full_name: string; nickname: string | null } | null
    courses: { name: string } | null
  } | null
}

const now = new Date()
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

export default function TeachingReportPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<LessonLog[]>([])
  const [loading, setLoading] = useState(true)
  const todayStr = now.toISOString().slice(0, 10)
  const [month, setMonth] = useState(defaultMonth)
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month')
  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo, setDateTo] = useState(todayStr)
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all')

  // แก้ไขชั่วโมงสอน
  const [editLog, setEditLog] = useState<LessonLog | null>(null)
  const [editForm, setEditForm] = useState({ lesson_date: '', duration_minutes: 60, topic: '', homework: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [month, filterMode, dateFrom, dateTo])

  async function loadData() {
    setLoading(true)
    let queryFrom: string
    let queryTo: string

    if (filterMode === 'month') {
      const [year, mo] = month.split('-').map(Number)
      queryFrom = `${month}-01`
      queryTo = new Date(year, mo, 0).toISOString().slice(0, 10) // last day of month
    } else {
      queryFrom = dateFrom
      queryTo = dateTo
    }

    const { data } = await supabase
      .from('lesson_logs')
      .select(`
        id, enrollment_id, lesson_date, duration_minutes, topic, homework, teacher_name,
        enrollments (
          students:student_id ( full_name, nickname ),
          courses ( name )
        )
      `)
      .gte('lesson_date', queryFrom)
      .lte('lesson_date', queryTo)
      .not('teacher_name', 'is', null)
      .order('lesson_date', { ascending: true })

    setLogs((data as unknown as LessonLog[]) ?? [])
    setLoading(false)
  }

  function openEdit(log: LessonLog) {
    setEditLog(log)
    setEditForm({
      lesson_date: log.lesson_date,
      duration_minutes: log.duration_minutes ?? 60,
      topic: log.topic ?? '',
      homework: log.homework ?? '',
    })
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editLog) return
    setSaving(true)
    const { error } = await supabase.from('lesson_logs').update({
      lesson_date: editForm.lesson_date,
      duration_minutes: editForm.duration_minutes,
      topic: editForm.topic || null,
      homework: editForm.homework || null,
    }).eq('id', editLog.id)

    if (error) {
      toast.error('แก้ไขไม่สำเร็จ: ' + error.message)
      setSaving(false)
      return
    }
    toast.success('แก้ไขแล้ว ✅')
    setEditLog(null)
    setSaving(false)
    loadData()
  }

  async function handleDelete(id: string) {
    const log = logs.find(l => l.id === id)
    if (!log) return

    // ซ่อนแถวออกจาก UI ทันที (optimistic)
    setLogs(prev => prev.filter(l => l.id !== id))

    let undone = false
    const timeoutId = setTimeout(async () => {
      if (undone) return

      const { error } = await supabase.from('lesson_logs').delete().eq('id', id)
      if (error) { toast.error('ลบไม่สำเร็จ: ' + error.message); loadData(); return }

      // ลด lessons_used คืน 1 ครั้ง ถ้ามี enrollment ผูกอยู่
      if (log.enrollment_id) {
        const { data: enroll } = await supabase
          .from('enrollments')
          .select('lessons_used')
          .eq('id', log.enrollment_id)
          .single()
        if (enroll && enroll.lessons_used > 0) {
          await supabase
            .from('enrollments')
            .update({ lessons_used: enroll.lessons_used - 1 })
            .eq('id', log.enrollment_id)
        }
      }
    }, 5000)

    toast(
      (t) => (
        <span className="flex items-center gap-3">
          ลบรายการแล้ว
          <button
            onClick={() => {
              undone = true
              clearTimeout(timeoutId)
              setLogs(prev => {
                if (prev.some(l => l.id === log.id)) return prev
                return [...prev, log].sort((a, b) => a.lesson_date < b.lesson_date ? 1 : -1)
              })
              toast.dismiss(t.id)
              toast.success('เลิกทำแล้ว')
            }}
            className="font-medium text-brand-600 underline"
          >
            เลิกทำ (Undo)
          </button>
        </span>
      ),
      { duration: 5000 }
    )
  }

  function fmtDateTH(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  function fmtDuration(min: number | null) {
    if (!min) return '—'
    if (min < 60) return `${min} น.`
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h}ชม. ${m}น.` : `${h} ชม.`
  }

  // group by teacher
  const teacherNames = Array.from(new Set(logs.map(l => l.teacher_name).filter(Boolean))) as string[]
  teacherNames.sort()

  const summaryByTeacher = teacherNames.map(name => {
    const teacherLogs = logs.filter(l => l.teacher_name === name)
    const totalMinutes = teacherLogs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0)
    return { name, logs: teacherLogs, totalMinutes, sessionCount: teacherLogs.length }
  }).sort((a, b) => b.totalMinutes - a.totalMinutes)

  const grandTotalMinutes = summaryByTeacher.reduce((s, r) => s + r.totalMinutes, 0)
  const grandTotalSessions = logs.length

  const displayedTeachers = selectedTeacher === 'all'
    ? summaryByTeacher
    : summaryByTeacher.filter(t => t.name === selectedTeacher)

  function exportExcel() {
    const wb = XLSX.utils.book_new()

    summaryByTeacher.forEach(({ name, logs: teacherLogs, totalMinutes, sessionCount }) => {
      const rows = teacherLogs.map(l => ({
        'วันที่': fmtDateTH(l.lesson_date),
        'นักเรียน': l.enrollments?.students?.nickname || l.enrollments?.students?.full_name || '—',
        'คอร์ส': l.enrollments?.courses?.name ?? '—',
        'ระยะเวลา (นาที)': l.duration_minutes ?? 0,
        'ระยะเวลา': fmtDuration(l.duration_minutes),
        'หัวข้อที่สอน': l.topic ?? '',
        'การบ้าน': l.homework ?? '',
      }))

      // แถวสรุปท้ายชีท
      rows.push({
        'วันที่': '',
        'นักเรียน': '',
        'คอร์ส': 'รวม',
        'ระยะเวลา (นาที)': totalMinutes,
        'ระยะเวลา': `${(totalMinutes / 60).toFixed(1)} ชม. (${sessionCount} ครั้ง)`,
        'หัวข้อที่สอน': '',
        'การบ้าน': '',
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [
        { wch: 22 }, // วันที่
        { wch: 16 }, // นักเรียน
        { wch: 24 }, // คอร์ส
        { wch: 14 }, // ระยะเวลา (นาที)
        { wch: 14 }, // ระยะเวลา
        { wch: 30 }, // หัวข้อ
        { wch: 30 }, // การบ้าน
      ]

      // ชื่อชีทห้ามเกิน 31 ตัวอักษร และห้ามมีอักขระพิเศษบางตัว
      const sheetName = name.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Teacher'
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })

    if (summaryByTeacher.length === 0) {
      const ws = XLSX.utils.json_to_sheet([{ 'ข้อมูล': 'ไม่มีบันทึกในเดือนนี้' }])
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    }

    const filenameSuffix = filterMode === 'month' ? month : `${dateFrom}_to_${dateTo}`
    XLSX.writeFile(wb, `รายงานชั่วโมงสอน_${filenameSuffix}.xlsx`)
  }

  function fmtDateTHShort(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const periodLabel = filterMode === 'month'
    ? new Date(`${month}-01`).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
    : dateFrom === dateTo
      ? fmtDateTHShort(dateFrom)
      : `${fmtDateTHShort(dateFrom)} - ${fmtDateTHShort(dateTo)}`

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg md:text-xl font-semibold">รายงานชั่วโมงสอน</h1>
        <span className="text-sm text-gray-400 dark:text-gray-300">{teacherNames.length} ครู</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 mb-4">สรุปชั่วโมงสอนรายเดือนของครูแต่ละคน — Export เป็น Excel แยกชีทต่อครูได้</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="label">ช่วงเวลา</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilterMode('month')}
              className={`btn-sm px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                filterMode === 'month' ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 dark:border-[#3a4560] text-gray-600 dark:text-gray-300 hover:border-brand-400'
              }`}
            >
              รายเดือน
            </button>
            <button
              onClick={() => setFilterMode('range')}
              className={`btn-sm px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                filterMode === 'range' ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 dark:border-[#3a4560] text-gray-600 dark:text-gray-300 hover:border-brand-400'
              }`}
            >
              เลือกวัน
            </button>
          </div>
        </div>

        {filterMode === 'month' ? (
          <div>
            <label className="label">เดือน</label>
            <input
              type="month"
              className="input"
              value={month}
              max={defaultMonth}
              onChange={e => setMonth(e.target.value)}
            />
          </div>
        ) : (
          <>
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
          </>
        )}

        <div className="flex-1 min-w-[180px]">
          <label className="label">ครู</label>
          <select className="input" value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}>
            <option value="all">ทุกคน</option>
            {teacherNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={exportExcel}
          disabled={loading || logs.length === 0}
          className="btn-brand h-[38px] px-4 disabled:opacity-40"
        >
          📥 Export Excel (.xlsx)
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div className="card p-4">
          <div className="text-2xl font-bold text-brand-700">{(grandTotalMinutes / 60).toFixed(1)}</div>
          <div className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">ชั่วโมงรวม — {periodLabel}</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">{grandTotalSessions}</div>
          <div className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">ครั้งสอนรวม</div>
        </div>
        <div className="card p-4 hidden md:block">
          <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">{teacherNames.length}</div>
          <div className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">ครูที่มีบันทึก</div>
        </div>
      </div>

      {/* Per-teacher tables */}
      {loading ? (
        <div className="card py-10 text-center text-gray-400 dark:text-gray-300 text-sm">กำลังโหลด...</div>
      ) : displayedTeachers.length === 0 ? (
        <div className="card py-10 text-center text-gray-400 dark:text-gray-300 text-sm">ไม่มีข้อมูลในเดือนนี้</div>
      ) : (
        <div className="space-y-4">
          {displayedTeachers.map(({ name, logs: teacherLogs, totalMinutes, sessionCount }) => (
            <div key={name} className="card overflow-hidden">
              <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">
                    {name.slice(0, 2)}
                  </div>
                  <h3 className="font-medium">ครู{name}</h3>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-brand-600">{(totalMinutes / 60).toFixed(1)} ชม.</div>
                  <div className="text-xs text-gray-400 dark:text-gray-300">{sessionCount} ครั้ง</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>นักเรียน</th>
                      <th>คอร์ส</th>
                      <th>ระยะเวลา</th>
                      <th>หัวข้อที่สอน</th>
                      <th>การบ้าน</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherLogs.map(l => (
                      <tr key={l.id} className="table-row-hover">
                        <td className="text-sm whitespace-nowrap">{fmtDateTH(l.lesson_date)}</td>
                        <td className="text-sm font-medium">
                          {l.enrollments?.students?.nickname || l.enrollments?.students?.full_name || '—'}
                        </td>
                        <td className="text-sm text-gray-600 dark:text-gray-300">{l.enrollments?.courses?.name ?? '—'}</td>
                        <td className="text-sm font-semibold text-brand-600 whitespace-nowrap">{fmtDuration(l.duration_minutes)}</td>
                        <td className="text-sm text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={l.topic ?? ''}>{l.topic ?? '—'}</td>
                        <td className="text-sm text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={l.homework ?? ''}>{l.homework ?? '—'}</td>
                        <td>
                          <div className="flex gap-1.5">
                            <button onClick={() => openEdit(l)} className="btn-outline btn-sm px-2">✎</button>
                            <button onClick={() => handleDelete(l.id)} className="btn-outline btn-sm px-2 text-red-400 hover:bg-red-50">✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editLog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <div>
                <h2 className="font-semibold">แก้ไขชั่วโมงสอน</h2>
                <p className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">
                  {editLog.enrollments?.students?.nickname || editLog.enrollments?.students?.full_name} — {editLog.enrollments?.courses?.name ?? ''}
                </p>
              </div>
              <button onClick={() => setEditLog(null)} className="text-gray-400 dark:text-gray-300">✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-3">
              <div>
                <label className="label">วันที่สอน</label>
                <input type="date" className="input" value={editForm.lesson_date}
                  onChange={e => setEditForm({ ...editForm, lesson_date: e.target.value })} />
              </div>
              <div>
                <label className="label">ระยะเวลา</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[30, 45, 60, 90, 120].map(m => (
                    <button key={m} type="button"
                      onClick={() => setEditForm({ ...editForm, duration_minutes: m })}
                      className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                        editForm.duration_minutes === m
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'border-gray-200 dark:border-[#3a4560] text-gray-600 dark:text-gray-300 hover:border-brand-400'
                      }`}
                    >
                      {m >= 60 ? `${m / 60}ชม.` : `${m}น.`}
                    </button>
                  ))}
                </div>
                <input type="number" min={1} className="input mt-2" placeholder="หรือกำหนดเอง (นาที)"
                  value={editForm.duration_minutes}
                  onChange={e => setEditForm({ ...editForm, duration_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">หัวข้อที่สอน</label>
                <input className="input" value={editForm.topic}
                  onChange={e => setEditForm({ ...editForm, topic: e.target.value })} />
              </div>
              <div>
                <label className="label">การบ้าน</label>
                <textarea className="input min-h-[70px] resize-none" value={editForm.homework}
                  onChange={e => setEditForm({ ...editForm, homework: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="btn-brand flex-1 justify-center disabled:opacity-50">
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button type="button" onClick={() => setEditLog(null)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
