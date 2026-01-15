import type { Address } from 'viem'

export const PUBLIC_KEY_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_PUBLIC_KEY_REGISTRY_ADDRESS?.trim() as
  | Address
  | undefined
export const MEMO_STORE_ADDRESS = process.env.NEXT_PUBLIC_MEMO_STORE_ADDRESS?.trim() as Address | undefined
export const PUBLIC_MEMO_HEADER_ADDRESS = process.env.NEXT_PUBLIC_PUBLIC_MEMO_HEADER_ADDRESS?.trim() as
  | Address
  | undefined
export const REGULATOR_PUBLIC_KEY_HEX = process.env.NEXT_PUBLIC_REGULATOR_PUBLIC_KEY_HEX?.trim()
export const REGULATOR_PRIVATE_KEY_JWK = process.env.NEXT_PUBLIC_REGULATOR_PRIVATE_KEY_JWK?.trim()
export const REGULATOR_ADDRESS = process.env.NEXT_PUBLIC_REGULATOR_ADDRESS?.trim() as Address | undefined

export const KEY_TYPE_P256 = 1

export const publicKeyRegistryAbi = [
  {
    type: 'function',
    name: 'setKey',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'key', type: 'bytes' },
      { name: 'keyType', type: 'uint8' },
      { name: 'version', type: 'uint32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getKey',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [
      { name: 'key', type: 'bytes' },
      { name: 'keyType', type: 'uint8' },
      { name: 'version', type: 'uint32' },
    ],
  },
] as const

export const memoStoreAbi = [
  {
    type: 'function',
    name: 'putMemo',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'memoHash', type: 'bytes32' },
      { name: 'data', type: 'bytes' },
      { name: 'sender', type: 'address' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deleteMemo',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'memoHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getMemo',
    stateMutability: 'view',
    inputs: [{ name: 'memoHash', type: 'bytes32' }],
    outputs: [
      { name: 'data', type: 'bytes' },
      { name: 'sender', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'createdAt', type: 'uint64' },
    ],
  },
  {
    type: 'function',
    name: 'MAX_MEMO_BYTES',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'MemoStored',
    inputs: [
      { name: 'memoHash', type: 'bytes32', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'data', type: 'bytes', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MemoDeleted',
    inputs: [
      { name: 'memoHash', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
    ],
    anonymous: false,
  },
] as const

export const publicMemoHeaderAbi = [
  {
    type: 'function',
    name: 'createMemoHeader',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'memoId', type: 'bytes32' },
          { name: 'purpose', type: 'string' },
          { name: 'locatorType', type: 'uint8' },
          { name: 'locatorHash', type: 'bytes32' },
          { name: 'locatorUrl', type: 'string' },
          { name: 'contentHash', type: 'bytes32' },
          { name: 'signature', type: 'bytes' },
          {
            name: 'sender',
            type: 'tuple',
            components: [
              { name: 'addr', type: 'address' },
              { name: 'identifier', type: 'string' },
            ],
          },
          {
            name: 'recipient',
            type: 'tuple',
            components: [
              { name: 'addr', type: 'address' },
              { name: 'identifier', type: 'string' },
            ],
          },
          { name: 'version', type: 'string' },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deleteMemoHeader',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'memoId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getMemoHeader',
    stateMutability: 'view',
    inputs: [{ name: 'memoId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'purpose', type: 'string' },
          { name: 'locatorType', type: 'uint8' },
          { name: 'locatorHash', type: 'bytes32' },
          { name: 'locatorUrl', type: 'string' },
          { name: 'contentHash', type: 'bytes32' },
          { name: 'signature', type: 'bytes' },
          {
            name: 'sender',
            type: 'tuple',
            components: [
              { name: 'addr', type: 'address' },
              { name: 'identifier', type: 'string' },
            ],
          },
          {
            name: 'recipient',
            type: 'tuple',
            components: [
              { name: 'addr', type: 'address' },
              { name: 'identifier', type: 'string' },
            ],
          },
          { name: 'version', type: 'string' },
          { name: 'createdAt', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'event',
    name: 'MemoHeaderCreated',
    inputs: [
      { name: 'memoId', type: 'bytes32', indexed: true },
      { name: 'senderAddr', type: 'address', indexed: true },
      { name: 'recipientAddr', type: 'address', indexed: true },
      { name: 'purpose', type: 'string', indexed: false },
      { name: 'locatorType', type: 'uint8', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MemoHeaderDeleted',
    inputs: [
      { name: 'memoId', type: 'bytes32', indexed: true },
      { name: 'deletedBy', type: 'address', indexed: true },
    ],
    anonymous: false,
  },
] as const
