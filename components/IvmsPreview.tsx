'use client'

import React from 'react'

type IvmsPreviewProps = {
  data: unknown
}

type Section = Record<string, unknown>

const normalizeValue = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

const renderSection = (title: string, section?: Section | null) => {
  if (!section || typeof section !== 'object') return null
  const rows = Object.entries(section)
    .map(([key, value]) => [key, normalizeValue(value)] as const)
    .filter(([, value]) => value)

  if (!rows.length) return null

  return (
    <div className="ivms-preview-section" key={title}>
      <div className="ivms-heading">{title}</div>
      <div className="ivms-preview-grid">
        {rows.map(([key, value]) => (
          <div className="ivms-preview-row" key={key}>
            <div className="ivms-preview-label">{key}</div>
            <div className="ivms-preview-value">{value as string}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function IvmsPreview({ data }: IvmsPreviewProps) {
  if (!data || typeof data !== 'object') {
    return null
  }

  const payload = data as Record<string, unknown>
  const originator = payload.originator as Section | undefined
  const beneficiary = payload.beneficiary as Section | undefined
  const transaction = payload.transaction as Section | undefined

  const hasStructured =
    (originator && typeof originator === 'object') ||
    (beneficiary && typeof beneficiary === 'object') ||
    (transaction && typeof transaction === 'object')

  if (!hasStructured) {
    const rows = Object.entries(payload)
      .map(([key, value]) => [key, normalizeValue(value)] as const)
      .filter(([, value]) => value)

    if (!rows.length) return null

    return (
      <div className="ivms-preview-section">
        <div className="ivms-heading">IVMS data</div>
        <div className="ivms-preview-grid">
          {rows.map(([key, value]) => (
            <div className="ivms-preview-row" key={key}>
              <div className="ivms-preview-label">{key}</div>
              <div className="ivms-preview-value">{value as string}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="ivms-preview">
      {renderSection('Originator', originator)}
      {renderSection('Beneficiary', beneficiary)}
      {renderSection('Transaction', transaction)}
    </div>
  )
}
