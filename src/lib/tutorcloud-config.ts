// src/lib/tutorcloud-config.ts
// Config สำหรับ TutorCloud (ระบบกลาง) — ไม่เกี่ยวกับ Mando House

export const TUTORCLOUD_CONFIG = {
  name: 'TutorCloud',
  nameTh: 'ทูเตอร์คลาวด์',
  description: 'ระบบจัดการสถาบันสอนพิเศษ ครบจบในที่เดียว',
  tagline: 'ระบบจัดการสถาบันสอนพิเศษ',

  // สีหลัก (จากโลโก้)
  primaryColor: '#1B6B3A',      // เขียวเข้ม
  secondaryColor: '#2ECC8E',    // เขียวอ่อน

  // Pricing
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      price: 490,
      maxStudents: 50,
      maxTeachers: 5,
      features: ['นักเรียนสูงสุด 50 คน', 'ครูสูงสุด 5 คน', 'ฟีเจอร์ครบทุกอย่าง'],
    },
    {
      id: 'growth',
      name: 'Growth',
      price: 990,
      maxStudents: 200,
      maxTeachers: 20,
      popular: true,
      features: ['นักเรียนสูงสุด 200 คน', 'ครูสูงสุด 20 คน', 'ฟีเจอร์ครบทุกอย่าง', 'แจ้งเตือน LINE', 'Export Excel'],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 1990,
      maxStudents: -1, // ไม่จำกัด
      maxTeachers: -1,
      features: ['นักเรียนไม่จำกัด', 'ครูไม่จำกัด', 'ฟีเจอร์ครบทุกอย่าง', 'แจ้งเตือน LINE', 'Export Excel', 'Priority support'],
    },
  ],

  // ติดต่อ
  website: 'https://tutorcloud.co.th',
  email: 'hello@tutorcloud.co.th',
  lineOA: '@tutorcloud',
}
