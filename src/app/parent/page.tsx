// src/app/parent/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatDate, formatThaiMoney } from '@/lib/utils'

export default async function ParentPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'parent') redirect('/staff')

  const { data: children } = await supabase
    .from('students')
    .select(`
      *,
      enrollments(
        *,
        course:courses(name, total_lessons, duration_minutes),
        reviews(*, teacher:profiles(full_name)),
        checkins(check_in_at, check_out_at, duration_minutes)
      )
    `)
    .eq('parent_id', user.id)
    .eq('is_active', true)

  async function handleLogout() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="max-w-2xl mx-auto p-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src="/logo.png" alt="Mando House" className="w-full h-full object-cover" />
            </div>
            <span className="font-semibold text-gray-900">Mando House</span>
          </div>
          <p className="text-sm text-gray-500">สวัสดีครับคุณ{profile?.full_name}</p>
        </div>
        <form action={handleLogout}>
          <button type="submit" className="btn-outline btn-sm text-gray-500">ออกจากระบบ</button>
        </form>
      </div>

      {/* Children */}
      {(children ?? []).length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          ยังไม่มีข้อมูลบุตรหลาน กรุณาติดต่อครู
        </div>
      ) : (
        <div className="space-y-6">
          {(children ?? []).map(child => {
            const activeEnroll = child.enrollments?.find((e: any) => e.status === 'active')
            const remaining = activeEnroll
              ? activeEnroll.lessons_total - activeEnroll.lessons_used
              : null
            const pct = activeEnroll
              ? Math.round((activeEnroll.lessons_used / activeEnroll.lessons_total) * 100)
              : 0
            const recentReviews = activeEnroll?.reviews
              ?.filter((r: any) => r.visible_to_parent)
              ?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              ?? []
            const recentCheckins = activeEnroll?.checkins
              ?.sort((a: any, b: any) => new Date(b.check_in_at).getTime() - new Date(a.check_in_at).getTime())
              ?.slice(0, 5)
              ?? []

            return (
              <div key={child.id}>
                {/* Child card */}
                <div className="card p-5 mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-base font-bold">
                      {(child.nickname || child.full_name).slice(0, 2)}
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900 text-lg">น้อง{child.nickname || child.full_name}</h2>
                      <p className="text-sm text-gray-500">{child.full_name}</p>
                    </div>
                  </div>

                  {activeEnroll ? (
                    <div className="space-y-3">
                      <div className="bg-brand-50 rounded-xl p-4">
                        <div className="text-sm font-medium text-brand-800 mb-2">
                          📚 {activeEnroll.course?.name}
                        </div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-brand-700">เรียนแล้ว {activeEnroll.lessons_used} ครั้ง</span>
                          <span className={`font-semibold ${remaining! <= 2 ? 'text-red-600' : remaining! <= 5 ? 'text-amber-600' : 'text-brand-600'}`}>
                            เหลือ {remaining} ครั้ง
                          </span>
                        </div>
                        <div className="w-full h-2 bg-brand-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 85 ? 'bg-red-400' : pct >= 65 ? 'bg-amber-400' : 'bg-brand-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-xs text-brand-600 mt-1.5">{pct}% ของคอร์ส</div>
                      </div>

                      {remaining! <= 5 && (
                        <div className={`rounded-xl p-3 flex items-center gap-3 ${remaining! <= 2 ? 'bg-red-50' : 'bg-amber-50'}`}>
                          <span className="text-xl">{remaining! <= 2 ? '🚨' : '⚠️'}</span>
                          <div className="text-sm">
                            <div className={`font-medium ${remaining! <= 2 ? 'text-red-800' : 'text-amber-800'}`}>
                              {remaining! <= 2 ? 'ใกล้หมดคอร์สมาก!' : 'ใกล้หมดคอร์ส'}
                            </div>
                            <div className={`text-xs mt-0.5 ${remaining! <= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                              กรุณาติดต่อครูเพื่อต่อคอร์ส
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">ไม่มีคอร์สที่กำลังเรียน</div>
                  )}
                </div>

                {/* Checkin history */}
                {recentCheckins.length > 0 && (
                  <div className="card mb-4">
                    <div className="card-header"><h3 className="font-medium text-sm">การเข้าเรียนล่าสุด</h3></div>
                    <div className="divide-y divide-gray-50">
                      {recentCheckins.map((c: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 px-5 py-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-xs text-brand-700 font-medium flex-shrink-0">
                            {new Date(c.check_in_at).getDate()}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-gray-700">{formatDate(c.check_in_at)}</div>
                            <div className="text-xs text-gray-400">
                              {new Date(c.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                              {c.duration_minutes && ` · ${Math.round(c.duration_minutes)} นาที`}
                            </div>
                          </div>
                          <span className="badge badge-green text-[10px]">เข้าเรียนแล้ว</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent reviews */}
                {recentReviews.length > 0 && (
                  <div className="card">
                    <div className="card-header"><h3 className="font-medium text-sm">รายงานจากครู</h3></div>
                    <div className="divide-y divide-gray-50">
                      {recentReviews.slice(0, 5).map((r: any) => (
                        <div key={r.id} className="p-5">
                          <div className="flex justify-between items-start mb-2">
                            <div className="text-xs text-gray-400">{formatDate(r.review_date)} · {r.teacher?.full_name || 'ครู'}</div>
                            <div className="text-amber-400 text-sm">{'★'.repeat(r.rating ?? 0)}</div>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{r.content}</p>
                          {r.homework_given && (
                            <div className="mt-2 bg-amber-50 rounded-lg p-2.5 text-xs text-amber-800">
                              📝 การบ้าน: {r.homework_given}
                            </div>
                          )}
                          {r.skills_practiced?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {r.skills_practiced.map((s: string) => (
                                <span key={s} className="badge badge-purple">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-8">
        มีปัญหา? ติดต่อครูที่ 081-000-1234
      </p>
    </div>
  )
}
