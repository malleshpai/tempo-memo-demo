import { NextResponse, type NextRequest } from 'next/server'
import { list } from '@vercel/blob'
import { isAddress, verifyMessage, type Hex } from 'viem'
import { buildMemoAccessMessage, isValidMemoId, MemoRecord } from '../../../../../lib/memo'

async function loadRecord(memoId: string) {
  const result = await list({ prefix: `memos/${memoId}/record.json` })
  if (!result.blobs.length) return null
  const latest = [...result.blobs].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0]
  const response = await fetch(latest.downloadUrl)
  if (!response.ok) return null
  return (await response.json()) as MemoRecord
}

export async function POST(request: NextRequest, context: { params: Promise<{ memoId: string }> }) {
  const { memoId } = await context.params
  if (!isValidMemoId(memoId)) {
    return NextResponse.json({ error: 'Invalid memo ID.' }, { status: 400 })
  }

  const body = await request.json()
  const address = body?.address as string
  const signature = body?.signature as string

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: 'Invalid address.' }, { status: 400 })
  }
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 })
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
}
