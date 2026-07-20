-- =============================================
-- Migration 004: ตารางสอน + รายจ่าย
-- รัน SQL นี้ใน Supabase SQL Editor
-- =============================================

-- =============================================
-- ROOMS — 4 ห้อง
-- =============================================
create table rooms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,           -- เช่น "ห้อง A", "ห้อง B"
  color text not null default '#1D9E75', -- สีสำหรับแสดงในตาราง
  capacity int default 5,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Seed 4 ห้อง
insert into rooms (name, color, capacity, sort_order) values
  ('ห้อง A', '#1D9E75', 6, 1),
  ('ห้อง B', '#185FA5', 6, 2),
  ('ห้อง C', '#BA7517', 4, 3),
  ('ห้อง D', '#993556', 4, 4);

-- =============================================
-- CLASS_SCHEDULES — ตารางสอนประจำ (recurring)
-- วันและเวลาที่จัดประจำ เช่น ทุกจันทร์ 14:00
-- =============================================
create table class_schedules (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references courses(id),
  room_id uuid references rooms(id),
  teacher_id uuid references profiles(id),
  day_of_week int not null check (day_of_week between 0 and 6),
    -- 0=อาทิตย์, 1=จันทร์, 2=อังคาร, 3=พุธ, 4=พฤหัส, 5=ศุกร์, 6=เสาร์
  start_time time not null,
  end_time time not null,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  -- ห้องเดิม + เวลาเดิม + วันเดิม = ซ้ำกันไม่ได้
  unique (room_id, day_of_week, start_time)
);

-- =============================================
-- SCHEDULE_STUDENTS — นักเรียนในแต่ละ class
-- =============================================
create table schedule_students (
  id uuid primary key default uuid_generate_v4(),
  schedule_id uuid not null references class_schedules(id) on delete cascade,
  student_id uuid not null references students(id),
  enrollment_id uuid references enrollments(id),
  joined_at date default current_date,
  created_at timestamptz default now(),
  unique (schedule_id, student_id)
);

-- =============================================
-- CLASS_SESSIONS — คลาสจริงแต่ละครั้ง (one-off หรือจาก schedule)
-- ใช้สำหรับ override หรือคลาสพิเศษ
-- =============================================
create table class_sessions (
  id uuid primary key default uuid_generate_v4(),
  schedule_id uuid references class_schedules(id),  -- null = คลาสพิเศษ
  course_id uuid references courses(id),
  room_id uuid references rooms(id),
  teacher_id uuid references profiles(id),
  session_date date not null,
  start_time time not null,
  end_time time not null,
  status text default 'scheduled'
    check (status in ('scheduled','completed','cancelled')),
  notes text,
  created_at timestamptz default now(),
  -- ห้องเดิม + วันเดิม + เวลาเดิม = ซ้ำไม่ได้
  unique (room_id, session_date, start_time)
);

-- =============================================
-- EXPENSE_CATEGORIES — หมวดหมู่รายจ่าย
-- =============================================
create table expense_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  icon text default '💰',
  color text default '#5F5E5A',
  sort_order int default 0,
  created_at timestamptz default now()
);

insert into expense_categories (name, icon, color, sort_order) values
  ('ค่าเช่า/สถานที่', '🏠', '#185FA5', 1),
  ('เงินเดือนครู', '👩‍🏫', '#1D9E75', 2),
  ('อุปกรณ์การสอน', '📚', '#BA7517', 3),
  ('ค่าไฟ/น้ำ/อินเทอร์เน็ต', '💡', '#993556', 4),
  ('การตลาด/โฆษณา', '📣', '#534AB7', 5),
  ('ค่าซ่อมแซม', '🔧', '#5F5E5A', 6),
  ('อื่นๆ', '📌', '#5F5E5A', 7);

-- =============================================
-- EXPENSES — รายจ่าย
-- =============================================
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid references expense_categories(id),
  title text not null,
  amount numeric(10,2) not null check (amount > 0),
  expense_date date not null default current_date,
  payment_method text default 'transfer'
    check (payment_method in ('transfer','cash','promptpay','credit')),
  receipt_url text,          -- URL รูปใบเสร็จ (optional)
  recorded_by uuid references profiles(id),
  notes text,
  is_recurring boolean default false,    -- รายจ่ายประจำ (เช่น ค่าเช่ารายเดือน)
  recurring_day int check (recurring_day between 1 and 31), -- วันที่จ่ายทุกเดือน
  created_at timestamptz default now()
);

-- =============================================
-- RLS: ทุก staff ทำได้หมด
-- =============================================
alter table rooms enable row level security;
alter table class_schedules enable row level security;
alter table schedule_students enable row level security;
alter table class_sessions enable row level security;
alter table expense_categories enable row level security;
alter table expenses enable row level security;

-- Rooms
create policy "rooms_staff_all" on rooms for all using (is_staff());
create policy "rooms_parent_read" on rooms for select using (is_parent());

-- Schedules
create policy "schedules_staff_all" on class_schedules for all using (is_staff());
create policy "schedules_parent_read" on class_schedules for select using (is_parent());

-- Schedule students
create policy "schedule_students_staff_all" on schedule_students for all using (is_staff());
create policy "schedule_students_parent_read" on schedule_students for select using (
  is_parent() and exists (
    select 1 from students where id = schedule_students.student_id and parent_id = auth.uid()
  )
);

-- Sessions
create policy "sessions_staff_all" on class_sessions for all using (is_staff());
create policy "sessions_parent_read" on class_sessions for select using (is_parent());

-- Expenses (staff only, parents don't see financial data)
create policy "expense_categories_staff_all" on expense_categories for all using (is_staff());
create policy "expenses_staff_all" on expenses for all using (is_staff());

-- =============================================
-- VIEW: monthly summary (รายได้ vs รายจ่าย)
-- =============================================
create or replace view monthly_summary as
select
  to_char(month_date, 'YYYY-MM') as month,
  to_char(month_date, 'Month YYYY') as month_label,
  coalesce(income, 0) as income,
  coalesce(expense, 0) as expense,
  coalesce(income, 0) - coalesce(expense, 0) as profit
from (
  select generate_series(
    date_trunc('month', now() - interval '5 months'),
    date_trunc('month', now()),
    '1 month'
  ) as month_date
) months
left join (
  select date_trunc('month', issued_at::timestamptz) as m, sum(amount) as income
  from receipts group by 1
) r on r.m = months.month_date
left join (
  select date_trunc('month', expense_date::timestamptz) as m, sum(amount) as expense
  from expenses group by 1
) e on e.m = months.month_date
order by month_date;

-- INDEX
create index if not exists idx_class_schedules_room on class_schedules(room_id, day_of_week);
create index if not exists idx_class_schedules_teacher on class_schedules(teacher_id);
create index if not exists idx_class_sessions_date on class_sessions(session_date, room_id);
create index if not exists idx_expenses_date on expenses(expense_date);
create index if not exists idx_expenses_category on expenses(category_id);
create index if not exists idx_schedule_students_schedule on schedule_students(schedule_id);
