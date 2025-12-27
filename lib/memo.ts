import { keccak256, stringToHex } from 'viem'

export type IvmsFormat = 'json' | 'text'

export type IvmsPayload = {
  schema: 'ivms-1'
  format: IvmsFormat
  payload: unknown
}

export type MemoRecord = {
  memoId: `0x${string}`
  sender: `0x${string}`
  recipient: `0x${string}`
  token: {
    address: `0x${string}`
    symbol: string
    decimals: number
  }
  amountBase: string
  amountDisplay: string
  txHash?: `0x${string}`
  ivms: IvmsPayload
  ivmsCanonical: string
  file?: {
    url: string
    filename: string
    contentType: string
  }
  createdAt: string
}

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => [key, sortValue(val)])
    return Object.fromEntries(entries)
  }
  return value
}

export const canonicalizeJson = (value: unknown) => JSON.stringify(sortValue(value))

export const hashMemo = (canonical: string) =>
  keccak256(stringToHex(canonical)) as `0x${string}`

export const isValidMemoId = (memoId: string) =>
  /^0x[0-9a-fA-F]{64}$/.test(memoId)

export const buildMemoAccessMessage = (memoId: string, address: string) =>
  `Tempo Memo Access\nMemo: ${memoId}\nAddress: ${address}`
