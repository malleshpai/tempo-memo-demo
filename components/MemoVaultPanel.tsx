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
}

export function MemoVaultPanel() {
  const { address } = useConnection()
  const router = useRouter()
  const [items, setItems] = React.useState<MemoSummary[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [showDialog, setShowDialog] = React.useState(false)
  const [memoInput, setMemoInput] = React.useState('')
  const [dialogError, setDialogError] = React.useState<string | null>(null)

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
          {items.length == 0 && (
            <div className="muted">No memos found for this address.</div>
          )}
          {items.map((item) => (
            <div className="card memo-item" key={item.memoId}>
              <div className="memo-item-main">
                <div>
                  <div style={{ fontWeight: 600 }}>{item.token.symbol} · {item.amountDisplay}</div>
                  {item.hasInvoice && <span className="status-pill status-pill-warn">Invoice</span>}
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
