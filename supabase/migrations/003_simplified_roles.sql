-- =============================================
-- Migration 003: Simplified Roles — staff + parent
-- ทุก staff ทำได้เหมือนกันทุกอย่าง, parent ดูเฉพาะลูก
-- รัน SQL นี้ใน Supabase SQL Editor (ต่อจาก 001 + 002)
-- =============================================

-- Drop policies เดิมทั้งหมด (จาก 002)
do $$ declare
  r record;
begin
  for r in (
    select policyname, tablename from pg_policies
    where schemaname = 'public'
  ) loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- Drop helper function เดิม
drop function if exists get_my_role();

-- =============================================
-- อัปเดต role constraint ใน profiles
-- =============================================
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('staff', 'parent'));

-- อัปเดต seed data ถ้ามี admin/teacher เดิม
update profiles set role = 'staff' where role in ('admin', 'teacher');

-- =============================================
-- HELPER FUNCTION
-- =============================================
create or replace function is_staff()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'staff'
  )
$$;

create or replace function is_parent()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'parent'
  )
$$;

-- =============================================
-- PROFILES
-- =============================================
create policy "profiles_own"
  on profiles for all
  using (id = auth.uid());

create policy "profiles_staff_read_all"
  on profiles for select
  using (is_staff());

create policy "profiles_staff_manage"
  on profiles for insert
  with check (is_staff());

create policy "profiles_staff_update_others"
  on profiles for update
  using (is_staff());

-- =============================================
-- STUDENTS — staff ทำได้ทุกอย่าง, parent เห็นเฉพาะลูก
-- =============================================
create policy "students_staff_all"
  on students for all
  using (is_staff());

create policy "students_parent_read"
  on students for select
  using (is_parent() and parent_id = auth.uid());

-- =============================================
-- ENROLLMENTS
-- =============================================
create policy "enrollments_staff_all"
  on enrollments for all
  using (is_staff());

create policy "enrollments_parent_read"
  on enrollments for select
  using (
    is_parent() and exists (
      select 1 from students
      where id = enrollments.student_id and parent_id = auth.uid()
    )
  );

-- =============================================
-- CHECKINS
-- =============================================
create policy "checkins_staff_all"
  on checkins for all
  using (is_staff());

create policy "checkins_parent_read"
  on checkins for select
  using (
    is_parent() and exists (
      select 1 from students
      where id = checkins.student_id and parent_id = auth.uid()
    )
  );

-- =============================================
-- LESSON LOGS
-- =============================================
create policy "lessons_staff_all"
  on lesson_logs for all
  using (is_staff());

create policy "lessons_parent_read"
  on lesson_logs for select
  using (
    is_parent() and exists (
      select 1 from students
      where id = lesson_logs.student_id and parent_id = auth.uid()
    )
  );

-- =============================================
-- REVIEWS
-- =============================================
create policy "reviews_staff_all"
  on reviews for all
  using (is_staff());

create policy "reviews_parent_read"
  on reviews for select
  using (
    is_parent() and visible_to_parent = true and exists (
      select 1 from students
      where id = reviews.student_id and parent_id = auth.uid()
    )
  );

-- =============================================
-- ALERTS
-- =============================================
create policy "alerts_staff_all"
  on alerts for all
  using (is_staff());

-- =============================================
-- RECEIPTS
-- =============================================
create policy "receipts_staff_all"
  on receipts for all
  using (is_staff());

create policy "receipts_parent_read"
  on receipts for select
  using (
    is_parent() and exists (
      select 1 from students
      where id = receipts.student_id and parent_id = auth.uid()
    )
  );

-- =============================================
-- COURSES — ทุกคนอ่านได้, staff เขียนได้
-- =============================================
create policy "courses_everyone_read"
  on courses for select using (true);

create policy "courses_staff_write"
  on courses for insert with check (is_staff());

create policy "courses_staff_update"
  on courses for update using (is_staff());

create policy "courses_staff_delete"
  on courses for delete using (is_staff());

-- =============================================
-- ALERT SETTINGS
-- =============================================
create policy "alert_settings_staff_all"
  on alert_settings for all using (is_staff());

create policy "alert_settings_parent_read"
  on alert_settings for select using (is_parent());

-- =============================================
-- INDEX
-- =============================================
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_students_parent on students(parent_id);
create index if not exists idx_enrollments_student_status on enrollments(student_id, status);
create index if not exists idx_enrollments_teacher on enrollments(teacher_id);
create index if not exists idx_checkins_student_date on checkins(student_id, check_in_at);
create index if not exists idx_lesson_logs_enrollment on lesson_logs(enrollment_id);
create index if not exists idx_reviews_student on reviews(student_id, visible_to_parent);
create index if not exists idx_receipts_student on receipts(student_id);
