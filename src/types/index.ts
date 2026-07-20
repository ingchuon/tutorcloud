// src/types/index.ts

export type UserRole = 'staff' | 'parent'
export type CourseType = 'group' | 'one_on_one' | 'kids' | 'hsk'
export type EnrollmentStatus = 'active' | 'completed' | 'expired' | 'paused'
export type PaymentMethod = 'transfer' | 'cash' | 'promptpay'
export type AlertType = 'course_ending' | 'course_expired' | 'payment_due' | 'custom'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  phone?: string
  line_id?: string
  avatar_url?: string
  created_at: string
}

export interface Course {
  id: string
  name: string
  name_en?: string
  type: CourseType
  description?: string
  total_lessons: number
  duration_minutes: number
  price: number
  max_students: number
  is_active: boolean
  created_at: string
}

export interface Student {
  id: string
  full_name: string
  nickname?: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other'
  parent_id?: string
  parent_name?: string
  parent_phone?: string
  parent_line_id?: string
  notes?: string
  is_active: boolean
  created_at: string
}

export interface Enrollment {
  id: string
  student_id: string
  course_id: string
  teacher_id?: string
  enrolled_at: string
  expires_at?: string
  lessons_used: number
  lessons_total: number
  status: EnrollmentStatus
  paid_amount?: number
  payment_method?: PaymentMethod
  notes?: string
  created_at: string
  student?: Student
  course?: Course
  teacher?: Profile
}

export interface Checkin {
  id: string
  student_id: string
  enrollment_id?: string
  check_in_at: string
  check_out_at?: string
  duration_minutes?: number
  recorded_by?: string
  notes?: string
  created_at: string
  student?: Student
  enrollment?: Enrollment
}

export interface LessonLog {
  id: string
  enrollment_id: string
  student_id: string
  lesson_date: string
  lesson_number: number
  teacher_id?: string
  topic?: string
  homework?: string
  created_at: string
  student?: Student
  enrollment?: Enrollment
  teacher?: Profile
}

export interface Review {
  id: string
  enrollment_id: string
  student_id: string
  teacher_id?: string
  lesson_log_id?: string
  review_date: string
  rating?: number
  content: string
  skills_practiced?: string[]
  homework_given?: string
  visible_to_parent: boolean
  created_at: string
  student?: Student
  teacher?: Profile
}

export interface Alert {
  id: string
  enrollment_id: string
  student_id: string
  alert_type: AlertType
  message: string
  lessons_remaining?: number
  is_sent: boolean
  sent_at?: string
  sent_via?: string
  created_at: string
  student?: Student
  enrollment?: Enrollment
}

export interface Receipt {
  id: string
  receipt_number: string
  enrollment_id: string
  student_id: string
  issued_by?: string
  issued_at: string
  amount: number
  payment_method?: PaymentMethod
  items: ReceiptItem[]
  notes?: string
  created_at: string
  student?: Student
  enrollment?: Enrollment
  issuer?: Profile
}

export interface ReceiptItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface AlertSettings {
  id: string
  warn_at_lessons_remaining: number
  notify_teacher: boolean
  notify_parent: boolean
  notify_via_line: boolean
  notify_via_email: boolean
  daily_alert_time: string
  updated_at: string
}
