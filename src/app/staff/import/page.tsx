'use client'
// src/app/staff/import/page.tsx  —  Download file (Import / Export ศูนย์รวม)
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatThaiMoney } from '@/lib/utils'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

/* ─── helpers ─── */
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
function buildMonthOptions() {
  const opts = [{ value: '', label: 'ทั้งหมด' }]
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    opts.push({ value: val, label: `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}` })
  }
  return opts
}
function parseDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0]
  if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000).toISOString().split('T')[0]
  if (typeof val === 'string') { try { const d = new Date(val); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0] } catch {} }
  if (val instanceof Date || (typeof val === 'object' && val !== null)) { try { const d = new Date(val); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0] } catch {} }
  return new Date().toISOString().split('T')[0]
}
function filterByMonth<T extends Record<string, any>>(arr: T[], field: string, month: string) {
  if (!month) return arr
  return arr.filter(r => String(r[field] ?? '').slice(0, 7) === month)
}
function saveXlsx(wb: XLSX.WorkBook, name: string) { XLSX.writeFile(wb, name) }

/* ─── export helpers ─── */
function buildWb(rows: any[], sheetName: string) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName)
  return wb
}

/* ─── export card config ─── */
type ExportItem = {
  id: string
  icon: string
  label: string
  desc: string
  color: string
}
const EXPORT_ITEMS: ExportItem[] = [
  { id: 'receipts',  icon: '🧾', label: 'รายรับ',          desc: 'ใบเสร็จ วันที่ ชื่อนักเรียน คอร์ส ยอด', color: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700' },
  { id: 'expenses',  icon: '📤', label: 'รายจ่าย',         desc: 'รายการ หมวดหมู่ วันที่ ยอด',             color: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700' },
  { id: 'students',  icon: '👥', label: 'รายชื่อนักเรียน', desc: 'ชื่อ ชื่อเล่น ผู้ปกครอง เบอร์ คอร์ส',    color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' },
  { id: 'checkins',  icon: '🕐', label: 'เช็กอิน',         desc: 'นักเรียน คอร์ส วันที่ เวลา ครู',         color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700' },
  { id: 'finance',   icon: '💰', label: 'รายรับ-รายจ่าย',  desc: 'สรุปการเงินรวม 2 sheet',                  color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' },
]

/* ─── template definitions ─── */
type TemplateItem = {
  id: string
  icon: string
  label: string
  desc: string
  rows: Record<string, string>[]
  headers: string[]
}
const TEMPLATES: TemplateItem[] = [
  {
    id: 'income',
    icon: '💰',
    label: 'Template รายรับ',
    desc: 'นำเข้าใบเสร็จ / ค่าคอร์ส',
    headers: ['Date','Name','Subject','Amount','ค่าหนังสือ','Teacher','Payment','Remark'],
    rows: [
      { Date: '2026-07-01', Name: 'น้องแสนดี', Subject: 'ภาษาจีน YCT', Amount: '4500', ค่าหนังสือ: '', Teacher: 'ครูเมล', Payment: 'transfer', Remark: '' },
      { Date: '2026-07-02', Name: 'น้องสมใจ',  Subject: 'คณิตศาสตร์',  Amount: '3500', ค่าหนังสือ: '250', Teacher: 'ครูฟลุ้ค', Payment: 'cash', Remark: '' },
    ],
  },
  {
    id: 'expense',
    icon: '📤',
    label: 'Template รายจ่าย',
    desc: 'นำเข้าค่าใช้จ่าย',
    headers: ['Date','List','price','teacher','Remark'],
    rows: [
      { Date: '2026-07-01', List: 'ค่าเช่า', price: '8000', teacher: '', Remark: '' },
      { Date: '2026-07-05', List: 'ค่าไฟฟ้า', price: '1200', teacher: '', Remark: '' },
    ],
  },
  {
    id: 'students',
    icon: '👥',
    label: 'Template นักเรียน',
    desc: 'นำเข้ารายชื่อนักเรียน',
    headers: ['full_name','nickname','parent_name','parent_phone','enrolled_at'],
    rows: [
      { full_name: 'สมใจ ใจดี', nickname: 'น้องใจ', parent_name: 'คุณแม่สมศรี', parent_phone: '0812345678', enrolled_at: '2026-07-01' },
    ],
  },
]

/* ═══════════════════════════════════════════ */
export default function DownloadFilePage() {
  const supabase = createClient()
  const monthOptions = buildMonthOptions()
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [exporting, setExporting] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<any[]>([])
  const [rawRows, setRawRows] = useState<any[]>([])
  const [importType, setImportType] = useState<'income' | 'expense' | 'students' | null>(null)

  /* ─── DOWNLOAD TEMPLATE ─── */
  function downloadTemplate(tpl: TemplateItem) {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(tpl.rows, { header: tpl.headers })
    XLSX.utils.book_append_sheet(wb, ws, tpl.label)
    saveXlsx(wb, `template_${tpl.id}.xlsx`)
    toast.success(`โหลด Template ${tpl.label} แล้ว`)
  }

  /* ─── EXPORT ─── */
  const handleExport = useCallback(async (id: string) => {
    setExporting(id)
    const tag = selectedMonth || 'all'
    try {
      if (id === 'receipts') {
        const { data } = await supabase.from('receipts')
          .select('receipt_number, issued_at, amount, payment_method, subject, book_fee, notes, student:students(full_name,nickname), enrollment:enrollments(course:courses(name))')
          .order('issued_at', { ascending: false })
        const rows = filterByMonth(data ?? [], 'issued_at', selectedMonth).map((r: any) => ({
          'เลขที่ใบเสร็จ': r.receipt_number,
          'วันที่': r.issued_at,
          'ชื่อนักเรียน': r.student?.full_name ?? '',
          'ชื่อเล่น': r.student?.nickname ?? '',
          'คอร์ส': r.enrollment?.course?.name ?? '',
          'วิชา': r.subject ?? '',
          'ยอดรวม': Number(r.amount),
          'ค่าหนังสือ': Number(r.book_fee ?? 0),
          'วิธีชำระ': r.payment_method,
          'หมายเหตุ': r.notes ?? '',
        }))
        saveXlsx(buildWb(rows, 'รายรับ'), `receipts_${tag}.xlsx`)
        toast.success(`Export รายรับ ${rows.length} รายการ`)
      }
      else if (id === 'expenses') {
        const { data } = await supabase.from('expenses')
          .select('title, amount, expense_date, payment_method, notes, category:expense_categories(name)')
          .order('expense_date', { ascending: false })
        const rows = filterByMonth(data ?? [], 'expense_date', selectedMonth).map((e: any) => ({
          'รายการ': e.title,
          'หมวดหมู่': (e.category as any)?.name ?? '',
          'วันที่': e.expense_date,
          'ยอด': Number(e.amount),
          'วิธีชำระ': e.payment_method,
          'หมายเหตุ': e.notes ?? '',
        }))
        saveXlsx(buildWb(rows, 'รายจ่าย'), `expenses_${tag}.xlsx`)
        toast.success(`Export รายจ่าย ${rows.length} รายการ`)
      }
      else if (id === 'students') {
        const { data } = await supabase.from('students')
          .select('full_name, nickname, parent_name, parent_phone, enrolled_at, is_active')
          .order('nickname')
        const rows = (data ?? []).map((s: any) => ({
          'ชื่อ-นามสกุล': s.full_name,
          'ชื่อเล่น': s.nickname ?? '',
          'ผู้ปกครอง': s.parent_name ?? '',
          'เบอร์โทร': s.parent_phone ?? '',
          'วันสมัคร': s.enrolled_at ?? '',
          'สถานะ': s.is_active ? 'Active' : 'Inactive',
        }))
        saveXlsx(buildWb(rows, 'นักเรียน'), `students_${tag}.xlsx`)
        toast.success(`Export นักเรียน ${rows.length} คน`)
      }
      else if (id === 'checkins') {
        const { data } = await supabase.from('checkins')
          .select('check_in_at, check_out_at, student:students(full_name,nickname), enrollment:enrollments(course:courses(name)), teacher:teachers(full_name)')
          .order('check_in_at', { ascending: false })
        const rows = filterByMonth(data ?? [], 'check_in_at', selectedMonth).map((c: any) => ({
          'นักเรียน': (c.student as any)?.nickname || (c.student as any)?.full_name || '',
          'คอร์ส': (c.enrollment as any)?.course?.name ?? '',
          'ครู': (c.teacher as any)?.full_name ?? '',
          'เช็กอิน': c.check_in_at,
          'เช็กเอาท์': c.check_out_at ?? '',
        }))
        saveXlsx(buildWb(rows, 'เช็กอิน'), `checkins_${tag}.xlsx`)
        toast.success(`Export เช็กอิน ${rows.length} รายการ`)
      }
      else if (id === 'finance') {
        const [{ data: rec }, { data: exp }] = await Promise.all([
          supabase.from('receipts').select('receipt_number, issued_at, amount, payment_method, subject, student:students(full_name,nickname)').order('issued_at', { ascending: false }),
          supabase.from('expenses').select('title, amount, expense_date, payment_method, category:expense_categories(name)').order('expense_date', { ascending: false }),
        ])
        const recRows = filterByMonth(rec ?? [], 'issued_at', selectedMonth).map((r: any) => ({
          'เลขที่': r.receipt_number, 'วันที่': r.issued_at,
          'ชื่อ': (r.student as any)?.nickname || (r.student as any)?.full_name || '',
          'วิชา': r.subject ?? '', 'ยอด': Number(r.amount), 'วิธีชำระ': r.payment_method,
        }))
        const expRows = filterByMonth(exp ?? [], 'expense_date', selectedMonth).map((e: any) => ({
          'รายการ': e.title, 'วันที่': e.expense_date,
          'หมวดหมู่': (e.category as any)?.name ?? '',
          'ยอด': Number(e.amount), 'วิธีชำระ': e.payment_method,
        }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recRows), 'รายรับ')
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows), 'รายจ่าย')
        const totalRec = recRows.reduce((s, r) => s + r['ยอด'], 0)
        const totalExp = expRows.reduce((s, e) => s + e['ยอด'], 0)
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
          { 'หัวข้อ': 'รายรับรวม', 'ยอด': totalRec },
          { 'หัวข้อ': 'รายจ่ายรวม', 'ยอด': totalExp },
          { 'หัวข้อ': 'กำไร/ขาดทุน', 'ยอด': totalRec - totalExp },
        ]), 'สรุป')
        saveXlsx(wb, `finance_${tag}.xlsx`)
        toast.success(`Export การเงิน · รายรับ ${recRows.length} / รายจ่าย ${expRows.length} รายการ`)
      }
    } catch (err: any) {
      toast.error('Export ไม่สำเร็จ: ' + (err?.message ?? ''))
    }
    setExporting(null)
  }, [selectedMonth, supabase])

  /* ─── READ FILE ─── */
  function readFile(file: File, type: 'income' | 'expense' | 'students') {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { raw: false })
      setRawRows(rows)
      setImportType(type)
      setPreview(rows.slice(0, 5))
    }
    reader.readAsBinaryString(file)
  }

  /* ─── IMPORT ─── */
  async function handleImport() {
    if (!importType || rawRows.length === 0) return
    setImporting(true)
    let success = 0, fail = 0

    if (importType === 'income') {
      for (const row of rawRows) {
        const name    = String(row['Name'] ?? row['ชื่อ'] ?? '').trim()
        const subject = String(row['Subject'] ?? row['วิชาที่เรียน'] ?? '').trim()
        const amount  = Number(String(row['Amount'] ?? row['จำนวนเงิน'] ?? '0').replace(/,/g, ''))
        const bookFee = Number(String(row['ค่าหนังสือ'] ?? '0').replace(/,/g, ''))
        const teacher = String(row['Teacher'] ?? row['ครู'] ?? '').trim()
        const payment = String(row['Payment'] ?? 'transfer').trim().toLowerCase()
        const remark  = String(row['Remark'] ?? '').trim()
        const issued_at = parseDate(row['Date'] ?? row['วันสมัคร'] ?? '')
        if (!name) { fail++; continue }
        const { data: sts } = await supabase.from('students').select('id').or(`full_name.ilike.%${name}%,nickname.ilike.%${name}%`).limit(1)
        const { error } = await supabase.from('receipts').insert({
          student_id: sts?.[0]?.id ?? null,
          amount: amount + bookFee,
          book_fee: bookFee || null,
          subject: subject || null,
          teacher_name: teacher || null,
          payment_method: payment === 'cash' ? 'cash' : payment === 'promptpay' ? 'promptpay' : 'transfer',
          notes: remark || null,
          issued_at,
        })
        if (error) fail++; else success++
      }
    }
    else if (importType === 'expense') {
      for (const row of rawRows) {
        const title  = String(row['List'] ?? row['รายการ'] ?? '').trim()
        const amount = Number(String(row['price'] ?? row['Price'] ?? row['จำนวนเงิน'] ?? '0').replace(/,/g, ''))
        const teacherAmt = Number(String(row['teacher'] ?? '0').replace(/,/g, ''))
        const expDate = parseDate(row['Date'] ?? row['วันที่'] ?? '')
        if (title && amount > 0) {
          const { error } = await supabase.from('expenses').insert({ title, amount, expense_date: expDate, payment_method: 'transfer' })
          if (error) fail++; else success++
        }
        if (teacherAmt > 0) {
          const { error } = await supabase.from('expenses').insert({ title: `ค่าสอนครู (${title})`, amount: teacherAmt, expense_date: expDate, payment_method: 'transfer' })
          if (error) fail++; else success++
        }
      }
    }
    else if (importType === 'students') {
      for (const row of rawRows) {
        const full_name = String(row['full_name'] ?? row['ชื่อ-นามสกุล'] ?? '').trim()
        const nickname  = String(row['nickname'] ?? row['ชื่อเล่น'] ?? '').trim()
        if (!full_name && !nickname) { fail++; continue }
        const { error } = await supabase.from('students').insert({
          full_name: full_name || nickname,
          nickname: nickname || null,
          parent_name: String(row['parent_name'] ?? row['ผู้ปกครอง'] ?? '').trim() || null,
          parent_phone: String(row['parent_phone'] ?? row['เบอร์โทร'] ?? '').trim() || null,
          enrolled_at: parseDate(row['enrolled_at'] ?? row['วันสมัคร'] ?? ''),
          is_active: true,
        })
        if (error) fail++; else success++
      }
    }

    toast.success(`Import สำเร็จ ${success} รายการ${fail > 0 ? ` (ข้าม ${fail})` : ''}`)
    setImporting(false)
    setPreview([]); setRawRows([]); setImportType(null)
  }

  /* ─── UI ─── */
  const tagMonth = selectedMonth
    ? monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth
    : 'ทั้งหมด'

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">📥 Download file</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ศูนย์รวม Import / Export ทุกข้อมูลในระบบ</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">เดือน:</label>
          <select className="input text-sm py-1.5 w-40" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* ─ EXPORT ─ */}
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">📤 Export ข้อมูล · {tagMonth}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {EXPORT_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => handleExport(item.id)}
            disabled={exporting === item.id}
            className={`rounded-2xl border p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all ${item.color}`}
          >
            <div className="text-2xl mb-2">{item.icon}</div>
            <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-1">{item.label}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">{item.desc}</div>
            <div className="text-xs font-medium text-brand-600 dark:text-brand-400">
              {exporting === item.id ? '⏳ กำลัง export...' : `⬇ โหลด .xlsx`}
            </div>
          </button>
        ))}
      </div>

      {/* ─ TEMPLATE ─ */}
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">📋 Template สำหรับ Import</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {TEMPLATES.map(tpl => (
          <div key={tpl.id} className="card p-4">
            <div className="text-2xl mb-2">{tpl.icon}</div>
            <div className="font-semibold text-sm mb-1">{tpl.label}</div>
            <div className="text-xs text-gray-400 mb-3">{tpl.desc}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Column: {tpl.headers.join(', ')}
            </div>
            <button onClick={() => downloadTemplate(tpl)} className="btn-outline btn-sm w-full text-xs">
              📋 โหลด Template
            </button>
          </div>
        ))}
      </div>

      {/* ─ IMPORT ─ */}
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">📤 Import ข้อมูล</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          { type: 'income' as const,   icon: '💰', label: 'นำเข้ารายรับ',          desc: 'ไฟล์ Excel รายรับ / ค่าคอร์ส' },
          { type: 'expense' as const,  icon: '📤', label: 'นำเข้ารายจ่าย',         desc: 'ไฟล์ Excel ค่าใช้จ่าย' },
          { type: 'students' as const, icon: '👥', label: 'นำเข้ารายชื่อนักเรียน', desc: 'ไฟล์ Excel รายชื่อนักเรียน' },
        ].map(item => (
          <label key={item.type} className="card p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all block">
            <div className="text-2xl mb-2">{item.icon}</div>
            <div className="font-semibold text-sm mb-1">{item.label}</div>
            <div className="text-xs text-gray-400 mb-3">{item.desc}</div>
            <div className="text-xs text-brand-600 dark:text-brand-400 font-medium">📁 เลือกไฟล์ .xlsx</div>
            <input type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f, item.type); e.target.value = '' }} />
          </label>
        ))}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="card-header">
            <h3 className="font-medium">ตัวอย่างข้อมูล (5 แถวแรก)</h3>
            <span className="badge badge-blue">{rawRows.length} แถวทั้งหมด</span>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs">
              <thead>
                <tr>{Object.keys(preview[0]).map(k => <th key={k} className="px-2 py-1 text-left bg-gray-50 dark:bg-[#1e2533] border border-gray-100 dark:border-[#2a3245] whitespace-nowrap">{k}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>{Object.values(row).map((v: any, j) => <td key={j} className="px-2 py-1 border border-gray-50 dark:border-[#2a3245] truncate max-w-[120px]">{String(v ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 dark:border-[#2a3245] flex gap-2">
            <button onClick={handleImport} disabled={importing} className="btn-brand">
              {importing ? 'กำลัง Import...' : `✅ ยืนยัน Import ${rawRows.length} แถว`}
            </button>
            <button onClick={() => { setPreview([]); setRawRows([]); setImportType(null) }} className="btn-outline">ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card p-5">
        <h3 className="font-medium mb-3">💡 คำแนะนำ</h3>
        <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          <p>• โหลด Template ก่อนแล้วกรอกข้อมูลตามรูปแบบ จะได้ import ได้ไม่ error</p>
          <p>• ไฟล์ต้องเป็น .xlsx หรือ .xls เท่านั้น</p>
          <p>• Import รายรับ: ระบบจะจับคู่นักเรียนจากชื่ออัตโนมัติ ถ้าไม่พบจะบันทึกเป็น guest</p>
          <p>• Import ซ้ำได้ แต่ข้อมูลจะเพิ่มขึ้น ควรเช็กก่อน</p>
          <p>• Export: เลือกเดือนบนหัวก่อน ถ้าเลือก "ทั้งหมด" จะ export ทุกเดือน</p>
        </div>
      </div>
    </div>
  )
}
