import { NextResponse } from 'next/server'
import { runOnchainIndexer } from '../../../../lib/onchainIndexer'

export async function GET() {
  try {
    const result = await runOnchainIndexer()
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
