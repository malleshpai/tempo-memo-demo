import type { Address } from 'viem'
import { encodeJson } from './crypto'

/**
 * Onchain Encrypted Memo - Version 1 (Legacy)
 * ~1860 bytes - includes redundant fields for readability
 */
export type OnchainEncryptedMemoV1 = {
  v: 1
  memoHash: `0x${string}`
  sender: Address
  recipient: Address
  senderPubKey: string
  regulatorPubKey?: string
  createdAt: string
  contentType: string
  ivmsHash: `0x${string}`
  token: {
    address: Address
    symbol: string
    decimals: number
  }
  amountDisplay: string
  keyAlg: 'ECDH-P256'
  kdf: 'HKDF-SHA256'
  enc: {
    alg: 'AES-256-GCM'
    iv: string
    ciphertext: string
  }
  keys: {
    addr: Address
    iv: string
    encKey: string
  }[]
}

/**
 * Onchain Encrypted Memo - Version 2 (Compact)
 * ~950 bytes - optimized for onchain storage
 *
 * Removes redundant fields:
 * - memoHash: known from contract key lookup
 * - senderPubKey/regulatorPubKey: lookup from PublicKeyRegistry
 * - keyAlg/kdf/enc.alg: implied by v:2
 * - contentType: implied (always JSON)
 * - ivmsHash: same as memoHash
 * - token symbol/decimals: can lookup from token address
 *
 * Uses short keys and unix timestamps for compactness.
 * Key order in k[] is fixed: [sender, recipient, regulator]
 */
export type OnchainEncryptedMemoV2 = {
  v: 2
  s: Address           // sender address
  r: Address           // recipient address
  t: number            // createdAt (unix seconds)
  tk: Address          // token address
  amt: string          // amount display string
  add?: string         // additionalInfo (base64, max 128 bytes decoded)
  iv: string           // encryption IV (base64)
  ct: string           // ciphertext (base64)
  k: [string, string][] // [[iv, encKey], ...] for sender, recipient, regulator
}

export type OnchainEncryptedMemo = OnchainEncryptedMemoV1 | OnchainEncryptedMemoV2

// V2 constants (implied, not stored)
export const V2_KEY_ALG = 'ECDH-P256' as const
export const V2_KDF = 'HKDF-SHA256' as const
export const V2_ENC_ALG = 'AES-256-GCM' as const
export const V2_CONTENT_TYPE = 'application/json' as const

// Max additional info size (128 bytes before base64)
export const MAX_ADDITIONAL_INFO_BYTES = 128

export const onchainMemoSize = (memo: OnchainEncryptedMemo) => encodeJson(memo).length

/**
 * Check if memo is v2 format
 */
export const isV2Memo = (memo: OnchainEncryptedMemo): memo is OnchainEncryptedMemoV2 => memo.v === 2

/**
 * Normalize memo to common format for display
 */
export type NormalizedMemo = {
  version: 1 | 2
  sender: Address
  recipient: Address
  createdAt: Date
  tokenAddress: Address
  amountDisplay: string
  additionalInfo?: string
  encIv: string
  encCiphertext: string
  keys: { iv: string; encKey: string }[]
}

export const normalizeMemo = (memo: OnchainEncryptedMemo): NormalizedMemo => {
  if (isV2Memo(memo)) {
    return {
      version: 2,
      sender: memo.s,
      recipient: memo.r,
      createdAt: new Date(memo.t * 1000),
      tokenAddress: memo.tk,
      amountDisplay: memo.amt,
      additionalInfo: memo.add,
      encIv: memo.iv,
      encCiphertext: memo.ct,
      keys: memo.k.map(([iv, encKey]) => ({ iv, encKey })),
    }
  }
  return {
    version: 1,
    sender: memo.sender,
    recipient: memo.recipient,
    createdAt: new Date(memo.createdAt),
    tokenAddress: memo.token.address,
    amountDisplay: memo.amountDisplay,
    encIv: memo.enc.iv,
    encCiphertext: memo.enc.ciphertext,
    keys: memo.keys.map(({ iv, encKey }) => ({ iv, encKey })),
  }
}
