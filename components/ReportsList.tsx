'use client'

import React from 'react'
import { usePayrollStore } from '../store/payrollStore'
import { tempoModerato } from '../lib/wagmi'

export function ReportsList() {
  const reports = usePayrollStore((s) => s.reports)

  function download(name: string, content: string) {
    const blob = new Blob([content], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Reports</div>
      {reports.length === 0 ? (
        <div style={{ color: '#666' }}>No reports yet</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {reports.map((r) => (
            <div key={r.id} className="card card-plain">
              <div style={{ fontWeight: 600 }}>{r.id}</div>
              <div style={{ color: '#666', fontSize: 12 }}>{r.createdAtIso}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => download(`${r.id}.pain.002.xml`, r.pain002Xml)}>
                  Download XML
                </button>
                {r.txHash ? (
                  <a
                    className="btn btn-ghost"
                    href={`${tempoModerato.blockExplorers?.default.url}/tx/${r.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Explorer
                  </a>
                ) : (
                  <button className="btn btn-ghost" disabled type="button">
                    View on Explorer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
