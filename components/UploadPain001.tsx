'use client'

import React from 'react'
import { parsePain001 } from '../lib/pain001'
import { DEFAULT_PAYROLL_TOKEN } from '../lib/constants'
import { usePayrollStore } from '../store/payrollStore'

export function UploadPain001() {
  const setPain001 = usePayrollStore((s) => s.setPain001)
  const [error, setError] = React.useState<string | null>(null)
  const [fileName, setFileName] = React.useState<string>('')

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const xml = await file.text()
    try {
      const { payments, totalAmount } = parsePain001(xml, DEFAULT_PAYROLL_TOKEN.decimals)
      setPain001(xml, payments, totalAmount)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse pain.001 file.')
    }
  }

  return (
    <div className="card card-plain upload-card">
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Upload pain.001</div>
      <input
        id="pain001-upload"
        className="upload-input"
        type="file"
        accept=".xml,text/xml"
        onChange={onFile}
      />
      <label className="upload-drop" htmlFor="pain001-upload">
        <div className="upload-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path
              d="M12 4l4 4h-3v6h-2V8H8l4-4zm-7 14h14v2H5v-2z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className="upload-title">Drag and drop your file</div>
        <div className="upload-subtitle">
          Or click to browse (.xml)
        </div>
      </label>
      <div className="upload-meta">
        <span className="muted">{fileName ? fileName : 'No file selected'}</span>
        <label className="btn btn-secondary" htmlFor="pain001-upload">
          Browse
        </label>
      </div>
      {error ? <div style={{ marginTop: 8, color: '#b00020' }}>{error}</div> : null}
    </div>
  )
}
