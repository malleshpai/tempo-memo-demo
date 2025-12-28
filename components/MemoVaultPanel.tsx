'use client'

import React from 'react'
import { useConnection } from 'wagmi'
import { useRouter } from 'next/navigation'
import { isValidMemoId } from '../lib/memo'

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
  source?: 'onchain' | 'offchain'
}

const parseAmount = (value: string) => {
  const number = Number(value)
  if (Number.isNaN(number)) return null
  return number
}

export function MemoVaultPanel() {
  const { address } = useConnection()
  const router = useRouter()
  const [items, setItems] = React.useState<MemoSummary[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [refreshError, setRefreshError] = React.useState<string | null>(null)
  const [refreshNote, setRefreshNote] = React.useState<string | null>(null)
  const [showDialog, setShowDialog] = React.useState(false)
  const [memoInput, setMemoInput] = React.useState('')
  const [dialogError, setDialogError] = React.useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = React.useState<'all' | 'onchain' | 'offchain'>('all')
  const [senderFilter, setSenderFilter] = React.useState('')
  const [assetFilter, setAssetFilter] = React.useState('all')
  const [amountMin, setAmountMin] = React.useState('')
  const [amountMax, setAmountMax] = React.useState('')
  const [dateFilter, setDateFilter] = React.useState('all')

  const loadMemos = React.useCallback(async () => {
    if (!address) {
      setItems([])
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/memos/by-address/${address}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load memos.')
      }
      setItems(data.items ?? [])
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setIsLoading(false)
    }
  }, [address])

  React.useEffect(() => {
    if (!address) {
      setItems([])
      return
    }

    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/memos/by-address/${address}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load memos.')
        }
        if (!cancelled) {
          setItems(data.items ?? [])
        }
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
  }, [address])

  const refreshLatest = async () => {
    if (!address) return
    setIsRefreshing(true)
    setRefreshError(null)
    setRefreshNote(null)
    try {
      const response = await fetch('/api/indexer/onchain?mode=manual')
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to refresh memos.')
      }
      if (data?.message) {
        setRefreshNote(data.message)
      } else if (typeof data?.stored === 'number') {
        setRefreshNote(`Indexed ${data.stored} memo${data.stored === 1 ? '' : 's'}.`)
      } else {
        setRefreshNote('Index complete.')
      }
      await loadMemos()
    } catch (err: any) {
      setRefreshError(err?.message ?? String(err))
    } finally {
      setIsRefreshing(false)
    }
  }

  const tokens = React.useMemo(() => {
    const set = new Set<string>()
    items.forEach((item) => {
      if (item?.token?.symbol) set.add(item.token.symbol)
    })
    return Array.from(set)
  }, [items])

  const filteredItems = React.useMemo(() => {
    const senderTerm = senderFilter.trim().toLowerCase()
    const min = amountMin ? Number(amountMin) : null
    const max = amountMax ? Number(amountMax) : null
    const now = Date.now()
    const cutoffDays =
      dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : dateFilter === '90d' ? 90 : null
    const cutoff = cutoffDays ? now - cutoffDays * 24 * 60 * 60 * 1000 : null

    return items.filter((item) => {
      if (!item) return false
      const source = item.source ?? 'offchain'
      if (sourceFilter !== 'all' && source !== sourceFilter) return false
      if (assetFilter !== 'all' && item.token?.symbol !== assetFilter) return false
      if (senderTerm) {
        const counterparty = item.counterparty?.toLowerCase() ?? ''
        const sender = item.sender?.toLowerCase() ?? ''
        if (!counterparty.includes(senderTerm) && !sender.includes(senderTerm)) return false
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
  }, [items, senderFilter, sourceFilter, assetFilter, amountMin, amountMax, dateFilter])

  const clearFilters = () => {
    setSourceFilter('all')
    setSenderFilter('')
    setAssetFilter('all')
    setAmountMin('')
    setAmountMax('')
    setDateFilter('all')
  }

  const openDialog = () => {
    setDialogError(null)
    setMemoInput('')
    setShowDialog(true)
  }

  const submitDialog = () => {
    const trimmed = memoInput.trim()
    if (!isValidMemoId(trimmed)) {
      setDialogError('Enter a valid 32-byte memo hash.')
      return
    }
    setShowDialog(false)
    router.push(`/${trimmed}`)
  }

  return (
    <section className="panel panel-wide">
      <div className="panel-header">
        <h3 className="panel-title">Memo vault</h3>
        <div className="panel-header-actions">
          <button className="btn btn-secondary" onClick={openDialog} type="button">
            Retrieve onchain memo
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void refreshLatest()}
            type="button"
            disabled={!address || isRefreshing}
          >
            {isRefreshing ? 'Fetching…' : 'Fetch latest memos'}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            {address ? 'Latest memos for this address' : 'Log in to view memos'}
          </span>
        </div>
      </div>

      {address && refreshNote && <div className="muted">{refreshNote}</div>}
      {address && refreshError && <div className="error-text">{refreshError}</div>}

      {address && (
        <div className="vault-filters">
          <label className="field field-inline">
            <span>Sender</span>
            <input
              value={senderFilter}
              onChange={(event) => setSenderFilter(event.target.value)}
              placeholder="Address or name"
            />
          </label>
          <label className="field field-inline">
            <span>Asset</span>
            <select value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)}
            >
              <option value="all">All</option>
              {tokens.map((token) => (
                <option key={token} value={token}>{token}</option>
              ))}
            </select>
          </label>
          <label className="field field-inline">
            <span>Source</span>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as 'all' | 'onchain' | 'offchain')}>
              <option value="all">All</option>
              <option value="onchain">Onchain</option>
              <option value="offchain">Offchain</option>
            </select>
          </label>
          <div className="field field-inline">
            <span>Amount</span>
            <div className="filter-range">
              <input
                value={amountMin}
                onChange={(event) => setAmountMin(event.target.value)}
                placeholder="Min"
              />
              <span className="muted">-</span>
              <input
                value={amountMax}
                onChange={(event) => setAmountMax(event.target.value)}
                placeholder="Max"
              />
            </div>
          </div>
          <label className="field field-inline">
            <span>Date</span>
            <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </label>
          <button className="btn btn-ghost" onClick={clearFilters} type="button">
            Clear
          </button>
        </div>
      )}

      {!address && <div className="muted">Log in to see incoming and outgoing memos.</div>}
      {address && isLoading && <div className="muted">Loading memos…</div>}
      {address && error && <div className="error-text">{error}</div>}

      {address && !isLoading && !error && (
        <div className="stack-md" style={{ marginTop: 12 }}>
          {filteredItems.length === 0 && (
            <div className="muted">No memos match your filters.</div>
          )}
          {filteredItems.map((item) => {
            const source = item.source ?? 'offchain'
            return (
              <div className="card memo-item" key={item.memoId}>
                <div className="memo-item-main">
                  <div>
                    <div className="memo-item-title">
                      {item.token.symbol} · {item.amountDisplay}
                    </div>
                    <div className="memo-item-badges">
                      <span className={source === 'onchain' ? 'status-pill' : 'status-pill status-pill-neutral'}>
                        {source === 'onchain' ? 'Onchain' : 'Offchain'}
                      </span>
                      {item.hasInvoice && <span className="status-pill status-pill-warn">Invoice</span>}
                    </div>
                    <div className="muted">
                      {item.role === 'sender' ? 'To' : 'From'} <span className="mono">{item.counterparty}</span>
                    </div>
                  </div>
                  <a className="btn btn-secondary btn-small" href={`/${item.memoId}`}>
                    View memo
                  </a>
                </div>
                <div className="memo-item-meta">
                  <span className="mono memo-hash-short">{item.memoId}</span>
                  <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showDialog && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowDialog(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h4>Retrieve onchain memo</h4>
              <button className="btn btn-ghost" onClick={() => setShowDialog(false)} type="button">
                Close
              </button>
            </div>
            <div className="stack-sm">
              <label className="field">
                <span>Memo hash</span>
                <input
                  value={memoInput}
                  onChange={(event) => setMemoInput(event.target.value)}
                  placeholder="0x…"
                />
              </label>
              {dialogError && <div className="error-text">{dialogError}</div>}
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowDialog(false)} type="button">
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={submitDialog} type="button">
                  Open memo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
