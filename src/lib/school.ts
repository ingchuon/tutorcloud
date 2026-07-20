// src/lib/school.ts
import { cookies } from 'next/headers'

export function getSchoolId(): string {
  const cookieStore = cookies()
  return cookieStore.get('school_id')?.value ?? 'mando'
}
