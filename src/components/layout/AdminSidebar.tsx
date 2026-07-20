'use client'
// src/components/layout/AdminSidebar.tsx
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { SCHOOL_CONFIG } from '@/lib/config'

const navItems = [
  { group: 'ภาพรวม', items: [
    { href: '/admin', label: 'Dashboard', icon: '⊞', adminOnly: false },
  ]},
  { group: 'นักเรียน', items: [
    { href: '/admin/students', label: 'ข้อมูลนักเรียน', icon: '👥', adminOnly: false },
    { href: '/admin/checkin', label: 'เช็กอิน / เช็กเอาท์', icon: '🕐', adminOnly: false },
    { href: '/admin/lessons', label: 'นับครั้งการเรียน', icon: '📅', adminOnly: false },
  ]},
  { group: 'การสอน', items: [
    { href: '/admin/reviews', label: 'รีวิวหลังสอน', icon: '⭐', adminOnly: false },
    { href: '/admin/courses', label: 'คอร์สและราคา', icon: '📚', adminOnly: false },
  ]},
  { group: 'การแจ้งเตือน', items: [
    { href: '/admin/alerts', label: 'แจ้งเตือน LINE', icon: '🔔', adminOnly: false },
  ]},
  { group: 'การเงิน', items: [
    { href: '/admin/receipts', label: 'ออกใบเสร็จ', icon: '🧾', adminOnly: false },
  ]},
  { group: 'ผู้ดูแล', items: [
    { href: '/admin/teachers', label: 'จัดการครู', icon: '🎓', adminOnly: true },
  ]},
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [role, setRole] = useState<string | null>(null)
  const [name, setName] = useState<string>('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
        .then(({ data }) => {
          setRole(data?.role ?? null)
          setName(data?.full_name ?? '')
        })
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('ออกจากระบบแล้ว')
    router.push('/login')
  }

  const initials = name ? name.slice(0, 2) : '??'

  return (
    <aside className="w-56 flex-shrink-0 bg-brand-500 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/15">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src="/logo.png" alt={SCHOOL_CONFIG.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-white font-medium text-sm">{SCHOOL_CONFIG.name}</div>
            <div className="text-white/60 text-xs">ระบบหลังบ้าน</div>
          </div>
        </div>
      </div>

      {/* Role badge */}
      {role && (
        <div className="px-5 py-3 border-b border-white/15 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-white text-xs font-medium">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-medium truncate">{name || 'กำลังโหลด...'}</div>
            <div className={`text-[10px] ${role === 'admin' ? 'text-accent-200' : 'text-cream-200'}`}>
              {role === 'admin' ? '👑 แอดมิน' : '🎓 ครู'}
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(({ group, items }) => {
          const visibleItems = items.filter(item => !item.adminOnly || role === 'admin')
          if (visibleItems.length === 0) return null
          return (
            <div key={group} className="mb-4">
              <div className="px-5 py-1 text-[10px] font-medium text-white/50 uppercase tracking-widest">
                {group}
              </div>
              {visibleItems.map(({ href, label, icon, adminOnly }) => {
                const active = href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 px-5 py-2 text-sm transition-colors',
                      active
                        ? 'bg-cream-200 text-brand-700 border-l-2 border-cream-500 font-medium'
                        : 'text-white/80 hover:text-white hover:bg-white/10 border-l-2 border-transparent'
                    )}
                  >
                    <span className="text-base">{icon}</span>
                    <span className="flex-1">{label}</span>
                    {adminOnly && (
                      <span className="text-[9px] bg-accent-500 text-white px-1.5 py-0.5 rounded">Admin</span>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-5 py-4 border-t border-white/15">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
        >
          <span>↩</span> ออกจากระบบ
        </button>
      </div>
    </aside>
  )
}
