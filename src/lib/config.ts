// src/lib/config.ts
// ✏️ แก้ไฟล์นี้ไฟล์เดียวเวลา copy ให้ลูกค้าใหม่

export const SCHOOL_CONFIG = {
  // ข้อมูลสถาบัน
  name: 'Mando House',
  nameTh: 'แมนโดเฮ้าส์',
  description: 'ระบบบริหารจัดการสถาบันสอนภาษาจีน Mando House',

  // สี (hex)
  primaryColor: '#0F6E56',

  // LINE
  lineToken: process.env.LINE_TOKEN ?? '',
  lineGroupId: process.env.LINE_GROUP_ID ?? '',

  // Supabase
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
}
