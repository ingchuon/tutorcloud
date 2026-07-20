'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student, Enrollment } from '@/types'
import { getInitials, formatThaiMoney } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

type StudentWithEnrollment = Student & {
  enrollments: (Enrollment & { course: { name: string }; teacher?: { full_name: string } | null })[]
}

export default function StudentsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [students, setStudents] = useState<StudentWithEnrollment[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [books, setBooks] = useState<any[]>([])
  const [showBookSaleModal, setShowBookSaleModal] = useState<StudentWithEnrollment | null>(null)
  const [bookSaleForm, setBookSaleForm] = useState({ book_id: '', quantity: 1, payment_method: 'cash', notes: '', sold_at: new Date().toISOString().split('T')[0] })
  const [bookSaleSaving, setBookSaleSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editStudent, setEditStudent] = useState<StudentWithEnrollment | null>(null)
  const [showEnrollModal, setShowEnrollModal] = useState<StudentWithEnrollment | null>(null)
  const [importing, setImporting] = useState(false)
  const [detailStudent, setDetailStudent] = useState<StudentWithEnrollment | null>(null)
  const [detailCheckins, setDetailCheckins] = useState<any[]>([])
  const [detailReceipts, setDetailReceipts] = useState<any[]>([])
  const [editEnrollId, setEditEnrollId] = useState<string | null>(null)
  const [editEnrollForm, setEditEnrollForm] = useState<any>({})
  const [expandedEnrollId, setExpandedEnrollId] = useState<string | null>(null)
  const [savingEnroll, setSavingEnroll] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [enrollForm, setEnrollForm] = useState({
    course_id: '', teacher_id: '', lessons_total: 10, lessons_used: 0, price: 0,
    payment_method: 'transfer', notes: '', purchased_at: new Date().toISOString().split('T')[0],
  })
  const [enrollSaving, setEnrollSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '', nickname: '', date_of_birth: '', gender: 'female',
    parent_name: '', parent_phone: '', parent_line_id: '', notes: '',
    school: '', study_type: '', enrolled_at: '',
  })

  async function loadStudents() {
    let query = supabase
      .from('students')
      .select(`*, enrollments(*, course:courses(name), teacher:teacher_ref_id(full_name))`)
      .order('created_at', { ascending: false })
    if (filterStatus !== 'all') query = query.eq('is_active', filterStatus === 'active')
    const { data } = await query
    setStudents((data ?? []) as StudentWithEnrollment[])
    setLoading(false)
  }

  async function loadCourses() {
    const { data } = await supabase.from('courses').select('id, name, price, total_lessons').eq('is_active', true)
    setCourses(data ?? [])
  }

  async function loadTeachers() {
    const { data } = await supabase.from('teachers').select('id, full_name').eq('is_active', true).order('full_name')
    setTeachers(data ?? [])
  }

  async function loadBooks() {
    const { data } = await supabase.from('books').select('*').eq('is_active', true).gt('stock', 0).order('name')
    setBooks(data ?? [])
  }

  useEffect(() => { loadStudents(); loadCourses(); loadTeachers(); loadBooks() }, [filterStatus])

  async function openDetail(s: StudentWithEnrollment) {
    setDetailStudent(s)
    setDetailLoading(true)
    const [{ data: checkins }, { data: receipts }] = await Promise.all([
      supabase
        .from('checkins')
        .select('*, enrollment:enrollments(*, course:courses(name))')
        .eq('student_id', s.id)
        .order('check_in_at', { ascending: false }),
      supabase
        .from('receipts')
        .select('*')
        .eq('student_id', s.id)
        .order('issued_at', { ascending: false }),
    ])
    setDetailCheckins(checkins ?? [])
    setDetailReceipts(receipts ?? [])
    setDetailLoading(false)
  }

  async function deleteEnrollment(enrollId: string) {
    if (!confirm('ลบคอร์สนี้? ประวัติการเรียนที่เชื่อมกับคอร์สนี้จะถูกลบด้วย')) return
    const { error } = await supabase.from('enrollments').delete().eq('id', enrollId)
    if (error) { toast.error('ลบไม่สำเร็จ'); return }
    toast.success('ลบคอร์สแล้ว')
    if (detailStudent) {
      const { data } = await supabase.from('students').select(`*, enrollments(*, course:courses(name), teacher:teacher_ref_id(full_name))`).eq('id', detailStudent.id).single()
      if (data) setDetailStudent(data as StudentWithEnrollment)
    }
    loadStudents()
  }

  async function updateEnrollmentStatus(enrollId: string, status: string) {
    const { error } = await supabase.from('enrollments').update({ status }).eq('id', enrollId)
    if (error) { toast.error('แก้ไขไม่สำเร็จ'); return }
    toast.success(status === 'active' ? 'เปิดใช้งานคอร์สแล้ว' : 'ปิดคอร์สแล้ว')
    if (detailStudent) {
      const { data } = await supabase.from('students').select(`*, enrollments(*, course:courses(name), teacher:teacher_ref_id(full_name))`).eq('id', detailStudent.id).single()
      if (data) setDetailStudent(data as StudentWithEnrollment)
    }
    loadStudents()
  }

  const filtered = students.filter(s =>
    s.full_name.includes(search) || (s.nickname ?? '').includes(search) || (s.parent_name ?? '').includes(search)
  )

  function toDateStr(val: string) {
    if (!val) return null
    try {
      const d = new Date(val)
      if (isNaN(d.getTime())) return null
      return d.toISOString().split('T')[0]
    } catch { return null }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      full_name: form.full_name.trim(),
      nickname: form.nickname.trim() || null,
      school: form.school.trim() || null,
      study_type: form.study_type.trim() || null,
      parent_name: form.parent_name.trim() || null,
      parent_phone: form.parent_phone.trim() || null,
      parent_line_id: form.parent_line_id.trim() || null,
      notes: form.notes.trim() || null,
      date_of_birth: toDateStr(form.date_of_birth),
      enrolled_at: toDateStr(form.enrolled_at),
    }
    if (editStudent) {
      const { error } = await supabase.from('students').update(payload).eq('id', editStudent.id)
      if (error) { toast.error('แก้ไขไม่สำเร็จ: ' + error.message); return }
      toast.success('แก้ไขข้อมูลแล้ว')
    } else {
      const { error } = await supabase.from('students').insert([payload])
      if (error) { toast.error('บันทึกไม่สำเร็จ: ' + error.message); return }
      toast.success('เพิ่มนักเรียนแล้ว')
    }
    setShowForm(false); setEditStudent(null)
    setForm({ full_name: '', nickname: '', date_of_birth: '', gender: 'female', parent_name: '', parent_phone: '', parent_line_id: '', notes: '', school: '', study_type: '', enrolled_at: '' })
    loadStudents()
  }

  function openEdit(s: StudentWithEnrollment) {
    setEditStudent(s)
    setForm({
      full_name: s.full_name, nickname: s.nickname ?? '', date_of_birth: s.date_of_birth ?? '',
      gender: (s as any).gender ?? 'female', parent_name: s.parent_name ?? '', parent_phone: s.parent_phone ?? '',
      parent_line_id: (s as any).parent_line_id ?? '', notes: (s as any).notes ?? '',
      school: (s as any).school ?? '', study_type: (s as any).study_type ?? '', enrolled_at: (s as any).enrolled_at ?? '',
    })
    setShowForm(true)
  }

  async function toggleActive(s: StudentWithEnrollment) {
    const { error } = await supabase.from('students').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) { toast.error('เปลี่ยนสถานะไม่สำเร็จ'); return }
    toast.success(!s.is_active ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว')
    loadStudents()
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!showEnrollModal) return

    setEnrollSaving(true)

    const selectedCourse = courses.find(c => c.id === enrollForm.course_id)
    const finalPrice = enrollForm.price > 0 ? enrollForm.price : (selectedCourse?.price ?? 0)

    if (finalPrice <= 0) {
      const ok = window.confirm('ราคาเป็น 0 บาท — จะไม่มีการออกใบเสร็จ\nต้องการดำเนินการต่อโดยไม่มีใบเสร็จไหม?')
      if (!ok) { setEnrollSaving(false); return }
    }

    // ✅ บันทึก paid_amount + payment_method ลง enrollments ด้วย
    const { data: enroll, error: enrollError } = await supabase
      .from('enrollments')
      .insert([{
        student_id: showEnrollModal.id,
        course_id: enrollForm.course_id || null,
        teacher_ref_id: enrollForm.teacher_id || null,
        lessons_total: enrollForm.lessons_total,
        lessons_used: enrollForm.lessons_used,
        status: 'active',
        notes: enrollForm.notes || null,
        paid_amount: finalPrice > 0 ? finalPrice : null,
        payment_method: finalPrice > 0 ? enrollForm.payment_method : null,
      }])
      .select().single()

    if (enrollError) {
      toast.error('บันทึกไม่สำเร็จ: ' + enrollError.message)
      setEnrollSaving(false)
      return
    }

    let receiptId: string | null = null

    if (finalPrice > 0) {
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert([{
          student_id: showEnrollModal.id,
          enrollment_id: enroll.id,
          amount: finalPrice,
          payment_method: enrollForm.payment_method,
          issued_at: enrollForm.purchased_at, // ✅ ส่ง "YYYY-MM-DD" ตรงๆ ไม่ผ่าน new Date()
          items: [{
            description: selectedCourse?.name ?? 'คอร์สเรียน',
            amount: finalPrice,
          }],
        }])
        .select('id, receipt_number')
        .single()

      if (receiptError) {
        toast.error('ซื้อคอร์สแล้ว แต่ออกใบเสร็จไม่สำเร็จ: ' + receiptError.message)
      } else {
        receiptId = receipt.id
        toast.success(
          (t: any) => (
            <span>
              ซื้อคอร์สสำเร็จ 🎉{' '}
              <button
                onClick={() => { router.push('/staff/receipts'); toast.dismiss(t.id) }}
                className="underline font-medium text-brand-600 ml-1"
              >
                ดูใบเสร็จ →
              </button>
            </span>
          ),
          { duration: 6000 }
        )
      }
    } else {
      toast.success('บันทึกคอร์สเรียบร้อย (ไม่มีใบเสร็จ)')
    }

    await fetch('/api/revalidate', { method: 'POST' })
    router.refresh()
    setShowEnrollModal(null)
    setEnrollForm({
      course_id: '', teacher_id: '', lessons_total: 10, lessons_used: 0,
      price: 0, payment_method: 'transfer', notes: '',
      purchased_at: new Date().toISOString().split('T')[0],
    })
    setEnrollSaving(false)
    loadStudents()

    // ✅ ถามว่าจะไปดูใบเสร็จเลยไหม
    if (receiptId) {
      const goNow = window.confirm('ออกใบเสร็จสำเร็จ! ไปดูหน้าใบเสร็จเลยไหม?')
      if (goNow) router.push('/staff/receipts')
    }
  }

  async function handleBookSale(e: React.FormEvent) {
    e.preventDefault()
    if (!showBookSaleModal) return
    const book = books.find(b => b.id === bookSaleForm.book_id)
    if (!book) { toast.error('กรุณาเลือกหนังสือ'); return }
    if (bookSaleForm.quantity > book.stock) { toast.error('สต็อกไม่พอ'); return }

    setBookSaleSaving(true)
    const total = book.price * bookSaleForm.quantity

    const { error } = await supabase.from('book_sales').insert([{
      book_id: book.id,
      student_id: showBookSaleModal.id,
      quantity: bookSaleForm.quantity,
      unit_price: book.price,
      total_amount: total,
      payment_method: bookSaleForm.payment_method,
      notes: bookSaleForm.notes || null,
      sold_at: new Date(bookSaleForm.sold_at).toISOString(),
    }])

    if (error) {
      toast.error('บันทึกไม่สำเร็จ: ' + error.message)
      setBookSaleSaving(false)
      return
    }

    // ลดสต็อก
    await supabase.from('books').update({ stock: book.stock - bookSaleForm.quantity }).eq('id', book.id)

    // ออกใบเสร็จ (เหมือนซื้อคอร์ส)
    const { error: receiptError } = await supabase.from('receipts').insert([{
      student_id: showBookSaleModal.id,
      enrollment_id: null,
      amount: total,
      book_fee: total,
      payment_method: bookSaleForm.payment_method,
      issued_at: bookSaleForm.sold_at,
      items: [{
        description: `หนังสือ: ${book.name} x${bookSaleForm.quantity}`,
        amount: total,
      }],
      notes: bookSaleForm.notes || null,
    }])

    if (receiptError) {
      toast.error('ขายสำเร็จ แต่ออกใบเสร็จไม่สำเร็จ: ' + receiptError.message)
    } else {
      toast.success(
        (t: any) => (
          <span>
            ขาย &quot;{book.name}&quot; ให้ {showBookSaleModal.nickname || showBookSaleModal.full_name} สำเร็จ 🎉 ({formatThaiMoney(total)}){' '}
            <button
              onClick={() => { router.push('/staff/receipts'); toast.dismiss(t.id) }}
              className="underline font-medium text-brand-600 ml-1"
            >
              ดูใบเสร็จ →
            </button>
          </span>
        ),
        { duration: 6000 }
      )
    }
    setShowBookSaleModal(null)
    setBookSaleForm({ book_id: '', quantity: 1, payment_method: 'cash', notes: '', sold_at: new Date().toISOString().split('T')[0] })
    setBookSaleSaving(false)
    loadBooks()
  }

  function exportExcel() {
    const data = filtered.map(s => {
      const activeEnroll = s.enrollments?.find(e => e.status === 'active')
      return {
        'ลำดับที่': '', 'วันสมัคร': (s as any).enrolled_at ?? '', 'ชื่อ': s.full_name,
        'ชื่อเล่น': s.nickname ?? '', 'โรงเรียน': (s as any).school ?? '',
        'อายุ': s.date_of_birth ? `${new Date().getFullYear() - new Date(s.date_of_birth).getFullYear()} ปี` : '',
        'วิชาที่เรียน': (activeEnroll?.course as any)?.name ?? '',
        'ครูผู้สอน': (activeEnroll as any)?.teacher?.full_name ?? '',
        'เบอร์โทร': s.parent_phone ?? '',
        'study type': (s as any).study_type ?? '', 'remark': (s as any).notes ?? '',
        'สถานะ': s.is_active ? 'Active' : 'Inactive',
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'นักเรียน')
    XLSX.writeFile(wb, `students_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('ดาวน์โหลด Excel แล้ว')
  }

  async function importExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws)
        const toInsert = rows.map(row => {
          let dob = null
          if (row['อายุ']) { const age = parseInt(String(row['อายุ']).replace(/[^0-9]/g, '')); if (!isNaN(age)) dob = `${new Date().getFullYear() - age}-01-01` }
          let enrolledAt = null
          if (row['วันสมัคร']) { try { const d = new Date(row['วันสมัคร']); if (!isNaN(d.getTime())) enrolledAt = d.toISOString().split('T')[0] } catch {} }
          return {
            full_name: String(row['ชื่อ'] ?? '').trim(),
            nickname: String(row['ชื่อเล่น'] ?? '').trim() || null,
            date_of_birth: dob, parent_phone: String(row['เบอร์โทร'] ?? '').trim() || null,
            school: String(row['โรงเรียน'] ?? '').trim() || null,
            study_type: String(row['study type'] ?? '').trim() || null,
            notes: String(row['remark'] ?? '').trim() || null,
            enrolled_at: enrolledAt, is_active: true,
          }
        }).filter(s => s.full_name)
        if (toInsert.length === 0) { toast.error('ไม่พบข้อมูลในไฟล์'); setImporting(false); return }
        const { error } = await supabase.from('students').insert(toInsert)
        if (error) { toast.error('Import ไม่สำเร็จ: ' + error.message) }
        else { toast.success(`Import สำเร็จ ${toInsert.length} คน 🎉`); loadStudents() }
      } catch { toast.error('อ่านไฟล์ไม่สำเร็จ') }
      setImporting(false)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  async function saveEnrollEdit(enrollId: string) {
    setSavingEnroll(true)
    const { error } = await supabase.from('enrollments').update({
      lessons_total: Number(editEnrollForm.lessons_total),
      lessons_used: Number(editEnrollForm.lessons_used),
      teacher_ref_id: editEnrollForm.teacher_id || null,
    }).eq('id', enrollId)
    if (error) { toast.error('แก้ไขไม่สำเร็จ'); setSavingEnroll(false); return }

    const receipt = detailReceipts.find(r => r.enrollment_id === enrollId)
    if (receipt && (editEnrollForm.price || editEnrollForm.issued_at)) {
      await supabase.from('receipts').update({
        amount: Number(editEnrollForm.price),
        issued_at: editEnrollForm.issued_at,
      }).eq('id', receipt.id)
    }
    toast.success('แก้ไขแล้ว')
    setSavingEnroll(false)
    setEditEnrollId(null)
    if (detailStudent) {
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase.from('students').select('*, enrollments(*, course:courses(name), teacher:teacher_ref_id(full_name))').eq('id', detailStudent.id).single(),
        supabase.from('receipts').select('*').eq('student_id', detailStudent.id).order('issued_at', { ascending: false }),
      ])
      if (s) setDetailStudent(s as StudentWithEnrollment)
      setDetailReceipts(r ?? [])
    }
    loadStudents()
  }

  function getEnrollCheckins(enrollId: string) {
    return detailCheckins.filter(c => c.enrollment_id === enrollId)
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">ข้อมูลนักเรียน</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 mt-0.5">{filtered.length} คน</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="btn-outline">📥 Export Excel</button>
          <label className={`btn-outline cursor-pointer ${importing ? 'opacity-50' : ''}`}>
            {importing ? 'กำลัง Import...' : '📤 Import Excel'}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={importExcel} disabled={importing} />
          </label>
          <button onClick={() => {
            setEditStudent(null)
            setForm({ full_name: '', nickname: '', date_of_birth: '', gender: 'female', parent_name: '', parent_phone: '', parent_line_id: '', notes: '', school: '', study_type: '', enrolled_at: '' })
            setShowForm(true)
          }} className="btn-brand">+ เพิ่มนักเรียน</button>
        </div>
      </div>

      <div className="card mb-4 p-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="ค้นหาชื่อ, ชื่อเล่น, ผู้ปกครอง..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex rounded-lg border border-gray-200 dark:border-[#3a4560] overflow-hidden">
          {(['active', 'inactive', 'all'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs transition-colors border-l first:border-l-0 border-gray-200 dark:border-[#3a4560] ${filterStatus === s ? 'bg-gray-900 text-white' : 'bg-white dark:bg-[#242d3f] text-gray-500 dark:text-gray-400 dark:text-gray-300 hover:bg-gray-50 dark:bg-[#1e2533]'}`}>
              {s === 'active' ? 'Active' : s === 'inactive' ? 'Inactive' : 'ทั้งหมด'}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-600">
        💡 ไฟล์ Excel ต้องมี column: <strong>ลำดับที่, วันสมัคร, ชื่อ, โรงเรียน, อายุ, วิชาที่เรียน, เบอร์โทร, study type, remark</strong>
      </div>

      <div className="card overflow-x-auto">
        {loading ? <p className="text-center text-gray-400 dark:text-gray-300 py-12">กำลังโหลด...</p> : (
          <table className="w-full">
            <thead>
              <tr>
                <th>นักเรียน</th>
                <th>โรงเรียน</th>
                <th>คอร์สปัจจุบัน</th>
                <th>ครูผู้สอน</th>
                <th>ความคืบหน้า</th>
                <th>เบอร์โทร</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const activeEnroll = s.enrollments?.find(e => e.status === 'active')
                const remaining = activeEnroll ? activeEnroll.lessons_total - activeEnroll.lessons_used : null
                const pct = activeEnroll ? Math.round((activeEnroll.lessons_used / activeEnroll.lessons_total) * 100) : 0
                const teacherName = (activeEnroll as any)?.teacher?.full_name ?? null
                return (
                  <tr key={s.id} className={`table-row-hover ${!s.is_active ? 'opacity-50' : ''}`}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-semibold flex-shrink-0">{getInitials(s.nickname || s.full_name)}</div>
                        <div>
                          <button onClick={() => openDetail(s)} className="font-medium text-gray-900 dark:text-white text-sm hover:text-brand-600 hover:underline text-left">{s.nickname || s.full_name}</button>
                          {s.nickname && <div className="text-xs text-gray-400 dark:text-gray-300">{s.full_name}</div>}
                          {(s as any).study_type && <div className="text-[10px] text-blue-400">{(s as any).study_type}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">{(s as any).school || '—'}</td>
                    <td>{activeEnroll ? <span className="text-sm">{(activeEnroll.course as any)?.name}</span> : <span className="text-gray-400 dark:text-gray-300 text-xs">ไม่มีคอร์ส</span>}</td>
                    <td>
                      {teacherName
                        ? <span className="text-sm text-gray-700 dark:text-gray-200">{teacherName}</span>
                        : <span className="text-gray-400 dark:text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td>
                      {activeEnroll && (
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-300 mb-1">{activeEnroll.lessons_used}/{activeEnroll.lessons_total} ครั้ง · <span className={remaining! <= 2 ? 'text-red-500 font-medium' : remaining! <= 5 ? 'text-amber-500 font-medium' : 'text-brand-600'}>เหลือ {remaining} ครั้ง</span></div>
                          <div className="w-28 h-1.5 bg-gray-100 dark:bg-[#2a3245] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 85 ? 'bg-red-400' : pct >= 65 ? 'bg-amber-400' : 'bg-brand-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </td>
                    <td><div className="text-sm">{s.parent_phone || '—'}</div></td>
                    <td>
                      <button onClick={() => toggleActive(s)} className={`badge cursor-pointer hover:opacity-80 transition ${s.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(s)} className="btn-outline btn-sm">แก้ไข</button>
                        <button onClick={() => { setShowEnrollModal(s); setEnrollForm({ course_id: '', teacher_id: '', lessons_total: 10, lessons_used: 0, price: 0, payment_method: 'transfer', notes: '', purchased_at: new Date().toISOString().split('T')[0] }) }} className="btn-outline btn-sm">ซื้อคอร์ส</button>
                        <button onClick={() => { setShowBookSaleModal(s); setBookSaleForm({ book_id: '', quantity: 1, payment_method: 'cash', notes: '', sold_at: new Date().toISOString().split('T')[0] }) }} className="btn-outline btn-sm">ซื้อหนังสือ</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center text-gray-400 dark:text-gray-300 py-8">ไม่พบนักเรียน</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {detailStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">{getInitials(detailStudent.nickname || detailStudent.full_name)}</div>
                <div>
                  <h2 className="font-semibold text-lg">{detailStudent.nickname || detailStudent.full_name}</h2>
                  {detailStudent.nickname && <p className="text-xs text-gray-400 dark:text-gray-300">{detailStudent.full_name}</p>}
                </div>
              </div>
              <button onClick={() => setDetailStudent(null)} className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:text-gray-300">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-[#1e2533] rounded-xl p-3">
                  <div className="text-xs text-gray-400 dark:text-gray-300 mb-2 font-medium">👤 ข้อมูลนักเรียน</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 dark:text-gray-300">โรงเรียน</span><span>{(detailStudent as any).school || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 dark:text-gray-300">Study type</span><span>{(detailStudent as any).study_type || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 dark:text-gray-300">วันสมัคร</span><span>{(detailStudent as any).enrolled_at || '—'}</span></div>
                    {(detailStudent as any).notes && <div className="pt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-300 border-t border-gray-200 dark:border-[#3a4560]">{(detailStudent as any).notes}</div>}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-[#1e2533] rounded-xl p-3">
                  <div className="text-xs text-gray-400 dark:text-gray-300 mb-2 font-medium">👨‍👩‍👧 ผู้ปกครอง</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 dark:text-gray-300">ชื่อ</span><span>{detailStudent.parent_name || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 dark:text-gray-300">โทร</span><span>{detailStudent.parent_phone || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 dark:text-gray-300">LINE</span><span>{(detailStudent as any).parent_line_id || '—'}</span></div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-300 font-medium mb-2">📚 ประวัติคอร์ส</div>
                <div className="space-y-2">
                  {detailStudent.enrollments?.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-300">ยังไม่มีคอร์ส</p>}
                  {detailStudent.enrollments?.map((enroll: any) => {
                    const pct = Math.round((enroll.lessons_used / enroll.lessons_total) * 100)
                    const remaining = enroll.lessons_total - enroll.lessons_used
                    return (
                      <div key={enroll.id} className="bg-gray-50 dark:bg-[#1e2533] rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{enroll.course?.name || 'ไม่มีชื่อคอร์ส'}</span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => updateEnrollmentStatus(enroll.id, enroll.status === 'active' ? 'completed' : 'active')}
                              className={`badge cursor-pointer hover:opacity-80 transition ${enroll.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                              {enroll.status === 'active' ? 'active' : enroll.status}
                            </button>
                            <button
                              onClick={() => {
                                setEditEnrollId(enroll.id)
                                const receipt = detailReceipts.find(r => r.enrollment_id === enroll.id)
                                setEditEnrollForm({
                                  lessons_total: enroll.lessons_total,
                                  lessons_used: enroll.lessons_used,
                                  teacher_id: enroll.teacher_ref_id ?? '',
                                  price: receipt ? receipt.amount : '',
                                  issued_at: receipt ? receipt.issued_at?.split('T')[0] : '',
                                })
                              }}
                              className="text-xs text-gray-400 dark:text-gray-300 hover:text-brand-600 hover:bg-brand-50 rounded px-1.5 py-0.5 transition">✎</button>
                            <button onClick={() => deleteEnrollment(enroll.id)} className="text-red-400 hover:text-red-600 text-xs hover:bg-red-50 rounded px-1.5 py-0.5 transition">🗑</button>
                          </div>
                        </div>

                        {editEnrollId === enroll.id ? (
                          <div className="bg-white dark:bg-[#242d3f] rounded-xl p-3 mb-2 border border-brand-100 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-gray-400 dark:text-gray-300 mb-0.5 block">ครูผู้สอน</label>
                                <select className="input text-xs py-1" value={editEnrollForm.teacher_id}
                                  onChange={e => setEditEnrollForm({...editEnrollForm, teacher_id: e.target.value})}>
                                  <option value="">— ไม่ระบุ —</option>
                                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 dark:text-gray-300 mb-0.5 block">จำนวนครั้งทั้งหมด</label>
                                <input type="number" className="input text-xs py-1" value={editEnrollForm.lessons_total}
                                  onChange={e => setEditEnrollForm({...editEnrollForm, lessons_total: e.target.value})} />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 dark:text-gray-300 mb-0.5 block">ใช้ไปแล้ว</label>
                                <input type="number" className="input text-xs py-1" value={editEnrollForm.lessons_used}
                                  onChange={e => setEditEnrollForm({...editEnrollForm, lessons_used: e.target.value})} />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 dark:text-gray-300 mb-0.5 block">ราคา (฿)</label>
                                <input type="number" className="input text-xs py-1" value={editEnrollForm.price}
                                  onChange={e => setEditEnrollForm({...editEnrollForm, price: e.target.value})} />
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs text-gray-400 dark:text-gray-300 mb-0.5 block">วันที่ซื้อ</label>
                                <input type="date" className="input text-xs py-1" value={editEnrollForm.issued_at}
                                  onChange={e => setEditEnrollForm({...editEnrollForm, issued_at: e.target.value})} />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveEnrollEdit(enroll.id)} disabled={savingEnroll}
                                className="btn-brand btn-sm flex-1 justify-center text-xs">
                                {savingEnroll ? 'กำลังบันทึก...' : 'บันทึก'}
                              </button>
                              <button onClick={() => setEditEnrollId(null)}
                                className="btn-outline btn-sm flex-1 justify-center text-xs">ยกเลิก</button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2 text-xs">
                            {enroll.teacher?.full_name && (
                              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 dark:text-gray-300">
                                <span className="text-gray-400 dark:text-gray-300">👩‍🏫</span>
                                <span className="font-medium text-brand-700">{enroll.teacher.full_name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 dark:text-gray-300">
                              <span className="text-gray-400 dark:text-gray-300">📚</span>
                              <span className="font-medium">{enroll.lessons_total} ครั้ง</span>
                            </div>
                            {(() => {
                              const receipt = detailReceipts.find(r => r.enrollment_id === enroll.id)
                              return receipt ? (
                                <>
                                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 dark:text-gray-300">
                                    <span className="text-gray-400 dark:text-gray-300">💰</span>
                                    <span className="font-medium text-brand-600">{Number(receipt.amount).toLocaleString()} ฿</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 dark:text-gray-300">
                                    <span className="text-gray-400 dark:text-gray-300">📅</span>
                                    <span className="font-medium">{new Date(receipt.issued_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                                  </div>
                                </>
                              ) : null
                            })()}
                          </div>
                        )}

                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 85 ? 'bg-red-400' : pct >= 65 ? 'bg-amber-400' : 'bg-brand-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-300 flex-shrink-0">{enroll.lessons_used}/{enroll.lessons_total} · เหลือ <span className={remaining <= 2 ? 'text-red-500 font-medium' : remaining <= 5 ? 'text-amber-500 font-medium' : 'text-brand-600'}>{remaining}</span> ครั้ง</span>
                        </div>

                        {(() => {
                          const enrollCheckins = getEnrollCheckins(enroll.id)
                          const isExpanded = expandedEnrollId === enroll.id
                          return enrollCheckins.length > 0 ? (
                            <div>
                              <button
                                onClick={() => setExpandedEnrollId(isExpanded ? null : enroll.id)}
                                className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                                🕐 ดูประวัติเรียน ({enrollCheckins.length} ครั้ง) {isExpanded ? '▲' : '▼'}
                              </button>
                              {isExpanded && (
                                <div className="mt-2 space-y-1.5">
                                  {enrollCheckins.map((c, idx) => (
                                    <div key={c.id} className="flex items-center justify-between bg-white dark:bg-[#242d3f] rounded-lg px-2.5 py-1.5 text-xs border border-gray-100 dark:border-[#3a4560]">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-400 dark:text-gray-300 font-medium">#{enrollCheckins.length - idx}</span>
                                        <span className="text-gray-700 dark:text-gray-200 font-medium">{fmtDate(c.check_in_at)}</span>
                                      </div>
                                      <div className="text-right text-gray-400 dark:text-gray-300">
                                        {fmtTime(c.check_in_at)}
                                        {c.check_out_at && ` — ${fmtTime(c.check_out_at)}`}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : <p className="text-xs text-gray-300">ยังไม่มีประวัติเรียน</p>
                        })()}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400 dark:text-gray-300 font-medium">🕐 ประวัติการเรียน</div>
                  <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">{detailCheckins.length} ครั้ง</span>
                </div>
                {detailLoading ? <p className="text-sm text-gray-400 dark:text-gray-300">กำลังโหลด...</p> : detailCheckins.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-300">ยังไม่มีประวัติการเรียน</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {detailCheckins.map((c, idx) => {
                      const sessionNo = detailCheckins.length - idx
                      const inTime = new Date(c.check_in_at)
                      const outTime = c.check_out_at ? new Date(c.check_out_at) : null
                      const duration = outTime ? Math.round((outTime.getTime() - inTime.getTime()) / 60000) : null
                      return (
                        <div key={c.id} className="bg-white dark:bg-[#242d3f] border border-gray-100 dark:border-[#3a4560] rounded-xl p-3 shadow-sm">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-brand-100 text-brand-700 rounded-full px-2 py-0.5 font-semibold flex-shrink-0">#{sessionNo}</span>
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{fmtDate(c.check_in_at)}</span>
                            </div>
                            <span className="text-xs text-brand-600 font-medium">{fmtTime(c.check_in_at)}{outTime ? ` — ${fmtTime(c.check_out_at)}` : ''}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 dark:text-gray-300">{c.enrollment?.course?.name || '—'}</span>
                            {duration && <span className="text-xs text-gray-400 dark:text-gray-300">{duration} นาที</span>}
                          </div>
                          {c.lesson_note && <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 bg-yellow-50 rounded-lg px-2.5 py-1.5 border border-yellow-100">📖 {c.lesson_note}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-[#3a4560] flex gap-2 flex-shrink-0">
              <button onClick={() => { setShowEnrollModal(detailStudent); setEnrollForm({ course_id: '', teacher_id: '', lessons_total: 10, lessons_used: 0, price: 0, payment_method: 'transfer', notes: '', purchased_at: new Date().toISOString().split('T')[0] }) }} className="btn-outline flex-1 justify-center text-sm">+ ซื้อคอร์ส</button>
              <button onClick={() => { setShowBookSaleModal(detailStudent); setBookSaleForm({ book_id: '', quantity: 1, payment_method: 'cash', notes: '', sold_at: new Date().toISOString().split('T')[0] }) }} className="btn-outline flex-1 justify-center text-sm">📚 ซื้อหนังสือ</button>
              <button onClick={() => { setDetailStudent(null); openEdit(detailStudent) }} className="btn-outline flex-1 justify-center">✎ แก้ไขข้อมูล</button>
              <button onClick={() => setDetailStudent(null)} className="btn-brand flex-1 justify-center">ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <div>
                <h2 className="font-semibold">ซื้อคอร์ส</h2>
                <p className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">{showEnrollModal.nickname || showEnrollModal.full_name}</p>
              </div>
              <button onClick={() => setShowEnrollModal(null)} className="text-gray-400 dark:text-gray-300">✕</button>
            </div>
            <form onSubmit={handleEnroll} className="p-5 space-y-3.5">
              <div>
                <label className="label">คอร์ส</label>
                <select className="input" value={enrollForm.course_id}
                  onChange={e => {
                    const course = courses.find(c => c.id === e.target.value)
                    setEnrollForm({ ...enrollForm, course_id: e.target.value, lessons_total: course?.total_lessons ?? 10, price: course?.price ?? 0 })
                  }}>
                  <option value="">— เลือกคอร์ส —</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">ครูผู้สอน</label>
                <select className="input" value={enrollForm.teacher_id}
                  onChange={e => setEnrollForm({ ...enrollForm, teacher_id: e.target.value })}>
                  <option value="">— เลือกครู —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">จำนวนครั้งทั้งหมด</label>
                  <input type="number" min={1} className="input" value={enrollForm.lessons_total}
                    onChange={e => setEnrollForm({ ...enrollForm, lessons_total: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">ใช้ไปแล้ว (ย้อนหลัง)</label>
                  <input type="number" min={0} className="input" value={enrollForm.lessons_used}
                    onChange={e => setEnrollForm({ ...enrollForm, lessons_used: Number(e.target.value) })} placeholder="0" />
                  <p className="text-xs text-gray-400 dark:text-gray-300 mt-1">ใส่ถ้ามีประวัติก่อนใช้ระบบ</p>
                </div>
              </div>
              <div>
                <label className="label">วันที่ซื้อคอร์ส</label>
                <input type="date" className="input" value={enrollForm.purchased_at}
                  onChange={e => setEnrollForm({ ...enrollForm, purchased_at: e.target.value })} />
              </div>
              <div>
                <label className="label">ราคา (บาท) *</label>
                <input
                  type="number" min={0}
                  className={`input ${enrollForm.price <= 0 ? 'border-amber-300 bg-amber-50' : ''}`}
                  value={enrollForm.price}
                  onChange={e => setEnrollForm({ ...enrollForm, price: Number(e.target.value) })}
                />
                {enrollForm.price <= 0 && (
                  <p className="text-xs text-amber-500 mt-1">⚠️ ราคาเป็น 0 — จะไม่มีการออกใบเสร็จ</p>
                )}
              </div>
              <div>
                <label className="label">ช่องทางชำระ</label>
                <select className="input" value={enrollForm.payment_method}
                  onChange={e => setEnrollForm({ ...enrollForm, payment_method: e.target.value })}>
                  <option value="transfer">โอนเงิน</option>
                  <option value="cash">เงินสด</option>
                  <option value="promptpay">พร้อมเพย์</option>
                </select>
              </div>
              <div>
                <label className="label">หมายเหตุ</label>
                <input className="input" placeholder="เช่น ต่อคอร์ส, โปรโมชัน..."
                  value={enrollForm.notes}
                  onChange={e => setEnrollForm({ ...enrollForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={enrollSaving} className="btn-brand flex-1 justify-center">
                  {enrollSaving ? 'กำลังบันทึก...' : 'ยืนยันซื้อคอร์ส'}
                </button>
                <button type="button" onClick={() => setShowEnrollModal(null)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Sale Modal */}
      {showBookSaleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <div>
                <h2 className="font-semibold">📚 ซื้อหนังสือ</h2>
                <p className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">
                  {showBookSaleModal.nickname || showBookSaleModal.full_name}
                </p>
              </div>
              <button onClick={() => setShowBookSaleModal(null)} className="text-gray-400 dark:text-gray-300">✕</button>
            </div>
            <form onSubmit={handleBookSale} className="p-5 space-y-3.5">
              {books.length === 0 ? (
                <p className="text-center text-gray-400 dark:text-gray-300 text-sm py-6">
                  ไม่มีหนังสือในสต็อก — เพิ่มได้ที่หน้า <span className="font-medium">จัดการหนังสือ</span>
                </p>
              ) : (
                <>
                  <div>
                    <label className="label">เลือกหนังสือ *</label>
                    <select className="input" required value={bookSaleForm.book_id}
                      onChange={e => setBookSaleForm({ ...bookSaleForm, book_id: e.target.value })}>
                      <option value="">— เลือกหนังสือ —</option>
                      {books.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} — {formatThaiMoney(b.price)} (เหลือ {b.stock} เล่ม)
                        </option>
                      ))}
                    </select>
                  </div>

                  {bookSaleForm.book_id && (() => {
                    const book = books.find(b => b.id === bookSaleForm.book_id)
                    if (!book) return null
                    return (
                      <>
                        <div>
                          <label className="label">จำนวน (สต็อกเหลือ {book.stock} เล่ม)</label>
                          <input type="number" min={1} max={book.stock} className="input"
                            value={bookSaleForm.quantity}
                            onChange={e => setBookSaleForm({ ...bookSaleForm, quantity: Number(e.target.value) })} />
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-[#1e2533] rounded-lg flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-300">รวม</span>
                          <span className="font-semibold text-brand-600">{formatThaiMoney(book.price * bookSaleForm.quantity)}</span>
                        </div>
                      </>
                    )
                  })()}

                  <div>
                    <label className="label">ช่องทางชำระ</label>
                    <select className="input" value={bookSaleForm.payment_method}
                      onChange={e => setBookSaleForm({ ...bookSaleForm, payment_method: e.target.value })}>
                      <option value="cash">เงินสด</option>
                      <option value="transfer">โอนเงิน</option>
                      <option value="promptpay">พร้อมเพย์</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">วันที่ขาย</label>
                    <input type="date" className="input" value={bookSaleForm.sold_at}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={e => setBookSaleForm({ ...bookSaleForm, sold_at: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">หมายเหตุ</label>
                    <input className="input" placeholder="(ไม่บังคับ)" value={bookSaleForm.notes}
                      onChange={e => setBookSaleForm({ ...bookSaleForm, notes: e.target.value })} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={bookSaleSaving || !bookSaleForm.book_id} className="btn-brand flex-1 justify-center disabled:opacity-50">
                      {bookSaleSaving ? 'กำลังบันทึก...' : 'ยืนยันการขาย'}
                    </button>
                    <button type="button" onClick={() => setShowBookSaleModal(null)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between sticky top-0 bg-white dark:bg-[#242d3f]">
              <h2 className="font-semibold">{editStudent ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'}</h2>
              <button onClick={() => { setShowForm(false); setEditStudent(null) }} className="text-gray-400 dark:text-gray-300">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">ชื่อ-นามสกุล *</label><input className="input" required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} /></div>
                <div><label className="label">ชื่อเล่น</label><input className="input" value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">วันเกิด</label><input type="date" className="input" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} /></div>
                <div><label className="label">เพศ</label>
                  <select className="input" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                    <option value="female">หญิง</option><option value="male">ชาย</option><option value="other">อื่นๆ</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">โรงเรียน</label><input className="input" value={form.school} onChange={e => setForm({...form, school: e.target.value})} /></div>
                <div><label className="label">Study Type</label><input className="input" placeholder="เช่น Online, Onsite" value={form.study_type} onChange={e => setForm({...form, study_type: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">วันสมัคร</label><input type="date" className="input" value={form.enrolled_at} onChange={e => setForm({...form, enrolled_at: e.target.value})} /></div>
                <div><label className="label">เบอร์โทร</label><input className="input" type="tel" value={form.parent_phone} onChange={e => setForm({...form, parent_phone: e.target.value})} /></div>
              </div>
              <div><label className="label">ผู้ปกครอง</label><input className="input" value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} /></div>
              <div><label className="label">LINE ID ผู้ปกครอง</label><input className="input" value={form.parent_line_id} onChange={e => setForm({...form, parent_line_id: e.target.value})} /></div>
              <div><label className="label">หมายเหตุ (remark)</label><textarea className="input min-h-[70px] resize-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-brand flex-1 justify-center">บันทึก</button>
                <button type="button" onClick={() => { setShowForm(false); setEditStudent(null) }} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
