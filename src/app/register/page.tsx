'use client'

import React from 'react'
import { AppShell } from '../../../components/AppShell'
import { EncryptionKeyPanel } from '../../../components/EncryptionKeyPanel'

export default function RegisterPage() {
  const panel = (
    <div className="app-surface">
      <EncryptionKeyPanel />
    </div>
  )

  return (
    <AppShell
      title="Register"
      subtitle="Tempo"
      unauthenticated={panel}
    >
      {panel}
    </AppShell>
  )
}
