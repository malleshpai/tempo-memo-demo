'use client'

import React from 'react'
import { AppShell } from '../../components/AppShell'
import { BalancePanel } from '../../components/BalancePanel'
import { TransferPanel } from '../../components/TransferPanel'
import { EncryptionKeyPanel } from '../../components/EncryptionKeyPanel'

export default function Page() {
  return (
    <AppShell
      title="Memo Console"
      subtitle="Tempo"
      unauthenticated={
        <div className="landing">
          <div className="landing-hero">
            <div className="landing-copy">
              <div className="eyebrow">Tempo Memo</div>
              <h2>Transfer with travel rule memos.</h2>
              <p className="muted">
                Authenticate with a passkey, send stablecoins with an IVMS memo hash, and share the memo vault link.
              </p>
            </div>
            <div className="landing-visual">
              <div className="landing-device">
                <div className="device-card">
                  <div className="device-thumb" />
                  <div className="device-ring" />
                  <div className="device-status">Securing memo…</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="app-surface">
        <div className="app-grid">
          <BalancePanel />
          <EncryptionKeyPanel />
          <TransferPanel />
        </div>
      </div>
    </AppShell>
  )
}
