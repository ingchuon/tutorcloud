// src/app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST() {
  revalidatePath('/staff')
  revalidatePath('/staff/receipts')
  return NextResponse.json({ revalidated: true })
}
