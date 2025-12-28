'use client'

import React from 'react'
import { usePublicClient } from 'wagmi'
import { hexToString } from 'viem'
import { decryptDataKey, decryptPayload, importPrivateKey } from '../lib/crypto'
import { isValidMemoId } from '../lib/memo'
import { MEMO_STORE_ADDRESS, REGULATOR_ADDRESS, REGULATOR_PRIVATE_KEY_JWK, memoStoreAbi } from '../lib/contracts'
import type { OnchainEncryptedMemo } from '../lib/onchainMemo'

const REGULATOR_PASSWORD = 'Iamtheregulator'

type RegulatorMemo = {
  memoId: `0x${string}`
  sender: `0x${string}`
  recipient: `0x${string}`
  token: {
    address: `0x${string}`
    symbol: string
    decimals: number
  }
  amountDisplay: string
  createdAt: string
  payload?: unknown
}

const safeIsoDate = (value?: string) => {
  if (value && !Number.isNaN(Date.parse(value))) {
    return value
  }
  return new Date().toISOString()
}

export function RegulatorPanel() {
  const publicClient = usePublicClient()
  const [password, setPassword] = React.useState('')
  const [isUnlocked, setIsUnlocked] = React.useState(false)
  const [memoId, setMemoId] = React.useState('')
  const [status, setStatus] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<RegulatorMemo | null>(null)
  const [history, setHistory] = React.useState<RegulatorMemo[]>([])

  const regulatorKey = React.useMemo(() => {
    if (!REGULATOR_PRIVATE_KEY_JWK) return null
    try {
      return JSON.parse(REGULATOR_PRIVATE_KEY_JWK) as JsonWebKey
    } catch {
      return null
    }
  }, [])

  const loadHistory = React.useCallback(async (regulatorAddress: string) => {
    try {
      const response = await fetch(`/api/memos/by-regulator/${regulatorAddress}`)
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load regulator memos.')
      }
      setHistory(payload.items ?? [])
    } catch (err: any) {
      setError(err?.message ?? String(err))
    }
  }, [])

  React.useEffect(() => {
    if (!isUnlocked) return
    if (!REGULATOR_ADDRESS) {
      setError('Regulator key is not configured.')
      return
    }
    void loadHistory(REGULATOR_ADDRESS)
  }, [isUnlocked, loadHistory])

  const unlock = () => {
    setError(null)
    if (password !== REGULATOR_PASSWORD) {
      setError('Incorrect regulator password.')
      return
    }
    setIsUnlocked(true)
    setPassword('')
  }

  const openFromHistory = (memo: RegulatorMemo) => {
    setMemoId(memo.memoId)
    setData(memo)
    setError(null)
    setStatus(null)
  }

  const loadMemo = async () => {
    setError(null)
    setStatus(null)
    setData(null)

    if (!isValidMemoId(memoId)) {
      setError('Memo hash must be a 32-byte hex string.')
      return
    }
    if (!MEMO_STORE_ADDRESS) {
      setError('Memo store address is not configured.')
      return
    }
    const regulatorAddress = REGULATOR_ADDRESS
    if (!regulatorAddress || !regulatorKey) {
      setError('Regulator key is not configured.')
      return
    }
    if (!publicClient) {
      setError('Onchain client is not available.')
      return
    }

    setStatus('Fetching onchain memo…')
    try {
      const [dataHex, sender, recipient, createdAt] = await publicClient.readContract({
        address: MEMO_STORE_ADDRESS,
        abi: memoStoreAbi,
        functionName: 'getMemo',
        args: [memoId as `0x${string}`],
      })

      if (!dataHex || dataHex === '0x') {
        throw new Error('Memo not found onchain.')
      }

      const json = hexToString(dataHex as `0x${string}`)
      const memo = JSON.parse(json) as OnchainEncryptedMemo
      const keyEntry = memo.keys.find((entry) => entry.addr.toLowerCase() === regulatorAddress.toLowerCase())
      if (!keyEntry) {
        throw new Error('Regulator key not found in memo payload.')
      }

      const privateKey = await importPrivateKey(regulatorKey)
      const dataKey = await decryptDataKey(memo.memoHash, privateKey, memo.senderPubKey, keyEntry.encKey, keyEntry.iv)
      const payloadBytes = await decryptPayload(dataKey, memo.enc.iv, memo.enc.ciphertext)
      const payloadText = new TextDecoder().decode(payloadBytes)
      let payload: unknown = payloadText
      try {
        payload = JSON.parse(payloadText)
      } catch {
        payload = payloadText
      }

      const createdAtIso = typeof createdAt === 'bigint' && createdAt > BigInt(0)
        ? new Date(Number(createdAt) * 1000).toISOString()
        : memo.createdAt
      const safeCreatedAt = safeIsoDate(createdAtIso)

      const nextMemo: RegulatorMemo = {
        memoId: memo.memoHash,
        sender: sender as `0x${string}`,
        recipient: recipient as `0x${string}`,
        token: memo.token ?? { address: '0x0000000000000000000000000000000000000000', symbol: 'Unknown', decimals: 0 },
        amountDisplay: memo.amountDisplay ?? '—',
        createdAt: safeCreatedAt,
        payload,
      }

      setData(nextMemo)
      setHistory((prev) => {
        const next = [nextMemo, ...prev.filter((item) => item.memoId !== nextMemo.memoId)].slice(0, 50)
        return next
      })
      setStatus(null)
    } catch (err: any) {
      setError(err?.message ?? String(err))
      setStatus(null)
    }
  }

  return (
    <section className="panel panel-wide">
      <div className="panel-header">
        <h3 className="panel-title">Regulator access</h3>
        <div className="panel-header-actions">
          <span className="muted" style={{ fontSize: 12 }}>Encrypted memo retrieval</span>
        </div>
      </div>

      {!isUnlocked ? (
        <div className="stack-md" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Regulator password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter regulator password"
            />
          </label>
          <button className="btn btn-primary" onClick={unlock}>
            Unlock regulator access
          </button>
          {error && <div className="error-text">{error}</div>}
        </div>
      ) : (
        <div className="stack-md" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Memo hash</span>
            <input
              value={memoId}
              onChange={(event) => setMemoId(event.target.value)}
              placeholder="0x…"
            />
          </label>
          <button className="btn btn-primary" onClick={() => void loadMemo()}>
            Retrieve memo
          </button>
          {status && <div className="muted">{status}</div>}
          {error && <div className="error-text">{error}</div>}

          <div className="stack-md" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600 }}>Retrieved onchain memos</div>
            {history.length === 0 && (
              <div className="muted">No memos indexed yet.</div>
            )}
            {history.map((memo) => (
              <div className="card memo-item" key={memo.memoId}>
                <div className="memo-item-main">
                  <div>
                    <div className="memo-item-title">{memo.token.symbol} · {memo.amountDisplay}</div>
                    <div className="muted">Sender <span className="mono">{memo.sender}</span></div>
                    <div className="muted">Recipient <span className="mono">{memo.recipient}</span></div>
                  </div>
                  <button
                    className="btn btn-secondary btn-small"
                    type="button"
                    onClick={() => openFromHistory(memo)}
                  >
                    View memo
                  </button>
                </div>
                <div className="memo-item-meta">
                  <span className="mono memo-hash-short">{memo.memoId}</span>
                  <span className="muted">{new Date(memo.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          {data && (
            <div className="stack-md">
              <div className="card">
                <div className="detail-grid">
                  <div>
                    <div className="muted">Sender</div>
                    <div className="mono">{data.sender}</div>
                  </div>
                  <div>
                    <div className="muted">Recipient</div>
                    <div className="mono">{data.recipient}</div>
                  </div>
                  <div>
                    <div className="muted">Token</div>
                    <div>{data.token.symbol}</div>
                  </div>
                  <div>
                    <div className="muted">Amount</div>
                    <div>{data.amountDisplay}</div>
                  </div>
                  <div>
                    <div className="muted">Created</div>
                    <div>{new Date(data.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <div className="card">
                <div style={{ fontWeight: 600 }}>Decrypted memo payload</div>
                <pre className="memo-json">{JSON.stringify(data.payload, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
