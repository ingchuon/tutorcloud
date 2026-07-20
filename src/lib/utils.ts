// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'd MMM yyyy') {
  return format(new Date(date), fmt, { locale: th })
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'd MMM yyyy HH:mm น.', { locale: th })
}

export function formatTime(date: string | Date) {
  return format(new Date(date), 'HH:mm น.', { locale: th })
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: th })
}

export function formatThaiMoney(amount: number): string {
  return new Intl.NumberFormat('th-TH').format(amount) + ' ฿'
}

export function getLessonsRemainingColor(remaining: number, total: number): string {
  const pct = remaining / total
  if (pct <= 0.15 || remaining <= 2) return 'text-red-600 bg-red-50'
  if (pct <= 0.3 || remaining <= 5) return 'text-amber-600 bg-amber-50'
  return 'text-brand-600 bg-brand-50'
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'กำลังเรียน',
    completed: 'เสร็จสิ้น',
    expired: 'หมดอายุ',
    paused: 'พักชั่วคราว',
  }
  return map[status] ?? status
}

export function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-brand-50 text-brand-700',
    completed: 'bg-blue-50 text-blue-700',
    expired: 'bg-red-50 text-red-700',
    paused: 'bg-gray-100 text-gray-600',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

export function getCourseTypeLabel(type: string): string {
  const map: Record<string, string> = {
    group: 'กลุ่ม',
    one_on_one: '1-on-1',
    kids: 'เด็ก',
    hsk: 'HSK',
  }
  return map[type] ?? type
}

export function getCourseTypeClass(type: string): string {
  const map: Record<string, string> = {
    group: 'bg-blue-50 text-blue-700',
    one_on_one: 'bg-purple-50 text-purple-700',
    kids: 'bg-amber-50 text-amber-700',
    hsk: 'bg-red-50 text-red-700',
  }
  return map[type] ?? 'bg-gray-100 text-gray-600'
}

export function getInitials(name: string): string {
  return name.slice(0, 2)
}

// LINE Notify simulator
export async function simulateLineNotify(message: string): Promise<boolean> {
  console.log('[LINE Notify Simulation]', message)
  await new Promise(r => setTimeout(r, 800))
  return true
}
