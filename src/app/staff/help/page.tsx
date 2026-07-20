'use client'
// src/app/staff/help/page.tsx
import { useState } from 'react'

const sections = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    color: '#0F6E56',
    darkBg: 'rgba(15,110,86,0.15)',
    desc: 'ภาพรวมของระบบทั้งหมด',
    features: [
      {
        title: 'การ์ดการเงิน 4 ใบ',
        icon: '💰',
        steps: [
          'รายรับเดือนนี้ — ยอดรวมจากใบเสร็จเดือนนี้ คลิกไปหน้ารายรับ',
          'รายจ่ายเดือนนี้ — ยอดรวมรายจ่ายเดือนนี้ คลิกไปหน้ารายจ่าย',
          'กำไร/ขาดทุนเดือนนี้ — รายรับ ลบ รายจ่าย คลิกไปหน้า Finance',
          'เงินคงเหลือ — ยอดยกมา บวก รายรับ ลบ รายจ่าย คลิกไปหน้า Finance',
        ],
      },
      {
        title: 'ปฏิทิน',
        icon: '📅',
        steps: [
          'แสดงปฏิทินเดือนปัจจุบัน',
          'วันที่มีตารางสอนจะถูก highlight',
          'คลิกวันเพื่อดูตารางสอนของวันนั้น',
        ],
      },
      {
        title: 'กราฟแท่ง 6 เดือน',
        icon: '📊',
        steps: [
          'แสดงรายรับ (สีน้ำเงิน) และรายจ่าย (สีส้ม) ย้อนหลัง 6 เดือน',
          'ดูแนวโน้มรายรับ-รายจ่ายของสถาบัน',
        ],
      },
      {
        title: 'กราฟวงกลมรายได้ตามวิชา',
        icon: '🎯',
        steps: [
          'แสดงสัดส่วนรายได้แยกตามวิชา — จีน / คณิต / อังกฤษ / อื่นๆ',
          'คำนวณจากใบเสร็จในเดือนปัจจุบัน',
        ],
      },
      {
        title: 'เช็กอินวันนี้',
        icon: '🕐',
        steps: [
          'แสดงรายชื่อนักเรียนที่เช็กอินวันนี้ล่าสุด 10 คน',
          'จุดเขียว = ยังอยู่ในสถาบัน ไม่มีจุด = ออกแล้ว',
          'คลิก "จัดการ" เพื่อไปหน้าเช็กอิน',
        ],
      },
      {
        title: 'ตารางเรียนวันนี้',
        icon: '🗓',
        steps: [
          'แสดงตารางสอนจาก Google Calendar ของวันนี้',
          'อัปเดตแบบ real-time',
        ],
      },
      {
        title: 'ใกล้หมดคอร์ส',
        icon: '⚠️',
        steps: [
          'แสดงนักเรียนที่เหลือ 0-1 ครั้งอัตโนมัติ',
          'badge แดง = หมดแล้ว, badge เหลือง = เหลือ 1 ครั้ง',
        ],
      },
      {
        title: 'รอซื้อคอร์สใหม่',
        icon: '🔄',
        steps: [
          'แสดงนักเรียนที่เรียนครบทุกครั้งแล้ว (status = completed)',
          'เฉพาะคนที่ไม่มีคอร์ส active เหลืออยู่เลย',
          'คลิกชื่อเพื่อไปหน้านักเรียน แล้วกด "+ ซื้อคอร์ส"',
        ],
      },
    ],
  },
  {
    id: 'students',
    title: 'ข้อมูลนักเรียน',
    color: '#7C3AED',
    darkBg: 'rgba(124,58,237,0.15)',
    desc: 'จัดการข้อมูลนักเรียนทั้งหมด',
    features: [
      {
        title: 'ดูข้อมูลนักเรียน',
        icon: '👤',
        steps: [
          'กรองดู Active / Inactive / ทั้งหมด',
          'ค้นหาด้วยชื่อ ชื่อเล่น หรือผู้ปกครอง',
          'คลิกชื่อนักเรียนเพื่อดูรายละเอียด ประวัติคอร์ส และประวัติเช็กอิน',
        ],
      },
      {
        title: 'เพิ่มนักเรียนใหม่',
        icon: '➕',
        steps: [
          'กดปุ่ม "+ เพิ่มนักเรียน" มุมขวาบน',
          'กรอกชื่อ-นามสกุล ชื่อเล่น โรงเรียน เบอร์โทร',
          'กด "บันทึก"',
        ],
      },
      {
        title: 'ซื้อคอร์ส',
        icon: '📚',
        steps: [
          'คลิกชื่อนักเรียน แล้วกดปุ่ม "+ ซื้อคอร์ส"',
          'เลือกคอร์สและครูผู้สอน',
          'กรอกจำนวนครั้ง ราคา และวันที่',
          'ระบบสร้างใบเสร็จอัตโนมัติถ้ากรอกราคา',
          'enrollment เปลี่ยนเป็น active ทันที พร้อมเช็กอินได้เลย',
        ],
      },
      {
        title: 'Import/Export Excel',
        icon: '📥',
        steps: [
          'Export — ดาวน์โหลดรายชื่อนักเรียนทั้งหมดพร้อมครูผู้สอน',
          'Import — อัปโหลดไฟล์ Excel ที่มีคอลัมน์ตามแบบฟอร์มที่กำหนด',
        ],
      },
    ],
  },
  {
    id: 'checkin',
    title: 'เช็กอิน / เช็กเอาท์',
    color: '#0369A1',
    darkBg: 'rgba(3,105,161,0.15)',
    desc: 'บันทึกเวลาเข้าออกของนักเรียน',
    features: [
      {
        title: 'เช็กอินด่วน',
        icon: '✓',
        steps: [
          'พิมพ์ชื่อหรือชื่อเล่นในช่องค้นหา แล้วเลือกนักเรียน',
          'เลือกครูผู้สอน (จำเป็น)',
          'เลือกวิชา ระยะเวลา หัวข้อ และการบ้าน (ถ้ามี)',
          'กดปุ่ม "เช็กอิน"',
          'ระบบแสดง popup สรุปพร้อม progress bar ครั้งที่เรียน',
        ],
      },
      {
        title: 'ระบบ block เมื่อครบจำนวนครั้ง',
        icon: '🚫',
        steps: [
          'ถ้าเรียนครบแล้ว ระบบแสดงแถบแดง "เรียนครบ X ครั้งแล้ว"',
          'ปุ่มเช็กอินถูก disable อัตโนมัติ กดไม่ได้',
          'ต้องไปซื้อคอร์สใหม่ที่หน้านักเรียนก่อน จึงจะเช็กอินได้',
          'เมื่อเช็กอินครั้งสุดท้าย ระบบเปลี่ยน status เป็น completed อัตโนมัติ',
        ],
      },
      {
        title: 'บันทึกย้อนหลัง',
        icon: '📅',
        steps: [
          'เปิด toggle "บันทึกย้อนหลัง" ใต้ฟอร์มเช็กอิน',
          'เลือกวันที่และเวลาที่ต้องการบันทึก',
          'เลือกนักเรียนและครู แล้วกด "บันทึกย้อนหลัง"',
          'ระบบจัดเรียงลำดับครั้งที่เรียนใหม่ให้ถูกต้องอัตโนมัติ',
        ],
      },
      {
        title: 'จัดการรายการ',
        icon: '📝',
        steps: [
          '"บันทึก" — บันทึกหัวข้อที่สอนหรือการบ้านหลังเช็กอินแล้ว',
          '"แก้ไข" — แก้ไขเวลาเช็กอิน/เช็กเอาท์',
          '"ลบ" — ลบรายการ (มี Undo 6 วินาที)',
          '"สรุป" — ดูสรุปทุกคอร์สของนักเรียน พร้อมคัดลอกส่งผู้ปกครอง',
        ],
      },
      {
        title: 'คัดลอกสรุปส่งผู้ปกครอง',
        icon: '📋',
        steps: [
          'กดปุ่ม "สรุป" ในแถวรายชื่อ หรือจาก popup หลังเช็กอิน',
          'ระบบแสดงประวัติการเรียนทุกคอร์สที่ active',
          'กด "คัดลอกส่งผู้ปกครอง" — ได้ข้อความสรุปพร้อมวาง LINE ทันที',
          'ข้อความรวมชื่อนักเรียน คอร์ส ประวัติทุกครั้ง และสถานะเหลือกี่ครั้ง',
        ],
      },
      {
        title: 'Tab สรุปรายคน',
        icon: '🔍',
        steps: [
          'คลิก tab "สรุปรายคน" ในฝั่งรายชื่อ',
          'พิมพ์ชื่อหรือชื่อเล่นนักเรียน',
          'ระบบแสดงสรุปทุกคอร์สที่กำลังเรียน พร้อม progress และประวัติ',
          'กด "คัดลอกส่งผู้ปกครอง" ได้เลยโดยไม่ต้องรอ popup',
        ],
      },
    ],
  },
  {
    id: 'teaching',
    title: 'ชั่วโมงสอน',
    color: '#0F6E56',
    darkBg: 'rgba(15,110,86,0.15)',
    desc: 'ติดตามการสอนของครูแต่ละคน',
    features: [
      {
        title: 'บันทึกชั่วโมงการสอน',
        icon: '➕',
        steps: [
          'กดปุ่ม "+ บันทึกชั่วโมงการสอน"',
          'เลือกครูผู้สอน (หรือกด "+ เพิ่มครูใหม่")',
          'เลือกนักเรียน/คอร์ส วันที่ และระยะเวลา (30/45/60/90/120 นาที)',
          'กรอกหัวข้อที่สอนและการบ้าน แล้วกด "บันทึก"',
        ],
      },
      {
        title: 'เพิ่มครูใหม่',
        icon: '👩‍🏫',
        steps: [
          'ใน Modal บันทึกชั่วโมง กดปุ่ม "+ เพิ่มครูใหม่"',
          'กรอกชื่อครูและวิชาที่สอน',
          'กด "เพิ่มครู" — ครูจะขึ้นใน dropdown ทันที',
        ],
      },
      {
        title: 'ดูประวัติการสอน',
        icon: '📋',
        steps: [
          'เลือกเดือนและครูที่ต้องการดู',
          'คลิกแถวเพื่อดูรายละเอียดหัวข้อและการบ้าน',
          'กด "แก้ไข" เพื่อแก้ไขข้อมูล',
        ],
      },
      {
        title: 'Export Excel',
        icon: '📊',
        steps: [
          'กดปุ่ม "Export Excel"',
          'ได้ไฟล์แยก Sheet ตามครูทุกคนในเดือนนั้น',
          'แต่ละ Sheet มีแถวสรุปรวมชั่วโมงท้าย',
        ],
      },
    ],
  },
  {
    id: 'teachers',
    title: 'ครูผู้สอน',
    color: '#0369A1',
    darkBg: 'rgba(3,105,161,0.15)',
    desc: 'จัดการข้อมูลครูผู้สอน',
    features: [
      {
        title: 'ดูรายชื่อครู',
        icon: '👩‍🏫',
        steps: [
          'แสดงครูทุกคนพร้อมวิชาที่สอนและจำนวนนักเรียน',
          'กรองดูครู active / inactive',
        ],
      },
      {
        title: 'เพิ่ม/แก้ไขครู',
        icon: '➕',
        steps: [
          'กดปุ่ม "+ เพิ่มครู" หรือกด "แก้ไข" ในแถวครู',
          'กรอกชื่อ วิชาที่สอน เบอร์โทร LINE',
          'กด "บันทึก"',
          'ครูที่เพิ่มจะขึ้นใน dropdown ของหน้าเช็กอินและบันทึกชั่วโมงสอน',
        ],
      },
      {
        title: 'ปิดใช้งานครู',
        icon: '🔒',
        steps: [
          'กด "แก้ไข" แล้วปิด toggle "ใช้งานอยู่"',
          'ครูที่ inactive จะไม่ขึ้นใน dropdown แต่ยังมีประวัติในระบบ',
        ],
      },
    ],
  },
  {
    id: 'schedule',
    title: 'ตารางสอน',
    color: '#7C3AED',
    darkBg: 'rgba(124,58,237,0.15)',
    desc: 'ดูตารางสอนจาก Google Calendar',
    features: [
      {
        title: 'ดูตารางสอน',
        icon: '🗓',
        steps: [
          'แสดงตารางสอนดึงจาก Google Calendar แบบ real-time',
          'เลือกดูแบบ วัน / สัปดาห์ / เดือน',
          'ใช้ลูกศรซ้าย-ขวาเพื่อเลื่อนวัน/สัปดาห์/เดือน',
        ],
      },
    ],
  },
  {
    id: 'courses',
    title: 'คอร์สและราคา',
    color: '#B45309',
    darkBg: 'rgba(180,83,9,0.15)',
    desc: 'จัดการคอร์สเรียนและราคา',
    features: [
      {
        title: 'ดูและแก้ไขคอร์ส',
        icon: '📚',
        steps: [
          'แสดงคอร์สทั้งหมดพร้อมราคาและจำนวนครั้ง',
          'กด "แก้ไข" เพื่อแก้ไขชื่อคอร์ส ราคา จำนวนครั้ง',
          'กด "ลบ" เพื่อลบคอร์ส (ไม่กระทบ enrollment ที่มีอยู่)',
        ],
      },
      {
        title: 'เพิ่มคอร์สใหม่',
        icon: '➕',
        steps: [
          'กดปุ่ม "+ เพิ่มคอร์ส"',
          'กรอกชื่อคอร์ส ราคา จำนวนครั้ง และวิชา',
          'คอร์สที่เพิ่มจะขึ้นใน dropdown ตอนซื้อคอร์สให้นักเรียน',
        ],
      },
    ],
  },
  {
    id: 'receipts',
    title: 'รายรับ',
    color: '#059669',
    darkBg: 'rgba(5,150,105,0.15)',
    desc: 'จัดการใบเสร็จรับเงิน',
    features: [
      {
        title: 'ออกใบเสร็จใหม่',
        icon: '🧾',
        steps: [
          'กด "+ ออกใบเสร็จ"',
          'เลือกนักเรียน — ระบบดึงราคาคอร์สอัตโนมัติ',
          'เลือกวันที่และช่องทางชำระ แล้วกด "ออกใบเสร็จ"',
        ],
      },
      {
        title: 'พิมพ์ใบเสร็จ',
        icon: '🖨',
        steps: [
          'กดปุ่มพิมพ์ในแถวใบเสร็จ',
          'หน้าต่างพิมพ์จะเปิดขึ้นอัตโนมัติ',
          'ใบเสร็จมีโลโก้ ชื่อสถาบัน เบอร์โทร',
        ],
      },
      {
        title: 'แก้ไขใบเสร็จ',
        icon: '✎',
        steps: [
          'กดปุ่มแก้ไขเพื่อแก้ไขจำนวนเงิน วันที่ หรือช่องทางชำระ',
          'กด "บันทึก"',
        ],
      },
    ],
  },
  {
    id: 'expenses',
    title: 'รายจ่าย',
    color: '#DC2626',
    darkBg: 'rgba(220,38,38,0.15)',
    desc: 'บันทึกและติดตามค่าใช้จ่าย',
    features: [
      {
        title: 'บันทึกรายจ่าย',
        icon: '➕',
        steps: [
          'กด "+ บันทึกรายจ่าย"',
          'เลือกหมวดหมู่ (ค่าครู / ค่าเช่า / ค่าไฟ ฯลฯ)',
          'กรอกชื่อรายจ่าย จำนวนเงิน วันที่ และช่องทางชำระ',
          'ติ๊ก "รายจ่ายประจำทุกเดือน" ถ้าต้องการ',
        ],
      },
      {
        title: 'ดูสรุปรายจ่าย',
        icon: '📊',
        steps: [
          'เลือกเดือนที่ต้องการดูจาก dropdown มุมขวาบน',
          'กราฟ 6 เดือนแสดงรายรับ-รายจ่าย',
          'ฝั่งขวาแสดงสัดส่วนแยกตามหมวดหมู่',
          'เลื่อนดูตารางรายการซ้ายขวาบนมือถือได้',
        ],
      },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    color: '#0F6E56',
    darkBg: 'rgba(15,110,86,0.15)',
    desc: 'ภาพรวมการเงินและตั้งค่ายอดยกมา',
    features: [
      {
        title: 'ตั้งค่ายอดยกมา',
        icon: '💰',
        steps: [
          'กดปุ่ม "แก้ไข" ที่การ์ดยอดยกมา',
          'กรอกยอดเงินคงเหลือจากเดือนที่แล้ว',
          'กด "บันทึก" — ระบบใช้ตัวเลขนี้คำนวณเงินคงเหลือใน Dashboard',
        ],
      },
      {
        title: 'Export รายงานรายเดือน',
        icon: '📥',
        steps: [
          'เลือกเดือนที่ต้องการ Export',
          'กด "Download" เพื่อดาวน์โหลดไฟล์ Excel',
          'ไฟล์รวมรายรับ รายจ่าย และกำไรของเดือนนั้น',
        ],
      },
    ],
  },
  {
    id: 'team',
    title: 'จัดการทีม',
    color: '#7C3AED',
    darkBg: 'rgba(124,58,237,0.15)',
    desc: 'จัดการสมาชิกทีมงาน',
    features: [
      {
        title: 'ดูข้อมูลทีมงาน',
        icon: '👥',
        steps: [
          'แสดงรายชื่อทุกคนพร้อมสถิติ — นักเรียน, Active, รีวิว, เช็กอิน 30 วัน',
          'สถิติอัปเดตอัตโนมัติจากข้อมูลจริงในระบบ',
        ],
      },
      {
        title: 'เพิ่มเจ้าหน้าที่ใหม่',
        icon: '➕',
        steps: [
          'กดปุ่ม "+ เพิ่มเจ้าหน้าที่" มุมขวาบน',
          'เพิ่ม user ใน Supabase Authentication → คัดลอก User ID → รัน SQL ที่ระบบสร้างให้',
          'ทุกคนในทีมมีสิทธิ์เท่ากัน — เช็กอิน บันทึกบทเรียน ออกใบเสร็จ ได้ทุกอย่าง',
        ],
      },
      {
        title: 'แก้ไขข้อมูล',
        icon: '✎',
        steps: [
          'กดปุ่ม "แก้ไข" ในการ์ดสมาชิก',
          'แก้ไขชื่อ เบอร์โทร LINE ID แล้วกด "บันทึก"',
        ],
      },
    ],
  },
]

