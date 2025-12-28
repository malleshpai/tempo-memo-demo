import { NextResponse, type NextRequest } from 'next/server'
import { list } from '@vercel/blob'
import { isAddress, isHex, verifyMessage, type Hex } from 'viem'
import { buildMemoAccessMessage, isValidMemoId, MemoRecord } from '../../../../../../lib/memo'


async function loadRecord(memoId: string) {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_ONLY_TOKEN
    const storeId = token?.split('_')[3]
    if (storeId) {
      const recordUrl = `https://${storeId}.public.blob.vercel-storage.com/memos/${memoId}/record.json`
      const direct = await fetch(recordUrl)
      if (direct.ok) {
        return (await direct.json()) as MemoRecord
      }
    }

    if (!token) return null
    const result = await list({ prefix: `memos/${memoId}/record.json`, token })
    if (!result.blobs.length) return null
    const latest = [...result.blobs].sort((a, b) => (new Date(b.uploadedAt).getTime()) - (new Date(a.uploadedAt).getTime()))[0]
    const response = await fetch(latest.downloadUrl)
    if (!response.ok) return null
    return (await response.json()) as MemoRecord
  } catch {
    return null
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ memoId: string }> }) {
  try {
    const { memoId } = await context.params
    if (!isValidMemoId(memoId)) {
      return NextResponse.json({ error: 'Invalid memo ID.' }, { status: 400 })
    }

    const body = await request.json()
    const address = body?.address as string
    const signature = body?.signature as string

    if (!signature || !isHex(signature)) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
    }

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: 'Invalid address.' }, { status: 400 })
    }

    const message = buildMemoAccessMessage(memoId, address)
    const isValid = await verifyMessage({ address, message, signature: signature as Hex })
    if (!isValid) {
      return NextResponse.json({ error: 'Signature verification failed.' }, { status: 401 })
    }

    const record = await loadRecord(memoId)
    if (!record) {
      return NextResponse.json({ error: 'Memo not found.' }, { status: 404 })
    }

    const addressLc = address.toLowerCase()
    if (
      record.sender.toLowerCase() !== addressLc &&
      record.recipient.toLowerCase() !== addressLc
    ) {
      return NextResponse.json({ error: 'Not authorized for this memo.' }, { status: 403 })
    }

    return NextResponse.json({
    memoId: record.memoId,
    sender: record.sender,
    recipient: record.recipient,
    token: record.token,
    amountBase: record.amountBase,
    amountDisplay: record.amountDisplay,
    txHash: record.txHash,
    ivms: record.ivms,
    file: record.file,
    createdAt: record.createdAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Unable to access memo: ${message}` }, { status: 500 })
  }
}
