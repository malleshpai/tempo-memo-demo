import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { put } from '@vercel/blob'
import { canonicalizeJson, hashMemo, IvmsPayload, isValidMemoId, MemoRecord } from '../../../lib/memo'

const parseIvmsPayload = (raw: string | null) => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as IvmsPayload
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''
  let memoId = ''
  let sender = ''
  let recipient = ''
  let tokenAddress = ''
  let tokenSymbol = ''
  let tokenDecimals = ''
  let amountBase = ''
  let amountDisplay = ''
  let txHash = ''
  let ivmsCanonical = ''
  let ivmsPayload: IvmsPayload | null = null
  let file: File | null = null

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    memoId = String(formData.get('memoId') ?? '')
    sender = String(formData.get('sender') ?? '')
    recipient = String(formData.get('recipient') ?? '')
    tokenAddress = String(formData.get('tokenAddress') ?? '')
    tokenSymbol = String(formData.get('tokenSymbol') ?? '')
    tokenDecimals = String(formData.get('tokenDecimals') ?? '')
    amountBase = String(formData.get('amountBase') ?? '')
    amountDisplay = String(formData.get('amountDisplay') ?? '')
    txHash = String(formData.get('txHash') ?? '')
    ivmsCanonical = String(formData.get('ivmsCanonical') ?? '')
    ivmsPayload = parseIvmsPayload(String(formData.get('ivmsPayload') ?? ''))
    const upload = formData.get('file')
    if (upload instanceof File) {
      file = upload
    }
  } else {
    const body = await request.json()
    memoId = body.memoId ?? ''
    sender = body.sender ?? ''
    recipient = body.recipient ?? ''
    tokenAddress = body.tokenAddress ?? ''
    tokenSymbol = body.tokenSymbol ?? ''
    tokenDecimals = body.tokenDecimals ?? ''
    amountBase = body.amountBase ?? ''
    amountDisplay = body.amountDisplay ?? ''
    txHash = body.txHash ?? ''
    ivmsCanonical = body.ivmsCanonical ?? ''
    ivmsPayload = body.ivmsPayload ?? null
  }

  if (!memoId || !isValidMemoId(memoId)) {
    return NextResponse.json({ error: 'Invalid memo ID.' }, { status: 400 })
  }

  if (!ivmsPayload) {
    return NextResponse.json({ error: 'IVMS payload is missing.' }, { status: 400 })
  }

  const canonical = ivmsCanonical || canonicalizeJson(ivmsPayload)
  const computed = hashMemo(canonical)
  if (computed !== memoId) {
    return NextResponse.json({ error: 'Memo hash does not match IVMS payload.' }, { status: 400 })
  }

  let fileInfo: MemoRecord['file'] | undefined
  const createdAt = new Date().toISOString()

  if (file) {
    const blob = await put(file.name, file, { access: 'public' })
    fileInfo = {
      url: blob.url,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
    }
  } else {
    const filename = `ivms-${memoId}.json`
    const payloadBlob = new Blob([canonical], { type: 'application/json' })
    const blob = await put(filename, payloadBlob, { access: 'public' })
    fileInfo = {
      url: blob.url,
      filename,
      contentType: 'application/json',
    }
  }

  const record: MemoRecord = {
    memoId: memoId as `0x${string}`,
    sender: sender as `0x${string}`,
    recipient: recipient as `0x${string}`,
    token: {
      address: tokenAddress as `0x${string}`,
      symbol: tokenSymbol,
      decimals: Number(tokenDecimals || 0),
    },
    amountBase,
    amountDisplay,
    txHash: (txHash || undefined) as `0x${string}` | undefined,
    ivms: ivmsPayload,
    ivmsCanonical: canonical,
    file: fileInfo,
    createdAt,
  }

  await kv.set(`memo:${memoId}`, JSON.stringify(record))

  return NextResponse.json({ ok: true, memoId })
}
