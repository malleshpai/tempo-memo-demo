'use client'

import React from 'react'
import { useConnect, useConnection, useDisconnect } from 'wagmi'
import { Actions } from 'tempo.ts/wagmi'
import { tempoTestnet } from 'viem/chains'
import { wagmiConfig } from '../lib/wagmi'

type AppShellProps = {
  title: string
  subtitle?: string
  unauthenticated: React.ReactNode
  children: React.ReactNode
}

export function AppShell({ title, subtitle, unauthenticated, children }: AppShellProps) {
  const { address } = useConnection()
  const { connect, connectAsync, connectors, isPending: connecting } = useConnect()
  const { disconnect } = useDisconnect()
  const [isMounted, setIsMounted] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  const connector = connectors?.[0]
  const isAuthed = isMounted && !!address
  const explorerBase = tempoTestnet.blockExplorers?.default.url
  const addressUrl = explorerBase && address ? `${explorerBase}/address/${address}` : undefined

  const onLogin = () => {
    if (!connector) return
    connect({ connector })
  }

  const copyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const onSignUp = () => {
    if (!connector) return
    void (async () => {
      const result = await connectAsync({
        connector,
        capabilities: {
          type: 'sign-up',
          label: title,
        },
      } as any)

      const account = result?.accounts?.[0]
      if (account) {
        try {
          await Actions.faucet.fund(wagmiConfig, { account })
        } catch {
          // Ignore faucet errors; user can retry manually.
        }
      }
    })()
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-brand">
          <div className="brand-mark">T</div>
          <div>
            <div className="eyebrow">{subtitle ?? 'Tempo Memo'}</div>
            <h1>{title}</h1>
          </div>
        </div>
        <nav className="app-nav">
          <a className="app-nav-link" href="/">Send</a>
          <a className="app-nav-link" href="/vault">Vault</a>
          <a className="app-nav-link" href="/regulator">Regulator</a>
          <a className="app-nav-link" href="/docs">Docs</a>
        </nav>
        {!isAuthed ? (
          <div className="topbar-actions">
            <button
              className="btn btn-secondary"
              disabled={!connector || connecting}
              onClick={onLogin}
            >
              Log in
            </button>
            <button
              className="btn btn-primary"
              disabled={!connector || connecting}
              onClick={onSignUp}
            >
              Sign up
            </button>
          </div>
        ) : (
          <div className="topbar-actions">
            {addressUrl && (
              <div className="topbar-address-wrap">
                <a className="topbar-address" href={addressUrl} target="_blank" rel="noreferrer">
                  {address}
                </a>
                <button
                  className="btn btn-ghost btn-copy"
                  onClick={() => void copyAddress()}
                  type="button"
                  aria-label="Copy address"
                  title="Copy address"
                >
                  {copied ? (
                    'Copied'
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="9" y="9" width="10" height="10" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
                  )}
                </button>
              </div>
            )}
            <button className="btn btn-secondary" onClick={() => disconnect()}>
              Sign out
            </button>
          </div>
        )}
      </header>

      {isAuthed ? children : unauthenticated}
    </div>
  )
}
