'use client'
// src/app/staff/courses/page.tsx — รวม คอร์ส + หนังสือ + อื่นๆ
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatThaiMoney, formatDate, getCourseTypeLabel, getCourseTypeClass } from '@/lib/utils'
import type { Course } from '@/types'
import toast from 'react-hot-toast'

const COURSE_TYPES = [
  { value: 'group',      label: 'กลุ่ม (Group)' },
  { value: 'one_on_one', label: '1-on-1' },
  { value: 'kids',       label: 'เด็ก (Kids)' },
  { value: 'hsk',        label: 'HSK Prep' },
]

export default function CoursesPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'courses' | 'books'>('courses')

  /* ─── COURSES state ─── */
  const [courses, setCourses] = useState<Course[]>([])
  const [showCourseForm, setShowCourseForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [courseForm, setCourseForm] = useState({
    name: '', type: 'group', description: '', total_lessons: 12,
    duration_minutes: 60, price: 3000, max_students: 5,
  })

  /* ─── BOOKS state ─── */
  const [books, setBooks] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [loadingBooks, setLoadingBooks] = useState(false)
  const [showBookForm, setShowBookForm] = useState(false)
  const [editBook, setEditBook] = useState<any>(null)
  const [showSaleModal, setShowSaleModal] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [bookForm, setBookForm] = useState({ name: '', price: 0, stock: 0, image_url: '' })
  const [saleForm, setSaleForm] = useState({
    student_id: '', quantity: 1, payment_method: 'cash', notes: '',
    sold_at: new Date().toISOString().split('T')[0],
  })

  /* ─── loaders ─── */
  async function loadCourses() {
    const { data } = await supabase.from('courses').select('*').order('price')
    setCourses(data ?? [])
  }

  const loadBooks = useCallback(async () => {
    setLoadingBooks(true)
    const [{ data: b }, { data: st }, { data: s }] = await Promise.all([
      supabase.from('books').select('*').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('students').select('id, full_name, nickname').eq('is_active', true).order('nickname'),
      supabase.from('book_sales')
        .select('*, book:books(name), student:students(full_name, nickname)')
        .order('sold_at', { ascending: false }).limit(20),
    ])
    setBooks(b ?? [])
    setStudents(st ?? [])
    setSales(s ?? [])
    setLoadingBooks(false)
  }, [])

  useEffect(() => { loadCourses() }, [])
  useEffect(() => { if (tab === 'books') loadBooks() }, [tab, loadBooks])

  /* ─── COURSE handlers ─── */
  function openEditCourse(c: Course) {
    setEditingCourse(c)
    setCourseForm({
      name: c.name, type: c.type, description: c.description || '',
      total_lessons: c.total_lessons, duration_minutes: c.duration_minutes,
      price: c.price, max_students: c.max_students,
    })
    setShowCourseForm(true)
  }

  async function handleSaveCourse(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...courseForm,
      price: Number(courseForm.price), total_lessons: Number(courseForm.total_lessons),
      duration_minutes: Number(courseForm.duration_minutes), max_students: Number(courseForm.max_students),
    }
    if (editingCourse) {
      const { error } = await supabase.from('courses').update(payload).eq('id', editingCourse.id)
      if (error) { toast.error('แก้ไขไม่สำเร็จ'); return }
      toast.success('แก้ไขคอร์สแล้ว')
    } else {
      const { error } = await supabase.from('courses').insert([payload])
      if (error) { toast.error('บันทึกไม่สำเร็จ'); return }
      toast.success('เพิ่มคอร์สแล้ว')
    }
    setShowCourseForm(false); setEditingCourse(null); loadCourses()
  }

  /* ─── BOOK handlers ─── */
  async function handleSaveBook(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (editBook) {
      const { error } = await supabase.from('books').update(bookForm).eq('id', editBook.id)
      if (error) { toast.error('แก้ไขไม่สำเร็จ'); setSaving(false); return }
      toast.success('แก้ไขหนังสือแล้ว')
    } else {
      const { error } = await supabase.from('books').insert([bookForm])
      if (error) { toast.error('บันทึกไม่สำเร็จ'); setSaving(false); return }
      toast.success('เพิ่มหนังสือแล้ว')
    }
    setShowBookForm(false); setEditBook(null)
    setBookForm({ name: '', price: 0, stock: 0, image_url: '' })
    setSaving(false); loadBooks()
  }

  async function handleSale(e: React.FormEvent) {
    e.preventDefault()
    if (!showSaleModal) return
    setSaving(true)
    if (saleForm.quantity > showSaleModal.stock) { toast.error('สต็อกไม่พอ'); setSaving(false); return }
    const total = showSaleModal.price * saleForm.quantity
    const { error } = await supabase.from('book_sales').insert([{
      book_id: showSaleModal.id, student_id: saleForm.student_id || null,
      quantity: saleForm.quantity, unit_price: showSaleModal.price, total_amount: total,
      payment_method: saleForm.payment_method, notes: saleForm.notes || null,
      sold_at: new Date(saleForm.sold_at).toISOString(),
    }])
    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSaving(false); return }
    await supabase.from('books').update({ stock: showSaleModal.stock - saleForm.quantity }).eq('id', showSaleModal.id)
    toast.success('บันทึกการขายแล้ว 🎉')
    setShowSaleModal(null)
    setSaleForm({ student_id: '', quantity: 1, payment_method: 'cash', notes: '', sold_at: new Date().toISOString().split('T')[0] })
    setSaving(false); loadBooks()
  }

  function openEditBook(book: any) {
    setEditBook(book)
    setBookForm({ name: book.name, price: book.price, stock: book.stock, image_url: book.image_url ?? '' })
    setShowBookForm(true)
  }

  async function deleteBook(id: string) {
    if (!confirm('ลบหนังสือนี้?')) return
    await supabase.from('books').update({ is_active: false }).eq('id', id)
    toast.success('ลบแล้ว'); loadBooks()
  }

  const lowStock = books.filter(b => b.stock <= 3)
  const tabClass = (t: string) =>
    `px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${tab === t ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a3245]'}`

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">คอร์สและราคา</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">จัดการคอร์สเรียนและหนังสือ</p>
        </div>
        <div className="flex gap-2">
          {tab === 'courses' && (
            <button onClick={() => { setEditingCourse(null); setShowCourseForm(true) }} className="btn-brand">+ เพิ่มคอร์ส</button>
          )}
          {tab === 'books' && (
            <button onClick={() => { setEditBook(null); setBookForm({ name: '', price: 0, stock: 0, image_url: '' }); setShowBookForm(true) }} className="btn-brand">+ เพิ่มหนังสือ</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button className={tabClass('courses')} onClick={() => setTab('courses')}>📚 คอร์สเรียน</button>
        <button className={tabClass('books')} onClick={() => setTab('books')}>📖 หนังสือและอื่นๆ</button>
      </div>

      {/* ═══ TAB: COURSES ═══ */}
      {tab === 'courses' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {courses.map(c => (
            <div key={c.id} className={`card p-4 md:p-5 ${!c.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <span className={`badge ${getCourseTypeClass(c.type)}`}>{getCourseTypeLabel(c.type)}</span>
                <span className={`badge ${c.is_active ? 'badge-green' : 'badge-gray'}`}>{c.is_active ? 'เปิดรับ' : 'ปิด'}</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm md:text-base">{c.name}</h3>
              {c.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{c.description}</p>}
              <div className="text-xl md:text-2xl font-semibold text-brand-600 mb-0.5">{formatThaiMoney(c.price)}</div>
              <div className="text-xs text-gray-400 mb-3">/ {c.total_lessons} ครั้ง</div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-50 dark:border-[#2a3245] pt-3 flex-wrap">
                <span>👥 สูงสุด {c.max_students} คน</span>
                <span>⏱ {c.duration_minutes} นาที/ครั้ง</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => openEditCourse(c)} className="btn-outline btn-sm flex-1 justify-center">แก้ไข</button>
                <button onClick={() => supabase.from('courses').update({ is_active: !c.is_active }).eq('id', c.id).then(loadCourses)} className="btn-outline btn-sm flex-1 justify-center text-gray-500">
                  {c.is_active ? 'ปิด' : 'เปิด'}
                </button>
                <button onClick={() => { if (confirm(`ปิดคอร์ส "${c.name}"?`)) supabase.from('courses').update({ is_active: false }).eq('id', c.id).then(loadCourses) }} className="btn-outline btn-sm px-2 text-red-400 hover:bg-red-50">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ TAB: BOOKS ═══ */}
      {tab === 'books' && (
        <>
          {lowStock.length > 0 && (
            <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <span>⚠️</span>
                <span className="font-medium text-amber-800 dark:text-amber-300 text-sm">สต็อกใกล้หมด {lowStock.length} รายการ</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStock.map(b => <span key={b.id} className="badge badge-amber">{b.name} เหลือ {b.stock} เล่ม</span>)}
              </div>
            </div>
          )}

          {loadingBooks ? (
            <p className="text-center text-gray-400 py-16 text-sm">กำลังโหลด...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                {books.map(book => (
                  <div key={book.id} className="card p-4 flex flex-col">
                    {book.image_url
                      ? <img src={book.image_url} alt={book.name} className="w-full h-36 object-cover rounded-lg mb-3" />
                      : <div className="w-full h-36 bg-gray-100 dark:bg-[#2a3245] rounded-lg mb-3 flex items-center justify-center text-4xl">📚</div>
                    }
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900 dark:text-white mb-1">{book.name}</div>
                      <div className="text-brand-600 font-semibold text-sm">{formatThaiMoney(book.price)}</div>
                      <div className={`text-xs mt-1 ${book.stock <= 3 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        สต็อก: {book.stock} เล่ม {book.stock <= 3 && '⚠️'}
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-3">
                      <button
                        onClick={() => { setShowSaleModal(book); setSaleForm({ student_id: '', quantity: 1, payment_method: 'cash', notes: '', sold_at: new Date().toISOString().split('T')[0] }) }}
                        disabled={book.stock === 0}
                        className="btn-brand btn-sm flex-1 justify-center disabled:opacity-40"
                      >
                        {book.stock === 0 ? 'หมด' : 'ขาย'}
                      </button>
                      <button onClick={() => openEditBook(book)} className="btn-outline btn-sm px-2">✎</button>
                      <button onClick={() => deleteBook(book.id)} className="btn-outline btn-sm px-2 text-red-400 hover:bg-red-50">✕</button>
                    </div>
                  </div>
                ))}
                {books.length === 0 && (
                  <div className="col-span-4 text-center text-gray-300 py-16 text-sm">ยังไม่มีหนังสือ กด + เพิ่มหนังสือ</div>
                )}
              </div>

              {/* ประวัติการขาย */}
              <div className="card overflow-hidden">
                <div className="card-header">
                  <h3 className="font-medium">ประวัติการขายล่าสุด</h3>
                  <span className="badge badge-gray">{sales.length} รายการ</span>
                </div>
                {sales.length === 0 ? (
                  <p className="text-center text-gray-300 py-8 text-sm">ยังไม่มีการขาย</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>วันที่</th><th>หนังสือ</th><th>นักเรียน</th><th>จำนวน</th><th>รวม</th><th>ชำระ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s: any) => (
                        <tr key={s.id}>
                          <td className="text-xs text-gray-500">{formatDate(s.sold_at, 'd MMM yy')}</td>
                          <td className="text-sm">{(s.book as any)?.name ?? '—'}</td>
                          <td className="text-sm">{(s.student as any)?.nickname || (s.student as any)?.full_name || '—'}</td>
                          <td className="text-center text-sm">{s.quantity}</td>
                          <td className="text-sm text-brand-600 font-semibold">{formatThaiMoney(s.total_amount)}</td>
                          <td><span className="badge badge-gray text-xs">{s.payment_method}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ Modal: แก้ไข/เพิ่มคอร์ส ═══ */}
      {showCourseForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between sticky top-0 bg-white dark:bg-[#242d3f]">
              <h2 className="font-semibold">{editingCourse ? 'แก้ไขคอร์ส' : 'เพิ่มคอร์สใหม่'}</h2>
              <button onClick={() => setShowCourseForm(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleSaveCourse} className="p-5 space-y-3">
              <div>
                <label className="label">ชื่อคอร์ส *</label>
                <input className="input" required value={courseForm.name} onChange={e => setCourseForm({ ...courseForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">ประเภทคอร์ส</label>
                  <select className="input" value={courseForm.type} onChange={e => setCourseForm({ ...courseForm, type: e.target.value })}>
                    {COURSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ราคา (฿)</label>
                  <input type="number" className="input" required value={courseForm.price} onChange={e => setCourseForm({ ...courseForm, price: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">จำนวนครั้ง</label>
                  <input type="number" className="input" value={courseForm.total_lessons} onChange={e => setCourseForm({ ...courseForm, total_lessons: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">นาที/ครั้ง</label>
                  <input type="number" className="input" value={courseForm.duration_minutes} onChange={e => setCourseForm({ ...courseForm, duration_minutes: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">นักเรียนสูงสุด</label>
                  <input type="number" className="input" value={courseForm.max_students} onChange={e => setCourseForm({ ...courseForm, max_students: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="label">รายละเอียด</label>
                <textarea className="input min-h-[70px] resize-none" value={courseForm.description} onChange={e => setCourseForm({ ...courseForm, description: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-brand flex-1 justify-center">บันทึก</button>
                <button type="button" onClick={() => setShowCourseForm(false)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Modal: แก้ไข/เพิ่มหนังสือ ═══ */}
      {showBookForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <h2 className="font-semibold">{editBook ? 'แก้ไขหนังสือ' : 'เพิ่มหนังสือใหม่'}</h2>
              <button onClick={() => setShowBookForm(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleSaveBook} className="p-5 space-y-3">
              <div>
                <label className="label">ชื่อหนังสือ *</label>
                <input className="input" required value={bookForm.name} onChange={e => setBookForm({ ...bookForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">ราคา (฿)</label>
                  <input type="number" className="input" min={0} value={bookForm.price} onChange={e => setBookForm({ ...bookForm, price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">สต็อก (เล่ม)</label>
                  <input type="number" className="input" min={0} value={bookForm.stock} onChange={e => setBookForm({ ...bookForm, stock: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="label">URL รูปปก (ไม่บังคับ)</label>
                <input className="input" value={bookForm.image_url} onChange={e => setBookForm({ ...bookForm, image_url: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="btn-brand flex-1 justify-center">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
                <button type="button" onClick={() => setShowBookForm(false)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Modal: ขายหนังสือ ═══ */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <h2 className="font-semibold">ขาย: {showSaleModal.name}</h2>
              <button onClick={() => setShowSaleModal(null)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleSale} className="p-5 space-y-3">
              <div>
                <label className="label">นักเรียน</label>
                <select className="input" value={saleForm.student_id} onChange={e => setSaleForm({ ...saleForm, student_id: e.target.value })}>
                  <option value="">— ไม่ระบุ —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.nickname || s.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">จำนวน (เล่ม)</label>
                  <input type="number" className="input" min={1} max={showSaleModal.stock} value={saleForm.quantity} onChange={e => setSaleForm({ ...saleForm, quantity: Number(e.target.value) })} />
                  <p className="text-xs text-gray-400 mt-1">สต็อกเหลือ {showSaleModal.stock} เล่ม</p>
                </div>
                <div>
                  <label className="label">รวม</label>
                  <div className="input bg-gray-50 dark:bg-[#1e2533] text-brand-600 font-semibold">
                    {formatThaiMoney(showSaleModal.price * saleForm.quantity)}
                  </div>
                </div>
              </div>
              <div>
                <label className="label">วิธีชำระ</label>
                <select className="input" value={saleForm.payment_method} onChange={e => setSaleForm({ ...saleForm, payment_method: e.target.value })}>
                  <option value="cash">เงินสด</option>
                  <option value="transfer">โอนเงิน</option>
                  <option value="promptpay">พร้อมเพย์</option>
                </select>
              </div>
              <div>
                <label className="label">วันที่ขาย</label>
                <input type="date" className="input" value={saleForm.sold_at} max={new Date().toISOString().split('T')[0]} onChange={e => setSaleForm({ ...saleForm, sold_at: e.target.value })} />
              </div>
              <div>
                <label className="label">หมายเหตุ</label>
                <input className="input" placeholder="(ไม่บังคับ)" value={saleForm.notes} onChange={e => setSaleForm({ ...saleForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="btn-brand flex-1 justify-center">{saving ? 'กำลังบันทึก...' : 'ยืนยันการขาย'}</button>
                <button type="button" onClick={() => setShowSaleModal(null)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
