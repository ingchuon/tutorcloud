'use client'
// src/components/TodayScheduleCard.tsx
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type GCalEvent = {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  account: string
  cancelled: boolean
}

const ACCOUNT_COLOR: Record<string, string> = {
  main: '#3B9EE0',
  aom: '#F5A623',
  nalin: '#7C6FF7',
}

const ACCOUNT_LABEL: Record<string, string> = {
  main: 'ครูในสถาบัน',
  aom: 'ครูออม',
  nalin: 'ครูบี',
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function TodayScheduleCard() {
  const router = useRouter()
  const supabase = createClient()
  const [events, setEvents] = useState<GCalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [hasCalendar, setHasCalendar] = useState<boolean | null>(null)

  // เช็กก่อนว่าสถาบันนี้มี Google Calendar token ไหม
  useEffect(() => {
    async function checkToken() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setHasCalendar(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

      const { data: tokens } = await supabase
        .from('google_calendar_tokens')
        .select('id')
        .eq('school_id', profile?.school_id ?? '')
        .limit(1)

      setHasCalendar((tokens ?? []).length > 0)
    }
    checkToken()
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setFailed(false)
    try {
      const start = new Date(); start.setHours(0,0,0,0)
      const end = new Date(start); end.setDate(end.getDate() + 1)
      const p = new URLSearchParams({ from: start.toISOString(), to: end.toISOString() })
      const res = await fetch(`/api/calendar/events?${p.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) { setFailed(true); setEvents([]); return }
      const list = (json.events ?? []) as GCalEvent[]
      setEvents(list.sort((a, b) => a.start.localeCompare(b.start)))
    } catch { setFailed(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (hasCalendar === true) load()
    if (hasCalendar === false) setLoading(false)
  }, [hasCalendar, load])

  const goToday = () => router.push(`/staff/schedule?view=day&date=${ymd(new Date())}`)

  return (
    <div className="rounded-2xl p-4 shadow-sm bg-white dark:bg-[#242d3f] border border-[#F0E9D8] dark:border-[#2a3245] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          📅 ตารางเรียนวันนี้
        </div>
        <button
          onClick={goToday}
          className="text-[11px] font-medium hover:underline"
          style={{ color: '#3B9EE0' }}
        >
          ดูทั้งหมด →
        </button>
      </div>

      {/* ยังไม่ได้เชื่อม Google Calendar */}
      {hasCalendar === false && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6 text-center">
          <div className="text-3xl mb-1">📆</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">ยังไม่ได้เชื่อม Google Calendar</p>
          <a
            href="/staff/schedule/connect"
            className="text-xs font-semibold px-3 py-1.5 rounded-full mt-1"
            style={{ background: '#3B9EE022', color: '#3B9EE0' }}
          >
            เชื่อมต่อเลย →
          </a>
        </div>
      )}

      {/* กำลังโหลด */}
      {hasCalendar === true && loading && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          กำลังโหลด...
        </div>
      )}

      {/* โหลดไม่สำเร็จ */}
      {hasCalendar === true && !loading && failed && (
        <div className="flex-1 flex flex-col items-center justify-center gap-1">
          <div className="text-3xl">🔌</div>
          <p className="text-xs text-red-400">
            โหลดไม่สำเร็จ —{' '}
            <a href="/staff/schedule/connect" className="underline">เชื่อมต่อ Google</a>
          </p>
        </div>
      )}

      {/* ไม่มีคลาสวันนี้ */}
      {hasCalendar === true && !loading && !failed && events.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-3xl mb-1">🌤</div>
          <p className="text-xs text-gray-400">วันนี้ไม่มีคลาส</p>
        </div>
      )}

      {/* แสดง events */}
      {hasCalendar === true && !loading && !failed && events.length > 0 && (
        <div className="space-y-1 overflow-y-auto flex-1 max-h-64">
          {events.map(e => {
            const color = ACCOUNT_COLOR[e.account] ?? '#9CA3AF'
            const label = ACCOUNT_LABEL[e.account] ?? e.account
            return (
              <button
                key={e.id}
                onClick={goToday}
                className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-[#FAF7F2] dark:hover:bg-[#2a3245] transition text-left"
                style={{ opacity: e.cancelled ? 0.45 : 1 }}
              >
                <div
                  className="w-1 rounded-full shrink-0 self-stretch"
                  style={{ backgroundColor: color, minHeight: '32px' }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate"
                    style={e.cancelled ? { textDecoration: 'line-through' } : undefined}
                  >
                    {e.title}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {e.allDay ? 'ทั้งวัน' : `${fmtTime(e.start)} - ${fmtTime(e.end)}`}
                  </div>
                </div>
                <span
                  className="text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
