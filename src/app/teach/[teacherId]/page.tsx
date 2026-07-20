'use client'
import { useParams } from 'next/navigation'
import TeacherPortal from '@/components/TeacherPortal'

export default function TeachTeacherPage() {
  const params = useParams()
  const teacherId = params.teacherId as string
  return <TeacherPortal initialTeacherId={teacherId} />
}
