'use client'

import React from 'react'
import { usePublicClient } from 'wagmi'
import { hexToString } from 'viem'
import { decryptDataKey, decryptPayload, importPrivateKey } from '../lib/crypto'
import { isValidMemoId } from '../lib/memo'
import { MEMO_STORE_ADDRESS, REGULATOR_ADDRESS, REGULATOR_PRIVATE_KEY_JWK, memoStoreAbi } from '../lib/contracts'
import type { OnchainEncryptedMemo } from '../lib/onchainMemo'
import type { MemoRecord } from '../lib/memo'
import { IvmsPreview } from './IvmsPreview'

const REGULATOR_PASSWORD = 'Iamtheregulator'

type RegulatorSummary = {
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
  source?: 'onchain' | 'offchain'
  hasInvoice?: boolean
  recordUrl?: string
}

type RegulatorMemo = RegulatorSummary & {
  payload?: unknown
  isLoading?: boolean
}

const safeIsoDate = (value?: string) => {
  if (value && !Number.isNaN(Date.parse(value))) {
    return value
  }
  return new Date().toISOString()
}

const parseAmount = (value: string) => {
  const number = Number(value)
  if (Number.isNaN(number)) return null
  return number
}

const resolveIvmsPayload = (payload?: unknown) => {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (record.schema === 'ivms-1' && 'payload' in record) {
      return record.payload
    }
  }
  return payload
}