const tips: Record<string, string> = {
  dashboard: 'กด Refresh หน้าถ้าข้อมูลไม่อัปเดต Dashboard ดึงข้อมูล real-time จาก Supabase',
  students: 'ถ้าต้องการ import นักเรียนหลายคนพร้อมกัน ใช้ปุ่ม "Import Excel" จะเร็วกว่าเพิ่มทีละคนมาก',
  checkin: 'กดปุ่ม "สรุป" ในแถวรายชื่อเพื่อดูและคัดลอกสรุปส่งผู้ปกครองได้เลย โดยไม่ต้องรอ popup หลังเช็กอิน',
  teaching: 'บันทึกหัวข้อและการบ้านทุกครั้ง จะช่วยให้ Export Excel มีข้อมูลครบถ้วนสำหรับสรุปรายเดือน',
  teachers: 'ครูที่เพิ่มในหน้านี้จะขึ้นใน dropdown ของหน้าเช็กอินและบันทึกชั่วโมงสอนทันที',
  schedule: 'ตารางสอนดึงจาก Google Calendar อัตโนมัติ ถ้าไม่ขึ้นให้ตรวจสอบการเชื่อมต่อ Google Calendar',
  courses: 'คอร์สที่ลบแล้วไม่กระทบ enrollment ที่มีอยู่แล้ว นักเรียนยังเรียนต่อได้ปกติ',
  receipts: 'ถ้าซื้อคอร์สผ่านหน้านักเรียน ระบบสร้างใบเสร็จอัตโนมัติ ไม่ต้องออกใบเสร็จซ้ำ',
  expenses: 'ใช้ฟีเจอร์ "รายจ่ายประจำทุกเดือน" สำหรับค่าเช่า ค่าเงินเดือน ที่จ่ายซ้ำทุกเดือน',
  finance: 'ตั้งค่ายอดยกมาทุกต้นเดือน เพื่อให้ยอดเงินคงเหลือใน Dashboard แม่นยำ',
  team: 'ทุกคนในทีมมีสิทธิ์เท่ากันหมด ไม่มีระดับ admin/staff แยกกัน',
}

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [openFeature, setOpenFeature] = useState<string | null>(null)

  const current = sections.find(s => s.id === activeSection)!

  return (
    <div className="min-h-screen bg-[#F5F4F0] dark:bg-[#1a2030]">
      <div className="bg-white dark:bg-[#242d3f] border-b border-gray-100 dark:border-[#2a3245] px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">คู่มือการใช้งาน</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Mando House — ระบบหลังบ้านสำหรับเจ้าหน้าที่</p>
      </div>

      <div className="flex gap-0 min-h-[calc(100vh-73px)]">
        <aside className="w-56 flex-shrink-0 bg-white dark:bg-[#242d3f] border-r border-gray-100 dark:border-[#2a3245] py-4">
          {sections.map(s => {
            const isActive = activeSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => { setActiveSection(s.id); setOpenFeature(null) }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all text-left border-l-2 ${
                  isActive
                    ? 'font-semibold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2a3245] border-transparent'
                }`}
                style={isActive ? { color: s.color, borderColor: s.color, background: s.darkBg } : {}}
              >
                <span>{s.title}</span>
              </button>
            )
          })}
        </aside>

        <main className="flex-1 p-8 max-w-3xl">
          <div className="flex items-center gap-4 mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ background: current.darkBg }}
            >
              <span className="text-xl font-bold" style={{ color: current.color }}>
                {current.title.slice(0, 1)}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{current.title}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{current.desc}</p>
            </div>
          </div>

          <div className="space-y-3">
            {current.features.map((f, i) => {
              const key = `${current.id}-${i}`
              const isOpen = openFeature === key
              return (
                <div key={key} className="bg-white dark:bg-[#242d3f] rounded-2xl border border-gray-100 dark:border-[#2a3245] overflow-hidden shadow-sm">
                  <button
                    onClick={() => setOpenFeature(isOpen ? null : key)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/50 dark:hover:bg-[#2a3245]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{f.icon}</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{f.title}</span>
                    </div>
                    <span className={`text-gray-400 dark:text-gray-500 transition-transform text-sm ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5">
                      <div className="border-t border-gray-100 dark:border-[#2a3245] pt-4">
                        <ol className="space-y-3">
                          {f.steps.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                              <span
                                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                                style={{ background: current.color }}
                              >
                                {idx + 1}
                              </span>
                              <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-8 rounded-2xl p-5" style={{ background: current.darkBg }}>
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <div>
                <div className="font-semibold text-sm mb-1" style={{ color: current.color }}>เคล็ดลับ</div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{tips[current.id]}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
