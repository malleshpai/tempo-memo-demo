#!/usr/bin/env npx tsx
/**
 * Seed test memos for regulator testing.
 * Creates 2 onchain encrypted memos and 2 offchain memos.
 */

import { createWalletClient, createPublicClient, http, parseUnits, type Hex, stringToHex, keccak256 } from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { tempoTestnet } from 'viem/chains'
import * as crypto from 'crypto'

// Contract addresses from env
const PUBLIC_KEY_REGISTRY_ADDRESS = '0x02F64DEbd94560Bfb29B0c12246819AD4388156d' as const
const MEMO_STORE_ADDRESS = '0x639223E5224Eae37e68FC390974bFB88Be7422B8' as const
const PUBLIC_MEMO_HEADER_ADDRESS = '0x1313219a547CB472dBc56F97E3C2cF273a0F511B' as const
const REGULATOR_PUBLIC_KEY_HEX = '0x048c65b24eeeed6d7376bf1695dfe2046cadf17b32a982614b253cae4060041444d0278058f046f639dd9da5037dddf0d3e93bab233b2b60bf4434e9ad9f8d77ff'
const REGULATOR_ADDRESS = '0xc905400fba3ea2b5eab3ee4b5efa5e67f99079cb' as const

// Fee payer private key
const FEE_PAYER_KEY = process.env.FEE_PAYER_KEY || '0x5344ac2a86df99fd834b2568f574159660576e2c9d593e49bff4a3e45dea0617'

// Token addresses
const TOKENS = {
  PathUSD: { symbol: 'PathUSD', address: '0x20c0000000000000000000000000000000000000' as const, decimals: 6 },
  AlphaUSD: { symbol: 'AlphaUSD', address: '0x20c0000000000000000000000000000000000001' as const, decimals: 6 },
  BetaUSD: { symbol: 'BetaUSD', address: '0x20c0000000000000000000000000000000000002' as const, decimals: 6 },
}

// ABIs
const publicKeyRegistryAbi = [
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

const memoStoreAbi = [
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
] as const

const publicMemoHeaderAbi = [
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
] as const

const erc20Abi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// Crypto helpers
const bytesToHex = (bytes: Uint8Array): Hex =>
  `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}` as Hex

const hexToBytes = (hex: string): Uint8Array => {
  const sanitized = hex.startsWith('0x') ? hex.slice(2) : hex
  const result = new Uint8Array(sanitized.length / 2)
  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(sanitized.slice(i * 2, i * 2 + 2), 16)
  }
  return result
}

// Generate P-256 key pair using Node crypto
function generateP256KeyPair() {
  const keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  })
  const publicKeyDer = keyPair.publicKey.export({ type: 'spki', format: 'der' })
  const privateKeyJwk = keyPair.privateKey.export({ format: 'jwk' })
  // Extract raw public key (last 65 bytes of DER)
  const publicKeyRaw = publicKeyDer.slice(-65)
  return {
    publicKeyHex: bytesToHex(publicKeyRaw) as Hex,
    privateKeyJwk,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  }
}

// ECDH key derivation and encryption
async function deriveSharedSecret(privateKey: crypto.KeyObject, publicKeyHex: string): Promise<Buffer> {
  const publicKeyRaw = hexToBytes(publicKeyHex)
  const publicKeyDer = Buffer.concat([
    Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex'),
    publicKeyRaw,
  ])
  const publicKey = crypto.createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' })
  return crypto.diffieHellman({ privateKey, publicKey })
}

function hkdfDeriveKey(sharedSecret: Buffer, salt: Uint8Array): Buffer {
  return crypto.hkdfSync('sha256', sharedSecret, salt, Buffer.from('tempo-memo-key'), 32)
}

function encryptAesGcm(key: Buffer, plaintext: Buffer): { iv: string; ciphertext: string } {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    iv: iv.toString('base64'),
    ciphertext: Buffer.concat([encrypted, authTag]).toString('base64'),
  }
}

async function encryptDataKeyFor(
  memoHash: string,
  senderPrivateKey: crypto.KeyObject,
  recipientPublicHex: string,
  dataKey: Buffer
): Promise<{ iv: string; encKey: string }> {
  const sharedSecret = await deriveSharedSecret(senderPrivateKey, recipientPublicHex)
  const wrapKey = hkdfDeriveKey(sharedSecret, hexToBytes(memoHash))
  const { iv, ciphertext } = encryptAesGcm(wrapKey, dataKey)
  return { iv, encKey: ciphertext }
}

// Test IVMS data generator
function generateIvmsPayload(senderName: string, recipientName: string, purpose: string, amount: string) {
  return {
    schema: 'ivms-1',
    format: 'json',
    payload: {
      originator: {
        name: senderName,
        address: '123 Sender St, New York, NY 10001',
        institution: 'Test Bank A',
        country: 'US',
      },
      beneficiary: {
        name: recipientName,
        address: '456 Recipient Ave, London, UK',
        institution: 'Test Bank B',
        country: 'GB',
      },
      transaction: {
        purpose,
        reference: `REF-${Date.now()}`,
      },
    },
  }
}

