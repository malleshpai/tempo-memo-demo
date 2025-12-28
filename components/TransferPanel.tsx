'use client'

import React from 'react'
import { parseUnits, isAddress, stringToHex } from 'viem'
import { tempoTestnet } from 'viem/chains'
import { Actions } from 'tempo.ts/wagmi'
import { useConnection, usePublicClient, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { TOKENS, DEFAULT_TRANSFER_TOKEN } from '../lib/constants'
import { KEY_TYPE_P256, MEMO_STORE_ADDRESS, PUBLIC_KEY_REGISTRY_ADDRESS, REGULATOR_PUBLIC_KEY_HEX, REGULATOR_ADDRESS, memoStoreAbi, publicKeyRegistryAbi } from '../lib/contracts'
import { encryptDataKeyFor, encryptPayload, importPrivateKey, loadPrivateKey } from '../lib/crypto'
import { OnchainEncryptedMemo, onchainMemoSize } from '../lib/onchainMemo'
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
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const [toAddress, setToAddress] = React.useState('')
  const [tokenAddress, setTokenAddress] = React.useState(DEFAULT_TRANSFER_TOKEN.address)
  const [amount, setAmount] = React.useState('')
  const [ivmsMode, setIvmsMode] = React.useState<IvmsMode>('upload')
  const [useOnchain, setUseOnchain] = React.useState(false)
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
  const onchainReady = Boolean(PUBLIC_KEY_REGISTRY_ADDRESS && MEMO_STORE_ADDRESS)

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
      if (useOnchain) {
        if (!onchainReady || !MEMO_STORE_ADDRESS || !PUBLIC_KEY_REGISTRY_ADDRESS) {
          throw new Error('Onchain memo contracts are not configured.')
        }
        if (!publicClient) {
          throw new Error('Onchain client is not available.')
        }
        const storedKey = loadPrivateKey(address)
        if (!storedKey) {
          throw new Error('Missing local encryption key. Generate and register your key first.')
        }
        const senderPrivate = await importPrivateKey(storedKey.privateKeyJwk)

        const recipientKey = await publicClient.readContract({
          address: PUBLIC_KEY_REGISTRY_ADDRESS,
          abi: publicKeyRegistryAbi,
          functionName: 'getKey',
          args: [toAddress as `0x${string}`],
        })
        const recipientPublic = recipientKey?.[0] as string | undefined
        const recipientKeyType = recipientKey?.[1] as number | undefined
        if (!recipientPublic || recipientPublic.length < 10 || recipientKeyType !== KEY_TYPE_P256) {
          throw new Error('Recipient does not have a registered encryption key.')
        }

        const senderPublic = storedKey.publicKeyHex
        const payloadBytes = new TextEncoder().encode(JSON.stringify(ivmsPayload))
        const { dataKey, iv, ciphertext } = await encryptPayload(payloadBytes)

        const senderKey = await encryptDataKeyFor(memoId, senderPrivate, senderPublic, dataKey)
        const recipientWrapped = await encryptDataKeyFor(memoId, senderPrivate, recipientPublic, dataKey)
        const keys = [
          { addr: address as `0x${string}`, iv: senderKey.iv, encKey: senderKey.encKey },
          { addr: toAddress as `0x${string}`, iv: recipientWrapped.iv, encKey: recipientWrapped.encKey },
        ]

        let regulatorPubKey = REGULATOR_PUBLIC_KEY_HEX || undefined
        if (REGULATOR_PUBLIC_KEY_HEX && REGULATOR_ADDRESS) {
          const regulatorWrapped = await encryptDataKeyFor(
            memoId,
            senderPrivate,
            REGULATOR_PUBLIC_KEY_HEX,
            dataKey,
          )
          keys.push({
            addr: REGULATOR_ADDRESS as `0x${string}`,
            iv: regulatorWrapped.iv,
            encKey: regulatorWrapped.encKey,
          })
        }

        const onchainMemo: OnchainEncryptedMemo = {
          v: 1,
          memoHash: memoId,
          sender: address as `0x${string}`,
          recipient: toAddress as `0x${string}`,
          senderPubKey: senderPublic,
          regulatorPubKey: regulatorPubKey || undefined,
          createdAt: new Date().toISOString(),
          contentType: 'application/json',
          ivmsHash: memoId,
          token: {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
          },
          amountDisplay: amount,
          keyAlg: 'ECDH-P256',
          kdf: 'HKDF-SHA256',
          enc: { alg: 'AES-256-GCM', iv, ciphertext },
          keys,
        }

        const size = onchainMemoSize(onchainMemo)
        if (size > 2048) {
          throw new Error(`Encrypted memo is ${size} bytes, exceeds 2048 byte limit.`)
        }

        setStatus('Storing encrypted memo onchain…')
        await writeContractAsync({
          address: MEMO_STORE_ADDRESS,
          abi: memoStoreAbi,
          functionName: 'putMemo',
          args: [memoId, stringToHex(JSON.stringify(onchainMemo)), address as `0x${string}`, toAddress as `0x${string}`],
        })
      }

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

      if (!useOnchain) {
        setStatus('Saving memo data…')
        const response = await fetch('/api/memos', {
          method: 'POST',
          body: formData,
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error || 'Failed to save memo data.')
        }
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

        <label className="field onchain-toggle">
          <span>Onchain encrypted memo</span>
          <div className="toggle-row">
            <input
              type="checkbox"
              checked={useOnchain}
              onChange={(event) => setUseOnchain(event.target.checked)}
              disabled={!onchainReady}
            />
            <span className="muted" style={{ fontSize: 12 }}>
              Store the encrypted memo JSON onchain (2048 bytes max).
            </span>
          </div>
        </label>

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
