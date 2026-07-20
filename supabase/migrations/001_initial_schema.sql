-- =============================================
-- Mando House — Database Schema
-- รัน script นี้ใน Supabase SQL Editor
-- =============================================

-- Extensions
create extension if not exists "uuid-ossp";

-- =============================================
-- COURSES — คอร์สและราคา
-- =============================================
create table courses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  name_en text,
  type text not null check (type in ('group','one_on_one','kids','hsk')),
  description text,
  total_lessons int not null,
  duration_minutes int not null default 60,
  price numeric(10,2) not null,
  max_students int default 5,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =============================================
-- PROFILES — ผู้ใช้งาน (ครู + ผู้ปกครอง)
-- =============================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','teacher','parent')),
  full_name text not null,
  phone text,
  line_id text,
  avatar_url text,
  created_at timestamptz default now()
);

-- =============================================
-- STUDENTS — ข้อมูลนักเรียน
-- =============================================
create table students (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  nickname text,
  date_of_birth date,
  gender text check (gender in ('male','female','other')),
  parent_id uuid references profiles(id),
  parent_name text,
  parent_phone text,
  parent_line_id text,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =============================================
-- ENROLLMENTS — การลงทะเบียนคอร์ส
-- =============================================
create table enrollments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  course_id uuid not null references courses(id),
  teacher_id uuid references profiles(id),
  enrolled_at date not null default current_date,
  expires_at date,
  lessons_used int not null default 0,
  lessons_total int not null,
  status text not null default 'active'
    check (status in ('active','completed','expired','paused')),
  paid_amount numeric(10,2),
  payment_method text check (payment_method in ('transfer','cash','promptpay')),
  notes text,
  created_at timestamptz default now()
);

-- =============================================
-- CHECKINS — เช็กอิน/เช็กเอาท์
-- =============================================
create table checkins (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id),
  enrollment_id uuid references enrollments(id),
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  duration_minutes int generated always as (
    case when check_out_at is not null
    then extract(epoch from (check_out_at - check_in_at))/60
    else null end
  ) stored,
  recorded_by uuid references profiles(id),
  notes text,
  created_at timestamptz default now()
);

-- =============================================
-- LESSON_LOGS — บันทึกครั้งการเรียน
-- =============================================
create table lesson_logs (
  id uuid primary key default uuid_generate_v4(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  student_id uuid not null references students(id),
  lesson_date date not null default current_date,
  lesson_number int not null,
  teacher_id uuid references profiles(id),
  topic text,
  homework text,
  created_at timestamptz default now()
);

-- Auto-increment lessons_used on enrollment when lesson logged
create or replace function increment_lessons_used()
returns trigger language plpgsql as $$
begin
  update enrollments
  set lessons_used = lessons_used + 1
  where id = new.enrollment_id;
  return new;
end;
$$;

create trigger trg_increment_lessons
after insert on lesson_logs
for each row execute function increment_lessons_used();

-- =============================================
-- REVIEWS — รีวิวหลังการสอน
-- =============================================
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  enrollment_id uuid not null references enrollments(id),
  student_id uuid not null references students(id),
  teacher_id uuid references profiles(id),
  lesson_log_id uuid references lesson_logs(id),
  review_date date not null default current_date,
  rating int check (rating between 1 and 5),
  content text not null,
  skills_practiced text[], -- e.g. ['พินอิน','คำศัพท์','การพูด']
  homework_given text,
  visible_to_parent boolean default true,
  created_at timestamptz default now()
);

-- =============================================
-- ALERTS — การแจ้งเตือน
-- =============================================
create table alerts (
  id uuid primary key default uuid_generate_v4(),
  enrollment_id uuid not null references enrollments(id),
  student_id uuid not null references students(id),
  alert_type text not null
    check (alert_type in ('course_ending','course_expired','payment_due','custom')),
  message text not null,
  lessons_remaining int,
  is_sent boolean default false,
  sent_at timestamptz,
  sent_via text check (sent_via in ('line','sms','email','manual')),
  created_at timestamptz default now()
);

-- =============================================
-- RECEIPTS — ใบเสร็จ
-- =============================================
create table receipts (
  id uuid primary key default uuid_generate_v4(),
  receipt_number text not null unique,
  enrollment_id uuid not null references enrollments(id),
  student_id uuid not null references students(id),
  issued_by uuid references profiles(id),
  issued_at date not null default current_date,
  amount numeric(10,2) not null,
  payment_method text check (payment_method in ('transfer','cash','promptpay')),
  items jsonb not null default '[]',
  notes text,
  created_at timestamptz default now()
);

