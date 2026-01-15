'use client'

import React from 'react'
import { parseUnits, isAddress, stringToHex, padHex } from 'viem'
import { tempoTestnet } from 'viem/chains'
import { Hooks } from 'wagmi/tempo'
import { useConnection, usePublicClient, useWriteContract, useWalletClient } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { TOKENS, DEFAULT_TRANSFER_TOKEN } from '../lib/constants'
import { KEY_TYPE_P256, MEMO_STORE_ADDRESS, PUBLIC_KEY_REGISTRY_ADDRESS, PUBLIC_MEMO_HEADER_ADDRESS, REGULATOR_PUBLIC_KEY_HEX, REGULATOR_ADDRESS, memoStoreAbi, publicKeyRegistryAbi, publicMemoHeaderAbi } from '../lib/contracts'
import { LocatorType, MEMO_VERSION, type CreateMemoHeaderParams } from '../lib/publicMemoHeader'
import { encryptDataKeyFor, encryptPayload, importPrivateKey, loadPrivateKey, bytesToHex, encodeJson } from '../lib/crypto'
import { OnchainEncryptedMemoV2, onchainMemoSize, MAX_ADDITIONAL_INFO_BYTES } from '../lib/onchainMemo'
import { canonicalizeJson, hashMemo, IvmsPayload } from '../lib/memo'
import { wagmiConfig } from '../lib/wagmi'
import { IvmsForm, IvmsFormData } from './IvmsForm'
import { IvmsPreview } from './IvmsPreview'

type IvmsMode = 'upload' | 'form'

const tokenList = Object.values(TOKENS)

const PURPOSE_OPTIONS = [
  { value: 'Payroll', label: 'Payroll' },
  { value: 'Refund', label: 'Refund' },
  { value: 'Invoice', label: 'Invoice' },
  { value: 'Payment', label: 'Payment' },
  { value: 'Transfer', label: 'Transfer' },
  { value: 'Settlement', label: 'Settlement' },
  { value: 'custom', label: 'Other...' },
] as const

const emptyForm: IvmsFormData = {
  originator: { name: '', address: '', institution: '', country: '' },
  beneficiary: { name: '', address: '', institution: '', country: '' },
  transaction: { purpose: '', reference: '' },
}

// Test data for quick testing
const TEST_RECIPIENT = '0xc9D3eb74123249c16069A91ee3b89722ca98d99c' as const
const TEST_AMOUNT = '1'
const TEST_SENDER_ID = 'test@sender.com'
const TEST_RECIPIENT_ID = 'test@recipient.com'
const TEST_FORM: IvmsFormData = {
  originator: { name: 'Test Sender', address: '123 Test St', institution: 'Test Bank', country: 'US' },
  beneficiary: { name: 'Test Recipient', address: '456 Demo Ave', institution: 'Demo Bank', country: 'US' },
  transaction: { purpose: 'Test Payment', reference: 'TEST-001' },
}

type TxRowStatus = 'pending' | 'sending' | 'sent' | 'confirmed' | 'error'

function TransactionRow({
  number,
  label,
  status,
  hash,
  explorerBase,
  isSubmitting,
}: {
  number: number
  label: string
  status: TxRowStatus
  hash?: `0x${string}`
  explorerBase?: string
  isSubmitting: boolean
}) {
  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return ''
      case 'sending':
        return 'Sending...'
      case 'sent':
        return 'Confirming...'
      case 'confirmed':
        return 'Confirmed'
      case 'error':
        return 'Failed'
      default:
        return ''
    }
  }

  const getStatusPillClass = () => {
    if (!isSubmitting) return 'status-pill'
    switch (status) {
      case 'confirmed':
        return 'status-pill status-pill-success'
      case 'sending':
      case 'sent':
        return 'status-pill status-pill-active'
      case 'error':
        return 'status-pill status-pill-error'
      default:
        return 'status-pill'
    }
  }

  const statusText = getStatusText()
  const explorerUrl = hash && explorerBase ? `${explorerBase}/tx/${hash}` : undefined

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className={getStatusPillClass()}>{number}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {isSubmitting && statusText && (
        <span
          className="muted"
          style={{
            fontSize: 12,
            color: status === 'confirmed' ? '#16a34a' : status === 'error' ? '#dc2626' : undefined,
          }}
        >
          {statusText}
        </span>
      )}
      {status === 'confirmed' && explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12 }}
          onClick={(e) => e.stopPropagation()}
        >
          View
        </a>
      )}
    </div>
  )
}

