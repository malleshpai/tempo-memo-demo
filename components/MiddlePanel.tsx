'use client'

import React from 'react'
import { formatUnits } from 'viem'
import { tempoModerato } from '../lib/wagmi'
import { usePayrollStore } from '../store/payrollStore'
import { DEFAULT_PAYROLL_TOKEN } from '../lib/constants'
import { executePayrollBatched } from '../lib/executePayrollBatched'
import { buildPain002 } from '../lib/pain002'

const formatCurrency = (raw: string) => {
  const [wholeRaw, fractionRaw = ''] = raw.split('.')
  const whole = wholeRaw.replace(/^0+/, '') || '0'
  const fraction = (fractionRaw + '00').slice(0, 2)
  const withSeparators = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `$${withSeparators}.${fraction}`
}

export function MiddlePanel() {
  const payments = usePayrollStore((s) => s.payments)
  const totalAmount = usePayrollStore((s) => s.totalAmount)
  const payer = usePayrollStore((s) => s.payerAddress)

  const isExecuting = usePayrollStore((s) => s.isExecuting)
  const setExecuting = usePayrollStore((s) => s.setExecuting)
  const executionError = usePayrollStore((s) => s.executionError)
  const setExecutionError = usePayrollStore((s) => s.setExecutionError)

  const setPaymentStatus = usePayrollStore((s) => s.setPaymentStatus)
  const addBatchHash = usePayrollStore((s) => s.addBatchHash)
  const setPaymentTxHashes = usePayrollStore((s) => s.setPaymentTxHashes)
  const paymentTxHashes = usePayrollStore((s) => s.paymentTxHashes)
  const paymentStatuses = usePayrollStore((s) => s.paymentStatuses)
  const addReport = usePayrollStore((s) => s.addReport)
  const hasExecuted = usePayrollStore((s) => s.batchTxHashes.length > 0)

  async function onExecute() {
    setExecutionError(undefined)
    setExecuting(true)

    try {
      const { batchTxHashes, statuses, paymentTxHashes } = await executePayrollBatched({
        payments,
        payer,
      })

      // update UI statuses
      for (const [e2e, st] of Object.entries(statuses)) {
        setPaymentStatus(e2e, st === 'SUCCESS' ? 'SUCCESS' : 'FAILED')
      }
      setPaymentTxHashes(paymentTxHashes)
      for (const h of batchTxHashes) addBatchHash(h)

      // Generate pain.002 report
      const createdAtIso = new Date().toISOString()
      const msgId = `PAIN002-${Date.now()}`
      const xml = buildPain002({
        msgId,
        createdAtIso,
        originalPain001MsgId: 'PAIN001-UPLOAD',
        payments,
        statuses,
        batchTxHashes,
      })

      addReport({
        id: msgId,
        createdAtIso,
        pain002Xml: xml,
        txHash: batchTxHashes[0],
      })
    } catch (e: any) {
      setExecutionError(e?.message ?? String(e))
    } finally {
      setExecuting(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Payroll</h3>
        {payments.length > 0 && !hasExecuted && (
          <div className="panel-header-actions">
            <button className="btn btn-primary" disabled={!payer || isExecuting} onClick={onExecute}>
              {isExecuting ? 'Executing…' : 'Execute payroll'}
            </button>
          </div>
        )}
        {payments.length > 0 && hasExecuted && (
          <div className="panel-header-actions">
            <span className="status-pill">COMPLETED</span>
          </div>
        )}
      </div>

      {payments.length === 0 && (
        <div className="muted" style={{ marginTop: 10 }}>
          Upload a pain.001 to populate payments.
        </div>
      )}

      {payments.length > 0 && (
        <>
          <div className="kpi" style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700 }}>
              {payments.length} payments · Total amount: {formatCurrency(formatUnits(totalAmount, DEFAULT_PAYROLL_TOKEN.decimals))}
            </div>
          </div>

          {executionError && (
            <div style={{ marginTop: 12, color: 'crimson', whiteSpace: 'pre-wrap' }}>
              {executionError}
            </div>
          )}

          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            {payments.map((p) => {
              const status = paymentStatuses[p.endToEndId] ?? 'PENDING'
              const txHash = paymentTxHashes[p.endToEndId]
              const explorerBase = tempoModerato.blockExplorers?.default.url
              const txUrl = explorerBase && txHash ? `${explorerBase}/tx/${txHash}` : undefined
              const statusClass =
                status === 'FAILED'
                  ? 'status-pill status-pill-fail'
                  : status === 'PENDING'
                    ? 'status-pill status-pill-warn'
                    : 'status-pill'

              return (
                <div
                  key={p.endToEndId}
                  className="card payment-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.endToEndId}</div>
                      <div className="muted mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                        {p.recipient}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>
                        {formatCurrency(formatUnits(p.amount, DEFAULT_PAYROLL_TOKEN.decimals))}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>{DEFAULT_PAYROLL_TOKEN.symbol}</div>
                    </div>
                  </div>
                  <div className="status-row">
                    <span>Status:</span>
                    <span className={statusClass}>
                      {status === 'SUCCESS' ? 'COMPLETED' : status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
