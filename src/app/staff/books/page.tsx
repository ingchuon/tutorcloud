'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatThaiMoney, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function BooksPage() {
  const supabase = createClient()
  const [books, setBooks] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showBookForm, setShowBookForm] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState<any>(null)
  const [editBook, setEditBook] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [bookForm, setBookForm] = useState({
    name: '', price: 0, stock: 0, image_url: '',
  })
  const [saleForm, setSaleForm] = useState({
    student_id: '', quantity: 1, payment_method: 'cash', notes: '',
    sold_at: new Date().toISOString().split('T')[0],
  })

  const loadData = useCallback(async () => {
    const [{ data: b }, { data: st }, { data: s }] = await Promise.all([
      supabase.from('books').select('*').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('students').select('id, full_name, nickname').eq('is_active', true).order('nickname'),
      supabase.from('book_sales').select('*, book:books(name), student:students(full_name, nickname)')
        .order('sold_at', { ascending: false }).limit(20),
    ])
    setBooks(b ?? [])
    setStudents(st ?? [])
    setSales(s ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

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
    setShowBookForm(false)
    setEditBook(null)
    setBookForm({ name: '', price: 0, stock: 0, image_url: '' })
    setSaving(false)
    loadData()
  }

  async function handleSale(e: React.FormEvent) {
    e.preventDefault()
    if (!showSaleModal) return
    setSaving(true)
    if (saleForm.quantity > showSaleModal.stock) {
      toast.error('สต็อกไม่พอ'); setSaving(false); return
    }
    const total = showSaleModal.price * saleForm.quantity
    const { error } = await supabase.from('book_sales').insert([{
      book_id: showSaleModal.id,
      student_id: saleForm.student_id || null,
      quantity: saleForm.quantity,
      unit_price: showSaleModal.price,
      total_amount: total,
      payment_method: saleForm.payment_method,
      notes: saleForm.notes || null,
      sold_at: new Date(saleForm.sold_at).toISOString(),
    }])
    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSaving(false); return }

    // ลดสต็อก
    await supabase.from('books').update({ stock: showSaleModal.stock - saleForm.quantity }).eq('id', showSaleModal.id)

    toast.success('บันทึกการขายแล้ว 🎉')
    setShowSaleModal(null)
    setSaleForm({ student_id: '', quantity: 1, payment_method: 'cash', notes: '', sold_at: new Date().toISOString().split('T')[0] })
    setSaving(false)
    loadData()
  }

  function openEdit(book: any) {
    setEditBook(book)
    setBookForm({ name: book.name, price: book.price, stock: book.stock, image_url: book.image_url ?? '' })
    setShowBookForm(true)
  }

  async function deleteBook(id: string) {
    if (!confirm('ลบหนังสือนี้?')) return
    await supabase.from('books').update({ is_active: false }).eq('id', id)
    toast.success('ลบแล้ว')
    loadData()
  }

  const lowStock = books.filter(b => b.stock <= 3)

  if (loading) return <div className="p-6 text-gray-400 dark:text-gray-300 text-center py-20">กำลังโหลด...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold">ขายหนังสือ</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 mt-0.5">{books.length} รายการ</p>
        </div>
        <button onClick={() => { setEditBook(null); setBookForm({ name: '', price: 0, stock: 0, image_url: '' }); setShowBookForm(true) }} className="btn-brand">
          + เพิ่มหนังสือ
        </button>
      </div>

      {/* แจ้งเตือนสต็อกใกล้หมด */}
      {lowStock.length > 0 && (
        <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span>⚠️</span>
            <span className="font-medium text-amber-800 dark:text-amber-300 text-sm">สต็อกใกล้หมด {lowStock.length} รายการ</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(b => (
              <span key={b.id} className="badge badge-amber">{b.name} เหลือ {b.stock} เล่ม</span>
            ))}
          </div>
        </div>
      )}

      {/* รายการหนังสือ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {books.map(book => (
          <div key={book.id} className="card p-4 flex flex-col">
            {book.image_url ? (
              <img src={book.image_url} alt={book.name} className="w-full h-36 object-cover rounded-lg mb-3" />
            ) : (
              <div className="w-full h-36 bg-gray-100 dark:bg-[#2a3245] rounded-lg mb-3 flex items-center justify-center text-4xl">📚</div>
            )}
            <div className="flex-1">
              <div className="font-medium text-sm text-gray-900 dark:text-white mb-1">{book.name}</div>
              <div className="text-brand-600 font-semibold text-sm">{formatThaiMoney(book.price)}</div>
              <div className={`text-xs mt-1 ${book.stock <= 3 ? 'text-red-500 font-medium' : 'text-gray-400 dark:text-gray-300'}`}>
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
              <button onClick={() => openEdit(book)} className="btn-outline btn-sm px-2">✎</button>
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
              <tr><th>วันที่</th><th>หนังสือ</th><th>นักเรียน</th><th>จำนวน</th><th>รวม</th><th>ชำระ</th></tr>
            </thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id} className="table-row-hover">
                  <td className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-300">{formatDate(s.sold_at, 'd MMM yy')}</td>
                  <td className="font-medium text-sm">{s.book?.name}</td>
                  <td className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">{s.student?.nickname || s.student?.full_name || '—'}</td>
                  <td className="text-sm">{s.quantity} เล่ม</td>
                  <td className="font-semibold text-brand-600">{formatThaiMoney(s.total_amount)}</td>
                  <td>
                    <span className="badge badge-blue text-[10px]">
                      {{ cash: 'เงินสด', transfer: 'โอน', promptpay: 'พร้อมเพย์' }[s.payment_method as string] || s.payment_method}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Book Modal */}
      {showBookForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <h2 className="font-semibold">{editBook ? 'แก้ไขหนังสือ' : 'เพิ่มหนังสือใหม่'}</h2>
              <button onClick={() => { setShowBookForm(false); setEditBook(null) }} className="text-gray-400 dark:text-gray-300">✕</button>
            </div>
            <form onSubmit={handleSaveBook} className="p-5 space-y-3.5">
              <div>
                <label className="label">ชื่อหนังสือ *</label>
                <input className="input" required value={bookForm.name}
                  onChange={e => setBookForm({ ...bookForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">ราคา (บาท) *</label>
                  <input type="number" min={0} className="input" required value={bookForm.price}
                    onChange={e => setBookForm({ ...bookForm, price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">จำนวนสต็อก *</label>
                  <input type="number" min={0} className="input" required value={bookForm.stock}
                    onChange={e => setBookForm({ ...bookForm, stock: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="label">URL รูปภาพ</label>
                <input className="input" placeholder="https://..." value={bookForm.image_url}
                  onChange={e => setBookForm({ ...bookForm, image_url: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="btn-brand flex-1 justify-center">
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button type="button" onClick={() => { setShowBookForm(false); setEditBook(null) }} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Modal */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#242d3f] rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100 dark:border-[#3a4560] flex items-center justify-between">
              <div>
                <h2 className="font-semibold">บันทึกการขาย</h2>
                <p className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">{showSaleModal.name} · {formatThaiMoney(showSaleModal.price)}/เล่ม</p>
              </div>
              <button onClick={() => setShowSaleModal(null)} className="text-gray-400 dark:text-gray-300">✕</button>
            </div>
            <form onSubmit={handleSale} className="p-5 space-y-3.5">
              <div>
                <label className="label">นักเรียน (ไม่บังคับ)</label>
                <select className="input" value={saleForm.student_id}
                  onChange={e => setSaleForm({ ...saleForm, student_id: e.target.value })}>
                  <option value="">— ลูกค้าทั่วไป —</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.nickname || s.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">จำนวน (สต็อกเหลือ {showSaleModal.stock} เล่ม)</label>
                <input type="number" min={1} max={showSaleModal.stock} className="input"
                  value={saleForm.quantity}
                  onChange={e => setSaleForm({ ...saleForm, quantity: Number(e.target.value) })} />
              </div>
              <div className="p-3 bg-gray-50 dark:bg-[#1e2533] rounded-lg flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">รวม</span>
                <span className="font-semibold text-brand-600">{formatThaiMoney(showSaleModal.price * saleForm.quantity)}</span>
              </div>
              <div>
                <label className="label">ช่องทางชำระ</label>
                <select className="input" value={saleForm.payment_method}
                  onChange={e => setSaleForm({ ...saleForm, payment_method: e.target.value })}>
                  <option value="cash">เงินสด</option>
                  <option value="transfer">โอนเงิน</option>
                  <option value="promptpay">พร้อมเพย์</option>
                </select>
              </div>
              <div>
                <label className="label">วันที่ขาย</label>
                <input type="date" className="input" value={saleForm.sold_at}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setSaleForm({ ...saleForm, sold_at: e.target.value })} />
              </div>
              <div>
                <label className="label">หมายเหตุ</label>
                <input className="input" placeholder="(ไม่บังคับ)" value={saleForm.notes}
                  onChange={e => setSaleForm({ ...saleForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="btn-brand flex-1 justify-center">
                  {saving ? 'กำลังบันทึก...' : 'ยืนยันการขาย'}
                </button>
                <button type="button" onClick={() => setShowSaleModal(null)} className="btn-outline flex-1 justify-center">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