export function TransferPanel() {
  const { address } = useConnection()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { writeContractAsync } = useWriteContract()
  const tokenTransfer = Hooks.token.useTransferSync()
  const [toAddress, setToAddress] = React.useState('')
  const [recipientKeyStatus, setRecipientKeyStatus] = React.useState<'idle' | 'checking' | 'available' | 'missing' | 'error'>('idle')
  const [recipientKeyMessage, setRecipientKeyMessage] = React.useState<string | null>(null)
  const [tokenAddress, setTokenAddress] = React.useState(DEFAULT_TRANSFER_TOKEN.address)
  const [amount, setAmount] = React.useState('')
  const [senderIdentifier, setSenderIdentifier] = React.useState('')
  const [recipientIdentifier, setRecipientIdentifier] = React.useState('')
  const [purposeSelection, setPurposeSelection] = React.useState('Payroll')
  const [customPurpose, setCustomPurpose] = React.useState('')
  const [useCustomMemoId, setUseCustomMemoId] = React.useState(false)
  const [customMemoId, setCustomMemoId] = React.useState('')
  const [memoIdInputMode, setMemoIdInputMode] = React.useState<'hex' | 'ascii' | 'uetr'>('uetr')
  const [uetrParts, setUetrParts] = React.useState(['', '', '', '', ''])
  const [ivmsMode, setIvmsMode] = React.useState<IvmsMode>('form')
  const [useOnchain, setUseOnchain] = React.useState(false)
  const [additionalInfo, setAdditionalInfo] = React.useState('')
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
    memoTxHash?: `0x${string}`
    headerTxHash?: `0x${string}`
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showPreview, setShowPreview] = React.useState(false)

  // Transaction progress tracking
  type TxStatus = 'pending' | 'sending' | 'sent' | 'confirmed' | 'error'
  const [txProgress, setTxProgress] = React.useState<{
    transfer: { status: TxStatus; hash?: `0x${string}` }
    header: { status: TxStatus; hash?: `0x${string}` }
    memo: { status: TxStatus; hash?: `0x${string}` }
  }>({
    transfer: { status: 'pending' },
    header: { status: 'pending' },
    memo: { status: 'pending' },
  })

  const token = tokenList.find((item) => item.address === tokenAddress) ?? DEFAULT_TRANSFER_TOKEN
  const effectivePurpose = purposeSelection === 'custom' ? customPurpose : purposeSelection

  React.useEffect(() => {
    setRecipientKeyStatus('idle')
    setRecipientKeyMessage(null)
    setUseOnchain(false)
  }, [toAddress])

  const fillTestData = () => {
    setToAddress(TEST_RECIPIENT)
    setAmount(TEST_AMOUNT)
    setSenderIdentifier(TEST_SENDER_ID)
    setRecipientIdentifier(TEST_RECIPIENT_ID)
    setIvmsForm(TEST_FORM)
    setPurposeSelection('Payment')
    setIvmsMode('form')
    // Trigger recipient key check
    void checkRecipientKey()
  }

  const resetStatus = () => {
    setStatus(null)
    setError(null)
  }

  const checkRecipientKey = async () => {
    setRecipientKeyMessage(null)
    if (!publicClient) {
      setRecipientKeyStatus('error')
      setRecipientKeyMessage('Onchain client is not available.')
      return
    }
    if (!PUBLIC_KEY_REGISTRY_ADDRESS) {
      setRecipientKeyStatus('error')
      setRecipientKeyMessage('Public key registry is not configured.')
      return
    }
    if (!isAddress(toAddress as `0x${string}`)) {
      setRecipientKeyStatus('error')
      setRecipientKeyMessage('Destination address is invalid.')
      return
    }
    setRecipientKeyStatus('checking')
    try {
      const result = await publicClient.readContract({
        address: PUBLIC_KEY_REGISTRY_ADDRESS as `0x${string}`,
        abi: publicKeyRegistryAbi,
        functionName: 'getKey',
        args: [toAddress as `0x${string}`],
      })
      const key = result?.[0] as string | undefined
      const keyType = result?.[1] as number | undefined
      if (key && key.length > 2 && keyType === KEY_TYPE_P256) {
        setRecipientKeyStatus('available')
        setRecipientKeyMessage('Recipient key is registered for onchain memos.')
        return
      }
      setRecipientKeyStatus('missing')
      setRecipientKeyMessage('Recipient has not registered their key. Ask them to visit the Register tab to generate + register their key.')
    } catch (err: any) {
      setRecipientKeyStatus('error')
      setRecipientKeyMessage(err?.message ?? 'Unable to check recipient key.')
    }
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
  const autoMemoId = React.useMemo(
    () => (ivmsCanonical ? hashMemo(ivmsCanonical) : null),
    [ivmsCanonical],
  )
  const customMemoIdHex = React.useMemo(() => {
    if (memoIdInputMode === 'uetr') {
      // UETR format: 8-4-4-4-12 hex chars (36 chars with hyphens, 32 without)
      const combined = uetrParts.join('')
      if (combined.length !== 32) return null
      if (!/^[0-9a-fA-F]{32}$/.test(combined)) return null
      return `0x${combined.toLowerCase()}` as `0x${string}`
    }
    if (!customMemoId) return null
    if (memoIdInputMode === 'hex') {
      if (/^0x[0-9a-fA-F]{64}$/.test(customMemoId)) {
        return customMemoId as `0x${string}`
      }
      return null
    }
    // ASCII mode: convert to hex and pad to 32 bytes
    if (customMemoId.length > 32) return null
    try {
      const hex = stringToHex(customMemoId, { size: 32 })
      return hex as `0x${string}`
    } catch {
      return null
    }
  }, [customMemoId, memoIdInputMode, uetrParts])

  const memoId = React.useMemo(() => {
    if (useCustomMemoId && customMemoIdHex) {
      return customMemoIdHex
    }
    return autoMemoId
  }, [useCustomMemoId, customMemoIdHex, autoMemoId])

  const ivmsPreviewData = ivmsPayload?.format === 'json' ? (ivmsPayload.payload as Record<string, unknown>) : null
  const hasIvmsPreview = Boolean(ivmsPreviewData)
  const onchainReady = Boolean(PUBLIC_KEY_REGISTRY_ADDRESS && MEMO_STORE_ADDRESS)
  const headerReady = Boolean(PUBLIC_MEMO_HEADER_ADDRESS)

  const recipientKeyOk = recipientKeyStatus === 'available'
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

    // Reset transaction progress
    setTxProgress({
      transfer: { status: 'pending' },
      header: { status: 'pending' },
      memo: { status: 'pending' },
    })

    let transferTxHash: `0x${string}` | undefined
    let headerTxHash: `0x${string}` | undefined
    let memoTxHash: `0x${string}` | undefined

    // Prepare encrypted memo data if onchain
    let onchainMemoData: { memo: OnchainEncryptedMemoV2; memoBytes: `0x${string}` } | undefined

    try {
      // Pre-compute onchain memo if needed
      if (useOnchain) {
        if (!recipientKeyOk) {
          throw new Error("Recipient has not registered their key for onchain memos.")
        }
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

        if (REGULATOR_PUBLIC_KEY_HEX && REGULATOR_ADDRESS) {
          const regulatorWrapped = await encryptDataKeyFor(memoId, senderPrivate, REGULATOR_PUBLIC_KEY_HEX, dataKey)
          keys.push({ addr: REGULATOR_ADDRESS as `0x${string}`, iv: regulatorWrapped.iv, encKey: regulatorWrapped.encKey })
        }

        let additionalInfoB64: string | undefined
        if (additionalInfo.trim()) {
          const infoBytes = new TextEncoder().encode(additionalInfo.trim().slice(0, MAX_ADDITIONAL_INFO_BYTES))
          additionalInfoB64 = btoa(String.fromCharCode(...infoBytes))
        }

        const onchainMemo: OnchainEncryptedMemoV2 = {
          v: 2,
          s: address as `0x${string}`,
          r: toAddress as `0x${string}`,
          t: Math.floor(Date.now() / 1000),
          tk: token.address,
          amt: amount,
          ...(effectivePurpose && { p: effectivePurpose }),
          ...(additionalInfoB64 && { add: additionalInfoB64 }),
          iv,
          ct: ciphertext,
          k: keys.map(k => [k.iv, k.encKey]),
        }

        const size = onchainMemoSize(onchainMemo)
        if (size > 2048) {
          throw new Error(`Encrypted memo is ${size} bytes, exceeds 2048 byte limit.`)
        }

        onchainMemoData = { memo: onchainMemo, memoBytes: bytesToHex(encodeJson(onchainMemo)) }
      }

      // ============ TX 1: Token Transfer ============
      setTxProgress(prev => ({ ...prev, transfer: { status: 'sending' } }))

      // Use Tempo's native token transfer hook
      const transferResult = await tokenTransfer.mutateAsync({
        amount: parsedAmount,
        to: toAddress as `0x${string}`,
        token: token.address,
      })

      const transferHash = transferResult.receipt.transactionHash
      setTxProgress(prev => ({ ...prev, transfer: { status: 'sent', hash: transferHash } }))
      // mutateAsync waits for the receipt, so we can mark it confirmed immediately
      transferTxHash = transferHash
      setTxProgress(prev => ({ ...prev, transfer: { status: 'confirmed', hash: transferTxHash } }))

      // ============ TX 2: Public Memo Header ============
      const shouldCreateHeader = headerReady && PUBLIC_MEMO_HEADER_ADDRESS && (useOnchain || (senderIdentifier && recipientIdentifier))
      if (shouldCreateHeader && PUBLIC_MEMO_HEADER_ADDRESS && walletClient) {
        setTxProgress(prev => ({ ...prev, header: { status: 'sending' } }))
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const locatorUrl = useOnchain ? '' : `${baseUrl}/${memoId}`
        const finalSenderIdentifier = senderIdentifier || address
        const finalRecipientIdentifier = recipientIdentifier || toAddress

        const headerParams: CreateMemoHeaderParams = {
          memoId,
          purpose: effectivePurpose || 'Transfer',
          locatorType: useOnchain ? LocatorType.OnChain : LocatorType.OffChain,
          locatorHash: useOnchain ? memoId : ('0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`),
          locatorUrl,
          contentHash: memoId,
          signature: '0x' as `0x${string}`,
          sender: { addr: address as `0x${string}`, identifier: finalSenderIdentifier },
          recipient: { addr: toAddress as `0x${string}`, identifier: finalRecipientIdentifier },
          version: MEMO_VERSION,
        }

        // Use walletClient.writeContract directly instead of wagmi hook
        const headerHash = await walletClient.writeContract({
          address: PUBLIC_MEMO_HEADER_ADDRESS,
          abi: publicMemoHeaderAbi,
          functionName: 'createMemoHeader',
          args: [headerParams],
          chain: tempoTestnet,
        })
        setTxProgress(prev => ({ ...prev, header: { status: 'sent', hash: headerHash } }))
        const headerReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: headerHash })
        headerTxHash = headerReceipt.transactionHash
        setTxProgress(prev => ({ ...prev, header: { status: 'confirmed', hash: headerTxHash } }))
      }

      // ============ TX 3: Encrypted Memo (MemoStore) ============
      if (useOnchain && onchainMemoData && MEMO_STORE_ADDRESS && walletClient) {
        setTxProgress(prev => ({ ...prev, memo: { status: 'sending' } }))
        // Use walletClient.writeContract directly instead of wagmi hook
        const memoHash = await walletClient.writeContract({
          address: MEMO_STORE_ADDRESS,
          abi: memoStoreAbi,
          functionName: 'putMemo',
          args: [memoId, onchainMemoData.memoBytes, address as `0x${string}`, toAddress as `0x${string}`],
          chain: tempoTestnet,
        })
        setTxProgress(prev => ({ ...prev, memo: { status: 'sent', hash: memoHash } }))
        const memoReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: memoHash })
        memoTxHash = memoReceipt.transactionHash
        setTxProgress(prev => ({ ...prev, memo: { status: 'confirmed', hash: memoTxHash } }))
      }

      // Save offchain data if not onchain
      if (!useOnchain) {
        const formData = new FormData()
        formData.set('memoId', memoId)
        formData.set('sender', address)
        formData.set('recipient', toAddress)
        formData.set('tokenAddress', token.address)
        formData.set('tokenSymbol', token.symbol)
        formData.set('tokenDecimals', String(token.decimals))
        formData.set('amountBase', parsedAmount.toString())
        formData.set('amountDisplay', amount)
        formData.set('txHash', transferTxHash!)
        formData.set('ivmsCanonical', ivmsCanonical)
        formData.set('ivmsPayload', JSON.stringify(ivmsPayload))
        if (ivmsFile) formData.set('file', ivmsFile)
        if (invoiceFile) formData.set('invoice', invoiceFile)
        if (additionalInfo.trim()) formData.set('additionalInfo', additionalInfo.trim())

        const response = await fetch('/api/memos', { method: 'POST', body: formData })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error || 'Failed to save memo data.')
        }
      }

      setMemoResult({ memoId, txHash: transferTxHash, memoTxHash, headerTxHash })
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
  const memoTxUrl = memoResult?.memoTxHash
    ? `${explorerBase}/tx/${memoResult.memoTxHash}`
    : undefined
  const headerTxUrl = memoResult?.headerTxHash
    ? `${explorerBase}/tx/${memoResult.headerTxHash}`
    : undefined

  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">New memo transfer</h3>
        <div className="panel-header-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={fillTestData}
            title="Fill form with test data for quick testing"
          >
            Fill Test Data
          </button>
          <button className="btn btn-primary" disabled={!canSubmit || isSubmitting} onClick={() => setShowPreview(true)}>
            {isSubmitting ? 'Submitting…' : 'Review & Send'}
          </button>
        </div>
      </div>

      <div className="stack-md" style={{ marginTop: 12 }}>
        <label className="field">
          <span>Destination address</span>
          <div className="field-row">
            <input
              value={toAddress}
              onChange={(event) => setToAddress(event.target.value)}
              placeholder="0x…"
            />
            <button
              className="btn btn-secondary btn-small"
              type="button"
              disabled={!toAddress || recipientKeyStatus === 'checking' || !onchainReady}
              onClick={() => void checkRecipientKey()}
            >
              {recipientKeyStatus === 'checking' ? 'Checking…' : 'Sender Registered?'}
            </button>
          </div>
          {!onchainReady && (
            <div className="muted" style={{ marginTop: 6 }}>
              Onchain memos require the registry + memo store contracts.
            </div>
          )}
          {recipientKeyStatus === 'available' && recipientKeyMessage && (
            <div className="muted" style={{ marginTop: 6 }}>{recipientKeyMessage}</div>
          )}
          {recipientKeyStatus !== 'available' && recipientKeyMessage && (
            <div className="error-text" style={{ marginTop: 6 }}>{recipientKeyMessage}</div>
          )}
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

        <div className="field-row">
          <label className="field">
            <span>Purpose</span>
            <select
              value={purposeSelection}
              onChange={(event) => setPurposeSelection(event.target.value)}
            >
              {PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {purposeSelection === 'custom' && (
            <label className="field">
              <span>Custom Purpose</span>
              <input
                value={customPurpose}
                onChange={(event) => setCustomPurpose(event.target.value.slice(0, 16))}
                placeholder="Max 16 chars"
                maxLength={16}
              />
            </label>
          )}
        </div>

        {headerReady && (
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Public Memo Header (Optional)</div>
            <div className="stack-sm">
              <div className="field-row">
                <label className="field">
                  <span>Sender ID</span>
                  <input
                    value={senderIdentifier}
                    onChange={(event) => setSenderIdentifier(event.target.value)}
                    placeholder="e.g. tom@ubs.com"
                  />
                </label>
                <label className="field">
                  <span>Recipient ID</span>
                  <input
                    value={recipientIdentifier}
                    onChange={(event) => setRecipientIdentifier(event.target.value)}
                    placeholder="e.g. liam@liam.com"
                  />
                </label>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Fill both to create a public on-chain header with identifiers visible to anyone.
              </div>
            </div>
          </div>
        )}

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
              disabled={!onchainReady || recipientKeyStatus === 'checking' || !recipientKeyOk}
            />
            <span className="muted" style={{ fontSize: 12 }}>
              Store the encrypted memo JSON onchain (2048 bytes max). Recipient must register their key.
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

        <label className="field">
          <span>Additional Info (optional)</span>
          <textarea
            value={additionalInfo}
            onChange={(event) => setAdditionalInfo(event.target.value.slice(0, MAX_ADDITIONAL_INFO_BYTES))}
            placeholder="Free-form notes, references, or instructions (max 128 characters)"
            rows={2}
            style={{ resize: 'vertical', minHeight: 60 }}
          />
          <span className="muted" style={{ fontSize: 11 }}>
            {additionalInfo.length}/{MAX_ADDITIONAL_INFO_BYTES} characters
          </span>
        </label>

        <div className="card memo-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Memo ID</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {useCustomMemoId ? 'Custom ID (e.g. UETR)' : 'Hash of IVMS payload'}
              </div>
            </div>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={useCustomMemoId}
                onChange={(e) => {
                  setUseCustomMemoId(e.target.checked)
                  if (!e.target.checked) {
                    setCustomMemoId('')
                    setMemoIdInputMode('hex')
                  }
                }}
              />
              Custom ID
            </label>
          </div>
          {useCustomMemoId ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="radio"
                    name="memoIdMode"
                    checked={memoIdInputMode === 'uetr'}
                    onChange={() => {
                      setMemoIdInputMode('uetr')
                      setCustomMemoId('')
                      setUetrParts(['', '', '', '', ''])
                    }}
                  />
                  UETR
                </label>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="radio"
                    name="memoIdMode"
                    checked={memoIdInputMode === 'ascii'}
                    onChange={() => {
                      setMemoIdInputMode('ascii')
                      setCustomMemoId('')
                    }}
                  />
                  ASCII
                </label>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="radio"
                    name="memoIdMode"
                    checked={memoIdInputMode === 'hex'}
                    onChange={() => {
                      setMemoIdInputMode('hex')
                      setCustomMemoId('')
                    }}
                  />
                  Hex
                </label>
              </div>
              {memoIdInputMode === 'uetr' ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {[8, 4, 4, 4, 12].map((len, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <span className="muted">-</span>}
                        <input
                          className="mono"
                          style={{
                            width: `${len * 10 + 16}px`,
                            fontSize: 13,
                            textAlign: 'center',
                            textTransform: 'lowercase',
                          }}
                          value={uetrParts[idx]}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, len)
                            const newParts = [...uetrParts]
                            newParts[idx] = val
                            setUetrParts(newParts)
                            // Auto-advance to next field
                            if (val.length === len && idx < 4) {
                              const nextInput = e.target.parentElement?.querySelectorAll('input')[idx + 1]
                              if (nextInput) (nextInput as HTMLInputElement).focus()
                            }
                          }}
                          placeholder={'0'.repeat(len)}
                          maxLength={len}
                        />
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    SWIFT UETR format: 8-4-4-4-12 hex characters
                  </div>
                </div>
              ) : (
                <input
                  className="mono"
                  style={{ width: '100%', fontSize: 13 }}
                  value={customMemoId}
                  onChange={(e) => setCustomMemoId(e.target.value)}
                  placeholder={memoIdInputMode === 'hex' ? '0x... (64 hex chars)' : 'Up to 32 characters'}
                  maxLength={memoIdInputMode === 'ascii' ? 32 : 66}
                />
              )}
              {customMemoIdHex && (
                <div className="mono" style={{ fontSize: 11, marginTop: 6, wordBreak: 'break-all', opacity: 0.7 }}>
                  {customMemoIdHex}
                </div>
              )}
              {autoMemoId && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  Content hash: {autoMemoId.slice(0, 10)}...{autoMemoId.slice(-8)}
                </div>
              )}
            </div>
          ) : (
            <div
              className="mono"
              style={{
                marginTop: 8,
                fontSize: 13,
                wordBreak: 'break-all',
                lineHeight: 1.4,
                padding: '8px 0',
              }}
            >
              {memoId ?? '—'}
            </div>
          )}
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
                  View transfer transaction
                </a>
              )}
              {memoTxUrl && (
                <a href={memoTxUrl} target="_blank" rel="noreferrer">
                  View memo posting transaction
                </a>
              )}
              {headerTxUrl && (
                <a href={headerTxUrl} target="_blank" rel="noreferrer">
                  View public header transaction
                </a>
              )}
              <a href={`/${memoResult.memoId}`}>
                Open memo vault
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setShowPreview(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isSubmitting ? 'Submitting Transfer' : 'Review Transfer'}</h3>
              {!isSubmitting && (
                <button className="btn btn-ghost" onClick={() => setShowPreview(false)}>✕</button>
              )}
            </div>

            <div className="stack-md">
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Transfer Details</div>
                <div className="detail-grid">
                  <div className="detail-span">
                    <div className="muted">Recipient</div>
                    <div className="mono detail-address">{toAddress}</div>
                  </div>
                  <div>
                    <div className="muted">Token</div>
                    <div>{token.symbol}</div>
                  </div>
                  <div>
                    <div className="muted">Amount</div>
                    <div>{amount} {token.symbol}</div>
                  </div>
                  <div>
                    <div className="muted">Purpose</div>
                    <div>{effectivePurpose}</div>
                  </div>
                  <div>
                    <div className="muted">Storage</div>
                    <div>{useOnchain ? 'Onchain (encrypted)' : 'Offchain (Vercel Blob)'}</div>
                  </div>
                  {additionalInfo && (
                    <div className="detail-span">
                      <div className="muted">Additional Info</div>
                      <div>{additionalInfo}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {isSubmitting ? 'Transaction Progress' : 'Transactions to Send'}
                </div>
                <div className="stack-sm">
                  {/* TX 1: Token Transfer */}
                  <TransactionRow
                    number={1}
                    label={`Transfer ${amount} ${token.symbol} to recipient`}
                    status={txProgress.transfer.status}
                    hash={txProgress.transfer.hash}
                    explorerBase={explorerBase}
                    isSubmitting={isSubmitting}
                  />

                  {/* TX 2: Public Header (for onchain always, for offchain if identifiers provided) */}
                  {(useOnchain || (headerReady && senderIdentifier && recipientIdentifier)) && (
                    <TransactionRow
                      number={2}
                      label="Create public memo header (PublicMemoHeader)"
                      status={txProgress.header.status}
                      hash={txProgress.header.hash}
                      explorerBase={explorerBase}
                      isSubmitting={isSubmitting}
                    />
                  )}

                  {/* TX 3: Private Memo (MemoStore) - onchain only */}
                  {useOnchain && (
                    <TransactionRow
                      number={3}
                      label="Store encrypted memo onchain (MemoStore)"
                      status={txProgress.memo.status}
                      hash={txProgress.memo.hash}
                      explorerBase={explorerBase}
                      isSubmitting={isSubmitting}
                    />
                  )}

                  {/* Offchain save indicator */}
                  {!useOnchain && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="status-pill status-pill-neutral">
                        {headerReady && senderIdentifier && recipientIdentifier ? '3' : '2'}
                      </span>
                      <span className="muted">Save memo data offchain (API call)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-span">
                <div className="muted" style={{ fontSize: 12 }}>Memo ID</div>
                <div className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{memoId}</div>
              </div>

              {error && (
                <div className="error-text" style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>
                  {error}
                </div>
              )}

              {status && !error && (
                <div className="success-text" style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 6 }}>
                  {status}
                </div>
              )}
            </div>

            <div className="modal-actions">
              {!isSubmitting && !memoResult && (
                <>
                  <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => void submitTransfer()}
                  >
                    Confirm & Send
                  </button>
                </>
              )}
              {memoResult && (
                <button className="btn btn-primary" onClick={() => setShowPreview(false)}>
                  Done
                </button>
              )}
              {isSubmitting && !memoResult && (
                <div className="muted" style={{ textAlign: 'center', width: '100%' }}>
                  Please confirm transactions in your wallet...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
