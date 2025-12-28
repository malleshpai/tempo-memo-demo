'use client'

import React from 'react'
import { AppShell } from '../../../components/AppShell'
import { RegulatorPanel } from '../../../components/RegulatorPanel'

export default function RegulatorPage() {
  const panel = (
    <div className="app-surface">
      <RegulatorPanel />
    </div>
  )

  return (
    <AppShell
      title="Regulator Vault"
      subtitle="Tempo"
      unauthenticated={panel}
    >
      {panel}
    </AppShell>
  )
}
