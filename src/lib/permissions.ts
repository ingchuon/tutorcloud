// src/lib/permissions.ts
// Mando House: 2 roles — staff (ทุกอย่าง) และ parent (ดูเฉพาะลูก)

import type { UserRole } from '@/types'

export function isStaff(role: UserRole | undefined): boolean {
  return role === 'staff'
}

export function isParent(role: UserRole | undefined): boolean {
  return role === 'parent'
}

// Staff ทำได้ทุกอย่าง, Parent เข้าได้แค่ /parent portal
export const STAFF_CAPABILITIES = [
  'ดูนักเรียนทั้งหมด',
  'เพิ่ม/แก้ไข/ลบนักเรียน',
  'เช็กอิน/เช็กเอาท์',
  'บันทึกครั้งเรียน',
  'เขียนรีวิวหลังสอน',
  'จัดการคอร์สและราคา',
  'แจ้งเตือน LINE',
  'ออกและลบใบเสร็จ',
  'ดูรายได้ทั้งหมด',
  'จัดการทีมงาน',
] as const

export const PARENT_CAPABILITIES = [
  'ดูข้อมูลลูก',
  'ดูความคืบหน้าการเรียน',
  'ดูรีวิวจากครู',
  'ดูประวัติการเข้าเรียน',
  'ดูใบเสร็จ',
] as const