// Memo list item component
function MemoListItem({
  memo,
  isSelected,
  onClick,
}: {
  memo: RegulatorSummary
  isSelected: boolean
  onClick: () => void
}) {
  const source = memo.source ?? 'offchain'
  return (
    <div
      className={`memo-list-item ${isSelected ? 'memo-list-item-selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="memo-list-item-header">
        <span className="memo-list-item-amount">{memo.token.symbol} {memo.amountDisplay}</span>
        <span className={`status-pill status-pill-small ${source === 'onchain' ? '' : 'status-pill-neutral'}`}>
          {source === 'onchain' ? 'Onchain' : 'Offchain'}
        </span>
      </div>
      <div className="memo-list-item-parties">
        <span className="mono">{memo.sender.slice(0, 10)}...{memo.sender.slice(-6)}</span>
        <span className="muted">→</span>
        <span className="mono">{memo.recipient.slice(0, 10)}...{memo.recipient.slice(-6)}</span>
      </div>
      <div className="memo-list-item-date muted">
        {new Date(memo.createdAt).toLocaleString()}
      </div>
    </div>
  )
}

// Detail panel component
function MemoDetailPanel({
  memo,
  error,
}: {
  memo: RegulatorMemo | null
  error: string | null
}) {
  if (error) {
    return (
      <div className="memo-detail-panel">
        <div className="memo-detail-empty">
          <div className="error-text">{error}</div>
        </div>
      </div>
    )
  }

  if (!memo) {
    return (
      <div className="memo-detail-panel">
        <div className="memo-detail-empty">
          <div className="muted">Select a memo from the list to view details</div>
        </div>
      </div>
    )
  }

  if (memo.isLoading) {
    return (
      <div className="memo-detail-panel">
        <div className="memo-detail-empty">
          <div className="muted">Decrypting memo...</div>
        </div>
      </div>
    )
  }

  const source = memo.source ?? 'offchain'

  return (
    <div className="memo-detail-panel">
      <div className="memo-detail-header">
        <h4>Memo Details</h4>
        <span className={`status-pill ${source === 'onchain' ? '' : 'status-pill-neutral'}`}>
          {source === 'onchain' ? 'Onchain' : 'Offchain'}
        </span>
      </div>

      <div className="card">
        <div className="detail-grid">
          <div className="detail-span">
            <div className="muted">Memo ID</div>
            <div className="mono detail-address">{memo.memoId}</div>
          </div>
          <div className="detail-span">
            <div className="muted">Sender</div>
            <div className="mono detail-address">{memo.sender}</div>
          </div>
          <div className="detail-span">
            <div className="muted">Recipient</div>
            <div className="mono detail-address">{memo.recipient}</div>
          </div>
          <div>
            <div className="muted">Token</div>
            <div>{memo.token.symbol}</div>
          </div>
          <div>
            <div className="muted">Amount</div>
            <div>{memo.amountDisplay}</div>
          </div>
          <div>
            <div className="muted">Created</div>
            <div>{new Date(memo.createdAt).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Memo Payload</div>
        {memo.payload && typeof resolveIvmsPayload(memo.payload) === 'object' ? (
          <IvmsPreview data={resolveIvmsPayload(memo.payload)} />
        ) : (
          <pre className="memo-json">{String(resolveIvmsPayload(memo.payload) ?? 'No payload loaded')}</pre>
        )}
      </div>
    </div>
  )
}

export function RegulatorPanel() {
  const publicClient = usePublicClient()
  const [password, setPassword] = React.useState('')
  const [isUnlocked, setIsUnlocked] = React.useState(false)
  const [memoId, setMemoId] = React.useState('')
  const [status, setStatus] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<RegulatorMemo | null>(null)
  const [history, setHistory] = React.useState<RegulatorSummary[]>([])
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [refreshNote, setRefreshNote] = React.useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = React.useState<'all' | 'onchain' | 'offchain'>('all')
  const [senderFilter, setSenderFilter] = React.useState('')
  const [assetFilter, setAssetFilter] = React.useState('all')
  const [amountMin, setAmountMin] = React.useState('')
  const [amountMax, setAmountMax] = React.useState('')
  const [dateFilter, setDateFilter] = React.useState('all')

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
      const [onchainResponse, offchainResponse] = await Promise.all([
        fetch(`/api/memos/by-regulator/${regulatorAddress}`),
        fetch('/api/memos/offchain'),
      ])
      const onchainPayload = await onchainResponse.json().catch(() => ({}))
      const offchainPayload = await offchainResponse.json().catch(() => ({}))

      if (!onchainResponse.ok) {
        throw new Error(onchainPayload?.error || 'Unable to load regulator memos.')
      }
      if (!offchainResponse.ok) {
        throw new Error(offchainPayload?.error || 'Unable to load offchain memos.')
      }

      const combined = [...(onchainPayload.items ?? []), ...(offchainPayload.items ?? [])]
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setHistory(combined)
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

  const refreshMemos = async () => {
    if (!REGULATOR_ADDRESS) return
    setIsRefreshing(true)
    setRefreshNote(null)
    setError(null)
    try {
      const response = await fetch('/api/indexer/onchain?mode=manual')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to refresh regulator memos.')
      }
      if (payload?.message) {
        setRefreshNote(payload.message)
      } else if (typeof payload?.stored === 'number') {
        setRefreshNote(`Indexed ${payload.stored} memo${payload.stored === 1 ? '' : 's'}.`)
      } else {
        setRefreshNote('Index complete.')
      }
      await loadHistory(REGULATOR_ADDRESS)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setIsRefreshing(false)
    }
  }

  const loadMemo = async (targetMemoId?: string) => {
    const activeMemoId = targetMemoId ?? memoId
    setError(null)
    setStatus(null)
    setData(null)

    if (targetMemoId) {
      setMemoId(targetMemoId)
    }

    if (!isValidMemoId(activeMemoId)) {
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
        args: [activeMemoId as `0x${string}`],
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
        source: 'onchain',
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

  const openFromHistory = async (memo: RegulatorSummary) => {
    setMemoId(memo.memoId)
    setError(null)
    setStatus(null)

    if (memo.source === 'offchain' && memo.recordUrl) {
      try {
        const response = await fetch(memo.recordUrl)
        if (!response.ok) {
          throw new Error('Unable to load offchain memo record.')
        }
        const record = (await response.json()) as MemoRecord
        setData({ ...memo, payload: record.ivms })
        return
      } catch (err: any) {
        setError(err?.message ?? String(err))
        return
      }
    }

    if (memo.source === 'onchain') {
      await loadMemo(memo.memoId)
      return
    }

    setData(memo)
  }

  const tokens = React.useMemo(() => {
    const set = new Set<string>()
    history.forEach((item) => {
      if (item?.token?.symbol) set.add(item.token.symbol)
    })
    return Array.from(set)
  }, [history])

  const filteredItems = React.useMemo(() => {
    const senderTerm = senderFilter.trim().toLowerCase()
    const min = amountMin ? Number(amountMin) : null
    const max = amountMax ? Number(amountMax) : null
    const now = Date.now()
    const cutoffDays =
      dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : dateFilter === '90d' ? 90 : null
    const cutoff = cutoffDays ? now - cutoffDays * 24 * 60 * 60 * 1000 : null

    return history.filter((item) => {
      if (!item) return false
      const source = item.source ?? 'offchain'
      if (sourceFilter !== 'all' && source !== sourceFilter) return false
      if (assetFilter !== 'all' && item.token?.symbol !== assetFilter) return false
      if (senderTerm) {
        const sender = item.sender?.toLowerCase() ?? ''
        const recipient = item.recipient?.toLowerCase() ?? ''
        if (!sender.includes(senderTerm) && !recipient.includes(senderTerm)) return false
      }
      const amount = parseAmount(item.amountDisplay)
      if (min != null || max != null) {
        if (amount == null) return false
        if (min != null && amount < min) return false
        if (max != null && amount > max) return false
      }
      if (cutoff && Date.parse(item.createdAt) < cutoff) return false
      return true
    })
  }, [history, senderFilter, sourceFilter, assetFilter, amountMin, amountMax, dateFilter])

  const clearFilters = () => {
    setSourceFilter('all')
    setSenderFilter('')
    setAssetFilter('all')
    setAmountMin('')
    setAmountMax('')
    setDateFilter('all')
  }

  // Login screen
  if (!isUnlocked) {
    return (
      <section className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Regulator Access</h3>
        </div>
        <div className="stack-md" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Regulator password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter regulator password"
              onKeyDown={(e) => e.key === 'Enter' && unlock()}
            />
          </label>
          <button className="btn btn-primary" onClick={unlock}>
            Unlock regulator access
          </button>
          {error && <div className="error-text">{error}</div>}
        </div>
      </section>
    )
  }

  // Main two-panel layout
  return (
    <div className="regulator-layout">
      {/* Left panel - memo list */}
      <div className="regulator-left-panel">
        <div className="regulator-list-header">
          <h3>Memos</h3>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => void refreshMemos()}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Filters */}
        <div className="regulator-filters">
          <div className="regulator-filter-row">
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as 'all' | 'onchain' | 'offchain')}
              className="filter-select"
            >
              <option value="all">All Sources</option>
              <option value="onchain">Onchain</option>
              <option value="offchain">Offchain</option>
            </select>
            <select
              value={assetFilter}
              onChange={(event) => setAssetFilter(event.target.value)}
              className="filter-select"
            >
              <option value="all">All Assets</option>
              {tokens.map((token) => (
                <option key={token} value={token}>{token}</option>
              ))}
            </select>
          </div>
          <input
            value={senderFilter}
            onChange={(event) => setSenderFilter(event.target.value)}
            placeholder="Filter by address..."
            className="filter-input"
          />
        </div>

        {/* Memo ID lookup */}
        <div className="regulator-lookup">
          <input
            value={memoId}
            onChange={(event) => setMemoId(event.target.value)}
            placeholder="Look up memo by ID (0x...)"
            className="filter-input"
          />
          <button
            className="btn btn-ghost btn-small"
            onClick={() => void loadMemo()}
            disabled={!memoId}
          >
            Lookup
          </button>
        </div>

        {refreshNote && <div className="muted regulator-note">{refreshNote}</div>}

        {/* Memo list */}
        <div className="memo-list">
          {filteredItems.length === 0 ? (
            <div className="memo-list-empty muted">
              {history.length === 0
                ? 'No memos found. Click Refresh to index.'
                : 'No memos match your filters.'}
            </div>
          ) : (
            filteredItems.map((memo) => (
              <MemoListItem
                key={memo.memoId}
                memo={memo}
                isSelected={data?.memoId === memo.memoId}
                onClick={() => void openFromHistory(memo)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel - memo detail */}
      <div className="regulator-right-panel">
        <MemoDetailPanel memo={data} error={error} />
      </div>
    </div>
  )
}
