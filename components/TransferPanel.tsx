'use client'

import React from 'react'
import { parseUnits, isAddress } from 'viem'
import { tempoTestnet } from 'viem/chains'
import { Actions } from 'tempo.ts/wagmi'
import { useConnection } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { TOKENS, DEFAULT_TRANSFER_TOKEN } from '../lib/constants'
import { canonicalizeJson, hashMemo, IvmsPayload } from '../lib/memo'
import { wagmiConfig } from '../lib/wagmi'
import { IvmsForm, IvmsFormData } from './IvmsForm'
import { IvmsPreview } from './IvmsPreview'

type IvmsMode = 'upload' | 'form'

const tokenList = Object.values(TOKENS)

const emptyForm: IvmsFormData = {
  originator: { name: '', address: '', institution: '', country: '' },
  beneficiary: { name: '', address: '', institution: '', country: '' },
  transaction: { purpose: '', reference: '' },
}

export function TransferPanel() {
  const { address } = useConnection()
  const [toAddress, setToAddress] = React.useState('')
  const [tokenAddress, setTokenAddress] = React.useState(DEFAULT_TRANSFER_TOKEN.address)
  const [amount, setAmount] = React.useState('')
  const [ivmsMode, setIvmsMode] = React.useState<IvmsMode>('upload')
  const [ivmsForm, setIvmsForm] = React.useState<IvmsFormData>(emptyForm)
  const [ivmsFile, setIvmsFile] = React.useState<File | null>(null)
  const [invoiceFile, setInvoiceFile] = React.useState<File | null>(null)
  const [ivmsFileText, setIvmsFileText] = React.useState<string | null>(null)
  const [ivmsFileIsJson, setIvmsFileIsJson] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [memoResult, setMemoResult] = React.useState<{
    memoId: `0x${string}`
    txHash?: `0x${string}`
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const token = tokenList.find((item) => item.address === tokenAddress) ?? DEFAULT_TRANSFER_TOKEN

  const resetStatus = () => {
    setStatus(null)
    setError(null)
  }

  const onFileChange = async (file?: File | null) => {
    setIvmsFile(file ?? null)
    setIvmsFileText(null)
    setIvmsFileIsJson(false)
    if (!file) return
    const text = await file.text()
    setIvmsFileText(text)
    try {
      JSON.parse(text)
      setIvmsFileIsJson(true)
    } catch {
      setIvmsFileIsJson(false)
    }
  }

  const ivmsPayload: IvmsPayload | null = React.useMemo(() => {
    if (ivmsMode === 'upload') {
      if (!ivmsFileText) return null
      let payload: unknown = ivmsFileText
      let format: IvmsPayload['format'] = 'text'
      if (ivmsFileIsJson) {
        try {
          payload = JSON.parse(ivmsFileText)
          format = 'json'
        } catch {
          payload = ivmsFileText
          format = 'text'
        }
      }
      return {
        schema: 'ivms-1',
        format,
        payload,
      }
    }

    return {
      schema: 'ivms-1',
      format: 'json',
      payload: {
        originator: ivmsForm.originator,
        beneficiary: ivmsForm.beneficiary,
        transaction: ivmsForm.transaction,
      },
    }
  }, [ivmsMode, ivmsFileText, ivmsFileIsJson, ivmsFile, ivmsForm])

  const ivmsCanonical = React.useMemo(
    () => (ivmsPayload ? canonicalizeJson(ivmsPayload) : null),
    [ivmsPayload],
  )
  const memoId = React.useMemo(
    () => (ivmsCanonical ? hashMemo(ivmsCanonical) : null),
    [ivmsCanonical],
  )

  const ivmsPreviewData = ivmsPayload?.format === 'json' ? (ivmsPayload.payload as Record<string, unknown>) : null
  const hasIvmsPreview = Boolean(ivmsPreviewData)

  const canSubmit =
    !!address &&
    isAddress(toAddress as `0x${string}`) &&
    !!amount &&
    Number(amount) > 0 &&
    !!memoId &&
    !!ivmsPayload

  const submitTransfer = async () => {
    resetStatus()
    if (!address || !memoId || !ivmsPayload || !ivmsCanonical) return
    if (!isAddress(toAddress as `0x${string}`)) {
      setError('Destination address is invalid.')
      return
    }
    const parsedAmount = parseUnits(amount, token.decimals)
    setIsSubmitting(true)
    try {
      setStatus('Submitting transfer…')
      const hash = await Actions.token.transfer(wagmiConfig, {
        amount: parsedAmount,
        to: toAddress as `0x${string}`,
        token: token.address,
        memo: memoId,
      })
      setStatus('Waiting for confirmation…')
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })

      const formData = new FormData()
      formData.set('memoId', memoId)
      formData.set('sender', address)
      formData.set('recipient', toAddress)
      formData.set('tokenAddress', token.address)
      formData.set('tokenSymbol', token.symbol)
      formData.set('tokenDecimals', String(token.decimals))
      formData.set('amountBase', parsedAmount.toString())
      formData.set('amountDisplay', amount)
      formData.set('txHash', receipt.transactionHash)
      formData.set('ivmsCanonical', ivmsCanonical)
      formData.set('ivmsPayload', JSON.stringify(ivmsPayload))
      if (ivmsFile) {
        formData.set('file', ivmsFile)
      }
      if (invoiceFile) {
        formData.set('invoice', invoiceFile)
      }

      setStatus('Saving memo data…')
      const response = await fetch('/api/memos', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || 'Failed to save memo data.')
      }

      setMemoResult({ memoId, txHash: receipt.transactionHash })
      setStatus('Transfer completed.')
    } catch (err: any) {
      setError(err?.message ?? String(err))
      setStatus(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const explorerBase = tempoTestnet.blockExplorers?.default.url
  const txUrl = memoResult?.txHash
    ? `${explorerBase}/tx/${memoResult.txHash}`
    : undefined

  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">New memo transfer</h3>
        <div className="panel-header-actions">
          <button className="btn btn-primary" disabled={!canSubmit || isSubmitting} onClick={() => void submitTransfer()}>
            {isSubmitting ? 'Submitting…' : 'Send transfer'}
          </button>
        </div>
      </div>

      <div className="stack-md" style={{ marginTop: 12 }}>
        <label className="field">
          <span>Destination address</span>
          <input
            value={toAddress}
            onChange={(event) => setToAddress(event.target.value)}
            placeholder="0x…"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Token</span>
            <select value={tokenAddress} onChange={(event) => setTokenAddress(event.target.value as `0x${string}`)}>
              {tokenList.map((item) => (
                <option key={item.address} value={item.address}>
                  {item.symbol}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Amount</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </label>
        </div>

        <div className="ivms-toggle">
          <button
            className={`tab ${ivmsMode === 'upload' ? 'tab-active' : ''}`}
            onClick={() => setIvmsMode('upload')}
            type="button"
          >
            Upload IVMS file
          </button>
          <button
            className={`tab ${ivmsMode === 'form' ? 'tab-active' : ''}`}
            onClick={() => setIvmsMode('form')}
            type="button"
          >
            Enter IVMS data
          </button>
        </div>

        {ivmsMode === 'upload' ? (
          <div className="stack-sm">
            <input type="file" onChange={(event) => void onFileChange(event.target.files?.[0])} />
            <label className="field">
              <span>Invoice PDF (optional)</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {ivmsFile && (
              <div className="muted" style={{ fontSize: 12 }}>
                {ivmsFile.name} · {ivmsFile.type || 'text/plain'}
              </div>
            )}
            {hasIvmsPreview && <IvmsPreview data={ivmsPreviewData} />}
          </div>
        ) : (
          <IvmsForm value={ivmsForm} onChange={setIvmsForm} />
        )}

        <div className="card memo-card">
          <div className="memo-row">
            <div>
              <div style={{ fontWeight: 600 }}>Onchain memo</div>
              <div className="muted">Hash of the IVMS payload</div>
            </div>
            <div className="mono memo-hash">
              {memoId ?? '—'}
            </div>
          </div>
        </div>

        {status && <div className="muted">{status}</div>}
        {error && <div className="error-text">{error}</div>}

        {memoResult && (
          <div className="card success-card">
            <div style={{ fontWeight: 600 }}>Transfer complete</div>
            <div className="stack-sm" style={{ marginTop: 8 }}>
              <div className="mono">Memo: {memoResult.memoId}</div>
              {txUrl && (
                <a href={txUrl} target="_blank" rel="noreferrer">
                  View transaction
                </a>
              )}
              <a href={`/${memoResult.memoId}`}>
                Open memo vault
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
