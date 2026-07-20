'use client'
// src/app/staff/receipts/page.tsx
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatThaiMoney } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const THAI_MONTHS_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function thaiDateShort(iso: string | null | undefined, sep = ' '): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const mon = THAI_MONTHS_ABBR[d.getMonth()]
  const be = String((d.getFullYear() + 543) % 100).padStart(2, '0')
  return `${day}${sep}${mon}${sep}${be}`
}

// แปลงจำนวนเงินเป็นตัวอักษรภาษาไทย เช่น 4500 -> "สี่พันห้าร้อยบาทถ้วน"
function bahtText(input: number): string {
  const amount = Math.round((Number(input) + Number.EPSILON) * 100) / 100
  const neg = amount < 0
  const abs = Math.abs(amount)
  const baht = Math.floor(abs)
  const satang = Math.round((abs - baht) * 100)
  const digit = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
  const pos = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']
  const readGroup = (n: number): string => {
    let s = ''
    const str = String(n)
    const L = str.length
    for (let i = 0; i < L; i++) {
      const d = +str[i]
      const p = L - i - 1
      if (d === 0) continue
      if (p === 1) s += (d === 1 ? 'สิบ' : d === 2 ? 'ยี่สิบ' : digit[d] + 'สิบ')
      else if (p === 0) s += (d === 1 && L > 1 ? 'เอ็ด' : digit[d])
      else s += digit[d] + pos[p]
    }
    return s
  }
  const readNumber = (n: number): string => {
    if (n === 0) return ''
    let s = ''
    const million = Math.floor(n / 1000000)
    const rest = n % 1000000
    if (million > 0) s += readNumber(million) + 'ล้าน'
    if (rest > 0) s += readGroup(rest)
    return s
  }
  let out = ''
  if (baht > 0) out += readNumber(baht) + 'บาท'
  if (satang > 0) out += readGroup(satang) + 'สตางค์'
  else if (baht > 0) out += 'ถ้วน'
  if (baht === 0 && satang === 0) out = 'ศูนย์บาทถ้วน'
  return (neg ? 'ลบ' : '') + out
}

