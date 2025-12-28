'use client'

import React from 'react'
import { useConnection, useReadContract, useWriteContract } from 'wagmi'
import { loadPrivateKey, generateKeyPair, savePrivateKey } from '../lib/crypto'
import { KEY_TYPE_P256, PUBLIC_KEY_REGISTRY_ADDRESS, publicKeyRegistryAbi } from '../lib/contracts'

export function EncryptionKeyPanel() {
  const { address } = useConnection()
  const [localKey, setLocalKey] = React.useState<ReturnType<typeof loadPrivateKey> | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isRegistering, setIsRegistering] = React.useState(false)
  const [txHash, setTxHash] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)

  const registryEnabled = Boolean(address && PUBLIC_KEY_REGISTRY_ADDRESS)
  const { data, refetch, isFetching } = useReadContract({
    address: PUBLIC_KEY_REGISTRY_ADDRESS,
    abi: publicKeyRegistryAbi,
    functionName: 'getKey',
    args: address ? [address] : undefined,
    query: { enabled: registryEnabled },
  })

  const { writeContractAsync } = useWriteContract()

  React.useEffect(() => {
    if (!address) {
      setLocalKey(null)
      return
    }
    setLocalKey(loadPrivateKey(address))
  }, [address])

  const onRegister = async () => {
    if (!address || !PUBLIC_KEY_REGISTRY_ADDRESS) return
    setError(null)
    setStatus(null)
    setTxHash(null)
    setIsRegistering(true)
    try {
      const keyPair = await generateKeyPair()
      savePrivateKey(address, keyPair)
      setStatus('Submitting registration…')
      const hash = await writeContractAsync({
        address: PUBLIC_KEY_REGISTRY_ADDRESS,
        abi: publicKeyRegistryAbi,
        functionName: 'setKey',
        args: [keyPair.publicKeyHex, KEY_TYPE_P256, keyPair.version],
        gas: BigInt(250000),
      })
      setTxHash(hash)
      setStatus('Registration submitted. Refreshing status…')
      setLocalKey(keyPair)
      await refetch()
      setStatus('Registration complete.')
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setIsRegistering(false)
    }
  }

  const onchainKey = data?.[0] as string | undefined
  const onchainKeyType = data?.[1] as number | undefined

  const isRegistered = Boolean(onchainKey && onchainKey.length > 2)
  const hasLocalKey = Boolean(localKey)

  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Encryption key</h3>
        <div className="panel-header-actions">
          <button
            className="btn btn-secondary"
            disabled={!address || !PUBLIC_KEY_REGISTRY_ADDRESS || isRegistering}
            onClick={() => void onRegister()}
          >
            {isRegistering ? 'Registering…' : 'Generate + register'}
          </button>
        </div>
      </div>

      {!address && <div className="muted">Log in to set your encryption key.</div>}
      {address && !PUBLIC_KEY_REGISTRY_ADDRESS && (
        <div className="error-text">Missing registry contract address.</div>
      )}

      {address && PUBLIC_KEY_REGISTRY_ADDRESS && (
        <div className="stack-sm" style={{ marginTop: 10 }}>
          <div className="muted">Onchain status: {isFetching ? 'Checking…' : isRegistered ? 'Registered' : 'Not registered'}</div>
          <div className="muted">Key type: {isRegistered ? onchainKeyType : '—'}</div>
          <div className="muted">Local private key: {hasLocalKey ? 'Present' : 'Missing'}</div>
          {!hasLocalKey && isRegistered && (
            <div className="error-text">
              This device cannot decrypt existing memos. Generate a new key if needed.
            </div>
          )}
          {status && <div className="muted">{status}</div>}
          {txHash && (
            <div className="muted" style={{ fontSize: 12 }}>
              Tx: <a href={`https://explore.tempo.xyz/tx/${txHash}`} target="_blank" rel="noreferrer">{txHash}</a>
            </div>
          )}
          {error && <div className="error-text">{error}</div>}
        </div>
      )}
    </section>
  )
}
