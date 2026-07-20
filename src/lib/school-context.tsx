'use client'
// src/lib/school-context.tsx
// ดึงข้อมูลสถาบันจาก database — ไม่แตะ config.ts เลย
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SCHOOL_CONFIG } from '@/lib/config'

type SchoolData = {
  id: string
  name: string
  logo_url: string | null
  primary_color: string
  plan: string
  status: string
}

const SchoolContext = createContext<SchoolData>({
  id: 'mando',
  name: SCHOOL_CONFIG.name,
  logo_url: null,
  primary_color: SCHOOL_CONFIG.primaryColor,
  plan: 'pro',
  status: 'active',
})

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [school, setSchool] = useState<SchoolData>({
    id: 'mando',
    name: SCHOOL_CONFIG.name,
    logo_url: null,
    primary_color: SCHOOL_CONFIG.primaryColor,
    plan: 'pro',
    status: 'active',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

      if (!profile?.school_id || profile.school_id === 'mando') return
      // ถ้าเป็น mando → ใช้ค่า default จาก config.ts ไม่ต้องดึง DB

      const { data: schoolData } = await supabase
        .from('schools')
        .select('id, name, logo_url, primary_color, plan, status')
        .eq('id', profile.school_id)
        .single()

      if (schoolData) setSchool(schoolData)
    }
    load()
  }, [])

  return (
    <SchoolContext.Provider value={school}>
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool() {
  return useContext(SchoolContext)
}
