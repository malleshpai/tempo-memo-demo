'use client'

import React from 'react'
import { AppShell } from '../../components/AppShell'
import { MemoVaultPanel } from '../../components/MemoVaultPanel'

export default function VaultPage() {
  return (
    <AppShell
      title="Memo Vault"
      subtitle="Tempo"
      unauthenticated={
        <div className="app-surface">
          <div className="panel">
            <h3 className="panel-title">Log in to view memos</h3>
            <div className="muted" style={{ marginTop: 8 }}>
              View incoming and outgoing memo history for your address.
            </div>
          </div>
        </div>
      }
    >
      <div className="app-surface">
        <MemoVaultPanel />
      </div>
    </AppShell>
  )
}
