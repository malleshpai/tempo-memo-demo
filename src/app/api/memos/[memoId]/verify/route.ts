import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { isAddress, verifyMessage } from 'viem'
import { buildMemoAccessMessage, isValidMemoId, MemoRecord } from '../../../../../../lib/memo'

export async function POST(request: Request, context: { params: { memoId: string } }) {
  const memoId = context.params.memoId
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
  const isValid = await verifyMessage({ address, message, signature })
  if (!isValid) {
    return NextResponse.json({ error: 'Signature verification failed.' }, { status: 401 })
  }

  const raw = await kv.get<string>(`memo:${memoId}`)
  if (!raw) {
    return NextResponse.json({ error: 'Memo not found.' }, { status: 404 })
  }

  const record = JSON.parse(raw) as MemoRecord
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
