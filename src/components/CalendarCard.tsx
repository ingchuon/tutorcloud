'use client'
// src/components/CalendarCard.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type GCalEvent = {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  account: string
  cancelled: boolean
}

const DAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const ACCOUNT_COLOR: Record<string, string> = {
  main: '#3B9EE0',
  aom: '#F5A623',
  nalin: '#7C6FF7',
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function startOfMondayWeek(d: Date) {
  const x = startOfDay(d)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  return x
}
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x }
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function CalendarCard() {
  const router = useRouter()
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()))
  const [events, setEvents] = useState<GCalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const gridStart = useMemo(() => startOfMondayWeek(startOfMonth(cursor)), [cursor])

  const load = useCallback(async () => {
    setLoading(true); setFailed(false)
    try {
      const p = new URLSearchParams({
        from: gridStart.toISOString(),
        to: addDays(gridStart, 42).toISOString(),
      })
      const res = await fetch(`/api/calendar/events?${p.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) { setFailed(true); setEvents([]); return }
      setEvents(json.events ?? [])
    } catch { setFailed(true) }
    finally { setLoading(false) }
  }, [gridStart])

  useEffect(() => { load() }, [load])

  const todayKey = ymd(new Date())

  const byDay = useMemo(() => {
    const map: Record<string, GCalEvent[]> = {}
    for (const e of events) {
      if (e.cancelled) continue
      const key = e.allDay ? e.start.slice(0,10) : ymd(new Date(e.start))
      if (!map[key]) map[key] = []
      map[key].push(e)
    }
    return map
  }, [events])

  const monthTotal = useMemo(() =>
    Object.entries(byDay)
      .filter(([k]) => k.slice(0,7) === `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`)
      .reduce((s, [, v]) => s + v.length, 0)
  , [byDay, cursor])

  const goDay = (day: Date) => router.push(`/staff/schedule?view=day&date=${ymd(day)}`)

  return (
    <div className="rounded-2xl bg-white dark:bg-[#242d3f] border border-[#F0E9D8] dark:border-[#2a3245] shadow-sm p-3 flex flex-col gap-1.5">

      {/* header */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-base text-gray-800 dark:text-gray-100">
          {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <div className="flex gap-1">
          <button onClick={() => setCursor(addMonths(cursor,-1))}
            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">‹</button>
          <button onClick={() => setCursor(startOfDay(new Date()))}
            className="px-2 h-6 rounded-md text-[10px] text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">วันนี้</button>
          <button onClick={() => setCursor(addMonths(cursor,1))}
            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">›</button>
        </div>
      </div>

      {failed && (
        <div className="text-[10px] text-red-400">
          โหลดปฏิทินไม่สำเร็จ — <a href="/staff/schedule/connect" className="underline">เชื่อมต่อ Google</a>
        </div>
      )}

      {/* weekday */}
      <div className="grid grid-cols-7">
        {DAYS_SHORT.map(d => (
          <div key={d} className="text-center text-[9px] text-gray-400 font-medium pb-0.5">{d}</div>
        ))}
      </div>

      {/* grid — 5 แถว 35 วัน */}
      <div className="grid grid-cols-7">
        {Array.from({length:35}, (_,i) => addDays(gridStart,i)).map(day => {
          const key = ymd(day)
          const list = byDay[key] ?? []
          const inMonth = day.getMonth() === cursor.getMonth()
          const isToday = key === todayKey
          const hasEvent = list.length > 0
          const accounts = Array.from(new Set(list.map(e => e.account))).slice(0,3)

          return (
            <button key={key} onClick={() => goDay(day)}
              className="flex flex-col items-center gap-0 rounded-md py-0.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition"
              style={{ opacity: inMonth ? 1 : 0.25 }}>
              <span
                className="w-6 h-6 flex items-center justify-center rounded-full text-[11px]"
                style={
                  isToday
                    ? { backgroundColor: '#1a1a2e', color: '#ffffff', fontWeight: 700 }
                    : hasEvent
                      ? { fontWeight: 700 }
                      : { fontWeight: 400 }
                }
              >
                <span className={isToday ? '' : 'text-gray-700 dark:text-gray-200'}>{day.getDate()}</span>
              </span>
              <span className="flex gap-0.5 h-1">
                {accounts.map(tag => (
                  <span key={tag} className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: ACCOUNT_COLOR[tag] ?? '#9CA3AF' }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700 mt-1">
        <span className="text-[10px] text-gray-400">
          {loading ? 'กำลังโหลด...' : `เดือนนี้ ${monthTotal} คลาส`}
        </span>
        <button onClick={() => router.push('/staff/schedule')}
          className="text-[10px] font-medium hover:underline" style={{ color: '#3B9EE0' }}>
          ดูตารางสอน →
        </button>
      </div>
    </div>
  )
}
