'use client'
// src/components/layout/StaffSidebar.tsx
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ThemeToggle } from '@/components/ThemeProvider'
import { SCHOOL_CONFIG } from '@/lib/config'

const navItems = [
  {
    group: 'ภาพรวม',
    items: [
      { href: '/staff', label: 'Dashboard' },
    ],
  },
  {
    group: 'นักเรียน',
    items: [
      { href: '/staff/students', label: 'ข้อมูลนักเรียน' },
      { href: '/staff/checkin', label: 'เช็กอิน / เช็กเอาท์' },
    ],
  },
  {
    group: 'การสอน',
    items: [
      { href: '/staff/teaching-report', label: 'ชั่วโมงสอน' },
      { href: '/staff/teachers', label: 'ครูผู้สอน' },
      { href: '/staff/schedule', label: 'ตารางสอน' },
      { href: '/staff/courses', label: 'คอร์สและราคา' },
    ],
  },
  {
    group: 'การเงิน',
    items: [
      { href: '/staff/receipts', label: 'รายรับ' },
      { href: '/staff/expenses', label: 'รายจ่าย' },
      { href: '/staff/settings', label: 'Finance' },
      { href: '/staff/import', label: 'Download file' },
    ],
  },
  {
    group: 'ทีมงาน',
    items: [
      { href: '/staff/team', label: 'จัดการทีม' },
      { href: '/staff/subscriptions', label: 'Subscription' },
      { href: '/staff/help', label: 'คู่มือการใช้งาน' },
    ],
  },
]

export default function StaffSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [alertCount, setAlertCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [schoolName, setSchoolName] = useState<string>(SCHOOL_CONFIG.name)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, school_id')
        .eq('id', user.id)
        .single()

      setName(profile?.full_name ?? '')
      setSchoolId(profile?.school_id ?? null)

      // ถ้าไม่ใช่ mando → ดึงชื่อสถาบันจาก DB
      if (profile?.school_id && profile.school_id !== 'mando') {
        const { data: school } = await supabase
          .from('schools')
          .select('name, logo_url')
          .eq('id', profile.school_id)
          .single()
        if (school) {
          setSchoolName(school.name)
          setLogoUrl(school.logo_url)
        }
      }
    }
    load()

    supabase.from('enrollments')
      .select('lessons_used, lessons_total')
      .eq('status', 'active')
      .then(({ data }) => {
        const count = (data ?? []).filter(e => (e.lessons_total - e.lessons_used) <= 3).length
        setAlertCount(count)
      })
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('ออกจากระบบแล้ว')
    router.push('/login')
  }

  const initials = name ? name.slice(0, 2) : '..'

  // ซ่อนเมนู Subscription ถ้าไม่ใช่ Mando House
  const filteredNavItems = navItems.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.href === '/staff/subscriptions') return schoolId === 'mando'
      return true
    }),
  })).filter(group => group.items.length > 0)

  const inner = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/15 dark:border-[#2a3245]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
            ) : (
              <img src="/logo.png" alt={schoolName} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm tracking-wide truncate">{schoolName}</div>
            <div className="text-white/60 text-[10px]">ระบบหลังบ้าน</div>
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="px-4 py-3 border-b border-white/15 dark:border-[#2a3245] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-white text-xs font-medium truncate">{name || '—'}</div>
          <div className="text-white/60 text-[10px]">เจ้าหน้าที่</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {filteredNavItems.map(({ group, items }) => (
          <div key={group} className="mb-3">
            <div className="px-5 py-1 text-[10px] font-medium text-white/50 dark:text-gray-500 uppercase tracking-widest">
              {group}
            </div>
            {items.map(({ href, label }) => {
              const active = href === '/staff' ? pathname === '/staff' : pathname.startsWith(href)
              const showBadge = href === '/staff/alerts' && alertCount > 0
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-5 py-2.5 text-sm transition-all',
                    active
                      ? 'bg-cream-200 text-brand-700 border-l-2 border-cream-500 font-medium dark:bg-brand-500/20 dark:text-brand-300 dark:border-brand-400'
                      : 'text-white/80 hover:text-white hover:bg-white/10 border-l-2 border-transparent dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-[#2a3245]'
                  )}
                >
                  <span className="flex-1 min-w-0 truncate">{label}</span>
                  {showBadge && (
                    <span className="w-5 h-5 rounded-full bg-accent-500 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                      {alertCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-5 py-4 border-t border-white/15 dark:border-[#2a3245] space-y-1">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors w-full"
        >
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col min-h-screen bg-brand-500 dark:bg-[#141b2d]">
        {inner}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-brand-500 dark:bg-[#141b2d] flex items-center justify-between px-4 border-b border-white/15 dark:border-[#2a3245]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
            ) : (
              <img src="/logo.png" alt={schoolName} className="w-full h-full object-cover" />
            )}
          </div>
          <span className="text-white font-semibold text-sm truncate">{schoolName}</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
          className="text-white/90 hover:text-white p-2 -mr-2 text-lg flex-shrink-0"
        >
          ☰
        </button>
      </header>

      {/* Mobile drawer */}
      <div
        className={cn('md:hidden fixed inset-0 z-50', open ? 'visible' : 'invisible pointer-events-none')}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn('absolute inset-0 bg-black/50 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
        />
        <aside
          className={cn(
            'absolute top-0 left-0 h-full w-64 max-w-[80%] flex flex-col bg-brand-500 dark:bg-[#141b2d] overflow-y-auto shadow-2xl transition-transform duration-300 ease-out',
            open ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex justify-end px-3 pt-3">
            <button onClick={() => setOpen(false)} aria-label="ปิดเมนู" className="text-white/80 hover:text-white p-1 text-lg">✕</button>
          </div>
          {inner}
        </aside>
      </div>
    </>
  )
}
