'use client'

import React from 'react'
import { formatUnits, parseAbi } from 'viem'
import { useConnection, useReadContracts } from 'wagmi'
import { UploadPain001 } from './UploadPain001'
import { ReportsList } from './ReportsList'
import { usePayrollStore } from '../store/payrollStore'
import { DEFAULT_PAYROLL_TOKEN } from '../lib/constants'

const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)'])
const formatTokenAmount = (raw: string) => {
  const [whole, fraction] = raw.split('.')
  const withSeparators = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${withSeparators}.${fraction}` : withSeparators
}

const formatCurrency = (raw: string) => {
  const [wholeRaw, fractionRaw = ''] = raw.split('.')
  const whole = wholeRaw.replace(/^0+/, '') || '0'
  const fraction = (fractionRaw + '00').slice(0, 2)
  const withSeparators = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `$${withSeparators}.${fraction}`
}

export function LeftPanel() {
  const { address, status } = useConnection()
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  const setPayerAddress = usePayrollStore((s) => s.setPayerAddress)
  React.useEffect(() => {
    setPayerAddress(address as any)
  }, [address, setPayerAddress])

  const payerAddress = (isMounted ? address : undefined) as `0x${string}` | undefined

  const { data } = useReadContracts({
    allowFailure: true,
    contracts: payerAddress
      ? [
          {
            address: DEFAULT_PAYROLL_TOKEN.address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [payerAddress],
          },
        ]
      : [],
    query: { enabled: !!payerAddress, refetchInterval: 3_000 },
  })

  const payerBalance = (data?.[0]?.result as bigint | undefined) ?? 0n

  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Payer</h3>
      </div>

      <div className="stack-sm muted" style={{ marginTop: 16 }}>
        <div className="kpi">
          Balance:{' '}
          {payerAddress
            ? formatCurrency(formatUnits(payerBalance, DEFAULT_PAYROLL_TOKEN.decimals))
            : '—'}
        </div>
      </div>

      <div className="stack-md" style={{ marginTop: 16 }}>
        <UploadPain001 />
        <ReportsList />
      </div>
    </section>
  )
}
