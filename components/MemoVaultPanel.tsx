'use client'

import React from 'react'
import { useConnection, usePublicClient } from 'wagmi'
import { hexToString, parseAbiItem } from 'viem'
import { MEMO_STORE_ADDRESS } from '../lib/contracts'
import type { OnchainEncryptedMemo } from '../lib/onchainMemo'

type MemoSummary = {
  memoId: string
  sender: string
  recipient: string
  role: 'sender' | 'recipient'
  counterparty: string
  token: {
    symbol: string
  }
  amountDisplay: string
  txHash?: string
  createdAt: string
  hasInvoice?: boolean
  source?: 'offchain' | 'onchain'
}

const safeIsoDate = (value?: string) => {
  if (value && !Number.isNaN(Date.parse(value))) {
    return value
  }
  return new Date().toISOString()
}

const decodeOnchainMemo = (dataHex?: `0x${string}`) => {
  if (!dataHex) return null
  try {
    const json = hexToString(dataHex)
    return JSON.parse(json) as OnchainEncryptedMemo
  } catch {
    return null
  }
}

export function MemoVaultPanel() {
  const { address } = useConnection()
  const publicClient = usePublicClient()
  const [items, setItems] = React.useState<MemoSummary[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    if (!address) {
      setItems([])
      return
    }

    let cancelled = false
    const loadOffchain = async () => {
      const response = await fetch(`/api/memos/by-address/${address}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load memos.')
      }
      const results = (data.items ?? []) as MemoSummary[]
      return results.map((item) => ({ ...item, source: 'offchain' as const }))
    }

    const loadOnchain = async () => {
      if (!publicClient || !MEMO_STORE_ADDRESS) {
        return [] as MemoSummary[]
      }

      const memoStoredEvent = parseAbiItem(
        'event MemoStored(bytes32 indexed memoHash, address indexed sender, address indexed recipient, bytes data)',
      )
      const memoDeletedEvent = parseAbiItem(
        'event MemoDeleted(bytes32 indexed memoHash, address indexed recipient)',
      )

      const [sentLogs, receivedLogs, deletedLogs] = await Promise.all([
        publicClient.getLogs({
          address: MEMO_STORE_ADDRESS,
          event: memoStoredEvent,
          args: { sender: address },
          fromBlock: BigInt(0),
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: MEMO_STORE_ADDRESS,
          event: memoStoredEvent,
          args: { recipient: address },
          fromBlock: BigInt(0),
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: MEMO_STORE_ADDRESS,
          event: memoDeletedEvent,
          fromBlock: BigInt(0),
          toBlock: 'latest',
        }),
      ])

      const deleted = new Set(
        deletedLogs
          .map((log) => (log.args.memoHash as string | undefined)?.toLowerCase())
          .filter(Boolean) as string[],
      )

      const summaries = new Map<string, MemoSummary>()
      const normalizedAddress = address.toLowerCase()
      const pushLog = (log: (typeof sentLogs)[number]) => {
        const memoHash = log.args.memoHash as `0x${string}`
        if (!memoHash) return
        if (deleted.has(memoHash.toLowerCase())) return

        const memo = decodeOnchainMemo(log.args.data as `0x${string}` | undefined)
        const sender = (log.args.sender as `0x${string}`) ?? memo?.sender
        const recipient = (log.args.recipient as `0x${string}`) ?? memo?.recipient
        if (!sender || !recipient) return

        const role = sender.toLowerCase() === normalizedAddress ? 'sender' : 'recipient'
        const counterparty = role === 'sender' ? recipient : sender
        const tokenSymbol = memo?.token?.symbol ?? 'Encrypted'
        const createdAt = safeIsoDate(memo?.createdAt)

        summaries.set(memoHash.toLowerCase(), {
          memoId: memoHash,
          sender,
          recipient,
          role,
          counterparty,
          token: { symbol: tokenSymbol },
          amountDisplay: memo?.amountDisplay ?? '—',
          txHash: log.transactionHash,
          createdAt,
          source: 'onchain',
        })
      }

      sentLogs.forEach(pushLog)
      receivedLogs.forEach(pushLog)

      return Array.from(summaries.values())
    }

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [offchainItems, onchainItems] = await Promise.all([loadOffchain(), loadOnchain()])
        if (cancelled) return
        const merged = new Map<string, MemoSummary>()
        onchainItems.forEach((item) => merged.set(item.memoId.toLowerCase(), item))
        offchainItems.forEach((item) => merged.set(item.memoId.toLowerCase(), item))

        const results = Array.from(merged.values()).sort((a, b) => {
          const left = Date.parse(a.createdAt)
          const right = Date.parse(b.createdAt)
          return (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left)
        })
        setItems(results)
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? String(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [address, publicClient])

  return (
    <section className="panel panel-wide">
      <div className="panel-header">
        <h3 className="panel-title">Memo vault</h3>
        <div className="panel-header-actions">
          <span className="muted" style={{ fontSize: 12 }}>
            {address ? 'Latest memos for this address' : 'Log in to view memos'}
          </span>
        </div>
      </div>

      {!address && <div className="muted">Log in to see incoming and outgoing memos.</div>}
      {address && isLoading && <div className="muted">Loading memos…</div>}
      {address && error && <div className="error-text">{error}</div>}

      {address && !isLoading && !error && (
        <div className="stack-md" style={{ marginTop: 12 }}>
          {items.length === 0 && (
            <div className="muted">No memos found for this address.</div>
          )}
          {items.map((item) => (
            <div className="card memo-item" key={item.memoId}>
              <div className="memo-item-main">
                <div>
                  <div style={{ fontWeight: 600 }}>{item.token.symbol} · {item.amountDisplay}</div>
                  {item.hasInvoice && <span className="status-pill status-pill-warn">Invoice</span>}
                  {item.source === 'onchain' && <span className="status-pill">Onchain</span>}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {item.role === 'sender' ? 'To' : 'From'} {item.counterparty}
                  </div>
                </div>
                <a className="btn btn-secondary btn-small" href={`/${item.memoId}`}>
                  View memo
                </a>
              </div>
              <div className="memo-item-meta">
                <span className="mono">{item.memoId}</span>
                <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
