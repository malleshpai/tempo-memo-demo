import type { Address } from 'viem'
import { encodeJson } from './crypto'

export type OnchainEncryptedMemo = {
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

export const onchainMemoSize = (memo: OnchainEncryptedMemo) => encodeJson(memo).length
