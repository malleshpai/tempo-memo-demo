'use client'

import React from 'react'
import { useConnect, useConnection, useDisconnect } from 'wagmi'
import { Actions } from 'wagmi/tempo'
import { tempoModerato } from '../lib/wagmi'
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
  const explorerBase = tempoModerato.blockExplorers?.default.url
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
        <div className="app-nav-wrap">
          <nav className="app-nav">
            <a className="app-nav-link" href="/" title="Send TIP-20 transfers with IVMS memo data">Send</a>
            <a className="app-nav-link" href="/vault" title="View sent and received memos">Memo Vault</a>
            <a className="app-nav-link" href="/register" title="Generate and register your encryption key">Register</a>
          </nav>
        </div>
        {!isAuthed ? (
          <div className="topbar-actions">
            <a className="btn btn-secondary" href="/docs" title="Learn how Tempo Memo works">Docs</a>
            <a className="btn btn-secondary btn-danger-outline" href="/regulator" title="Supervisory access to all memos">Regulator</a>
            <button
              className="btn btn-secondary"
              disabled={!connector || connecting}
              onClick={onLogin}
              title="Sign in with your passkey"
            >
              Log in
            </button>
            <button
              className="btn btn-primary"
              disabled={!connector || connecting}
              onClick={onSignUp}
              title="Create a new Tempo account with passkey"
            >
              Sign up
            </button>
          </div>
        ) : (
          <div className="topbar-actions">
            {addressUrl && (
              <div className="topbar-address-wrap">
                <a className="topbar-address" href={addressUrl} target="_blank" rel="noreferrer" title="View address in explorer">
                  {address}
                </a>
                <button
                  className="btn btn-ghost btn-copy"
                  onClick={() => void copyAddress()}
                  type="button"
                  aria-label="Copy address"
                  title="Copy address to clipboard"
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
            <a className="btn btn-secondary" href="/docs" title="Learn how Tempo Memo works">Docs</a>
            <a className="btn btn-secondary btn-danger-outline" href="/regulator" title="Supervisory access to all memos">Regulator</a>
            <button className="btn btn-secondary" onClick={() => disconnect()} title="Sign out of your account">
              Sign out
            </button>
          </div>
        )}
      </header>

      {isAuthed ? children : unauthenticated}
    </div>
  )
}
