// src/app/staff/page.tsx
import { createClient } from '@/lib/supabase/server'
import { formatThaiMoney, formatDate } from '@/lib/utils'
import Link from 'next/link'
import DashboardExport from '@/components/layout/DashboardExport'
import CalendarCard from '@/components/CalendarCard'
import TodayScheduleCard from '@/components/TodayScheduleCard'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user) return <div>ไม่พบ user: {error?.message}</div>

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()

  const nowTH  = new Date(new Date().getTime() + 7 * 60 * 60 * 1000)
  const today  = nowTH.toISOString().split('T')[0]
  const todayStart = today + 'T00:00:00+07:00'
  const todayEnd   = today + 'T23:59:59+07:00'
  const yr = new Date().getFullYear()
  const mo = new Date().getMonth()
  const currentMonth     = `${yr}-${String(mo + 1).padStart(2, '0')}`
  const firstOfMonth     = new Date(yr, mo, 1).toISOString().split('T')[0]
  const firstOfLastMonth = new Date(yr, mo - 1, 1).toISOString().split('T')[0]
  const lastOfLastMonth  = new Date(yr, mo, 0).toISOString().split('T')[0]

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(yr, mo - 5 + i, 1)
    return {
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][d.getMonth()],
    }
  })

  const [
    { data: receiptsThisMonth },
    { data: receiptsLastMonth },
    { data: allActiveEnrollments },
    { data: recentCheckins },
    { data: expensesThisMonth },
    { data: allReceipts6m },
    { data: allExpenses6m },
    { data: monthlyBalance },
    { data: completedEnrollments },
  ] = await Promise.all([
    supabase.from('receipts').select('amount, subject, book_fee, enrollment:enrollments(course:courses(name))').gte('issued_at', firstOfMonth),
    supabase.from('receipts').select('amount').gte('issued_at', firstOfLastMonth).lte('issued_at', lastOfLastMonth),
    // ── ดึง student_id ตรงๆ ด้วย เพื่อใช้ filter waitingRenew ──
    supabase.from('enrollments').select('*, student_id, student:students(nickname,full_name), course:courses(name)').eq('status', 'active'),
    supabase.from('checkins').select('*, student:students(nickname,full_name)').gte('check_in_at', todayStart).lte('check_in_at', todayEnd).order('check_in_at', { ascending: false }).limit(10),
    supabase.from('expenses').select('amount').gte('expense_date', firstOfMonth),
    supabase.from('receipts').select('amount, issued_at').gte('issued_at', last6Months[0].key + '-01'),
    supabase.from('expenses').select('amount, expense_date').gte('expense_date', last6Months[0].key + '-01'),
    supabase.from('monthly_balance').select('carry_over').eq('month', currentMonth).single(),
    // ── completed enrollments พร้อม student_id ตรงๆ ──
    supabase.from('enrollments')
      .select('id, student_id, lessons_used, lessons_total, student:students(nickname, full_name), course:courses(name)')
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),
  ])

  const revenueThisMonth = receiptsThisMonth?.reduce((s: number, r: any) => s + Number(r.amount), 0) ?? 0
  const revenueLastMonth = receiptsLastMonth?.reduce((s: number, r: any) => s + Number(r.amount), 0) ?? 0
  const revenuePct = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : 0
  const expensesTotal   = expensesThisMonth?.reduce((s: number, e: any) => s + Number(e.amount), 0) ?? 0
  const profitThisMonth = revenueThisMonth - expensesTotal

  const carryOver = Number((monthlyBalance as any)?.carry_over ?? 0)
  const cashBalance = carryOver + revenueThisMonth - expensesTotal

  // ── ใช้ student_id (คอลัมน์ตรงๆ) ไม่ใช่ relation ──
  const activeStudentIds = new Set(
    (allActiveEnrollments ?? []).map((e: any) => e.student_id).filter(Boolean)
  )

  // จัดกลุ่มตาม student_id เอาคนที่ไม่มี active เหลือ คนละ 1 แถว
  const completedByStudent = new Map<string, any>()
  ;(completedEnrollments ?? []).forEach((e: any) => {
    const sid = e.student_id
    if (!sid) return
    if (activeStudentIds.has(sid)) return
    if (!completedByStudent.has(sid)) completedByStudent.set(sid, e)
  })
  const waitingRenew = Array.from(completedByStudent.values()).slice(0, 10)

  const chartData = last6Months.map(m => ({
    ...m,
    rev: (allReceipts6m ?? []).filter((r: any) => String(r.issued_at ?? '').slice(0, 7) === m.key).reduce((s: number, r: any) => s + Number(r.amount), 0),
    exp: (allExpenses6m ?? []).filter((e: any) => String(e.expense_date ?? '').slice(0, 7) === m.key).reduce((s: number, e: any) => s + Number(e.amount), 0),
  }))
  const chartMax = Math.max(...chartData.flatMap(d => [d.rev, d.exp]), 1)

  const subjectPalette: Record<string, string> = { chi: '#FB7185', math: '#FBBF24', eng: '#38BDF8', other: '#A78BFA' }
  const subjectLabels:  Record<string, string> = { chi: 'จีน', math: 'คณิต', eng: 'อังกฤษ', other: 'อื่นๆ' }
  const subjectRevenue: Record<string, number> = { chi: 0, math: 0, eng: 0, other: 0 }
  ;(receiptsThisMonth ?? []).forEach((r: any) => {
    const s = String(r.subject ?? (r.enrollment as any)?.course?.name ?? '').toLowerCase()
    const amt = Number(r.amount ?? 0)
    if (s.includes('จีน') || s.includes('chi') || s.includes('hsk') || s.includes('yct')) subjectRevenue.chi += amt
    else if (s.includes('คณิต') || s.includes('math')) subjectRevenue.math += amt
    else if (s.includes('อังกฤษ') || s.includes('eng') || s.includes('phonics')) subjectRevenue.eng += amt
    else subjectRevenue.other += amt
    subjectRevenue.other += Number(r.book_fee ?? 0)
  })
  const pieData = Object.entries(subjectRevenue).filter(([, v]) => v > 0).map(([k, v]) => ({ key: k, label: subjectLabels[k], value: v, color: subjectPalette[k] }))
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0)
  const CX = 50, CY = 50, R_OUT = 46, R_IN = 28
  function polar(r: number, deg: number): [number, number] {
    const a = (deg - 90) * Math.PI / 180
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
  }
  let angleAcc = 0
  const piePaths = pieData.map(d => {
    const start = angleAcc
    const sweep = pieTotal > 0 ? (d.value / pieTotal) * 360 : 0
    let end = start + sweep; if (sweep >= 359.999) end = start + 359.999
    angleAcc = end
    const large = sweep > 180 ? 1 : 0
    const [x1,y1]=polar(R_OUT,start); const [x2,y2]=polar(R_OUT,end)
    const [x3,y3]=polar(R_IN,end);   const [x4,y4]=polar(R_IN,start)
    return { path: `M${x1.toFixed(2)} ${y1.toFixed(2)} A${R_OUT} ${R_OUT} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${x3.toFixed(2)} ${y3.toFixed(2)} A${R_IN} ${R_IN} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}Z`, color: d.color }
  })

  const urgentExpiring = (allActiveEnrollments ?? [])
    .filter((e: any) => (e.lessons_total - e.lessons_used) <= 1)
    .sort((a: any, b: any) => (a.lessons_total - a.lessons_used) - (b.lessons_total - b.lessons_used))
    .slice(0, 8)

  const financeCards = [
    { label: 'รายรับเดือนนี้', icon: '💰', value: formatThaiMoney(revenueThisMonth),
      sub: `${revenuePct >= 0 ? '▲' : '▼'} ${Math.abs(revenuePct)}% จากเดือนที่แล้ว`,
      bg: '#CFE4F5', text: '#1e3a5f', href: '/staff/receipts' },
    { label: 'รายจ่ายเดือนนี้', icon: '📤', value: formatThaiMoney(expensesTotal),
      sub: currentMonth,
      bg: '#D9E5B8', text: '#3a4520', href: '/staff/expenses' },
    { label: profitThisMonth >= 0 ? 'กำไรเดือนนี้' : 'ขาดทุนเดือนนี้', icon: '📈',
      value: `${profitThisMonth >= 0 ? '+' : ''}${formatThaiMoney(profitThisMonth)}`,
      sub: 'รายรับ − รายจ่าย',
      bg: profitThisMonth >= 0 ? '#F5DE8E' : '#F5C2C2',
      text: profitThisMonth >= 0 ? '#5a4a10' : '#5f1e1e',
      href: '/staff/settings' },
    { label: 'เงินคงเหลือ', icon: '🏦', value: formatThaiMoney(cashBalance),
      sub: `ยกมา ${formatThaiMoney(carryOver)}`,
      bg: '#F3CFE0', text: '#5f1e42', href: '/staff/settings' },
  ]

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4 bg-[#FAF7F2] dark:bg-[#1a2030]" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">สวัสดีครับ {profile?.full_name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(new Date(), 'EEEE d MMMM yyyy')}</p>
        </div>
        <DashboardExport />
      </div>

      {/* แถว 1: การ์ดการเงิน + ปฏิทิน */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-2 gap-3 content-start items-start">
          {financeCards.map((c, i) => (
            <Link key={i} href={c.href}
              className="relative overflow-hidden rounded-2xl hover:-translate-y-0.5 transition-transform"
              style={{ background: c.bg, color: c.text, textDecoration: 'none', padding: '14px 16px', display: 'block' }}>
              <span style={{
                position: 'absolute', right: '-14px', bottom: '-14px',
                width: '70px', height: '70px', borderRadius: '999px',
                background: 'rgba(255,255,255,0.28)',
              }} />
              <div style={{
                width: '26px', height: '26px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', marginBottom: '6px',
              }}>{c.icon}</div>
              <div style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.75, fontWeight: 600 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 'clamp(16px,1.8vw,22px)', fontWeight: 800, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.value}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.65, marginTop: '2px' }}>{c.sub}</div>
            </Link>
          ))}
        </div>
        <div className="lg:col-span-1">
          <CalendarCard />
        </div>
      </div>

      {/* แถว 2: กราฟแท่ง + กราฟวงกลม */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-4 shadow-sm bg-white dark:bg-[#242d3f] border border-[#F0E9D8] dark:border-[#2a3245]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">รายรับ-รายจ่าย 6 เดือนล่าสุด</div>
            <div className="flex gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: '#3B9EE0' }}></span>รายรับ</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: '#F5A623' }}></span>รายจ่าย</span>
            </div>
          </div>
          <div className="flex items-end gap-2 md:gap-4 h-40">
            {chartData.map((m, i) => {
              const revH = chartMax > 0 ? Math.round((m.rev / chartMax) * 100) : 0
              const expH = chartMax > 0 ? Math.round((m.exp / chartMax) * 100) : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-0.5 flex-1">
                    <div className="w-5 rounded-t-lg" style={{ height: `${revH}%`, background: '#3B9EE0', minHeight: m.rev > 0 ? '4px' : '0' }} />
                    <div className="w-5 rounded-t-lg" style={{ height: `${expH}%`, background: '#F5A623', minHeight: m.exp > 0 ? '4px' : '0' }} />
                  </div>
                  <div className="text-[10px] text-gray-400">{m.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl p-4 shadow-sm bg-white dark:bg-[#242d3f] border border-[#F0E9D8] dark:border-[#2a3245] flex flex-col">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">รายได้ตามวิชาเดือนนี้</div>
          {pieTotal === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <p className="text-xs text-gray-400">ยังไม่มีข้อมูล</p>
            </div>
          ) : (
            <div className="flex-1 flex items-center gap-3 min-h-0">
              <div className="flex-1 min-w-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: 'auto', maxHeight: '170px' }}>
                  {piePaths.map((p, i) => <path key={i} d={p.path} fill={p.color} />)}
                  <circle cx={CX} cy={CY} r={R_IN - 1} fill="white" className="dark:fill-[#242d3f]" />
                  <text x={CX} y={CY - 4} textAnchor="middle" style={{ fontSize: '5.5px', fill: '#9ca3af' }}>รวมเดือนนี้</text>
                  <text x={CX} y={CY + 6} textAnchor="middle" style={{ fontSize: '8.5px', fontWeight: 700 }} className="fill-gray-800 dark:fill-gray-100">{formatThaiMoney(pieTotal)}</text>
                </svg>
              </div>
              <div className="flex flex-col gap-2.5 flex-shrink-0 w-28">
                {pieData.map(d => (
                  <div key={d.key} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-gray-600 dark:text-gray-300">{d.label}</span>
                    </div>
                    <div className="pl-4 text-sm font-bold text-gray-800 dark:text-gray-100">{Math.round((d.value / pieTotal) * 100)}%</div>
                    <div className="pl-4 text-[10px] text-gray-400">{formatThaiMoney(d.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* แถว 3: เช็กอิน + ตารางเรียน + ใกล้หมดคอร์ส + รอซื้อคอร์สใหม่ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* เช็กอิน */}
        <div className="rounded-2xl p-4 shadow-sm bg-white dark:bg-[#242d3f] border border-[#F0E9D8] dark:border-[#2a3245] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">เช็กอินวันนี้</div>
            <Link href="/staff/checkin" className="text-[11px] font-medium hover:underline" style={{ color: '#3B9EE0' }}>จัดการ →</Link>
          </div>
          {!(recentCheckins ?? []).length ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <p className="text-xs text-gray-400">ยังไม่มีการเช็กอิน</p>
            </div>
          ) : (
            <div className="space-y-1 overflow-y-auto flex-1 max-h-64">
              {(recentCheckins ?? []).map((c: any) => (
                <Link href="/staff/checkin" key={c.id}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-[#FAF7F2] dark:hover:bg-[#2a3245] transition">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#3B9EE0' }}>
                    {(c.student?.nickname || c.student?.full_name || '?').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{c.student?.nickname || c.student?.full_name}</div>
                    <div className="text-[10px] text-gray-400">{new Date(c.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })} น.</div>
                  </div>
                  {!c.check_out_at && <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ตารางเรียนวันนี้ */}
        <TodayScheduleCard />

        {/* ใกล้หมดคอร์ส */}
        <div className="rounded-2xl p-4 shadow-sm bg-white dark:bg-[#242d3f] border border-[#F0E9D8] dark:border-[#2a3245] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">ใกล้หมดคอร์ส</div>
            <Link href="/staff/alerts" className="text-[11px] font-medium hover:underline" style={{ color: '#3B9EE0' }}>ดูทั้งหมด →</Link>
          </div>
          {urgentExpiring.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <p className="text-xs text-gray-400">ไม่มีคอร์สที่ใกล้หมด</p>
            </div>
          ) : (
            <div className="space-y-1 overflow-y-auto flex-1 max-h-64">
              {urgentExpiring.map((e: any) => {
                const remaining = e.lessons_total - e.lessons_used
                const name = e.student?.nickname || e.student?.full_name || '?'
                return (
                  <Link href="/staff/checkin" key={e.id}
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-[#FAF7F2] dark:hover:bg-[#2a3245] transition">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 text-xs font-bold flex-shrink-0">
                      {name.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{e.course?.name}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${remaining <= 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {remaining <= 0 ? 'หมด' : `${remaining} ครั้ง`}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* รอซื้อคอร์สใหม่ */}
        <div className="rounded-2xl p-4 shadow-sm bg-white dark:bg-[#242d3f] border border-[#F0E9D8] dark:border-[#2a3245] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">รอซื้อคอร์สใหม่</div>
              {waitingRenew.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  {waitingRenew.length} คน
                </span>
              )}
            </div>
            <Link href="/staff/students" className="text-[11px] font-medium hover:underline" style={{ color: '#3B9EE0' }}>ดูทั้งหมด →</Link>
          </div>
          {waitingRenew.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <p className="text-xs text-gray-400">ไม่มีนักเรียนที่รอซื้อคอร์สใหม่</p>
            </div>
          ) : (
            <div className="space-y-1 overflow-y-auto flex-1 max-h-64">
              {waitingRenew.map((e: any) => {
                const name = e.student?.nickname || e.student?.full_name || '?'
                return (
                  <Link key={e.id} href="/staff/students"
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-300 text-xs font-bold flex-shrink-0">
                      {name.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{e.course?.name}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 whitespace-nowrap">
                      {e.lessons_total} ครั้ง
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