type OnchainEncryptedMemo = {
  v: number
  memoHash: Hex
  sender: Hex
  recipient: Hex
  senderPubKey: string
  regulatorPubKey?: string
  createdAt: string
  contentType: string
  ivmsHash: Hex
  token: { address: Hex; symbol: string; decimals: number }
  amountDisplay: string
  keyAlg: string
  kdf: string
  enc: { alg: string; iv: string; ciphertext: string }
  keys: Array<{ addr: Hex; iv: string; encKey: string }>
}

async function main() {
  console.log('Setting up clients...')

  const feePayerAccount = privateKeyToAccount(FEE_PAYER_KEY as Hex)
  console.log(`Fee payer: ${feePayerAccount.address}`)

  const publicClient = createPublicClient({
    chain: tempoTestnet,
    transport: http(),
  })

  const walletClient = createWalletClient({
    account: feePayerAccount,
    chain: tempoTestnet,
    transport: http(),
  })

  // Generate test accounts
  console.log('\nGenerating test accounts...')
  const senderKey = generatePrivateKey()
  const recipientKey = generatePrivateKey()
  const senderAccount = privateKeyToAccount(senderKey)
  const recipientAccount = privateKeyToAccount(recipientKey)

  console.log(`Sender: ${senderAccount.address}`)
  console.log(`Recipient: ${recipientAccount.address}`)

  // Generate P-256 keys for encryption
  console.log('\nGenerating P-256 encryption keys...')
  const senderP256 = generateP256KeyPair()
  const recipientP256 = generateP256KeyPair()

  // Fund test accounts with gas tokens (PathUSD) and transfer tokens (AlphaUSD)
  console.log('\nFunding test accounts...')
  const fundAmount = parseUnits('1000', 6)
  const gasAmount = parseUnits('100', 6)

  // Fund sender with PathUSD for gas
  await walletClient.writeContract({
    address: TOKENS.PathUSD.address,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [senderAccount.address, gasAmount],
  })
  console.log(`Funded sender with 100 PathUSD for gas`)

  // Fund recipient with PathUSD for gas (needed for key registration)
  await walletClient.writeContract({
    address: TOKENS.PathUSD.address,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipientAccount.address, gasAmount],
  })
  console.log(`Funded recipient with 100 PathUSD for gas`)

  // Fund sender with AlphaUSD for transfers
  await walletClient.writeContract({
    address: TOKENS.AlphaUSD.address,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [senderAccount.address, fundAmount],
  })
  console.log(`Funded sender with 1000 AlphaUSD for transfers`)

  // Create wallet clients for test accounts
  const senderWallet = createWalletClient({
    account: senderAccount,
    chain: tempoTestnet,
    transport: http(),
  })

  const recipientWallet = createWalletClient({
    account: recipientAccount,
    chain: tempoTestnet,
    transport: http(),
  })

  // Register P-256 keys
  console.log('\nRegistering encryption keys...')

  await senderWallet.writeContract({
    address: PUBLIC_KEY_REGISTRY_ADDRESS,
    abi: publicKeyRegistryAbi,
    functionName: 'setKey',
    args: [senderP256.publicKeyHex, 1, 1],
  })
  console.log(`Registered sender key`)

  await recipientWallet.writeContract({
    address: PUBLIC_KEY_REGISTRY_ADDRESS,
    abi: publicKeyRegistryAbi,
    functionName: 'setKey',
    args: [recipientP256.publicKeyHex, 1, 1],
  })
  console.log(`Registered recipient key`)

  // Create 2 onchain memos
  console.log('\n--- Creating Onchain Memos ---')

  for (let i = 1; i <= 2; i++) {
    console.log(`\nCreating onchain memo ${i}...`)

    const ivmsPayload = generateIvmsPayload(
      `Alice Test ${i}`,
      `Bob Test ${i}`,
      i === 1 ? 'Payroll' : 'Invoice',
      `${100 * i}.00`
    )

    const payloadJson = JSON.stringify(ivmsPayload)
    const memoHash = keccak256(stringToHex(payloadJson)) as Hex

    // Encrypt payload
    const dataKey = crypto.randomBytes(32)
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv)
    const encrypted = Buffer.concat([cipher.update(payloadJson), cipher.final()])
    const authTag = cipher.getAuthTag()

    // Encrypt data key for sender, recipient, and regulator
    const senderKeyEntry = await encryptDataKeyFor(memoHash, senderP256.privateKey, senderP256.publicKeyHex, dataKey)
    const recipientKeyEntry = await encryptDataKeyFor(memoHash, senderP256.privateKey, recipientP256.publicKeyHex, dataKey)
    const regulatorKeyEntry = await encryptDataKeyFor(memoHash, senderP256.privateKey, REGULATOR_PUBLIC_KEY_HEX, dataKey)

    const onchainMemo: OnchainEncryptedMemo = {
      v: 1,
      memoHash,
      sender: senderAccount.address,
      recipient: recipientAccount.address,
      senderPubKey: senderP256.publicKeyHex,
      regulatorPubKey: REGULATOR_PUBLIC_KEY_HEX,
      createdAt: new Date().toISOString(),
      contentType: 'application/json',
      ivmsHash: memoHash,
      token: TOKENS.AlphaUSD,
      amountDisplay: `${100 * i}.00`,
      keyAlg: 'ECDH-P256',
      kdf: 'HKDF-SHA256',
      enc: {
        alg: 'AES-256-GCM',
        iv: iv.toString('base64'),
        ciphertext: Buffer.concat([encrypted, authTag]).toString('base64'),
      },
      keys: [
        { addr: senderAccount.address, ...senderKeyEntry },
        { addr: recipientAccount.address, ...recipientKeyEntry },
        { addr: REGULATOR_ADDRESS, ...regulatorKeyEntry },
      ],
    }

    const memoData = bytesToHex(Buffer.from(JSON.stringify(onchainMemo)))

    // Store memo onchain
    const memoTx = await senderWallet.writeContract({
      address: MEMO_STORE_ADDRESS,
      abi: memoStoreAbi,
      functionName: 'putMemo',
      args: [memoHash, memoData, senderAccount.address, recipientAccount.address],
    })
    console.log(`Stored onchain memo: ${memoTx}`)

    // Create public header
    const headerTx = await senderWallet.writeContract({
      address: PUBLIC_MEMO_HEADER_ADDRESS,
      abi: publicMemoHeaderAbi,
      functionName: 'createMemoHeader',
      args: [{
        memoId: memoHash,
        purpose: i === 1 ? 'Payroll' : 'Invoice',
        locatorType: 0, // OnChain
        locatorHash: memoHash,
        locatorUrl: '',
        contentHash: memoHash,
        signature: '0x' as Hex,
        sender: { addr: senderAccount.address, identifier: `alice${i}@testbank.com` },
        recipient: { addr: recipientAccount.address, identifier: `bob${i}@testbank.com` },
        version: 'TempoMemoStandard::Version1',
      }],
    })
    console.log(`Created public header: ${headerTx}`)

    // Transfer tokens
    const transferAmount = parseUnits(`${100 * i}`, 6)
    const transferTx = await senderWallet.writeContract({
      address: TOKENS.AlphaUSD.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipientAccount.address, transferAmount],
    })
    console.log(`Token transfer: ${transferTx}`)
    console.log(`Onchain memo ${i} complete! Memo ID: ${memoHash}`)
  }

  // Create 2 offchain memos (via API)
  console.log('\n--- Creating Offchain Memos ---')

  for (let i = 1; i <= 2; i++) {
    console.log(`\nCreating offchain memo ${i}...`)

    const ivmsPayload = generateIvmsPayload(
      `Charlie Test ${i}`,
      `Diana Test ${i}`,
      i === 1 ? 'Payment' : 'Refund',
      `${250 * i}.00`
    )

    const payloadJson = JSON.stringify(ivmsPayload)
    const memoHash = keccak256(stringToHex(payloadJson)) as Hex

    // For offchain, we POST to the /api/memos endpoint
    const formData = new URLSearchParams()
    formData.set('memoId', memoHash)
    formData.set('sender', senderAccount.address)
    formData.set('recipient', recipientAccount.address)
    formData.set('tokenAddress', TOKENS.BetaUSD.address)
    formData.set('tokenSymbol', TOKENS.BetaUSD.symbol)
    formData.set('tokenDecimals', '6')
    formData.set('amountBase', parseUnits(`${250 * i}`, 6).toString())
    formData.set('amountDisplay', `${250 * i}.00`)
    formData.set('txHash', `0x${crypto.randomBytes(32).toString('hex')}`)
    formData.set('ivmsCanonical', payloadJson)
    formData.set('ivmsPayload', payloadJson)

    try {
      const response = await fetch('http://localhost:3000/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      })

      if (!response.ok) {
        const error = await response.json()
        console.log(`Warning: API response not ok - ${error.error || response.status}`)
      } else {
        console.log(`Stored offchain memo via API`)
      }
    } catch (err) {
      console.log(`Warning: Could not store offchain memo via API - ${err}`)
    }

    // Create public header for offchain memo
    const headerTx = await senderWallet.writeContract({
      address: PUBLIC_MEMO_HEADER_ADDRESS,
      abi: publicMemoHeaderAbi,
      functionName: 'createMemoHeader',
      args: [{
        memoId: memoHash,
        purpose: i === 1 ? 'Payment' : 'Refund',
        locatorType: 1, // OffChain
        locatorHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
        locatorUrl: `http://localhost:3000/${memoHash}`,
        contentHash: memoHash,
        signature: '0x' as Hex,
        sender: { addr: senderAccount.address, identifier: `charlie${i}@example.com` },
        recipient: { addr: recipientAccount.address, identifier: `diana${i}@example.com` },
        version: 'TempoMemoStandard::Version1',
      }],
    })
    console.log(`Created public header: ${headerTx}`)
    console.log(`Offchain memo ${i} complete! Memo ID: ${memoHash}`)
  }

  console.log('\n=== Test Data Creation Complete ===')
  console.log('Created 2 onchain memos and 2 offchain memos.')
  console.log('Go to the Regulator page and click "Refresh regulator memos" to see them.')
}

main().catch(console.error)
