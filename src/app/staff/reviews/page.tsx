'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const SKILLS = ['พินอิน', 'คำศัพท์', 'การพูด', 'การฟัง', 'ไวยากรณ์', 'การอ่าน', 'การเขียน', 'ประโยค']

export default function ReviewsPage() {
  const supabase = createClient()
  const [reviews, setReviews] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editReview, setEditReview] = useState<any>(null)
  const [rating, setRating] = useState(5)
  const [form, setForm] = useState({
    enrollment_id: '',
    review_date: new Date().toISOString().split('T')[0],
    content: '',
    homework_given: '',
    skills_practiced: [] as string[],
    visible_to_parent: true,
  })

  async function loadData() {
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase.from('reviews')
        .select('*, student:students(full_name, nickname), teacher:profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('enrollments')
        .select('*, student:students(full_name, nickname), course:courses(name)')
        .eq('status', 'active'),
    ])
    setReviews(r ?? [])
    setEnrollments(e ?? [])
  }

  useEffect(() => { loadData() }, [])

  function toggleSkill(s: string) {
    setForm(f => ({
      ...f,
      skills_practiced: f.skills_practiced.includes(s)
        ? f.skills_practiced.filter(x => x !== s)
        : [...f.skills_practiced, s]
    }))
  }

  function openEdit(r: any) {
    setEditReview(r)
    setRating(r.rating ?? 5)
    setForm({
      enrollment_id: r.enrollment_id ?? '',
      review_date: r.review_date ?? new Date().toISOString().split('T')[0],
      content: r.content ?? '',
      homework_given: r.homework_given ?? '',
      skills_practiced: r.skills_practiced ?? [],
      visible_to_parent: r.visible_to_parent ?? true,
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (editReview) {
      const { error } = await supabase.from('reviews').update({
        review_date: form.review_date,
        content: form.content,
        homework_given: form.homework_given || null,
        skills_practiced: form.skills_practiced,
        visible_to_parent: form.visible_to_parent,
        rating,
      }).eq('id', editReview.id)
      if (error) { toast.error('แก้ไขไม่สำเร็จ'); return }
      toast.success('แก้ไขรีวิวแล้ว')
    } else {
      const enroll = enrollments.find(en => en.id === form.enrollment_id)
      if (!enroll) { toast.error('กรุณาเลือกนักเรียน'); return }
      const { error } = await supabase.from('reviews').insert({
        ...form,
        rating,
        student_id: enroll.student_id,
      })
      if (error) { toast.error('บันทึกไม่สำเร็จ'); return }
      toast.success('บันทึกรีวิวแล้ว')
    }

    setShowForm(false)
    setEditReview(null)
    setForm({ enrollment_id: '', review_date: new Date().toISOString().split('T')[0], content: '', homework_given: '', skills_practiced: [], visible_to_parent: true })
    setRating(5)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('ลบรีวิวนี้?')) return
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (error) { toast.error('ลบไม่สำเร็จ'); return }
    toast.success('ลบแล้ว')
    loadData()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">รีวิวหลังการสอน</h1>
          <p className="text-sm text-gray-500 mt-0.5">บันทึกพัฒนาการและประเมินผลนักเรียน</p>
        </div>
        <button onClick={() => { setEditReview(null); setShowForm(true) }} className="btn-brand">+ เขียนรีวิว</button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reviews.map(r => (
          <div key={r.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">
                  {(r.student?.nickname || r.student?.full_name || '?').slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{r.student?.nickname || r.student?.full_name}</div>
                  <div className="text-xs text-gray-400">{formatDate(r.review_date)} · {r.teacher?.full_name || 'ครู'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.visible_to_parent && <span className="badge badge-blue text-[10px]">ผู้ปกครองเห็น</span>}
                <div className="text-amber-400 text-sm">{'★'.repeat(r.rating ?? 0)}{'☆'.repeat(5 - (r.rating ?? 0))}</div>
                <button onClick={() => openEdit(r)} className="btn-outline btn-sm px-2">✎</button>
                <button onClick={() => handleDelete(r.id)} className="btn-outline btn-sm px-2 text-red-400 hover:bg-red-50">✕</button>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">{r.content}</p>
            {r.homework_given && (
              <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800 mb-3">
                📝 <strong>การบ้าน:</strong> {r.homework_given}
              </div>
            )}
            {r.skills_practiced?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {r.skills_practiced.map((s: string) => (
                  <span key={s} className="badge badge-purple">{s}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {reviews.length === 0 && (
          <div className="card p-12 text-center text-gray-400">ยังไม่มีรีวิว</div>
        )}
      </div>

      {/* Review Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-semibold">{editReview ? 'แก้ไขรีวิว' : 'เขียนรีวิวหลังสอน'}</h2>
              <button onClick={() => { setShowForm(false); setEditReview(null) }} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {!editReview && (
                <div>
                  <label className="label">นักเรียน *</label>
                  <select className="input" required value={form.enrollment_id}
                    onChange={e => setForm({...form, enrollment_id: e.target.value})}>
                    <option value="">— เลือกนักเรียน —</option>
                    {enrollments.map(en => (
                      <option key={en.id} value={en.id}>
                        {en.student?.nickname || en.student?.full_name} – {en.course?.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">วันที่สอน</label>
                <input type="date" className="input" value={form.review_date}
                  onChange={e => setForm({...form, review_date: e.target.value})} />
              </div>
              <div>
                <label className="label">คะแนนความพึงพอใจ</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button type="button" key={n} onClick={() => setRating(n)}
                      className={`text-2xl transition-transform ${n <= rating ? 'text-amber-400' : 'text-gray-200'} hover:scale-110`}>
                      ★
                    </button>
                  ))}
                  <span className="text-sm text-gray-500 ml-2 self-center">{rating}/5</span>
                </div>
              </div>
              <div>
                <label className="label">บันทึกการสอน *</label>
                <textarea required className="input min-h-[100px] resize-none"
                  placeholder="เนื้อหาที่สอน พัฒนาการของนักเรียน จุดที่ต้องปรับปรุง..."
                  value={form.content}
                  onChange={e => setForm({...form, content: e.target.value})} />
              </div>
              <div>
                <label className="label">ทักษะที่ฝึก</label>
                <div className="flex flex-wrap gap-2">
                  {SKILLS.map(s => (
                    <button type="button" key={s} onClick={() => toggleSkill(s)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        form.skills_practiced.includes(s)
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">การบ้าน</label>
                <input className="input" placeholder="การบ้านที่ให้นักเรียน..."
                  value={form.homework_given}
                  onChange={e => setForm({...form, homework_given: e.target.value})} />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.visible_to_parent}
                  onChange={e => setForm({...form, visible_to_parent: e.target.checked})} />
                <span className="text-gray-700">แสดงให้ผู้ปกครองเห็น</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-brand flex-1 justify-center">
                  {editReview ? 'บันทึกการแก้ไข' : 'บันทึกรีวิว'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditReview(null) }} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
