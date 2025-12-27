'use client'

import React from 'react'
import { WagmiProvider, useConnect, useConnection, useDisconnect } from 'wagmi'
import { Actions } from 'tempo.ts/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { tempoTestnet } from 'viem/chains'
import { wagmiConfig } from '../lib/wagmi'
import { LeftPanel } from '../components/LeftPanel'
import { MiddlePanel } from '../components/MiddlePanel'

const qc = new QueryClient()

function AppShell() {
  const { address } = useConnection()
  const { connect, connectAsync, connectors, isPending: connecting } = useConnect()
  const { disconnect } = useDisconnect()
  const [isMounted, setIsMounted] = React.useState(false)

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

  const onSignUp = () => {
    if (!connector) return
    void (async () => {
      const result = await connectAsync({
        connector,
        capabilities: {
          type: 'sign-up',
          label: 'Tempo Payroll',
        },
      })

      const account = result?.accounts?.[0]
      if (account) {
        try {
          await Actions.faucet.fund(wagmiConfig, { account })
        } catch {
          // Ignore faucet errors; user can retry from the faucet if needed.
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
            <div className="eyebrow">Payroll</div>
            <h1>Overview</h1>
          </div>
        </div>
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
              <a className="topbar-address" href={addressUrl} target="_blank" rel="noreferrer">
                {address}
              </a>
            )}
            <button className="btn btn-secondary" onClick={() => disconnect()}>
              Sign out
            </button>
          </div>
        )}
      </header>

      {isAuthed ? (
        <div className="app-surface">
          <div className="app-grid">
            <LeftPanel />
            <MiddlePanel />
          </div>
        </div>
      ) : (
        <div className="landing">
          <div className="landing-hero">
            <div className="landing-copy">
              <div className="eyebrow">Tempo Payroll</div>
              <h2>Run payroll with clarity.</h2>
              <p className="muted">
                Upload payment files, execute payouts, and track every run in one streamlined
                workspace.
              </p>
              <div className="landing-actions">
                <button
                  className="btn btn-primary"
                  disabled={!connector || connecting}
                  onClick={onLogin}
                >
                  Log in
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={!connector || connecting}
                  onClick={onSignUp}
                >
                  Sign up
                </button>
              </div>
            </div>
            <div className="landing-visual">
              <div className="landing-device">
                <div className="device-card">
                  <div className="device-thumb" />
                  <div className="device-ring" />
                  <div className="device-status">Processing…</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <AppShell />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
