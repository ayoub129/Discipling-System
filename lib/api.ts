import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown
  try { body = await request.json() } catch { throw new Error('Invalid JSON body') }
  return schema.parse(body)
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  if (error instanceof Error && error.message === 'Invalid JSON body') return NextResponse.json({ error: error.message }, { status: 400 })
  if (error instanceof Error && error.message.startsWith('This local time does not exist')) return NextResponse.json({ error: error.message }, { status: 400 })
  console.error('API operation failed', error instanceof Error ? error.message : 'Unknown error')
  return NextResponse.json({ error: 'Unable to complete this action. Please try again.' }, { status: 500 })
}

export function databaseError(error: { code?: string; message: string }) {
  if (error.code === 'P0001') return NextResponse.json({ error: error.message }, { status: 409 })
  if (error.code === '23505') return NextResponse.json({ error: 'This item already exists.' }, { status: 409 })
  if (error.code === '23503' || error.code === '23514' || error.code === '22P02') return NextResponse.json({ error: 'Invalid values or a referenced item is unavailable.' }, { status: 400 })
  if (error.code === '42501') return NextResponse.json({ error: 'You cannot change this item.' }, { status: 403 })
  console.error('Database operation failed', error.code)
  return NextResponse.json({ error: 'Unable to save. Please try again.' }, { status: 500 })
}
