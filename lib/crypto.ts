const STORAGE_PREFIX = 'tempo-memo-enc-key:'

export type StoredKey = {
  publicKeyHex: `0x${string}`
  privateKeyJwk: JsonWebKey
  version: number
}

const encoder = new TextEncoder()

export const bytesToHex = (bytes: Uint8Array) =>
  (`0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`)

export const hexToBytes = (hex: string) => {
  const sanitized = hex.startsWith('0x') ? hex.slice(2) : hex
  const result = new Uint8Array(sanitized.length / 2)
  for (let i = 0; i < result.length; i += 1) {
    result[i] = parseInt(sanitized.slice(i * 2, i * 2 + 2), 16)
  }
  return result
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

const base64ToBytes = (base64: string) => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export const savePrivateKey = (address: string, key: StoredKey) => {
  const normalized = address.toLowerCase()
  localStorage.setItem(`${STORAGE_PREFIX}${normalized}`, JSON.stringify(key))
}

export const loadPrivateKey = (address: string) => {
  const normalized = address.toLowerCase()
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${normalized}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredKey
  } catch {
    return null
  }
}

export const generateKeyPair = async (version = 1): Promise<StoredKey> => {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits', 'deriveKey'],
  )
  const publicRaw = await crypto.subtle.exportKey('raw', pair.publicKey)
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return {
    publicKeyHex: bytesToHex(new Uint8Array(publicRaw)),
    privateKeyJwk: privateJwk,
    version,
  }
}

export const importPrivateKey = async (jwk: JsonWebKey) => {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits', 'deriveKey'],
  )
}

export const importPublicKey = async (hex: string) => {
  return crypto.subtle.importKey(
    'raw',
    hexToBytes(hex),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  )
}

const deriveWrappingKey = async (privateKey: CryptoKey, publicKey: CryptoKey, memoHash: string) => {
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  )
  const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey'])
  const salt = hexToBytes(memoHash)
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: encoder.encode('tempo-memo-key'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const encryptPayload = async (payload: Uint8Array) => {
  const dataKey = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aesKey = await crypto.subtle.importKey('raw', dataKey, 'AES-GCM', false, ['encrypt', 'decrypt'])
  const payloadBytes = new Uint8Array(payload)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, payloadBytes)
  return {
    dataKey,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

export const encryptDataKeyFor = async (
  memoHash: string,
  senderPrivate: CryptoKey,
  recipientPublicHex: string,
  dataKey: Uint8Array,
) => {
  const recipientPublic = await importPublicKey(recipientPublicHex)
  const wrapKey = await deriveWrappingKey(senderPrivate, recipientPublic, memoHash)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const dataKeyBytes = new Uint8Array(dataKey)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, dataKeyBytes)
  return {
    iv: bytesToBase64(iv),
    encKey: bytesToBase64(new Uint8Array(encrypted)),
  }
}

export const decryptDataKey = async (
  memoHash: string,
  recipientPrivate: CryptoKey,
  senderPublicHex: string,
  encKey: string,
  iv: string,
) => {
  const senderPublic = await importPublicKey(senderPublicHex)
  const wrapKey = await deriveWrappingKey(recipientPrivate, senderPublic, memoHash)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    wrapKey,
    base64ToBytes(encKey),
  )
  return new Uint8Array(decrypted)
}

export const decryptPayload = async (dataKey: Uint8Array, iv: string, ciphertext: string) => {
  const dataKeyBytes = new Uint8Array(dataKey)
  const aesKey = await crypto.subtle.importKey('raw', dataKeyBytes, 'AES-GCM', false, ['decrypt'])
  const ivBytes = new Uint8Array(base64ToBytes(iv))
  const cipherBytes = new Uint8Array(base64ToBytes(ciphertext))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    aesKey,
    cipherBytes,
  )
  return new Uint8Array(decrypted)
}

export const encodeJson = (value: unknown) => encoder.encode(JSON.stringify(value))
