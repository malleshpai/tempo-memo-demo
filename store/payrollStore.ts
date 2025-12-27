import { create } from 'zustand'
import type { PayrollPayment, PayrollReport } from '../lib/pain001'

type State = {
  payerAddress?: `0x${string}`

  // Upload + parsing
  pain001Raw?: string
  payments: PayrollPayment[]
  totalAmount: bigint

  // Execution
  isExecuting: boolean
  executionError?: string
  // One tx hash per batch chunk (each chunk = one Tempo tx)
  batchTxHashes: (`0x${string}`)[]
  // Per-line tx hash (batch-level hash)
  paymentTxHashes: Record<string, `0x${string}`>
  // Per-line status
  paymentStatuses: Record<string, 'PENDING' | 'SUCCESS' | 'FAILED'>

  // Reports (generated pain.002 XML)
  reports: PayrollReport[]
}

type Actions = {
  setPayerAddress: (a?: `0x${string}`) => void

  setPain001: (raw: string, payments: PayrollPayment[], totalAmount: bigint) => void
  resetPayroll: () => void

  setExecuting: (v: boolean) => void
  setExecutionError: (e?: string) => void
  addBatchHash: (h: `0x${string}`) => void
  setPaymentTxHashes: (txs: Record<string, `0x${string}`>) => void
  setPaymentStatus: (endToEndId: string, status: 'PENDING' | 'SUCCESS' | 'FAILED') => void

  addReport: (r: PayrollReport) => void
}

export const usePayrollStore = create<State & Actions>((set) => ({
  payments: [],
  totalAmount: 0n,
  isExecuting: false,
  batchTxHashes: [],
  paymentTxHashes: {},
  paymentStatuses: {},
  reports: [],

  setPayerAddress: (payerAddress) => set({ payerAddress }),

  setPain001: (pain001Raw, payments, totalAmount) =>
    set({
      pain001Raw,
      payments,
      totalAmount,
      paymentStatuses: Object.fromEntries(payments.map((p) => [p.endToEndId, 'PENDING'])),
      batchTxHashes: [],
      paymentTxHashes: {},
      executionError: undefined,
      reports: [],
    }),

  resetPayroll: () =>
    set({
      pain001Raw: undefined,
      payments: [],
      totalAmount: 0n,
      isExecuting: false,
      executionError: undefined,
      batchTxHashes: [],
      paymentTxHashes: {},
      paymentStatuses: {},
      reports: [],
    }),

  setExecuting: (isExecuting) => set({ isExecuting }),
  setExecutionError: (executionError) => set({ executionError }),

  addBatchHash: (h) => set((s) => ({ batchTxHashes: [...s.batchTxHashes, h] })),
  setPaymentTxHashes: (paymentTxHashes) => set({ paymentTxHashes }),

  setPaymentStatus: (endToEndId, status) =>
    set((s) => ({ paymentStatuses: { ...s.paymentStatuses, [endToEndId]: status } })),

  addReport: (r) => set((s) => ({ reports: [r, ...s.reports] })),
}))