-- Auto-generate receipt number
create or replace function generate_receipt_number()
returns trigger language plpgsql as $$
declare
  yr text := to_char(now(), 'YYYY');
  seq int;
begin
  select count(*) + 1 into seq from receipts where extract(year from issued_at) = extract(year from now());
  new.receipt_number := 'MH-' || yr || '-' || lpad(seq::text, 4, '0');
  return new;
end;
$$;

create trigger trg_receipt_number
before insert on receipts
for each row when (new.receipt_number is null or new.receipt_number = '')
execute function generate_receipt_number();

-- =============================================
-- ALERT SETTINGS — ตั้งค่าการแจ้งเตือน
-- =============================================
create table alert_settings (
  id uuid primary key default uuid_generate_v4(),
  warn_at_lessons_remaining int not null default 3,
  notify_teacher boolean default true,
  notify_parent boolean default true,
  notify_via_line boolean default true,
  notify_via_email boolean default false,
  daily_alert_time time default '09:00:00',
  updated_at timestamptz default now()
);

insert into alert_settings (warn_at_lessons_remaining) values (3);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table profiles enable row level security;
alter table students enable row level security;
alter table enrollments enable row level security;
alter table checkins enable row level security;
alter table lesson_logs enable row level security;
alter table reviews enable row level security;
alter table alerts enable row level security;
alter table receipts enable row level security;
alter table courses enable row level security;

-- Admins & Teachers can see everything
create policy "admin_teacher_all" on students
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('admin','teacher')
    )
  );

create policy "admin_teacher_all_enroll" on enrollments
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
  );

create policy "admin_teacher_all_checkin" on checkins
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
  );

create policy "admin_teacher_all_lessons" on lesson_logs
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
  );

create policy "admin_teacher_all_reviews" on reviews
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
  );

create policy "admin_teacher_all_receipts" on receipts
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
  );

create policy "admin_teacher_all_alerts" on alerts
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
  );

-- Parents can only see their child's data
create policy "parent_view_own_children" on students
  for select using (
    parent_id = auth.uid() or
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
  );

create policy "parent_view_own_enrollments" on enrollments
  for select using (
    exists (
      select 1 from students s
      where s.id = enrollments.student_id and s.parent_id = auth.uid()
    ) or
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
  );

create policy "parent_view_reviews" on reviews
  for select using (
    visible_to_parent = true and (
      exists (
        select 1 from students s
        where s.id = reviews.student_id and s.parent_id = auth.uid()
      ) or
      exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
    )
  );

create policy "parent_view_receipts" on receipts
  for select using (
    exists (
      select 1 from students s
      where s.id = receipts.student_id and s.parent_id = auth.uid()
    ) or
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
  );

-- Everyone can read courses
create policy "courses_public_read" on courses
  for select using (true);

create policy "admin_manage_courses" on courses
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
  );

-- Profiles: own profile
create policy "profiles_own" on profiles
  for all using (id = auth.uid());

create policy "profiles_admin_read_all" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'))
  );

-- =============================================
-- SEED DATA — ข้อมูลตัวอย่าง
-- =============================================
insert into courses (name, type, description, total_lessons, duration_minutes, price, max_students) values
  ('Group A1 – ภาษาจีนเริ่มต้น', 'group', 'เหมาะสำหรับผู้เริ่มต้น เรียนพินอิน คำศัพท์พื้นฐาน ประโยคทักทาย', 24, 60, 2400, 5),
  ('1-on-1 Basic – เรียนส่วนตัว', 'one_on_one', 'เรียนตัวต่อตัวกับครู ปรับเนื้อหาได้ตามความต้องการ', 12, 60, 3600, 1),
  ('1-on-1 Pro – เข้มข้น', 'one_on_one', 'เรียนตัวต่อตัว มีสื่อการสอนครบชุด รายงานพัฒนาการทุกเดือน', 12, 75, 4800, 1),
  ('Kids A – สำหรับเด็ก 5-10 ปี', 'kids', 'เรียนผ่านเพลงและเกม เน้นการออกเสียงและความสนุก', 16, 45, 2800, 4),
  ('Group A2 – ระดับกลาง', 'group', 'สำหรับผู้ที่ผ่าน A1 แล้ว เรียนไวยากรณ์และบทสนทนา', 24, 60, 2800, 5),
  ('HSK Prep – ติว HSK 1-2', 'hsk', 'เตรียมสอบ HSK ฝึกข้อสอบจริง เทคนิคการทำข้อสอบ', 10, 90, 5500, 2);
