'use client'

import React from 'react'
import { useConnection } from 'wagmi'
import { tempoTestnet } from 'viem/chains'
import { isValidMemoId, MemoRecord } from '../lib/memo'

type MemoViewerProps = {
  memoId: string
}

type MemoResponse = Pick<
  MemoRecord,
  'memoId' | 'sender' | 'recipient' | 'token' | 'amountBase' | 'amountDisplay' | 'txHash' | 'ivms' | 'file' | 'createdAt'
>

export function MemoViewer({ memoId }: MemoViewerProps) {
  const { address } = useConnection()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<MemoResponse | null>(null)

  const loadMemo = async () => {
    if (!address) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/memos/${memoId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || 'Unable to access memo.')
      }
      const payload = (await response.json()) as MemoResponse
      setData(payload)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const explorerBase = tempoTestnet.blockExplorers?.default.url
  const txUrl = data?.txHash ? `${explorerBase}/tx/${data.txHash}` : undefined

  if (!isValidMemoId(memoId)) {
    return (
      <div className="app-surface">
        <div className="panel">
          <h3 className="panel-title">Invalid memo</h3>
          <div className="muted" style={{ marginTop: 8 }}>
            The memo ID must be a 32-byte hex string.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-surface">
      <div className="panel memo-viewer">
        <div className="panel-header">
          <h3 className="panel-title">Memo vault</h3>
          <div className="panel-header-actions">
            <button
              className="btn btn-primary"
              disabled={!address || isLoading}
              onClick={() => void loadMemo()}
            >
              {isLoading ? 'Verifying…' : 'Verify & view'}
            </button>
          </div>
        </div>

        <div className="stack-md" style={{ marginTop: 12 }}>
          <div className="card card-plain">
            <div className="memo-row">
              <div>
                <div style={{ fontWeight: 600 }}>Memo</div>
                <div className="muted">Access requires sender or recipient login.</div>
              </div>
              <div className="mono memo-hash">{memoId}</div>
            </div>
          </div>

          {!address && <div className="muted">Log in to verify access.</div>}
          {error && <div className="error-text">{error}</div>}

          {data && (
            <>
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
                  {txUrl && (
                    <div>
                      <div className="muted">Transaction</div>
                      <a href={txUrl} target="_blank" rel="noreferrer">
                        View on explorer
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div style={{ fontWeight: 600 }}>IVMS data</div>
                {data.ivms.format === 'json' ? (
                  <pre className="memo-json">
                    {JSON.stringify(data.ivms.payload, null, 2)}
                  </pre>
                ) : (
                  <pre className="memo-json">{String(data.ivms.payload)}</pre>
                )}
              </div>

              {data.file && (
                <a className="btn btn-secondary" href={data.file.url} download>
                  Download IVMS file
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
