import { encodeFunctionData, parseAbi } from 'viem'
import { sendCalls, waitForCallsStatus } from '@wagmi/core'
import { wagmiConfig } from './wagmi'
import { BATCH_SIZE, DEFAULT_PAYROLL_TOKEN } from './constants'
import type { PayrollPayment } from './pain001'

// TIP-20 transfer is ERC-20 compatible for transfer(to, amount) in practice for typical tokens.
// We only need encoding.
const erc20Abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)'])

export type ExecutePayrollResult = {
  batchTxHashes: (`0x${string}`)[]
  // Map endToEndId -> status
  statuses: Record<string, 'SUCCESS' | 'FAILED'>
  // Map endToEndId -> tx hash (batch-level hash)
  paymentTxHashes: Record<string, `0x${string}`>
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Executes payroll in chunks. Each chunk becomes one "call bundle" and ultimately one onchain tx hash.
 * Returns all batch tx hashes (one per chunk) and per-line statuses.
 */
export async function executePayrollBatched(params: {
  payments: PayrollPayment[]
  payer?: `0x${string}` // optional; you can pass null/undefined to let wallet fill it :contentReference[oaicite:10]{index=10}
  tokenAddress?: `0x${string}`
  batchSize?: number
}): Promise<ExecutePayrollResult> {
  const {
    payments,
    payer,
    tokenAddress = DEFAULT_PAYROLL_TOKEN.address,
    batchSize = BATCH_SIZE,
  } = params

  const statuses: Record<string, 'SUCCESS' | 'FAILED'> = {}
  const paymentTxHashes: Record<string, `0x${string}`> = {}
  const batchTxHashes: (`0x${string}`)[] = []

  const batches = chunk(payments, batchSize)

  for (const batch of batches) {
    // Build call list: each call is token.transfer(to, amount)
    const calls = batch.map((p) => ({
      to: tokenAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [p.recipient, p.amount],
      }),
    }))

    // 1) Ask wallet to sign & broadcast this batch of calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { id } = await sendCalls(wagmiConfig as any, {
      account: payer ?? null,
      calls,
    })

    // 2) Wait for inclusion + fetch receipts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await waitForCallsStatus(wagmiConfig as any, { id, pollingInterval: 1_000 })

    // receipts are per-call-bundle; take tx hash from first receipt
    const txHash = (result.receipts?.[0]?.transactionHash ?? null) as (`0x${string}` | null)

    if (txHash) batchTxHashes.push(txHash)

    // If bundle status failed, mark every line failed; otherwise success.
    const bundleOk = result.status === 'success'

    for (const p of batch) {
      statuses[p.endToEndId] = bundleOk ? 'SUCCESS' : 'FAILED'
      if (txHash) paymentTxHashes[p.endToEndId] = txHash
    }
  }

  return { batchTxHashes, statuses, paymentTxHashes }
}
