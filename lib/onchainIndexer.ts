import { list, put } from '@vercel/blob'
import { createPublicClient, http, hexToString, parseAbiItem, isAddress } from 'viem'
import type { OnchainEncryptedMemo } from './onchainMemo'

const RPC_URL = 'https://rpc.testnet.tempo.xyz'
const INDEX_STATE_KEY = 'memos/onchain-indexer/state.json'
const MAX_BLOCK_RANGE = BigInt(5000)
const INITIAL_LOOKBACK = BigInt(2000)

type IndexState = {
  lastBlock?: number
  lastRun?: number
  lastManualBlock?: number
  lastManualRun?: number
}

type IndexMode = 'auto' | 'manual'

type IndexerResult =
  | {
      ok: true
      mode: IndexMode
      fromBlock: string
      toBlock: string
      stored: number
      deleted: number
      chunks: number
    }
  | {
      ok: true
      mode: IndexMode
      message: string
    }
  | {
      ok: false
      error: string
    }

const getToken = () => process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_ONLY_TOKEN

type IndexerConfig =
  | {
      token: string
      memoStoreAddress: `0x${string}`
    }
  | {
      error: string
    }


const getIndexerConfig = (): IndexerConfig => {
  const token = getToken()
  if (!token) return { error: 'Missing blob token.' }
  const memoStoreAddress = process.env.NEXT_PUBLIC_MEMO_STORE_ADDRESS
  if (!memoStoreAddress || !isAddress(memoStoreAddress)) {
    return { error: 'Memo store not configured.' }
  }
  return { token, memoStoreAddress: memoStoreAddress as `0x${string}` }
}

const loadState = async (token: string) => {
  const result = await list({ prefix: 'memos/onchain-indexer/', token })
  const blob = result.blobs.find((item) => item.pathname === INDEX_STATE_KEY)
  if (!blob) return null
  const response = await fetch(blob.downloadUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) return null
  return response.json() as Promise<IndexState>
}

const saveState = async (token: string, state: IndexState) => {
  const payload = new Blob([JSON.stringify(state, null, 2)], {
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

const buildSummary = (
  memoHash: `0x${string}`,
  sender: string,
  recipient: string,
  memo: OnchainEncryptedMemo,
  txHash?: `0x${string}`,
) => ({
  memoId: memoHash,
  sender,
  recipient,
  token: memo.token ?? {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'Unknown',
    decimals: 0,
  },
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

const findBlockByTimestamp = async (client: ReturnType<typeof createPublicClient>, latestBlock: bigint, target: bigint) => {
  if (target <= BigInt(0)) return BigInt(0)

  let low = BigInt(0)
  let high = latestBlock

  while (low < high) {
    const mid = (low + high) / BigInt(2)
    const block = await client.getBlock({ blockNumber: mid })
    if (block.timestamp < target) {
      low = mid + BigInt(1)
    } else {
      high = mid
    }
  }

  return low
}

const computeStartBlock = async (
  mode: IndexMode,
  client: ReturnType<typeof createPublicClient>,
  latestBlock: bigint,
  state: IndexState | null,
) => {
  if (mode === 'manual') {
    if (state?.lastManualBlock) {
      return BigInt(state.lastManualBlock) + BigInt(1)
    }
    const target = BigInt(Math.floor(Date.now() / 1000) - 86400)
    return findBlockByTimestamp(client, latestBlock, target)
  }

  if (state?.lastBlock) {
    return BigInt(state.lastBlock) + BigInt(1)
  }
  return latestBlock > INITIAL_LOOKBACK ? latestBlock - INITIAL_LOOKBACK : BigInt(0)
}

export const runOnchainIndexer = async (mode: IndexMode = 'auto'): Promise<IndexerResult> => {
  const config = getIndexerConfig()
  if ('error' in config) {
    return { ok: false, error: config.error }
  }

  const { token, memoStoreAddress } = config
  const client = createPublicClient({ transport: http(RPC_URL) })
  const latestBlock = await client.getBlockNumber()
  const state = await loadState(token)

  let start = await computeStartBlock(mode, client, latestBlock, state)
  if (start > latestBlock) {
    const updatedState: IndexState = { ...state }
    if (mode === 'manual') {
      updatedState.lastManualBlock = Number(latestBlock)
      updatedState.lastManualRun = Date.now()
    } else {
      updatedState.lastBlock = Number(latestBlock)
      updatedState.lastRun = Date.now()
    }
    await saveState(token, updatedState)
    return { ok: true, mode, message: 'No new blocks.' }
  }

  const storedEvent = parseAbiItem(
    'event MemoStored(bytes32 indexed memoHash, address indexed sender, address indexed recipient, bytes data)',
  )
  const deletedEvent = parseAbiItem('event MemoDeleted(bytes32 indexed memoHash, address indexed recipient)')

  let storedCount = 0
  let deletedCount = 0
  let chunks = 0
  const initialStart = start
  let end = start

  while (start <= latestBlock) {
    end =
      start + MAX_BLOCK_RANGE - BigInt(1) > latestBlock
        ? latestBlock
        : start + MAX_BLOCK_RANGE - BigInt(1)

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

    storedCount += storedLogs.length
    deletedCount += deletedLogs.length

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
        writeSummary(token, sender.toLowerCase(), memoHash, {
          ...summary,
          role: 'sender',
          counterparty: recipient,
        }),
        writeSummary(token, recipient.toLowerCase(), memoHash, {
          ...summary,
          role: 'recipient',
          counterparty: sender,
        }),
      ])
    }

    for (const log of deletedLogs) {
      const memoHash = log.args.memoHash as `0x${string}` | undefined
      const recipient = (log.args.recipient as string | undefined) ?? ''
      if (!memoHash || !recipient) continue
      await writeSummary(token, recipient.toLowerCase(), memoHash, { memoId: memoHash, deleted: true })
    }

    chunks += 1
    if (end === latestBlock) break
    start = end + BigInt(1)
  }

  const updatedState: IndexState = { ...state }
  if (mode === 'manual') {
    updatedState.lastManualBlock = Number(end)
    updatedState.lastManualRun = Date.now()
  } else {
    updatedState.lastBlock = Number(end)
    updatedState.lastRun = Date.now()
  }
  await saveState(token, updatedState)

  return {
    ok: true,
    mode,
    fromBlock: initialStart.toString(),
    toBlock: end.toString(),
    stored: storedCount,
    deleted: deletedCount,
    chunks,
  }
}

export const maybeRefreshOnchainIndex = async (minIntervalMs = 2 * 60 * 1000): Promise<IndexerResult> => {
  const config = getIndexerConfig()
  if ('error' in config) {
    return { ok: false, error: config.error }
  }

  const state = await loadState(config.token)
  const lastRun = state?.lastRun ?? 0
  if (Date.now() - lastRun < minIntervalMs) {
    return { ok: true, mode: 'auto', message: 'Skipped.' }
  }

  return runOnchainIndexer('auto')
}
