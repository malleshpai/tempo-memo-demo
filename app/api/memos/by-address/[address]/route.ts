import { NextResponse, type NextRequest } from 'next/server'
import { list } from '@vercel/blob'
import { isAddress } from 'viem'
import { maybeRefreshOnchainIndex } from '../../../../../lib/onchainIndexer'

const normalizeAddress = (value: string) => value.toLowerCase()

async function loadSummaries(address: string) {
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_ONLY_TOKEN
  if (!token) return []
  const result = await list({ prefix: `memos/by-address/${address}/`, token })
  if (!result.blobs.length) return []
  const summaries = await Promise.all(
    result.blobs.map(async (blob) => {
      const response = await fetch(blob.downloadUrl)
      if (!response.ok) return null
      return response.json()
    }),
  )
  return summaries.filter(Boolean)
}

export async function GET(_request: NextRequest, context: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await context.params
    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: 'Invalid address.' }, { status: 400 })
    }

    const normalized = normalizeAddress(address)
    await maybeRefreshOnchainIndex()
    const items = await loadSummaries(normalized)
    const sorted = items
      .filter((item) => item && item.memoId && !item.deleted)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ items: sorted })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Unable to load memos: ${message}` }, { status: 500 })
  }
}
