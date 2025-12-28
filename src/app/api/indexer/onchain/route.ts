import { NextResponse } from 'next/server'
import { list, put } from '@vercel/blob'
import { createPublicClient, http, hexToString, parseAbiItem, isAddress } from 'viem'
import type { OnchainEncryptedMemo } from '../../../../lib/onchainMemo'

const RPC_URL = 'https://rpc.testnet.tempo.xyz'
const INDEX_STATE_KEY = 'memos/onchain-indexer/state.json'
const MAX_BLOCK_RANGE = BigInt(5000)
const INITIAL_LOOKBACK = BigInt(2000)

const getToken = () => process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_ONLY_TOKEN

const loadState = async (token: string) => {
  const result = await list({ prefix: 'memos/onchain-indexer/', token })
  const blob = result.blobs.find((item) => item.pathname === INDEX_STATE_KEY)
  if (!blob) return null
  const response = await fetch(blob.downloadUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) return null
  return response.json() as Promise<{ lastBlock?: number }>
}

const saveState = async (token: string, lastBlock: bigint) => {
  const payload = new Blob([JSON.stringify({ lastBlock: Number(lastBlock) }, null, 2)], {
    type: 'application/json',
  })
  await put(INDEX_STATE_KEY, payload, {
    access: 'public',
    addRandomSuffix: false,
    token,
  })
}

const parseMemo = (dataHex: `0x${string}`) => {
  try {
    const json = hexToString(dataHex)
    return JSON.parse(json) as OnchainEncryptedMemo
  } catch {
    return null
  }
}

const buildSummary = (memoHash: `0x${string}`, sender: string, recipient: string, memo: OnchainEncryptedMemo, txHash?: `0x${string}`) => ({
  memoId: memoHash,
  sender,
  recipient,
  token: memo.token ?? { address: '0x0000000000000000000000000000000000000000', symbol: 'Unknown', decimals: 0 },
  amountDisplay: memo.amountDisplay ?? '—',
  amountBase: memo.amountDisplay ?? '—',
  txHash: txHash ?? undefined,
  createdAt: memo.createdAt ?? new Date().toISOString(),
  source: 'onchain',
})

const writeSummary = async (token: string, address: string, memoId: string, payload: Record<string, unknown>) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  await put(`memos/by-address/${address}/${memoId}.json`, blob, {
    access: 'public',
    addRandomSuffix: false,
    token,
  })
}

export async function GET() {
  const token = getToken()
  if (!token) {
    return NextResponse.json({ error: 'Missing blob token.' }, { status: 500 })
  }

  const memoStoreAddress = process.env.NEXT_PUBLIC_MEMO_STORE_ADDRESS
  if (!memoStoreAddress || !isAddress(memoStoreAddress)) {
    return NextResponse.json({ error: 'Memo store not configured.' }, { status: 500 })
  }

  const client = createPublicClient({ transport: http(RPC_URL) })
  const latestBlock = await client.getBlockNumber()
  const state = await loadState(token)
  const lastBlock = state?.lastBlock ? BigInt(state.lastBlock) : null

  const start = lastBlock ? lastBlock + BigInt(1) : (latestBlock > INITIAL_LOOKBACK ? latestBlock - INITIAL_LOOKBACK : BigInt(0))
  if (start > latestBlock) {
    return NextResponse.json({ ok: true, message: 'No new blocks.' })
  }

  const end = start + MAX_BLOCK_RANGE - BigInt(1) > latestBlock ? latestBlock : start + MAX_BLOCK_RANGE - BigInt(1)

  const storedEvent = parseAbiItem('event MemoStored(bytes32 indexed memoHash, address indexed sender, address indexed recipient, bytes data)')
  const deletedEvent = parseAbiItem('event MemoDeleted(bytes32 indexed memoHash, address indexed recipient)')

  const [storedLogs, deletedLogs] = await Promise.all([
    client.getLogs({
      address: memoStoreAddress,
      event: storedEvent,
      fromBlock: start,
      toBlock: end,
    }),
    client.getLogs({
      address: memoStoreAddress,
      event: deletedEvent,
      fromBlock: start,
      toBlock: end,
    }),
  ])

  for (const log of storedLogs) {
    const memoHash = log.args.memoHash as `0x${string}` | undefined
    const sender = (log.args.sender as string | undefined) ?? ''
    const recipient = (log.args.recipient as string | undefined) ?? ''
    const dataHex = log.args.data as `0x${string}` | undefined
    if (!memoHash || !sender || !recipient || !dataHex) continue
    const memo = parseMemo(dataHex)
    if (!memo) continue

    const summary = buildSummary(memoHash, sender, recipient, memo, log.transactionHash as `0x${string}`)
    await Promise.all([
      writeSummary(token, sender.toLowerCase(), memoHash, { ...summary, role: 'sender', counterparty: recipient }),
      writeSummary(token, recipient.toLowerCase(), memoHash, { ...summary, role: 'recipient', counterparty: sender }),
    ])
  }

  for (const log of deletedLogs) {
    const memoHash = log.args.memoHash as `0x${string}` | undefined
    const recipient = (log.args.recipient as string | undefined) ?? ''
    if (!memoHash || !recipient) continue
    await writeSummary(token, recipient.toLowerCase(), memoHash, { memoId: memoHash, deleted: true })
  }

  await saveState(token, end)

  return NextResponse.json({
    ok: true,
    fromBlock: start.toString(),
    toBlock: end.toString(),
    stored: storedLogs.length,
    deleted: deletedLogs.length,
  })
}
