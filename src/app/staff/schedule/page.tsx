'use client'
// src/app/staff/schedule/page.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'

type GCalEvent = {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  account: string
  email: string
  location: string
  meetLink: string
  cancelled: boolean
}

type AccountInfo = {
  account: string
  email: string
  ok: boolean
  count: number
}

type ViewMode = 'day' | 'week' | 'month'

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

const ACCOUNT_META: Record<string, { label: string; color: string }> = {
  main:  { label: 'ครูในสถาบัน', color: '#1C3A2A' },
  aom:   { label: 'ครูออม',      color: '#E8A020' },
  nalin: { label: 'ครูบี',       color: '#7C6FF7' },
}

const B_PRIMARY = '#1C3A2A'
const B_GOLD    = '#E8A020'
const B_CREAM   = '#F5F0E8'
const B_BORDER  = '#E8E2D8'
const B_TODAY_BG = 'rgba(28,58,42,0.07)'

function metaOf(tag: string) {
  return ACCOUNT_META[tag] ?? { label: tag, color: '#9CA3AF' }
}

function hexAlpha(hex: string, opacity: string) {
  return hex + opacity
}

function startOfDay(date: Date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0); return d
}
function startOfWeek(date: Date) {
  const d = startOfDay(date); d.setDate(d.getDate() - d.getDay()); return d
}
function startOfMonth(date: Date) {
  const d = startOfDay(date); d.setDate(1); return d
}
function addDays(date: Date, n: number) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d
}
function addMonths(date: Date, n: number) {
  const d = new Date(date); d.setDate(1); d.setMonth(d.getMonth() + n); return d
}
function ymd(date: Date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0')
}
function fmtTime(iso: string) {
  const d = new Date(iso)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}
function fmtThaiDate(date: Date) {
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}
function fmtThaiMonth(date: Date) {
  return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
}
function fmtThaiFull(date: Date) {
  return date.toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const navBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: '8px',
  background: '#ffffff',
  border: '1px solid ' + B_BORDER,
  color: B_PRIMARY,
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
}

