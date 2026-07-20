# 🏫 Mando House — ระบบหลังบ้าน

ระบบบริหารจัดการสถาบันสอนภาษาจีน | **Next.js 14 + Supabase**

---

## ✨ ฟีเจอร์ทั้งหมด

| โมดูล | รายละเอียด |
|---|---|
| 📊 Dashboard | ภาพรวม นักเรียน รายได้เดือน คลาสวันนี้ ใกล้หมดคอร์ส |
| 👥 ข้อมูลนักเรียน | เพิ่ม/แก้ไข/ลบ ข้อมูลส่วนตัว ข้อมูลผู้ปกครอง |
| 🕐 เช็กอิน/ออก | บันทึกเวลาเข้าออกรายวัน |
| 📅 นับครั้งเรียน | บันทึกครั้ง เนื้อหา การบ้าน (auto-update) |
| ⭐ รีวิวหลังสอน | บันทึกพัฒนาการ คะแนน ทักษะที่ฝึก |
| 📚 คอร์สและราคา | จัดการคอร์ส ราคา ประเภท |
| 🔔 แจ้งเตือน LINE | จำลองส่ง LINE เมื่อใกล้หมดคอร์ส |
| 🧾 ใบเสร็จ | ออกใบเสร็จ พิมพ์ได้ เลขอัตโนมัติ |
| 🎓 จัดการทีม | ดูสถิติเจ้าหน้าที่ รองรับ 15 คน |
| 👨‍👩‍👧 Portal ผู้ปกครอง | ดูความคืบหน้า รีวิว เวลาเข้าเรียน |

---

## 👥 ระบบ Role (2 roles เท่านั้น)

| Role | ไทย | สิทธิ์ |
|---|---|---|
| `staff` | เจ้าหน้าที่ | ทุกอย่าง — ทำได้หมด เหมือนกันทุกคน |
| `parent` | ผู้ปกครอง | ดูเฉพาะข้อมูลลูกตัวเอง ที่หน้า `/parent` |

**ไม่มี admin/teacher แยก** — ทุกคนในทีม staff สิทธิ์เท่ากัน แค่ login แยกกัน

---

## 🚀 วิธีติดตั้ง

