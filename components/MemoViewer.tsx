'use client'

import React from 'react'
import { useConnection, usePublicClient } from 'wagmi'
import { getConnectorClient } from 'wagmi/actions'
import { tempoTestnet } from 'viem/chains'
import { hexToString, isAddress } from 'viem'
import { sendCallsSync } from 'viem/actions'
import { isValidMemoId, MemoRecord } from '../lib/memo'
import { decryptDataKey, decryptPayload, importPrivateKey, loadPrivateKey } from '../lib/crypto'
import { MEMO_STORE_ADDRESS, memoStoreAbi } from '../lib/contracts'
import { wagmiConfig } from '../lib/wagmi'
import { IvmsPreview } from './IvmsPreview'
import type { OnchainEncryptedMemo } from '../lib/onchainMemo'

type MemoViewerProps = {
  memoId: string
}

type MemoResponse = Pick<
  MemoRecord,
  'memoId' | 'sender' | 'recipient' | 'token' | 'amountBase' | 'amountDisplay' | 'txHash' | 'ivms' | 'file' | 'invoice' | 'createdAt'
>

export function MemoViewer({ memoId }: MemoViewerProps) {
  const { address } = useConnection()
  const publicClient = usePublicClient()
  const [isLoading, setIsLoading] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [actionStatus, setActionStatus] = React.useState<string | null>(null)
  const [data, setData] = React.useState<MemoResponse | null>(null)
  const [source, setSource] = React.useState<'offchain' | 'onchain' | null>(null)
  const memoStoreAddress = MEMO_STORE_ADDRESS
  const hasMemoStore = Boolean(memoStoreAddress && isAddress(memoStoreAddress))


  const loadOnchainMemo = async () => {
    if (!hasMemoStore || !memoStoreAddress) {
      throw new Error('Memo store is not configured.')
    }
    if (!address) {
      throw new Error('Log in to decrypt this memo.')
    }
    if (!publicClient) {
      throw new Error('Onchain client is not available.')
    }

    const storedKey = loadPrivateKey(address)
    if (!storedKey) {
      throw new Error('Missing local encryption key for this address.')
    }

    const privateKey = await importPrivateKey(storedKey.privateKeyJwk)
    const [dataHex, sender, recipient, createdAt] = await publicClient.readContract({
      address: memoStoreAddress,
      abi: memoStoreAbi,
      functionName: 'getMemo',
      args: [memoId as `0x${string}`],
    })

    if (!dataHex || dataHex === '0x') {
      throw new Error('Memo not found onchain.')
    }

    const json = hexToString(dataHex as `0x${string}`)
    const memo = JSON.parse(json) as OnchainEncryptedMemo
    const keyEntry = memo.keys.find((entry) => entry.addr.toLowerCase() === address.toLowerCase())
    if (!keyEntry) {
      throw new Error('This address does not have access to the encrypted memo.')
    }

    const memoHash = memo.memoHash || (memoId as `0x${string}`)
    const dataKey = await decryptDataKey(memoHash, privateKey, memo.senderPubKey, keyEntry.encKey, keyEntry.iv)
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
    const safeCreatedAt = createdAtIso && !Number.isNaN(Date.parse(createdAtIso))
      ? createdAtIso
      : new Date().toISOString()
    const token = memo.token ?? { address: '0x0000000000000000000000000000000000000000', symbol: 'Unknown', decimals: 0 }

    const result: MemoResponse = {
      memoId: memoHash,
      sender: sender as `0x${string}`,
      recipient: recipient as `0x${string}`,
      token,
      amountBase: memo.amountDisplay,
      amountDisplay: memo.amountDisplay,
      txHash: undefined,
      ivms: { schema: 'ivms-1', format: 'json', payload },
      file: undefined,
      invoice: undefined,
      createdAt: safeCreatedAt,
    }

    return result
  }

  const loadMemo = async () => {
    if (!address) return
    setIsLoading(true)
    setError(null)
    setActionStatus(null)
    try {
      const response = await fetch(`/api/memos/${memoId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })

      if (response.ok) {
        const payload = (await response.json()) as MemoResponse
        setData(payload)
        setSource('offchain')
        return
      }

      if (response.status === 404) {
        const onchainPayload = await loadOnchainMemo()
        setData(onchainPayload)
        setSource('onchain')
        return
      }

      const body = await response.json().catch(() => ({}))
      throw new Error(body?.error || 'Unable to access memo.')
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const deleteOnchainMemo = async () => {
    if (!hasMemoStore || !memoStoreAddress) {
      setError('Memo store is not configured.')
      return
    }
    if (!address) {
      setError('Log in to delete this memo.')
      return
    }

    setIsDeleting(true)
    setError(null)
    setActionStatus('Deleting onchain memo…')
    try {
      const client = await getConnectorClient(wagmiConfig, {
        account: address as `0x${string}`
      })
      setActionStatus('Waiting for confirmation…')
      await sendCallsSync(client, {
        account: address as `0x${string}`,
        calls: [
          {
            to: memoStoreAddress,
            abi: memoStoreAbi,
            functionName: 'deleteMemo',
            args: [memoId as `0x${string}`],
          },
        ],
        capabilities: { sync: true },
      })
      setActionStatus('Memo deleted.')
      setData(null)
      setSource(null)
    } catch (err: any) {
      setError(err?.message ?? String(err))
      setActionStatus(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const explorerBase = tempoTestnet.blockExplorers?.default.url
  const txUrl = data?.txHash ? `${explorerBase}/tx/${data.txHash}` : undefined
  const canDelete =
    source === 'onchain' &&
    hasMemoStore &&
    !!address &&
    !!data &&
    data.recipient.toLowerCase() === address.toLowerCase()

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
          <h3 className="panel-title">Memo Vault</h3>
          <div className="panel-header-actions">
            {canDelete && (
              <button
                className="btn btn-secondary"
                disabled={isDeleting}
                onClick={() => void deleteOnchainMemo()}
              >
                {isDeleting ? 'Deleting…' : 'Delete onchain memo'}
              </button>
            )}
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
          {actionStatus && <div className="muted">{actionStatus}</div>}

          {data && (
            <>
              <div className="card">
                <div className="detail-grid">
                  <div className="detail-span">
                    <div className="muted">Sender</div>
                    <div className="mono detail-address">{data.sender}</div>
                  </div>
                  <div className="detail-span">
                    <div className="muted">Recipient</div>
                    <div className="mono detail-address">{data.recipient}</div>
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
                {data.ivms.format === 'json' && data.ivms.payload && typeof data.ivms.payload === 'object' ? (
                  <IvmsPreview data={data.ivms.payload} />
                ) : (
                  <pre className="memo-json">{String(data.ivms.payload)}</pre>
                )}
              </div>

              {data.file && (
                <a className="btn btn-secondary" href={data.file.url} download>
                  Download IVMS file
                </a>
              )}
              {data.invoice && (
                <a className="btn btn-secondary" href={data.invoice.url} download>
                  Download invoice PDF
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
