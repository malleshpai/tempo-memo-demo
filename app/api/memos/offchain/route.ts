import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'
import type { MemoRecord } from '../../../../lib/memo'

const isRecordBlob = (pathname: string) => pathname.startsWith('memos/') && pathname.endsWith('/record.json')

export async function GET() {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_ONLY_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'Missing blob token.' }, { status: 500 })
    }

    const result = await list({ prefix: 'memos/', token })
    const recordBlobs = result.blobs.filter((blob) => isRecordBlob(blob.pathname))

    const records = await Promise.all(
      recordBlobs.map(async (blob) => {
        const response = await fetch(blob.downloadUrl)
        if (!response.ok) return null
        const record = (await response.json()) as MemoRecord
        return {
          memoId: record.memoId,
          sender: record.sender,
          recipient: record.recipient,
          token: record.token,
          amountDisplay: record.amountDisplay,
          createdAt: record.createdAt,
          hasInvoice: Boolean(record.invoice),
          source: 'offchain',
          recordUrl: blob.downloadUrl,
        }
      }),
    )

    const items = records
      .filter(Boolean)
      .sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime())

    return NextResponse.json({ items })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Unable to load offchain memos: ${message}` }, { status: 500 })
  }
}