export default function SchedulePage() {
  const [view, setView]         = useState<ViewMode>('week')
  const [cursor, setCursor]     = useState<Date>(() => startOfDay(new Date()))
  const [events, setEvents]     = useState<GCalEvent[]>([])
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [hidden, setHidden]     = useState<string[]>([])
  const [loading, setLoading]   = useState(true)
  const [errMsg, setErrMsg]     = useState('')

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const v = sp.get('view')
    const d = sp.get('date')
    if (v === 'day' || v === 'week' || v === 'month') setView(v)
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const parsed = new Date(d + 'T00:00:00')
      if (!isNaN(parsed.getTime())) setCursor(parsed)
    }
  }, [])

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === 'day') {
      const s = startOfDay(cursor)
      return { rangeStart: s, rangeEnd: addDays(s, 1) }
    }
    if (view === 'week') {
      const s = startOfWeek(cursor)
      return { rangeStart: s, rangeEnd: addDays(s, 7) }
    }
    const gs = startOfWeek(startOfMonth(cursor))
    return { rangeStart: gs, rangeEnd: addDays(gs, 42) }
  }, [view, cursor])

  const load = useCallback(async () => {
    setLoading(true); setErrMsg('')
    try {
      const p = new URLSearchParams({ from: rangeStart.toISOString(), to: rangeEnd.toISOString() })
      const res = await fetch('/api/calendar/events?' + p.toString(), { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) { setErrMsg(json?.error ?? 'โหลดข้อมูลไม่สำเร็จ'); setEvents([]); setAccounts([]); return }
      setEvents(json.events ?? [])
      setAccounts(json.accounts ?? [])
    } catch { setErrMsg('เชื่อมต่อ API ไม่ได้') }
    finally { setLoading(false) }
  }, [rangeStart, rangeEnd])

  useEffect(() => { load() }, [load])

  const toggleAccount = (tag: string) =>
    setHidden(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const visibleEvents = useMemo(() => events.filter(e => !hidden.includes(e.account)), [events, hidden])

  const byDay = useMemo(() => {
    const map: Record<string, GCalEvent[]> = {}
    for (const e of visibleEvents) {
      const key = e.allDay ? e.start.slice(0, 10) : ymd(new Date(e.start))
      if (!map[key]) map[key] = []
      map[key].push(e)
    }
    return map
  }, [visibleEvents])

  const todayKey = ymd(new Date())

  const step = (dir: number) => {
    if (view === 'day')  setCursor(addDays(cursor, dir))
    else if (view === 'week') setCursor(addDays(cursor, dir * 7))
    else setCursor(addMonths(cursor, dir))
  }

  const goToday = () => setCursor(startOfDay(new Date()))
  const openDay = (date: Date) => { setCursor(startOfDay(date)); setView('day') }

  const headerLabel = () => {
    if (view === 'day') return fmtThaiFull(cursor)
    if (view === 'week') {
      const s = startOfWeek(cursor)
      return fmtThaiDate(s) + ' \u2013 ' + fmtThaiDate(addDays(s, 6))
    }
    return fmtThaiMonth(cursor)
  }

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: B_CREAM }}>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" style={{ color: B_PRIMARY }}>
              ตารางสอน
            </h1>
            <p className="text-sm text-gray-500">
              {headerLabel()}
              {' \u00b7 '}
              <a href="/staff/schedule/connect" className="underline" style={{ color: B_GOLD }}>
                เชื่อมต่อบัญชี
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View switcher */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid ' + B_BORDER }}>
              {(['day', 'week', 'month'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="px-3 py-2 text-sm font-medium"
                  style={view === v
                    ? { background: B_PRIMARY, color: '#ffffff' }
                    : { background: '#ffffff', color: B_PRIMARY }}
                >
                  {v === 'day' ? 'วัน' : v === 'week' ? 'สัปดาห์' : 'เดือน'}
                </button>
              ))}
            </div>

            <button onClick={() => step(-1)} style={navBtnStyle}>&#8592;</button>
            <button onClick={goToday} style={navBtnStyle}>วันนี้</button>
            <button onClick={() => step(1)} style={navBtnStyle}>&#8594;</button>
            <button
              onClick={load}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: B_GOLD, color: '#ffffff' }}
            >
              รีเฟรช
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {accounts.map(a => {
            const m = metaOf(a.account)
            const off = hidden.includes(a.account)
            return (
              <button
                key={a.account}
                onClick={() => toggleAccount(a.account)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                style={{ opacity: off ? 0.4 : 1, background: '#ffffff', border: '1px solid ' + B_BORDER, color: B_PRIMARY }}
              >
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: m.color }} />
                <span>{m.label}</span>
                <span className="text-gray-400 text-xs">({a.count})</span>
                {!a.ok && <span className="text-red-500 text-xs">token เสีย</span>}
              </button>
            )
          })}
        </div>

        {errMsg && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#FEF2F2', color: '#DC2626' }}>
            {errMsg} &mdash;{' '}
            <a href="/staff/schedule/connect" className="underline">ไปหน้าเชื่อมต่อ Google</a>
          </div>
        )}

        {loading && (
          <div className="text-center py-10 text-sm" style={{ color: B_PRIMARY }}>กำลังโหลด...</div>
        )}

        {/* DAY VIEW */}
        {!loading && view === 'day' && (
          <DayView date={cursor} events={byDay[ymd(cursor)] ?? []} />
        )}

        {/* WEEK VIEW */}
        {!loading && view === 'week' && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)).map((day, i) => {
              const key = ymd(day)
              const list = byDay[key] ?? []
              const isToday = key === todayKey
              return (
                <div
                  key={key}
                  className="rounded-xl p-3 min-h-[140px]"
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid ' + (isToday ? B_PRIMARY : B_BORDER),
                    boxShadow: isToday ? '0 0 0 2px ' + hexAlpha(B_PRIMARY, '22') : undefined,
                  }}
                >
                  <button
                    onClick={() => openDay(day)}
                    className="w-full text-left mb-2 pb-2"
                    style={{ borderBottom: '1px solid ' + B_BORDER }}
                  >
                    <div className="text-sm font-semibold" style={{ color: isToday ? B_PRIMARY : '#374151' }}>
                      {DAYS[i]}
                    </div>
                    <div className="text-xs text-gray-400">{fmtThaiDate(day)}</div>
                  </button>
                  {list.length === 0 && <div className="text-xs text-gray-400 py-2">ไม่มีคลาส</div>}
                  <div className="space-y-2">
                    {list.map(e => <EventChip key={e.id} e={e} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* MONTH VIEW */}
        {!loading && view === 'month' && (
          <div className="rounded-xl p-2 md:p-3" style={{ background: '#ffffff', border: '1px solid ' + B_BORDER }}>
            <div className="grid grid-cols-7 mb-1">
              {DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: B_PRIMARY }}>
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 42 }, (_, i) => addDays(startOfWeek(startOfMonth(cursor)), i)).map(day => {
                const key = ymd(day)
                const list = byDay[key] ?? []
                const inMonth = day.getMonth() === cursor.getMonth()
                const isToday = key === todayKey
                return (
                  <button
                    key={key}
                    onClick={() => openDay(day)}
                    className="rounded-lg p-1.5 min-h-[68px] md:min-h-[92px] text-left transition"
                    style={{
                      opacity: inMonth ? 1 : 0.35,
                      background: isToday ? B_TODAY_BG : 'transparent',
                      border: '1px solid ' + (isToday ? B_PRIMARY : 'transparent'),
                    }}
                  >
                    <div className="text-xs font-medium mb-1" style={{ color: isToday ? B_PRIMARY : '#374151' }}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {list.slice(0, 2).map(e => {
                        const m = metaOf(e.account)
                        return (
                          <div
                            key={e.id}
                            className="text-[9px] md:text-[10px] truncate rounded px-1"
                            style={{
                              background: hexAlpha(m.color, '22'),
                              color: m.color,
                              textDecoration: e.cancelled ? 'line-through' : undefined,
                            }}
                          >
                            {e.allDay ? '' : fmtTime(e.start) + ' '}
                            {e.title}
                          </div>
                        )
                      })}
                      {list.length > 2 && (
                        <div className="text-[9px] text-gray-400 px-1">+{list.length - 2} คลาส</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!loading && visibleEvents.length === 0 && !errMsg && view !== 'month' && (
          <div className="text-center py-8 text-sm text-gray-400">ไม่มี event ในช่วงนี้</div>
        )}
      </div>
    </div>
  )
}

/* ── sub components ── */

function EventChip({ e }: { e: GCalEvent }) {
  const m = metaOf(e.account)
  return (
    <div
      className="rounded-lg p-2 text-xs"
      style={{
        background: hexAlpha(m.color, '18'),
        borderLeft: '3px solid ' + m.color,
        opacity: e.cancelled ? 0.5 : 1,
      }}
    >
      <div className="font-medium text-gray-800" style={e.cancelled ? { textDecoration: 'line-through' } : undefined}>
        {e.title}
      </div>
      <div className="text-gray-500 mt-0.5">
        {e.allDay ? 'ทั้งวัน' : fmtTime(e.start) + ' - ' + fmtTime(e.end)}
      </div>
      <div className="text-[10px] mt-0.5" style={{ color: m.color }}>{m.label}</div>
      {e.meetLink && (
        <a href={e.meetLink} target="_blank" rel="noreferrer" className="text-[10px] underline" style={{ color: B_GOLD }}>
          เข้า Google Meet
        </a>
      )}
    </div>
  )
}

function DayView({ date, events }: { date: Date; events: GCalEvent[] }) {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start))
  return (
    <div className="rounded-xl p-4" style={{ background: '#ffffff', border: '1px solid ' + B_BORDER }}>
      <div className="flex items-baseline justify-between mb-3 pb-3" style={{ borderBottom: '1px solid ' + B_BORDER }}>
        <h2 className="font-semibold" style={{ color: B_PRIMARY }}>{fmtThaiFull(date)}</h2>
        <span className="text-sm text-gray-400">{sorted.length} คลาส</span>
      </div>
      {sorted.length === 0 && (
        <div className="text-center py-10 text-sm text-gray-400">วันนี้ไม่มีคลาส</div>
      )}
      <div className="space-y-2">
        {sorted.map(e => {
          const m = metaOf(e.account)
          return (
            <div
              key={e.id}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{
                background: hexAlpha(m.color, '10'),
                borderLeft: '4px solid ' + m.color,
                opacity: e.cancelled ? 0.5 : 1,
              }}
            >
              <div className="w-24 shrink-0 text-sm font-medium" style={{ color: B_PRIMARY }}>
                {e.allDay ? 'ทั้งวัน' : fmtTime(e.start)}
                {!e.allDay && <div className="text-xs text-gray-400 font-normal">{'ถึง ' + fmtTime(e.end)}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800" style={e.cancelled ? { textDecoration: 'line-through' } : undefined}>
                  {e.title}
                </div>
                <div className="text-xs mt-0.5" style={{ color: m.color }}>{m.label}</div>
                {e.location && <div className="text-xs text-gray-400 mt-0.5">{'📍 ' + e.location}</div>}
                {e.meetLink && (
                  <a href={e.meetLink} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: B_GOLD }}>
                    เข้า Google Meet
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
