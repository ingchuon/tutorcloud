'use client'
// src/app/staff/settings/page.tsx  — Finance Hub
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatThaiMoney, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

type MonthOption = { value: string; label: string }

function buildMonthOptions(): MonthOption[] {
  const opts: MonthOption[] = [{ value: '', label: 'ทุกเดือน' }]
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
    opts.push({ value: val, label })
  }
  return opts
}

export default function FinancePage() {
  const supabase = createClient()
  const monthOptions = buildMonthOptions()
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [tab, setTab] = useState<'overview' | 'receipts' | 'expenses' | 'settings'>('overview')

  // ข้อมูลการเงิน
  const [receipts, setReceipts] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // settings
  const [saving, setSaving] = useState(false)
  const [settingsForm, setSettingsForm] = useState({ carry_over: 0, total_carry_over: 0 })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [
      { data: rec },
      { data: exp },
      { data: bal },
    ] = await Promise.all([
      supabase.from('receipts')
        .select('id, receipt_number, issued_at, amount, payment_method, subject, book_fee, student:students(nickname, full_name), enrollment:enrollments(course:courses(name))')
        .order('issued_at', { ascending: false }),
      supabase.from('expenses')
        .select('id, title, amount, expense_date, payment_method, category:expense_categories(name, icon, color)')
        .order('expense_date', { ascending: false }),
      supabase.from('monthly_balance').select('carry_over, total_carry_over').eq('month', currentMonth).single(),
    ])
    setReceipts(rec ?? [])
    setExpenses(exp ?? [])
    if (bal) setSettingsForm({ carry_over: bal.carry_over ?? 0, total_carry_over: bal.total_carry_over ?? 0 })
    setLoading(false)
  }, [currentMonth])

  useEffect(() => { loadData() }, [loadData])

  // กรองตามเดือน
  const filteredReceipts = selectedMonth
    ? receipts.filter(r => String(r.issued_at ?? '').slice(0, 7) === selectedMonth)
    : receipts
  const filteredExpenses = selectedMonth
    ? expenses.filter(e => String(e.expense_date ?? '').slice(0, 7) === selectedMonth)
    : expenses

  // ยอดรวม
  const totalRevenue      = filteredReceipts.reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenses     = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const profit            = totalRevenue - totalExpenses
  const totalAllRevenue = settingsForm.total_carry_over + totalRevenue
  const bookRevenue       = filteredReceipts.reduce((s, r) => s + Number(r.book_fee ?? 0), 0)
  const courseRevenue     = totalRevenue - bookRevenue

  // รายได้แยกวิชา
  const subjectMap: Record<string, number> = {}
  filteredReceipts.forEach(r => {
    const s = String(r.subject ?? (r.enrollment as any)?.course?.name ?? '').toLowerCase()
    const amt = Number(r.amount ?? 0)
    const key =
      s.includes('จีน') || s.includes('chi') || s.includes('hsk') || s.includes('yct') ? 'ภาษาจีน' :
      s.includes('คณิต') || s.includes('math') ? 'คณิตศาสตร์' :
      s.includes('อังกฤษ') || s.includes('eng') || s.includes('phonics') ? 'ภาษาอังกฤษ' : 'อื่นๆ'
    subjectMap[key] = (subjectMap[key] ?? 0) + amt
  })
  const subjectColors: Record<string, string> = { 'ภาษาจีน': '#FB7185', 'คณิตศาสตร์': '#FBBF24', 'ภาษาอังกฤษ': '#38BDF8', 'อื่นๆ': '#A78BFA' }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('monthly_balance').upsert({
      month: currentMonth,
      carry_over: settingsForm.carry_over,
      total_carry_over: settingsForm.total_carry_over,
    }, { onConflict: 'month' })
    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSaving(false); return }
    toast.success('บันทึกแล้ว ✅')
    setSaving(false)
  }

  const tabClass = (t: string) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === t ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a3245]'}`

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">💰 Finance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ภาพรวมการเงินทั้งหมด</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">เดือน:</label>
          <select
            className="input text-sm py-1.5 w-40"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'รายรับ',           value: totalRevenue,    color: 'from-teal-500 to-teal-400',    icon: '📥' },
          { label: 'รายจ่าย',          value: totalExpenses,   color: 'from-rose-500 to-rose-400',    icon: '📤' },
          { label: profit >= 0 ? 'กำไร' : 'ขาดทุน', value: profit, color: profit >= 0 ? 'from-emerald-500 to-emerald-400' : 'from-red-600 to-red-400', icon: profit >= 0 ? '📈' : '📉' },
          { label: 'รายได้ทั้งหมด',   value: totalAllRevenue, color: 'from-violet-500 to-violet-400', icon: '💰' },
        ].map((c, i) => (
          <div key={i} className={`rounded-2xl p-4 text-white bg-gradient-to-br ${c.color} shadow-sm`}>
            <div className="text-xs opacity-90 mb-1">{c.icon} {c.label}</div>
            <div className="text-lg md:text-xl font-bold leading-tight">{c.value >= 0 ? '' : ''}{formatThaiMoney(Math.abs(c.value))}</div>
            {i === 2 && <div className="text-[10px] opacity-75 mt-1">รายรับ − รายจ่าย</div>}
            {i === 3 && <div className="text-[10px] opacity-75 mt-1">ทุกใบเสร็จในระบบ</div>}
          </div>
        ))}
      </div>

      {/* Sub cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">📚 รายรับค่าคอร์ส</div>
          <div className="text-lg font-semibold text-brand-600">{formatThaiMoney(courseRevenue)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">📖 รายรับขายหนังสือ</div>
          <div className="text-lg font-semibold text-brand-600">{formatThaiMoney(bookRevenue)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">↩️ ยอดยกมาเดือนนี้</div>
          <div className="text-lg font-semibold text-brand-600">{formatThaiMoney(settingsForm.carry_over)}</div>
        </div>
      </div>

      {/* รายได้แยกวิชา */}
      {Object.keys(subjectMap).length > 0 && (
        <div className="card p-5 mb-6">
          <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-3">รายได้แยกตามวิชา</h3>
          <div className="space-y-2.5">
            {Object.entries(subjectMap).sort((a, b) => b[1] - a[1]).map(([key, val]) => (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300">{key}</span>
                  <span className="font-semibold" style={{ color: subjectColors[key] }}>{formatThaiMoney(val)} · {totalRevenue > 0 ? Math.round((val / totalRevenue) * 100) : 0}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${totalRevenue > 0 ? Math.round((val / totalRevenue) * 100) : 0}%`, background: subjectColors[key] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {(['overview', 'receipts', 'expenses', 'settings'] as const).map(t => (
          <button key={t} className={tabClass(t)} onClick={() => setTab(t)}>
            {{ overview: '📊 สรุป', receipts: '📥 รายรับ', expenses: '📤 รายจ่าย', settings: '⚙️ ตั้งค่า' }[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-12">กำลังโหลด...</p>
      ) : (
        <>
          {/* TAB: overview */}
          {tab === 'overview' && (
            <div className="card divide-y divide-gray-100 dark:divide-[#2a3245]">
              {filteredReceipts.length === 0 && filteredExpenses.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">ไม่มีข้อมูลช่วงนี้</p>
              ) : (
                [...filteredReceipts.slice(0, 5).map(r => ({ type: 'in', date: r.issued_at, label: r.student?.nickname || r.student?.full_name || '—', sub: (r.enrollment as any)?.course?.name || '—', amount: Number(r.amount) })),
                 ...filteredExpenses.slice(0, 5).map(e => ({ type: 'out', date: e.expense_date, label: e.title, sub: (e.category as any)?.name || '—', amount: Number(e.amount) }))]
                .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
                .slice(0, 10)
                .map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${item.type === 'in' ? 'bg-teal-100 dark:bg-teal-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                        {item.type === 'in' ? '📥' : '📤'}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{item.label}</div>
                        <div className="text-xs text-gray-400">{item.sub} · {formatDate(item.date, 'd MMM yy')}</div>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${item.type === 'in' ? 'text-teal-600' : 'text-rose-500'}`}>
                      {item.type === 'in' ? '+' : '-'}{formatThaiMoney(item.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: receipts */}
          {tab === 'receipts' && (
            <div className="card">
              <div className="p-4 border-b border-gray-100 dark:border-[#2a3245] flex justify-between items-center">
                <span className="text-sm font-medium">{filteredReceipts.length} รายการ · {formatThaiMoney(totalRevenue)}</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-[#2a3245]">
                {filteredReceipts.length === 0 ? (
                  <p className="text-center text-gray-400 py-10 text-sm">ไม่มีรายรับช่วงนี้</p>
                ) : filteredReceipts.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {r.student?.nickname || r.student?.full_name || '—'}
                        <span className="ml-2 text-xs text-gray-400">{r.receipt_number}</span>
                      </div>
                      <div className="text-xs text-gray-400">{(r.enrollment as any)?.course?.name || '—'} · {formatDate(r.issued_at, 'd MMM yy')}</div>
                    </div>
                    <span className="text-sm font-semibold text-teal-600">+{formatThaiMoney(Number(r.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: expenses */}
          {tab === 'expenses' && (
            <div className="card">
              <div className="p-4 border-b border-gray-100 dark:border-[#2a3245] flex justify-between items-center">
                <span className="text-sm font-medium">{filteredExpenses.length} รายการ · {formatThaiMoney(totalExpenses)}</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-[#2a3245]">
                {filteredExpenses.length === 0 ? (
                  <p className="text-center text-gray-400 py-10 text-sm">ไม่มีรายจ่ายช่วงนี้</p>
                ) : filteredExpenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{(e.category as any)?.icon ?? '💸'}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{e.title}</div>
                        <div className="text-xs text-gray-400">{(e.category as any)?.name || '—'} · {formatDate(e.expense_date, 'd MMM yy')}</div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-rose-500">-{formatThaiMoney(Number(e.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: settings */}
          {tab === 'settings' && (
            <div className="card p-5 max-w-lg">
              <h2 className="font-medium mb-4">ตั้งค่ายอดเงิน</h2>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="label">↩️ ยอดยกมาจากเดือนที่แล้ว (บาท)</label>
                  <input type="number" min={0} step={0.01} className="input"
                    value={settingsForm.carry_over}
                    onChange={e => setSettingsForm(f => ({ ...f, carry_over: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">เงินคงเหลือที่ยกมาจากเดือนก่อน</p>
                </div>
                <div>
                  <label className="label">💰 รายได้ทั้งหมดตั้งแต่เปิดกิจการ (บาท)</label>
                  <input type="number" min={0} step={0.01} className="input"
                    value={settingsForm.total_carry_over}
                    onChange={e => setSettingsForm(f => ({ ...f, total_carry_over: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">ใส่ยอดรวมก่อนเริ่มใช้ระบบ เช่น 542,294</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-[#1e2533] rounded-xl text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between"><span>ยอดยกมา</span><span className="font-medium">{formatThaiMoney(settingsForm.carry_over)}</span></div>
                  <div className="flex justify-between"><span>รายได้ทั้งหมด</span><span className="font-medium">{formatThaiMoney(settingsForm.total_carry_over)}</span></div>
                </div>
                <button type="submit" disabled={saving} className="btn-brand w-full justify-center">
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )
}
