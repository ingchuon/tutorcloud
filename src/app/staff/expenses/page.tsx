'use client'
// src/app/staff/expenses/page.tsx
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatThaiMoney } from '@/lib/utils'
import toast from 'react-hot-toast'

const PAYMENT_LABELS: Record<string, string> = {
  transfer: 'โอนเงิน', cash: 'เงินสด', promptpay: 'พร้อมเพย์', credit: 'บัตรเครดิต',
}
const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

export default function ExpensesPage() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [monthlySummary, setMonthlySummary] = useState<any[]>([])
  const [receipts, setReceipts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editExpense, setEditExpense] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [form, setForm] = useState({
    category_id: '', title: '', amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'transfer', notes: '', is_recurring: false, recurring_day: '',
  })

  const loadData = useCallback(async () => {
    const [firstOfMonth, lastOfMonth] = getMonthRange(filterMonth)

    const [{ data: exp }, { data: cats }, { data: recs }] = await Promise.all([
      supabase.from('expenses')
        .select('*, category:expense_categories(name, icon, color)')
        .gte('expense_date', firstOfMonth)
        .lte('expense_date', lastOfMonth)
        .order('expense_date', { ascending: false }),
      supabase.from('expense_categories').select('*').order('sort_order'),
      supabase.from('receipts').select('amount, issued_at').order('issued_at'),
    ])

    setExpenses(exp ?? [])
    setCategories(cats ?? [])
    setReceipts(recs ?? [])

    const summary = buildMonthlySummary(recs ?? [], exp ? await getAllExpenses() : [])
    setMonthlySummary(summary)
    setLoading(false)
  }, [filterMonth])

  async function getAllExpenses() {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    const { data } = await supabase.from('expenses')
      .select('amount, expense_date')
      .gte('expense_date', sixMonthsAgo.toISOString().split('T')[0])
    return data ?? []
  }

  useEffect(() => { loadData() }, [loadData])

  function getMonthRange(month: string) {
    const [y, m] = month.split('-').map(Number)
    const first = `${y}-${String(m).padStart(2, '0')}-01`
    const last = new Date(y, m, 0).toISOString().split('T')[0]
    return [first, last]
  }

  function buildMonthlySummary(recs: any[], exps: any[]) {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const key = `${y}-${String(m).padStart(2,'0')}`
      const income = recs.filter(r => r.issued_at?.startsWith(key)).reduce((s, r) => s + Number(r.amount), 0)
      const expense = exps.filter(e => e.expense_date?.startsWith(key)).reduce((s, e) => s + Number(e.amount), 0)
      months.push({ key, label: `${MONTHS_TH[m-1]} ${y}`, income, expense, profit: income - expense })
    }
    return months
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      category_id: form.category_id || null,
      title: form.title,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      notes: form.notes || null,
      is_recurring: form.is_recurring,
      recurring_day: form.is_recurring && form.recurring_day ? Number(form.recurring_day) : null,
    }
    let error
    if (editExpense) {
      ;({ error } = await supabase.from('expenses').update(payload).eq('id', editExpense.id))
    } else {
      ;({ error } = await supabase.from('expenses').insert([payload]))
    }
    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSaving(false); return }
    toast.success(editExpense ? 'แก้ไขแล้ว' : 'บันทึกรายจ่ายแล้ว')
    setShowForm(false); setEditExpense(null)
    setSaving(false)
    resetForm()
    loadData()
  }

  function resetForm() {
    setForm({ category_id: '', title: '', amount: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'transfer', notes: '', is_recurring: false, recurring_day: '' })
  }

  function openEdit(exp: any) {
    setEditExpense(exp)
    setForm({
      category_id: exp.category_id ?? '',
      title: exp.title,
      amount: String(exp.amount),
      expense_date: exp.expense_date,
      payment_method: exp.payment_method ?? 'transfer',
      notes: exp.notes ?? '',
      is_recurring: exp.is_recurring ?? false,
      recurring_day: exp.recurring_day ? String(exp.recurring_day) : '',
    })
    setShowForm(true)
  }

  async function deleteExpense(id: string) {
    if (!confirm('ลบรายจ่ายนี้?')) return
    await supabase.from('expenses').delete().eq('id', id)
    toast.success('ลบแล้ว')
    loadData()
  }

  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const [firstOfMonth, lastOfMonth] = getMonthRange(filterMonth)
  const totalIncome = receipts
    .filter(r => r.issued_at >= firstOfMonth && r.issued_at <= lastOfMonth)
    .reduce((s, r) => s + Number(r.amount), 0)
  const profit = totalIncome - totalExpense

  const catBreakdown = categories.map(cat => {
    const total = expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0)
    return { ...cat, total }
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const maxBar = Math.max(...monthlySummary.map(m => Math.max(m.income, m.expense)), 1)

  const monthOptions = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    monthOptions.push({ key, label: `${MONTHS_TH[d.getMonth()]} ${d.getFullYear()}` })
  }

  return (
    <div className="p-4 md:p-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">รายจ่าย</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ติดตามค่าใช้จ่ายและกำไรขาดทุน</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto text-sm" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
            {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <button onClick={() => { setEditExpense(null); resetForm(); setShowForm(true) }} className="btn-brand whitespace-nowrap">
            + บันทึกรายจ่าย
          </button>
        </div>
      </div>

      {/* Summary cards — 1 col mobile, 3 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="card p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">รายได้เดือนนี้</div>
          <div className="text-2xl font-semibold text-brand-600">{formatThaiMoney(totalIncome)}</div>
          <div className="text-xs text-gray-400 mt-1">จากใบเสร็จ</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">รายจ่ายเดือนนี้</div>
          <div className="text-2xl font-semibold text-red-500">{formatThaiMoney(totalExpense)}</div>
          <div className="text-xs text-gray-400 mt-1">{expenses.length} รายการ</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">กำไรสุทธิ</div>
          <div className={`text-2xl font-semibold ${profit >= 0 ? 'text-brand-600' : 'text-red-500'}`}>
            {profit >= 0 ? '+' : ''}{formatThaiMoney(profit)}
          </div>
          <div className={`text-xs mt-1 ${profit >= 0 ? 'text-brand-500' : 'text-red-400'}`}>
            {totalIncome > 0 ? Math.round((profit / totalIncome) * 100) : 0}% margin
          </div>
        </div>
      </div>

      {/* 6-month chart */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-medium text-gray-800 dark:text-gray-100">รายรับ-รายจ่าย 6 เดือน</h3>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-400 inline-block"></span>รายได้
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-400 inline-block"></span>รายจ่าย
            </span>
          </div>
        </div>
        <div className="flex items-end gap-2 h-36">
          {monthlySummary.map(m => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex items-end gap-0.5 h-28">
                <div
                  className="flex-1 rounded-t-md bg-blue-400 transition-all"
                  style={{ height: `${Math.round((m.income / maxBar) * 100)}%`, minHeight: m.income > 0 ? '4px' : '0' }}
                  title={`รายได้: ${formatThaiMoney(m.income)}`}
                />
                <div
                  className="flex-1 rounded-t-md bg-red-400 transition-all"
                  style={{ height: `${Math.round((m.expense / maxBar) * 100)}%`, minHeight: m.expense > 0 ? '4px' : '0' }}
                  title={`รายจ่าย: ${formatThaiMoney(m.expense)}`}
                />
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-300 text-center leading-tight w-full truncate">{m.label}</div>
              <div className={`text-[10px] font-medium ${m.profit >= 0 ? 'text-brand-600' : 'text-red-500'}`}>
                {m.profit >= 0 ? '+' : ''}{Math.round(m.profit / 1000)}k
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ตาราง + category — เรียงลงบน mobile, เรียงข้างบน desktop */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* Expense list — มี horizontal scroll บน mobile */}
        <div className="flex-1 card overflow-hidden">
          <div className="card-header">
            <h3 className="font-medium">รายการจ่ายเดือนนี้</h3>
            <span className="badge badge-red">{expenses.length} รายการ</span>
          </div>
          {loading ? (
            <p className="text-center text-gray-400 dark:text-gray-300 py-8 text-sm">กำลังโหลด...</p>
          ) : expenses.length === 0 ? (
            <p className="text-center text-gray-300 py-10 text-sm">ยังไม่มีรายจ่าย</p>
          ) : (
            /* wrapper ให้เลื่อนซ้าย-ขวาบนจอแคบ */
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">วันที่</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">รายการ</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">หมวด</th>
                    <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">จำนวน</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id} className="table-row-hover border-t border-gray-50 dark:border-[#2a3245]">
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(exp.expense_date, 'd MMM')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">{exp.title}</div>
                        {exp.is_recurring && (
                          <span className="text-[10px] text-blue-500">ประจำทุกวันที่ {exp.recurring_day}</span>
                        )}
                        {exp.notes && (
                          <div className="text-xs text-gray-400 dark:text-gray-300 truncate max-w-[200px]">{exp.notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {exp.category ? (
                          <span className="text-xs flex items-center gap-1 whitespace-nowrap">
                            <span>{exp.category.icon}</span>
                            <span style={{ color: exp.category.color }}>{exp.category.name}</span>
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-semibold text-sm text-red-600">-{formatThaiMoney(exp.amount)}</span>
                        <div className="text-[10px] text-gray-400 dark:text-gray-300">
                          {PAYMENT_LABELS[exp.payment_method] ?? exp.payment_method}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(exp)} className="btn-outline btn-sm px-2">แก้</button>
                          <button onClick={() => deleteExpense(exp.id)} className="btn-outline btn-sm px-2 text-red-400 hover:bg-red-50">X</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Category breakdown — เต็มความกว้างบน mobile */}
        <div className="lg:w-64 space-y-4 flex-shrink-0">
          <div className="card p-5">
            <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-4">แยกตามหมวด</h3>
            {catBreakdown.length === 0 ? (
              <p className="text-sm text-gray-300 text-center py-4">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-3">
                {catBreakdown.map(cat => (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-1.5">
                        <span>{cat.icon}</span>
                        <span className="text-gray-700 dark:text-gray-200 text-xs">{cat.name}</span>
                      </span>
                      <span className="font-medium text-xs" style={{ color: cat.color }}>
                        {formatThaiMoney(cat.total)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-[#2a3245] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.round((cat.total / totalExpense) * 100)}%`, background: cat.color }} />
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-300 text-right mt-0.5">
                      {Math.round((cat.total / totalExpense) * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {expenses.some(e => e.is_recurring) && (
            <div className="card p-4">
              <h3 className="font-medium text-gray-800 dark:text-gray-100 text-sm mb-3">รายจ่ายประจำ</h3>
              <div className="space-y-2">
                {expenses.filter(e => e.is_recurring).map(exp => (
                  <div key={exp.id} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-gray-600 dark:text-gray-300 truncate">{exp.title}</span>
                    <div className="text-right flex-shrink-0">
                      <div className="font-medium text-red-500">-{formatThaiMoney(exp.amount)}</div>
                      <div className="text-gray-400 dark:text-gray-300">ทุกวันที่ {exp.recurring_day}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Expense Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between sticky top-0 bg-white dark:bg-[#242d3f]">
              <h2 className="font-semibold">{editExpense ? 'แก้ไขรายจ่าย' : 'บันทึกรายจ่าย'}</h2>
              <button onClick={() => { setShowForm(false); setEditExpense(null) }} className="text-gray-400 dark:text-gray-300">X</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="label">หมวดหมู่</label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map(cat => (
                    <button type="button" key={cat.id}
                      onClick={() => setForm({ ...form, category_id: cat.id })}
                      className={`flex items-center gap-2 p-2.5 rounded-lg text-xs border text-left transition-all ${form.category_id === cat.id ? 'font-semibold border-current' : 'border-gray-200 dark:border-[#3a4560] hover:border-gray-300 text-gray-600 dark:text-gray-300'}`}
                      style={form.category_id === cat.id ? { borderColor: cat.color, color: cat.color, background: cat.color + '15' } : {}}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">ชื่อรายจ่าย *</label>
                <input className="input" required placeholder="เช่น ค่าเช่าห้องเดือนมิถุนายน"
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">จำนวนเงิน (฿) *</label>
                  <input type="number" min="0" step="0.01" className="input" required placeholder="0"
                    value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className="label">วันที่จ่าย</label>
                  <input type="date" className="input" value={form.expense_date}
                    onChange={e => setForm({ ...form, expense_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">ชำระโดย</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PAYMENT_LABELS).map(([v, l]) => (
                    <button type="button" key={v}
                      onClick={() => setForm({ ...form, payment_method: v })}
                      className={`py-1.5 text-xs rounded-lg border transition-colors ${form.payment_method === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-[#242d3f] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#3a4560] hover:border-gray-400'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.is_recurring}
                  onChange={e => setForm({ ...form, is_recurring: e.target.checked })} />
                <span className="text-sm text-gray-700 dark:text-gray-200">รายจ่ายประจำทุกเดือน</span>
              </label>
              {form.is_recurring && (
                <div>
                  <label className="label">จ่ายทุกวันที่</label>
                  <input type="number" min="1" max="31" className="input" placeholder="เช่น 1 หรือ 15"
                    value={form.recurring_day} onChange={e => setForm({ ...form, recurring_day: e.target.value })} />
                </div>
              )}
              <div>
                <label className="label">หมายเหตุ</label>
                <textarea className="input min-h-[60px] resize-none" placeholder="รายละเอียดเพิ่มเติม..."
                  value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="btn-brand flex-1 justify-center">
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditExpense(null) }} className="btn-outline flex-1 justify-center">
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