export default function ReceiptsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [receipts, setReceipts] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editReceipt, setEditReceipt] = useState<any>(null)
  const [form, setForm] = useState({
    enrollment_id: '', payment_method: 'transfer', notes: '',
    issued_at: new Date().toISOString().split('T')[0],
    amount: 0, student_id: '',
  })
  const [preview, setPreview] = useState<any>(null)

  async function loadData() {
    const [{ data: r }, { data: e }, { data: s }] = await Promise.all([
      supabase.from('receipts')
        .select('*, student:students(full_name, nickname, parent_name), enrollment:enrollments(*, course:courses(name, price, total_lessons))')
        .order('issued_at', { ascending: false })
        .limit(50),
      supabase.from('enrollments')
        .select('*, student:students(full_name, nickname), course:courses(name, price, total_lessons)')
        .in('status', ['active', 'completed']),
      supabase.from('students').select('id, full_name, nickname').eq('is_active', true).order('nickname'),
    ])
    setReceipts(r ?? [])
    setEnrollments(e ?? [])
    setStudents(s ?? [])
  }

  useEffect(() => { loadData() }, [])

  function updatePreview(enrollmentId: string) {
    const en = enrollments.find(e => e.id === enrollmentId)
    if (!en) { setPreview(null); return }
    setPreview(en)
    setForm(f => ({
      ...f,
      enrollment_id: enrollmentId,
      amount: en.course?.price ?? 0,
      student_id: en.student_id,
    }))
  }

  function openEdit(r: any) {
    setEditReceipt(r)
    setForm({
      enrollment_id: r.enrollment_id ?? '',
      payment_method: r.payment_method ?? 'transfer',
      notes: r.notes ?? '',
      issued_at: r.issued_at?.split('T')[0] ?? new Date().toISOString().split('T')[0],
      amount: r.amount ?? 0,
      student_id: r.student_id ?? '',
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (editReceipt) {
      const { error } = await supabase.from('receipts').update({
        payment_method: form.payment_method,
        notes: form.notes || null,
        issued_at: form.issued_at,
        amount: form.amount,
      }).eq('id', editReceipt.id)
      if (error) { toast.error('แก้ไขไม่สำเร็จ'); return }
      toast.success('แก้ไขแล้ว')
    } else {
      const en = enrollments.find(x => x.id === form.enrollment_id)
      if (!en) { toast.error('กรุณาเลือกนักเรียน'); return }

      const items = [{
        description: en.course?.name,
        quantity: en.lessons_total,
        unit_price: en.course?.price && en.lessons_total ? en.course.price / en.lessons_total : 0,
        total: en.course?.price ?? 0,
      }]

      const { error } = await supabase.from('receipts').insert({
        enrollment_id: en.id,
        student_id: en.student_id,
        issued_at: form.issued_at,
        amount: form.amount > 0 ? form.amount : (en.course?.price ?? 0),
        payment_method: form.payment_method,
        items,
        notes: form.notes || null,
      })
      if (error) { toast.error('บันทึกไม่สำเร็จ'); return }
      toast.success('ออกใบเสร็จแล้ว')
    }

    router.refresh()
    await fetch('/api/revalidate', { method: 'POST' })
    setShowForm(false)
    setEditReceipt(null)
    setPreview(null)
    setForm({ enrollment_id: '', payment_method: 'transfer', notes: '', issued_at: new Date().toISOString().split('T')[0], amount: 0, student_id: '' })
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('ลบใบเสร็จนี้?')) return
    const { error } = await supabase.from('receipts').delete().eq('id', id)
    if (error) { toast.error('ลบไม่สำเร็จ'); return }
    toast.success('ลบแล้ว')
    loadData()
  }

  function printReceipt(r: any) {
    const win = window.open('', '_blank')
    if (!win) return

    // ----- ข้อมูลสถาบัน (แก้ได้ตรงนี้) -----
    const BIZ = {
      brand: 'Mando House',
      subtitle: 'สถาบันสอนพิเศษภาษาจีน คณิตศาสตร์ ภาษาอังกฤษ',
      address: 'ที่อยู่ : 178/25 ถ.พระยาสัจจา ต.เสม็ด อ.เมือง จ.ชลบุรี 20000',
      tel: 'โทร : 085-0930111 , 097-1727677',
      receiver: 'นลินรัตน์ คงเนาวรัตน์',
      logo: 'https://bebfmbijwezoyhoedgtt.supabase.co/storage/v1/object/public/Mando%20house%20logo/Mando%20house%20logo.png',
    }

    // ----- เตรียมรายการ (รองรับ items ทั้งแบบเก่า {amount,description} และใหม่ {quantity,total}) -----
    const courseName = r.enrollment?.course?.name ?? '—'
    const enrollmentLessons =
      r.enrollment?.lessons_total ?? r.enrollment?.course?.total_lessons ?? null

    const rawItems: any[] =
      Array.isArray(r.items) && r.items.length > 0
        ? r.items
        : courseName !== '—'
          ? [{ description: courseName, total: r.amount }]
          : []

    const itemRows = rawItems.map((it: any, idx: number) => {
      const amount = Number(it.total ?? it.amount ?? 0)
      let desc = it.description ?? '—'
      if (!/ครั้ง/.test(desc)) {
        const sessions = it.quantity != null
          ? Number(it.quantity)
          : (rawItems.length === 1 ? enrollmentLessons : null)
        if (sessions != null) desc = `${desc} ( ${sessions} ครั้ง )`
      }
      return { no: idx + 1, desc, courses: 1, amount, amountText: formatThaiMoney(amount) }
    })

    const total = Number(r.amount || 0)

    // เติมแถวว่างให้ตารางสูงพอสวย (อย่างน้อย 6 แถว)
    const MIN_ROWS = 6
    const emptyCount = Math.max(0, MIN_ROWS - itemRows.length)

    const bodyRows = itemRows.map(row => `
        <tr class="itemrow">
          <td class="c-no">${row.no}</td>
          <td class="c-desc">${row.desc}</td>
          <td class="c-qty">${row.courses}</td>
          <td class="c-amt">${row.amountText}</td>
        </tr>`).join('')
      + Array.from({ length: emptyCount }).map(() => `
        <tr class="itemrow"><td class="c-no">&nbsp;</td><td></td><td></td><td></td></tr>`).join('')

    const pm = r.payment_method
    const chk = (on: boolean) => `<span class="box">${on ? '✓' : ''}</span>`

    const customer = `${r.student?.full_name ?? ''}${r.student?.nickname ? ` (${r.student.nickname})` : ''}`.trim() || '—'

    const html = `<!DOCTYPE html><html lang="th"><head>
      <meta charset="utf-8"><title>ใบเสร็จ ${r.receipt_number ?? ''}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        *{box-sizing:border-box}
        body{font-family:'Sarabun','Noto Sans Thai',sans-serif;color:#000;margin:0 auto;padding:28px 32px;max-width:720px;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .title-row{text-align:center;margin-bottom:12px}
        .title-row .title{font-size:17px;font-weight:700}
        .biz{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:10px}
        .biz .name{color:#1d4ed8;font-size:18px;font-weight:700;margin-bottom:2px}
        .biz .subtitle{font-weight:600;margin-bottom:3px}
        .biz .info{line-height:1.75}
        .biz .logo{width:112px;height:96px;object-fit:contain;flex:none}
        .cust{border-top:1px solid #000;padding-top:8px;display:flex;justify-content:space-between;gap:24px;line-height:2.1}
        .label{color:#000}
        .blue{color:#1d4ed8;font-weight:600}
        .uline{display:inline-block;min-width:150px;border-bottom:1px dotted #666;padding:0 6px}
        .uline.sm{min-width:90px}
        table.items{width:100%;border-collapse:collapse;margin-top:14px}
        table.items th,table.items td{border:1px solid #000;padding:6px 8px}
        table.items thead th{text-align:center;font-weight:700;line-height:1.25}
        table.items thead .en{font-weight:400;font-size:11px;color:#333}
        .c-no{width:9%;text-align:center}
        .c-desc{width:55%}
        .c-qty{width:17%;text-align:center}
        .c-amt{width:19%;text-align:right}
        .itemrow td{height:26px}
        table.totals{width:100%;border-collapse:collapse;border:1px solid #000;border-top:none}
        table.totals td{border:1px solid #000;padding:8px;vertical-align:middle}
        table.totals td:first-child{border-left:none}
        table.totals tr:last-child td{border-bottom:none}
        .t-left{width:60%}
        .t-lbl{width:23%;line-height:1.2}
        .t-lbl .en{font-size:10px;color:#333}
        .t-num{width:17%;text-align:right;white-space:nowrap}
        .words{font-weight:500}
        .chk{display:inline-flex;align-items:center;gap:6px;margin-right:18px}
        .box{width:15px;height:15px;border:1px solid #000;display:inline-flex;align-items:center;justify-content:center;font-size:12px;line-height:1;color:#1d4ed8}
        .sign{display:flex;justify-content:space-around;margin-top:44px;text-align:center}
        .sign .signname{min-height:18px;margin-bottom:4px}
        .sign .line{width:190px;border-bottom:1px dotted #666;height:1px;margin-bottom:6px}
        @media print{@page{size:A4;margin:14mm}body{padding:0}}
      </style></head><body>

      <div class="title-row">
        <span class="title">ใบเสร็จรับเงิน (Receipt)</span>
      </div>

      <div class="biz">
        <div>
          <div class="name">${BIZ.brand}</div>
          <div class="subtitle">${BIZ.subtitle}</div>
          <div class="info">
            ${BIZ.address}<br>
            ${BIZ.tel}
          </div>
        </div>
        <img class="logo" src="${BIZ.logo}" alt="Mando House" />
      </div>

      <div class="cust">
        <div style="flex:1">
          <div><span class="label">ชื่อผู้รับบริการ/Customer :</span> <span class="blue">${customer}</span></div>
          <div><span class="label">ที่อยู่/Address :</span> <span class="uline"></span></div>
          <div><span class="label">เลขประจำตัวผู้เสียภาษี/Tax ID :</span> <span class="uline"></span></div>
        </div>
        <div style="text-align:right;white-space:nowrap">
          <div><span class="label">วันที่/Date :</span> <span class="blue">${thaiDateShort(r.issued_at)}</span></div>
          <div><span class="label">เลขที่/No. :</span> <span class="blue">${r.receipt_number ?? '—'}</span></div>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th class="c-no">ลำดับที่<br><span class="en">Items</span></th>
            <th class="c-desc">รายละเอียดคอร์ส<br><span class="en">Description</span></th>
            <th class="c-qty">จำนวนคอร์ส<br><span class="en">No.of Course</span></th>
            <th class="c-amt">จำนวนเงิน<br><span class="en">Amount</span></th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>

      <table class="totals">
        <tr>
          <td class="t-left words">ตัวอักษร . ${bahtText(total)}</td>
          <td class="t-lbl">จำนวนเงินรวม<br><span class="en">Total Amount</span></td>
          <td class="t-num">${formatThaiMoney(total)}</td>
        </tr>
        <tr>
          <td class="t-left">
            <span class="chk">${chk(pm === 'cash')} เงินสด</span>
            <span class="chk">${chk(pm === 'transfer')} เงินโอน</span>
            <span class="chk">${chk(pm === 'promptpay')} พร้อมเพย์</span>
            ธนาคาร <span class="uline sm"></span>
            ${r.notes ? `<div style="font-size:11px;color:#666;margin-top:4px">หมายเหตุ: ${r.notes}</div>` : ''}
          </td>
          <td class="t-lbl">จำนวนเงินสุทธิ<br><span class="en">Total net</span></td>
          <td class="t-num" style="font-weight:700">${formatThaiMoney(total)}</td>
        </tr>
      </table>

      <div class="sign">
        <div><div class="signname">${BIZ.receiver}</div><div class="line"></div>ผู้รับเงิน</div>
        <div><div class="signname">${thaiDateShort(r.issued_at, '-')}</div><div class="line"></div>วันที่</div>
      </div>

      <script>
        (function(){
          function go(){ try { window.focus(); window.print(); } catch (e) {} }
          var img = document.querySelector('img');
          if (img && !img.complete) {
            img.addEventListener('load', go);
            img.addEventListener('error', go);
            setTimeout(go, 3000);
          } else {
            setTimeout(go, 300);
          }
        })();
      </script>
      </body></html>`

    win.document.write(html)
    win.document.close()
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">ใบเสร็จ</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 mt-0.5">ออกและจัดการใบเสร็จรับเงิน · {receipts.length} รายการ</p>
        </div>
        <button onClick={() => { setEditReceipt(null); setPreview(null); setForm({ enrollment_id: '', payment_method: 'transfer', notes: '', issued_at: new Date().toISOString().split('T')[0], amount: 0, student_id: '' }); setShowForm(true) }} className="btn-brand">
          + ออกใบเสร็จ
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>นักเรียน</th>
              <th>คอร์ส / รายการ</th>
              <th>วันที่</th>
              <th>จำนวนเงิน</th>
              <th>ชำระโดย</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {receipts.map(r => (
              <tr key={r.id} className="table-row-hover">
                <td className="font-mono text-xs text-gray-600 dark:text-gray-300">{r.receipt_number ?? '—'}</td>
                <td className="font-medium text-sm">{r.student?.nickname || r.student?.full_name || '—'}</td>
                <td className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">
                  {r.enrollment?.course?.name ?? r.items?.[0]?.description ?? r.subject ?? '—'}
                </td>
                <td className="text-sm">{formatDate(r.issued_at)}</td>
                <td className="font-semibold text-brand-600">{formatThaiMoney(r.amount)}</td>
                <td>
                  <span className="badge badge-blue text-[10px]">
                    {{ transfer: 'โอน', cash: 'เงินสด', promptpay: 'พร้อมเพย์' }[r.payment_method as string] || r.payment_method}
                  </span>
                </td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => printReceipt(r)} className="btn-outline btn-sm px-2">🖨</button>
                    <button onClick={() => openEdit(r)} className="btn-outline btn-sm px-2">✎</button>
                    <button onClick={() => handleDelete(r.id)} className="btn-outline btn-sm px-2 text-red-400 hover:bg-red-50">✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {receipts.length === 0 && (
              <tr><td colSpan={7} className="text-center text-gray-400 dark:text-gray-300 py-8">ยังไม่มีใบเสร็จ</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-2xl shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <h2 className="font-semibold">{editReceipt ? 'แก้ไขใบเสร็จ' : 'ออกใบเสร็จใหม่'}</h2>
              <button onClick={() => { setShowForm(false); setEditReceipt(null); setPreview(null) }} className="text-gray-400 dark:text-gray-300">✕</button>
            </div>
            <div className={editReceipt ? '' : 'grid grid-cols-2 divide-x divide-gray-100'}>
              <form onSubmit={handleSave} className="p-5 space-y-4">
                {!editReceipt && (
                  <div>
                    <label className="label">นักเรียน *</label>
                    <select className="input" required value={form.enrollment_id}
                      onChange={e => updatePreview(e.target.value)}>
                      <option value="">— เลือกนักเรียน —</option>
                      {enrollments.map(en => (
                        <option key={en.id} value={en.id}>
                          {en.student?.nickname || en.student?.full_name} – {en.course?.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {editReceipt && (
                  <div>
                    <label className="label">จำนวนเงิน (บาท)</label>
                    <input type="number" min={0} className="input" value={form.amount}
                      onChange={e => setForm({...form, amount: Number(e.target.value)})} />
                  </div>
                )}
                {!editReceipt && form.enrollment_id && (
                  <div>
                    <label className="label">จำนวนเงิน (บาท)</label>
                    <input type="number" min={0} className="input" value={form.amount}
                      onChange={e => setForm({...form, amount: Number(e.target.value)})} />
                  </div>
                )}
                <div>
                  <label className="label">วันที่ออกใบเสร็จ</label>
                  <input type="date" className="input" value={form.issued_at}
                    onChange={e => setForm({...form, issued_at: e.target.value})} />
                </div>
                <div>
                  <label className="label">ชำระโดย</label>
                  <select className="input" value={form.payment_method}
                    onChange={e => setForm({...form, payment_method: e.target.value})}>
                    <option value="transfer">โอนเงิน</option>
                    <option value="cash">เงินสด</option>
                    <option value="promptpay">พร้อมเพย์</option>
                  </select>
                </div>
                <div>
                  <label className="label">หมายเหตุ</label>
                  <input className="input" placeholder="(ไม่บังคับ)" value={form.notes}
                    onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="btn-brand flex-1 justify-center">
                    {editReceipt ? 'บันทึก' : 'ออกใบเสร็จ'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditReceipt(null); setPreview(null) }} className="btn-outline flex-1 justify-center">ยกเลิก</button>
                </div>
              </form>

              {!editReceipt && (
                <div className="p-5">
                  <p className="text-xs text-gray-400 dark:text-gray-300 mb-4 text-center">ตัวอย่างใบเสร็จ</p>
                  {preview ? (
                    <div className="border border-gray-100 dark:border-[#3a4560] rounded-xl p-5 font-mono text-sm">
                      <div className="text-center mb-2">
                        <div className="text-base font-bold">Mando House</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-300 leading-relaxed">
                          สถาบันสอนพิเศษภาษาจีน คณิตศาสตร์ ภาษาอังกฤษ<br/>
                          085-0930111 ， 097-1727677
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-300 mt-1">ใบเสร็จรับเงิน</div>
                      </div>
                      <div className="space-y-1.5 text-xs border-t border-gray-100 dark:border-[#3a4560] pt-3">
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 dark:text-gray-300">นักเรียน</span><span>{preview.student?.nickname || preview.student?.full_name}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 dark:text-gray-300">คอร์ส</span><span>{preview.course?.name ?? '—'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 dark:text-gray-300">จำนวน</span><span>{preview.lessons_total} ครั้ง</span></div>
                      </div>
                      <div className="flex justify-between font-bold text-sm mt-3 pt-3 border-t border-gray-200 dark:border-[#3a4560]">
                        <span>รวม</span>
                        <span className="text-brand-600">{formatThaiMoney(form.amount > 0 ? form.amount : (preview.course?.price ?? 0))}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-200 dark:border-[#3a4560] rounded-xl h-40 flex items-center justify-center text-gray-300 text-sm">
                      เลือกนักเรียนเพื่อดูตัวอย่าง
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
