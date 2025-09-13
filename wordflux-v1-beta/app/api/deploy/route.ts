import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const filePath = path.join(process.cwd(), 'data', 'deploy.json')

export async function GET() {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(raw)
    const count = Number(json.count || 0)
    return NextResponse.json({ ok: true, count }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, count: 0, error: e?.message || 'read_failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
