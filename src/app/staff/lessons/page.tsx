'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface LessonLogRow {
  id: string
  lesson_date: string
  lesson_number: number
  duration_minutes: number | null
  topic: string | null
  homework: string | null
  teacher_name: string | null
}

export default function LessonsPage() {
  const supabase = createClient()
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [editEnroll, setEditEnroll] = useState<any>(null)
  const [logForm, setLogForm] = useState({ topic: '', homework: '', lesson_date: new Date().toISOString().split('T')[0] })
  const [editForm, setEditForm] = useState({ lessons_total: 0, lessons_used: 0, status: 'active', notes: '' })

  // รายละเอียดประวัติการเรียน
  const [detailEnroll, setDetailEnroll] = useState<any>(null)
  const [detailLogs, setDetailLogs] = useState<LessonLogRow[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function loadData() {
    const { data } = await supabase
      .from('enrollments')
      .select('*, student:students(full_name, nickname), course:courses(name, total_lessons), teacher:profiles(full_name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setEnrollments(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filtered = enrollments.filter(en => {
    if (!search) return true
    const name = (en.student?.nickname || en.student?.full_name || '').toLowerCase()
    const course = (en.course?.name || '').toLowerCase()
    const q = search.toLowerCase()
    return name.includes(q) || course.includes(q)
  })

  async function addLesson(e: any) {
    e.preventDefault()
    if (!adding) return
    const enrollment = enrollments.find(en => en.id === adding)
    if (!enrollment) return
    const { error } = await supabase.from('lesson_logs').insert({
      enrollment_id: adding,
      student_id: enrollment.student_id,
      lesson_number: enrollment.lessons_used + 1,
      lesson_date: logForm.lesson_date,
      topic: logForm.topic,
      homework: logForm.homework,
    })
    if (error) { toast.error('บันทึกไม่สำเร็จ'); return }

    await supabase.from('enrollments')
      .update({ lessons_used: enrollment.lessons_used + 1 })
      .eq('id', adding)

    toast.success(`บันทึกครั้งที่ ${enrollment.lessons_used + 1} แล้ว`)
    setAdding(null)
    setLogForm({ topic: '', homework: '', lesson_date: new Date().toISOString().split('T')[0] })
    loadData()
  }

  function openEdit(en: any) {
    setEditEnroll(en)
    setEditForm({
      lessons_total: en.lessons_total,
      lessons_used: en.lessons_used,
      status: en.status,
      notes: en.notes ?? '',
    })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('enrollments').update({
      lessons_total: editForm.lessons_total,
      lessons_used: editForm.lessons_used,
      status: editForm.status,
      notes: editForm.notes || null,
    }).eq('id', editEnroll.id)
    if (error) { toast.error('แก้ไขไม่สำเร็จ'); return }
    toast.success('แก้ไขแล้ว')
    setEditEnroll(null)
    loadData()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('enrollments').update({ status: 'completed' }).eq('id', id)
    if (error) { toast.error('ไม่สำเร็จ: ' + error.message); return }
    loadData()

    toast(
      (t) => (
        <span className="flex items-center gap-3">
          ปิด enrollment แล้ว
          <button
            onClick={async () => {
              await supabase.from('enrollments').update({ status: 'active' }).eq('id', id)
              toast.dismiss(t.id)
              toast.success('เลิกทำแล้ว')
              loadData()
            }}
            className="font-medium text-brand-600 underline"
          >
            เลิกทำ (Undo)
          </button>
        </span>
      ),
      { duration: 6000 }
    )
  }

  // เปิดดูรายละเอียด/ประวัติการเรียนทั้งหมดของ enrollment นี้
  async function openDetail(en: any) {
    setDetailEnroll(en)
    setLoadingDetail(true)
    const { data } = await supabase
      .from('lesson_logs')
      .select('id, lesson_date, lesson_number, duration_minutes, topic, homework, teacher_name')
      .eq('enrollment_id', en.id)
      .order('lesson_date', { ascending: false })
      .order('lesson_number', { ascending: false })
    setDetailLogs((data as LessonLogRow[]) ?? [])
    setLoadingDetail(false)
  }

  function fmtDateTH(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })
  }

  function fmtDuration(min: number | null) {
    if (!min) return '—'
    if (min < 60) return `${min} น.`
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h}ชม. ${m}น.` : `${h} ชม.`
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg md:text-xl font-semibold">นับครั้งการเรียน</h1>
        <span className="text-sm text-gray-400 dark:text-gray-300">{filtered.length} รายการ</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 mb-4">ติดตามความคืบหน้าคอร์ส — กดที่แถวเพื่อดูประวัติการเรียนแต่ละครั้ง (ครู/หัวข้อ/การบ้าน)</p>

      {/* ช่องค้นหา */}
      <div className="mb-4">
        <input
          className="input max-w-sm"
          placeholder="🔍 ค้นหาชื่อนักเรียนหรือคอร์ส..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        {loading ? <p className="text-center text-gray-400 dark:text-gray-300 py-12">กำลังโหลด...</p> : (
          <table className="w-full">
            <thead>
              <tr>
                <th>นักเรียน</th>
                <th>คอร์ส</th>
                <th>ครั้งที่เรียน</th>
                <th>เหลือ</th>
                <th>ความคืบหน้า</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(en => {
                const remaining = en.lessons_total - en.lessons_used
                const pct = en.lessons_total > 0 ? Math.round((en.lessons_used / en.lessons_total) * 100) : 0
                const name = en.student?.nickname || en.student?.full_name

                return (
                  <tr
                    key={en.id}
                    className="table-row-hover cursor-pointer"
                    onClick={() => openDetail(en)}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">
                          {(name || '?').slice(0, 2)}
                        </div>
                        <span className="font-medium text-sm">{name}</span>
                      </div>
                    </td>
                    <td className="text-gray-600 dark:text-gray-300 text-sm">{en.course?.name}</td>
                    <td className="font-medium text-sm">{en.lessons_used} / {en.lessons_total} ครั้ง</td>
                    <td>
                      <span className={`font-semibold text-sm ${remaining <= 0 ? 'text-red-600' : remaining <= 2 ? 'text-red-600' : remaining <= 5 ? 'text-amber-600' : 'text-brand-600'}`}>
                        {remaining} ครั้ง
                      </span>
                    </td>
                    <td>
                      <div className="w-32 h-2 bg-gray-100 dark:bg-[#2a3245] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 85 ? 'bg-red-400' : pct >= 65 ? 'bg-amber-400' : 'bg-brand-400'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">{pct}%</div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        <button onClick={() => setAdding(en.id)} disabled={remaining <= 0} className="btn-brand btn-sm disabled:opacity-40">
                          + บันทึก
                        </button>
                        <button onClick={() => openEdit(en)} className="btn-outline btn-sm px-2">✎</button>
                        <button onClick={() => handleDelete(en.id)} className="btn-outline btn-sm px-2 text-red-400 hover:bg-red-50">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-400 dark:text-gray-300 py-8">
                  {search ? `ไม่พบ "${search}"` : 'ไม่มี enrollment ที่กำลังเรียน'}
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Lesson Modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <h2 className="font-semibold">บันทึกครั้งเรียน</h2>
              <button onClick={() => setAdding(null)} className="text-gray-400 dark:text-gray-300">✕</button>
            </div>
            <form onSubmit={addLesson} className="p-5 space-y-3">
              <div>
                <label className="label">วันที่เรียน</label>
                <input type="date" className="input" value={logForm.lesson_date}
                  onChange={e => setLogForm({...logForm, lesson_date: e.target.value})} />
              </div>
              <div>
                <label className="label">เนื้อหาที่เรียน</label>
                <input className="input" placeholder="เช่น สระจีน, พินอิน, บทที่ 3"
                  value={logForm.topic} onChange={e => setLogForm({...logForm, topic: e.target.value})} />
              </div>
              <div>
                <label className="label">การบ้าน</label>
                <textarea className="input min-h-[70px] resize-none" placeholder="การบ้านที่ให้..."
                  value={logForm.homework} onChange={e => setLogForm({...logForm, homework: e.target.value})} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-brand flex-1 justify-center">บันทึก</button>
                <button type="button" onClick={() => setAdding(null)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Enrollment Modal */}
      {editEnroll && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <div>
                <h2 className="font-semibold">แก้ไข Enrollment</h2>
                <p className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">
                  {editEnroll.student?.nickname || editEnroll.student?.full_name} — {editEnroll.course?.name}
                </p>
              </div>
              <button onClick={() => setEditEnroll(null)} className="text-gray-400 dark:text-gray-300">✕</button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">ครั้งทั้งหมด</label>
                  <input type="number" min={1} className="input" value={editForm.lessons_total}
                    onChange={e => setEditForm({ ...editForm, lessons_total: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">ครั้งที่ใช้แล้ว</label>
                  <input type="number" min={0} className="input" value={editForm.lessons_used}
                    onChange={e => setEditForm({ ...editForm, lessons_used: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="label">สถานะ</label>
                <select className="input" value={editForm.status}
                  onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="label">หมายเหตุ</label>
                <input className="input" value={editForm.notes}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-brand flex-1 justify-center">บันทึก</button>
                <button type="button" onClick={() => setEditEnroll(null)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail / History Modal */}
      {detailEnroll && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailEnroll(null)}>
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-semibold">
                  {detailEnroll.student?.nickname || detailEnroll.student?.full_name}
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">
                  {detailEnroll.course?.name} · {detailEnroll.lessons_used}/{detailEnroll.lessons_total} ครั้ง
                  {' '}(เหลือ {detailEnroll.lessons_total - detailEnroll.lessons_used} ครั้ง)
                </p>
              </div>
              <button onClick={() => setDetailEnroll(null)} className="text-gray-400 dark:text-gray-300">✕</button>
            </div>
            <div className="overflow-y-auto divide-y divide-gray-50">
              {loadingDetail ? (
                <p className="text-center text-gray-400 dark:text-gray-300 py-10 text-sm">กำลังโหลด...</p>
              ) : detailLogs.length === 0 ? (
                <p className="text-center text-gray-400 dark:text-gray-300 py-10 text-sm">ยังไม่มีประวัติการเรียน</p>
              ) : (
                detailLogs.map(log => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">
                          ครั้งที่ {log.lesson_number}
                        </span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{fmtDateTH(log.lesson_date)}</span>
                      </div>
                      <span className="text-sm font-semibold text-brand-600">{fmtDuration(log.duration_minutes)}</span>
                    </div>
                    {log.teacher_name && (
                      <div className="text-xs text-gray-400 dark:text-gray-300 mb-1">ครู{log.teacher_name}</div>
                    )}
                    {log.topic && (
                      <div className="text-xs text-gray-600 dark:text-gray-300 bg-yellow-50 rounded-lg px-2.5 py-1.5 mt-1 border border-yellow-100">
                        📖 {log.topic}
                      </div>
                    )}
                    {log.homework && (
                      <div className="text-xs text-gray-600 dark:text-gray-300 bg-blue-50 rounded-lg px-2.5 py-1.5 mt-1 border border-blue-100">
                        ✏️ การบ้าน: {log.homework}
                      </div>
                    )}
                    {!log.topic && !log.homework && !log.teacher_name && (
                      <div className="text-xs text-gray-300 italic">ไม่มีรายละเอียดเพิ่มเติม</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