### ขั้นตอนที่ 1: สร้าง Supabase Project
1. [supabase.com](https://supabase.com) → สร้างบัญชีฟรี → New Project
2. ชื่อ: `mando-house` · Region: Southeast Asia (Singapore)
3. รอ ~2 นาที

### ขั้นตอนที่ 2: รัน SQL Schema
ใน Supabase Dashboard → **SQL Editor** → รันทีละไฟล์ตามลำดับ:
```
supabase/migrations/001_initial_schema.sql   ← ตารางและ seed data
supabase/migrations/003_simplified_roles.sql ← RLS สำหรับ staff/parent
```
(ข้ามไฟล์ 002 ได้เลย ถ้าเริ่มใหม่)

### ขั้นตอนที่ 3: ตั้งค่า Environment
```bash
cp .env.local.example .env.local
# แก้ไข NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY
# จาก Supabase Dashboard → Settings → API
```

### ขั้นตอนที่ 4: สร้าง User แรก (เจ้าหน้าที่)
1. Supabase → Authentication → Users → **Add User**
2. ใส่อีเมล + รหัสผ่าน → คัดลอก User ID (UUID)
3. รัน SQL:
```sql
INSERT INTO profiles (id, role, full_name, phone)
VALUES ('USER_ID_HERE', 'staff', 'ชื่อของคุณ', '081-000-1234');
```

### ขั้นตอนที่ 5: รัน
```bash
npm install
npm run dev
# เปิด http://localhost:3000
```

---

## 🎓 เพิ่มเจ้าหน้าที่ (รองรับ 15 คน)

ทำซ้ำขั้นตอนที่ 4 สำหรับทุกคน:
```sql
INSERT INTO profiles (id, role, full_name, phone)
VALUES ('USER_ID', 'staff', 'ครูสมชาย', '081-234-5678');
```

ดูสถิติแต่ละคนได้ที่เมนู **จัดการทีม** (/staff/team)

---

## 👨‍👩‍👧 เพิ่มผู้ปกครอง

1. สร้าง User ใน Authentication
2. สร้าง profile:
```sql
INSERT INTO profiles (id, role, full_name, phone)
VALUES ('PARENT_USER_ID', 'parent', 'คุณแม่สมหญิง', '081-234-5678');
```
3. ผูกกับนักเรียน:
```sql
UPDATE students SET parent_id = 'PARENT_USER_ID' WHERE nickname = 'มิน';
```
4. ผู้ปกครองล็อกอินแล้วจะเข้า `/parent` อัตโนมัติ

---

## 📁 โครงสร้างโปรเจกต์

```
src/
├── app/
│   ├── login/           → หน้าล็อกอิน
│   ├── staff/           → ระบบสำหรับเจ้าหน้าที่ทุกคน
│   │   ├── page.tsx          → Dashboard
│   │   ├── students/         → ข้อมูลนักเรียน
│   │   ├── checkin/          → เช็กอิน/ออก
│   │   ├── lessons/          → นับครั้งเรียน
│   │   ├── reviews/          → รีวิวหลังสอน
│   │   ├── courses/          → คอร์สและราคา
│   │   ├── alerts/           → แจ้งเตือน LINE
│   │   ├── receipts/         → ใบเสร็จ
│   │   └── team/             → จัดการทีมงาน
│   └── parent/          → Portal ผู้ปกครอง
├── lib/
│   ├── permissions.ts   → role helpers (staff/parent)
│   └── utils.ts
├── types/index.ts       → TypeScript types
└── middleware.ts        → routing: staff→/staff, parent→/parent
supabase/
└── migrations/
    ├── 001_initial_schema.sql      → ตาราง + seed data
    └── 003_simplified_roles.sql   → RLS สำหรับ 2 roles
```

---

## 🔔 LINE Notification

ตอนนี้เป็นโหมดจำลอง เมื่อต้องการส่งจริง:
1. สมัคร [LINE Notify](https://notify-bot.line.me/th/)
2. เพิ่มใน `.env.local`: `LINE_NOTIFY_TOKEN=your-token`
3. แก้ `simulateLineNotify()` ใน `src/lib/utils.ts` เป็น fetch จริง

---

## 🛠 Tech Stack
- **Frontend**: Next.js 14, React, TailwindCSS, Noto Sans Thai
- **Backend/DB**: Supabase (PostgreSQL + Auth + Row Level Security)
- **ใบเสร็จ**: Browser Print API

---

## 🗓 ตารางสอน (Migration 004)

**ตาราง SQL ใหม่:**
- `rooms` — 4 ห้อง (A, B, C, D) seed ไว้แล้ว ปรับได้
- `class_schedules` — ตารางสอนประจำรายสัปดาห์ + unique constraint ป้องกันห้องซ้อน
- `schedule_students` — นักเรียนในแต่ละ slot
- `class_sessions` — คลาสจริงแต่ละครั้ง (override หรือคลาสพิเศษ)

**ฟีเจอร์:**
- กรองดูตามวัน / ดูทั้งสัปดาห์
- ระบบตรวจห้องซ้อนอัตโนมัติ (conflict check)
- เพิ่ม/ลบนักเรียนในแต่ละ slot
- แสดงสถิติห้องแต่ละวัน

## 📤 รายจ่าย (Migration 004)

**ตาราง SQL ใหม่:**
- `expense_categories` — 7 หมวด seed ไว้แล้ว
- `expenses` — รายจ่าย + รองรับรายจ่ายประจำ (is_recurring)
- `monthly_summary` view — รายรับ vs รายจ่าย 6 เดือน

**ฟีเจอร์:**
- กรองดูตามเดือน
- กราฟรายรับ-รายจ่าย 6 เดือน
- Breakdown ตามหมวดหมู่ + %
- รองรับรายจ่ายประจำ (ค่าเช่า ค่าเงินเดือน ฯลฯ)
