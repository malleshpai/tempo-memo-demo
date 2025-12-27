'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '../../components/AppShell'
import { MemoViewer } from '../../components/MemoViewer'

export default function MemoPage() {
  const params = useParams()
  const memoId = Array.isArray(params?.memoId) ? params.memoId[0] : params?.memoId

  return (
    <AppShell
      title="Memo Vault"
      subtitle="Tempo"
      unauthenticated={
        <div className="app-surface">
          <div className="panel">
            <h3 className="panel-title">Log in to view memo</h3>
            <div className="muted" style={{ marginTop: 8 }}>
              This memo is only visible to the sender or recipient of the transfer.
            </div>
          </div>
        </div>
      }
    >
      {memoId ? <MemoViewer memoId={memoId} /> : null}
    </AppShell>
  )
}
