'use client'

import React from 'react'

export type IvmsFormData = {
  originator: {
    name: string
    address: string
    institution: string
    country: string
  }
  beneficiary: {
    name: string
    address: string
    institution: string
    country: string
  }
  transaction: {
    purpose: string
    reference: string
  }
}

const defaultData: IvmsFormData = {
  originator: { name: '', address: '', institution: '', country: '' },
  beneficiary: { name: '', address: '', institution: '', country: '' },
  transaction: { purpose: '', reference: '' },
}

type IvmsFormProps = {
  value?: IvmsFormData
  onChange: (value: IvmsFormData) => void
}

export function IvmsForm({ value, onChange }: IvmsFormProps) {
  const data = value ?? defaultData

  const update = (path: string, next: string) => {
    const [section, field] = path.split('.')
    const clone = {
      ...data,
      [section]: {
        ...(data as any)[section],
        [field]: next,
      },
    }
    onChange(clone)
  }

  return (
    <div className="ivms-form">
      <div className="ivms-section">
        <div className="ivms-heading">Originator</div>
        <div className="ivms-grid">
          <label className="field">
            <span>Name</span>
            <input
              value={data.originator.name}
              onChange={(event) => update('originator.name', event.target.value)}
              placeholder="Jane Doe"
            />
          </label>
          <label className="field">
            <span>Address</span>
            <input
              value={data.originator.address}
              onChange={(event) => update('originator.address', event.target.value)}
              placeholder="123 Market St"
            />
          </label>
          <label className="field">
            <span>Institution</span>
            <input
              value={data.originator.institution}
              onChange={(event) => update('originator.institution', event.target.value)}
              placeholder="Originator Bank"
            />
          </label>
          <label className="field">
            <span>Country</span>
            <input
              value={data.originator.country}
              onChange={(event) => update('originator.country', event.target.value)}
              placeholder="US"
            />
          </label>
        </div>
      </div>

      <div className="ivms-section">
        <div className="ivms-heading">Beneficiary</div>
        <div className="ivms-grid">
          <label className="field">
            <span>Name</span>
            <input
              value={data.beneficiary.name}
              onChange={(event) => update('beneficiary.name', event.target.value)}
              placeholder="Alex Kim"
            />
          </label>
          <label className="field">
            <span>Address</span>
            <input
              value={data.beneficiary.address}
              onChange={(event) => update('beneficiary.address', event.target.value)}
              placeholder="456 Mission Ave"
            />
          </label>
          <label className="field">
            <span>Institution</span>
            <input
              value={data.beneficiary.institution}
              onChange={(event) => update('beneficiary.institution', event.target.value)}
              placeholder="Recipient Bank"
            />
          </label>
          <label className="field">
            <span>Country</span>
            <input
              value={data.beneficiary.country}
              onChange={(event) => update('beneficiary.country', event.target.value)}
              placeholder="US"
            />
          </label>
        </div>
      </div>

      <div className="ivms-section">
        <div className="ivms-heading">Transaction</div>
        <div className="ivms-grid">
          <label className="field">
            <span>Purpose</span>
            <input
              value={data.transaction.purpose}
              onChange={(event) => update('transaction.purpose', event.target.value)}
              placeholder="Payroll"
            />
          </label>
          <label className="field">
            <span>Reference</span>
            <input
              value={data.transaction.reference}
              onChange={(event) => update('transaction.reference', event.target.value)}
              placeholder="Invoice #123"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
