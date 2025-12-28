import { NextResponse } from 'next/server'
import { runOnchainIndexer } from '../../../../lib/onchainIndexer'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') === 'manual' ? 'manual' : 'auto'
    const result = await runOnchainIndexer(mode)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
