'use client'
// src/components/dashboard/DashboardExport.tsx
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

export default function DashboardExport() {
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  // ตัวกรองเดือน — default = เดือนปัจจุบัน, '' = ทั้งหมด
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  // สร้างรายการเดือนย้อนหลัง 24 เดือน + ตัวเลือก "ทั้งหมด"
  const monthOptions = [
    { value: '', label: 'ทั้งหมด (ไม่กรองเดือน)' },
    ...Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
      return { value: val, label }
    }),
  ]

  // helper กรอง array ตามเดือน
  function filterByMonth<T extends Record<string, any>>(arr: T[], dateField: string): T[] {
    if (!selectedMonth) return arr
    return arr.filter(r => {
      const v = r[dateField]
      return typeof v === 'string' && v.slice(0, 7) === selectedMonth
    })
  }

  // ── 1. Export รายรับ-รายจ่าย ─────────────────────────────
  async function exportFinance() {
    setLoading('finance')
    toast.loading('กำลังดึงข้อมูล...')

    const [{ data: receipts }, { data: expenses }] = await Promise.all([
      supabase
        .from('receipts')
        .select('receipt_number, issued_at, amount, payment_method, subject, notes, student:students(full_name, nickname)')
        .order('issued_at', { ascending: false }),
      supabase
        .from('expenses')
        .select('title, amount, expense_date, payment_method, notes, category:expense_categories(name)')
        .order('expense_date', { ascending: false }),
    ])

    toast.dismiss()
    const wb = XLSX.utils.book_new()
    const filteredReceipts = filterByMonth(receipts ?? [], 'issued_at')
    const filteredExpenses = filterByMonth(expenses ?? [], 'expense_date')

    // Sheet 1: รายรับ
    const receiptRows = filteredReceipts.map((r: any) => ({
      'เลขที่ใบเสร็จ': r.receipt_number ?? '',
      'วันที่':        r.issued_at?.split('T')[0] ?? '',
      'ชื่อนักเรียน':  r.student?.nickname || r.student?.full_name || '',
      'จำนวนเงิน':    Number(r.amount),
      'ช่องทางชำระ':  { transfer: 'โอนเงิน', cash: 'เงินสด', promptpay: 'พร้อมเพย์' }[r.payment_method as string] || r.payment_method || '',
      'วิชา':         r.subject ?? '',
      'หมายเหตุ':     r.notes ?? '',
    }))
    const ws1 = XLSX.utils.json_to_sheet(receiptRows)
    ws1['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'รายรับ')

    // Sheet 2: รายจ่าย
    const expenseRows = filteredExpenses.map((e: any) => ({
      'วันที่':       e.expense_date ?? '',
      'รายการ':       e.title ?? '',
      'หมวดหมู่':    (e.category as any)?.name ?? '',
      'จำนวนเงิน':   Number(e.amount),
      'ช่องทางชำระ': { transfer: 'โอนเงิน', cash: 'เงินสด', promptpay: 'พร้อมเพย์' }[e.payment_method as string] || e.payment_method || '',
      'หมายเหตุ':     e.notes ?? '',
    }))
    const ws2 = XLSX.utils.json_to_sheet(expenseRows)
    ws2['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'รายจ่าย')

    const monthTag = selectedMonth || 'ทั้งหมด'
    XLSX.writeFile(wb, `mando_finance_${monthTag}.xlsx`)
    toast.success(`Export รายรับ-รายจ่าย ${selectedMonth ? monthOptions.find(m => m.value === selectedMonth)?.label : 'ทั้งหมด'} สำเร็จ`)
    setLoading(null)
    setShowMenu(false)
  }

  // ── 2. Export ข้อมูลการเข้าเรียน ─────────────────────────
  async function exportCheckins() {
    setLoading('checkin')
    toast.loading('กำลังดึงข้อมูล...')

    const { data: checkins } = await supabase
      .from('checkins')
      .select(`
        check_in_at, check_out_at, lesson_note,
        student:students(full_name, nickname),
        enrollment:enrollments(lessons_used, lessons_total, course:courses(name))
      `)
      .order('check_in_at', { ascending: false })

    toast.dismiss()
    const wb = XLSX.utils.book_new()
    const filteredCheckins = filterByMonth(checkins ?? [], 'check_in_at')

    // จัดกลุ่มตามนักเรียน
    const byStudent: Record<string, any[]> = {}
    filteredCheckins.forEach((c: any) => {
      const name = c.student?.nickname || c.student?.full_name || 'ไม่ระบุ'
      if (!byStudent[name]) byStudent[name] = []
      byStudent[name].push(c)
    })

    // Sheet รวม
    const allRows = filteredCheckins.map((c: any, i: number) => {
      const inTime  = new Date(c.check_in_at)
      const outTime = c.check_out_at ? new Date(c.check_out_at) : null
      const duration = outTime ? Math.round((outTime.getTime() - inTime.getTime()) / 60000) : null
      return {
        'ลำดับ':         i + 1,
        'ชื่อนักเรียน': c.student?.nickname || c.student?.full_name || '',
        'คอร์ส':         (c.enrollment as any)?.course?.name ?? '',
        'ครั้งที่':      (c.enrollment as any)?.lessons_used ?? '',
        'วันที่':        inTime.toLocaleDateString('th-TH'),
        'เวลาเข้า':     inTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        'เวลาออก':      outTime ? outTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '',
        'ระยะเวลา(น.)': duration ?? '',
        'บันทึก':        c.lesson_note ?? '',
      }
    })
    const wsAll = XLSX.utils.json_to_sheet(allRows)
    wsAll['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 24 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, wsAll, 'ทุกคน')

    // แยก Sheet ตามนักเรียน
    Object.entries(byStudent).forEach(([name, rows]) => {
      const studentRows = rows.map((c: any, i: number) => {
        const inTime  = new Date(c.check_in_at)
        const outTime = c.check_out_at ? new Date(c.check_out_at) : null
        const duration = outTime ? Math.round((outTime.getTime() - inTime.getTime()) / 60000) : null
        return {
          'ครั้งที่':     i + 1,
          'คอร์ส':        (c.enrollment as any)?.course?.name ?? '',
          'วันที่':       inTime.toLocaleDateString('th-TH'),
          'เวลาเข้า':    inTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          'เวลาออก':     outTime ? outTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '',
          'ระยะเวลา(น.)': duration ?? '',
          'บันทึก':       c.lesson_note ?? '',
        }
      })
      const ws = XLSX.utils.json_to_sheet(studentRows)
      ws['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 24 }]
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
    })

    const monthTag2 = selectedMonth || 'ทั้งหมด'
    XLSX.writeFile(wb, `mando_checkins_${monthTag2}.xlsx`)
    toast.success(`Export การเข้าเรียน ${selectedMonth ? monthOptions.find(m => m.value === selectedMonth)?.label : 'ทั้งหมด'} สำเร็จ ${Object.keys(byStudent).length} คน`)
    setLoading(null)
    setShowMenu(false)
  }

  // ── 3. Export สรุปรายเดือน ───────────────────────────────
  async function exportMonthlySummary() {
    setLoading('monthly')
    toast.loading('กำลังดึงข้อมูล...')

    const [{ data: receipts }, { data: expenses }, { data: checkins }, { data: lessonLogs }] = await Promise.all([
      supabase.from('receipts').select('amount, issued_at'),
      supabase.from('expenses').select('amount, expense_date'),
      supabase.from('checkins').select('check_in_at, student_id'),
      supabase.from('lesson_logs').select('lesson_date, duration_minutes, teacher_name'),
    ])

    toast.dismiss()

    // สร้าง map เดือน 12 เดือนย้อนหลัง
    const months: Record<string, {
      income: number, expense: number, checkinCount: number,
      uniqueStudents: Set<string>, teachingMinutes: number
    }> = {}

    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months[key] = { income: 0, expense: 0, checkinCount: 0, uniqueStudents: new Set(), teachingMinutes: 0 }
    }

    ;(receipts ?? []).forEach((r: any) => {
      const key = r.issued_at?.slice(0, 7)
      if (months[key]) months[key].income += Number(r.amount)
    })
    ;(expenses ?? []).forEach((e: any) => {
      const key = e.expense_date?.slice(0, 7)
      if (months[key]) months[key].expense += Number(e.amount)
    })
    ;(checkins ?? []).forEach((c: any) => {
      const key = c.check_in_at?.slice(0, 7)
      if (months[key]) {
        months[key].checkinCount++
        if (c.student_id) months[key].uniqueStudents.add(c.student_id)
      }
    })
    ;(lessonLogs ?? []).forEach((l: any) => {
      const key = l.lesson_date?.slice(0, 7)
      if (months[key]) months[key].teachingMinutes += Number(l.duration_minutes ?? 0)
    })

    const rows = Object.entries(months).map(([key, data]) => {
      const [y, m] = key.split('-')
      const label = new Date(+y, +m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
      const profit = data.income - data.expense
      return {
        'เดือน':                label,
        'รายรับ (บาท)':        data.income,
        'รายจ่าย (บาท)':       data.expense,
        'กำไรสุทธิ (บาท)':     profit,
        'Margin %':             data.income > 0 ? Math.round((profit / data.income) * 100) : 0,
        'จำนวนเช็กอิน (ครั้ง)': data.checkinCount,
        'นักเรียน (คน)':        data.uniqueStudents.size,
        'ชั่วโมงสอน (ชม.)':     (data.teachingMinutes / 60).toFixed(1),
      }
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'สรุปรายเดือน')
    XLSX.writeFile(wb, `mando_monthly_summary_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Export สรุปรายเดือน สำเร็จ')
    setLoading(null)
    setShowMenu(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors shadow-sm"
      >
        <span>📊</span>
        <span>Export</span>
        <span className="text-white/70 text-xs">{showMenu ? '▲' : '▼'}</span>
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Export ข้อมูล</p>
            </div>

            {/* ตัวเลือกเดือน */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-1.5">กรองตามเดือน</p>
            <select
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="p-2">
              <button
                onClick={exportFinance}
                disabled={loading === 'finance'}
                className="w-full flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-60"
              >
                <span className="text-xl mt-0.5">💰</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">รายรับ - รายจ่าย</div>
                  <div className="text-xs text-gray-400">2 Sheet: ใบเสร็จ + ค่าใช้จ่ายทั้งหมด</div>
                </div>
                {loading === 'finance' && <span className="ml-auto text-xs text-gray-400 mt-1">...</span>}
              </button>

              <button
                onClick={exportCheckins}
                disabled={loading === 'checkin'}
                className="w-full flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-60"
              >
                <span className="text-xl mt-0.5">🕐</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">การเข้าเรียนของนักเรียน</div>
                  <div className="text-xs text-gray-400">Sheet รวม + แยก Sheet ตามนักเรียน</div>
                </div>
                {loading === 'checkin' && <span className="ml-auto text-xs text-gray-400 mt-1">...</span>}
              </button>

              <button
                onClick={exportMonthlySummary}
                disabled={loading === 'monthly'}
                className="w-full flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-60"
              >
                <span className="text-xl mt-0.5">📅</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">สรุปรายเดือน</div>
                  <div className="text-xs text-gray-400">รายรับ รายจ่าย กำไร เช็กอิน ชั่วโมงสอน</div>
                </div>
                {loading === 'monthly' && <span className="ml-auto text-xs text-gray-400 mt-1">...</span>}
              </button>
            </div>

            <div className="px-4 py-2 border-t border-gray-50 bg-gray-50/50">
              <p className="text-[10px] text-gray-400">ดาวน์โหลดเป็นไฟล์ .xlsx</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
