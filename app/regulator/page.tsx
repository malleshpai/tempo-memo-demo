'use client'

import React from 'react'
import { AppShell } from '../../components/AppShell'
import { RegulatorPanel } from '../../components/RegulatorPanel'

export default function RegulatorPage() {
  return (
    <AppShell
      title="Regulator Vault"
      subtitle="Tempo"
      unauthenticated={<RegulatorPanel />}
    >
      <RegulatorPanel />
    </AppShell>
  )
}
