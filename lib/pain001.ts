import { XMLParser } from 'fast-xml-parser'
import { z } from 'zod'

export type PayrollPayment = {
  endToEndId: string
  // recipient wallet
  recipient: `0x${string}`
  // amount in token base units (e.g. 6 decimals for AlphaUSD)
  amount: bigint
  ccy?: string
}

export type PayrollReport = {
  id: string
  createdAtIso: string
  pain002Xml: string
  txHash?: `0x${string}`
}

const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .transform((v) => v as `0x${string}`)

function normalizeRecipient(raw: string, endToEndId: string): `0x${string}` {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error(`Missing recipient address for payment ${endToEndId}.`)
  }

  const scientificNumber = /^[0-9]+(?:\.[0-9]+)?e[+-]?[0-9]+$/i
  if (scientificNumber.test(trimmed)) {
    throw new Error(
      `Recipient address for payment ${endToEndId} looks like a number (${trimmed}). ` +
        'Ensure the XML contains a hex address string like 0xabc... and is not auto-formatted by Excel.',
    )
  }

  const normalized = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? `0x${trimmed.slice(2)}` : trimmed
  const candidate = normalized.startsWith('0x') ? normalized : `0x${normalized}`
  if (!/^[0-9a-fA-F]+$/.test(candidate.slice(2))) {
    throw new Error(`Invalid recipient address for payment ${endToEndId}: "${trimmed}"`)
  }

  const parsed = AddressSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new Error(`Invalid recipient address for payment ${endToEndId}: "${trimmed}"`)
  }
  return parsed.data
}

function toBigintAmount(decimalStr: string, decimals: number): bigint {
  // minimal, strict conversion without floating math
  const [ints, frac = ''] = decimalStr.trim().split('.')
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  const asStr = `${ints}${fracPadded}`.replace(/^0+/, '') || '0'
  return BigInt(asStr)
}

export function parsePain001(xml: string, tokenDecimals: number): { payments: PayrollPayment[]; totalAmount: bigint } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
  })
  const doc = parser.parse(xml)

  // Navigate broadly but defensively
  const cstmr = doc?.Document?.CstmrCdtTrfInitn
  const pmtInf = Array.isArray(cstmr?.PmtInf) ? cstmr.PmtInf[0] : cstmr?.PmtInf
  const txs = pmtInf?.CdtTrfTxInf
  const txList = Array.isArray(txs) ? txs : txs ? [txs] : []

  const payments: PayrollPayment[] = txList.map((tx: any, i: number) => {
    const endToEndId = String(tx?.PmtId?.EndToEndId ?? `E2E-${i + 1}`)

    // Recipient wallet address is in CdtrAcct/Id/Othr/Id (your chosen mapping)
    const rawRecipient = String(tx?.CdtrAcct?.Id?.Othr?.Id ?? '')
    const recipient = normalizeRecipient(rawRecipient, endToEndId)

    const instdAmtNode = tx?.Amt?.InstdAmt
    const amtStr = typeof instdAmtNode === 'object' ? String(instdAmtNode['#text'] ?? '') : String(instdAmtNode ?? '')
    const ccy = typeof instdAmtNode === 'object' ? String(instdAmtNode['@_Ccy'] ?? '') : undefined

    const amount = toBigintAmount(amtStr, tokenDecimals)

    return { endToEndId, recipient, amount, ccy }
  })

  const totalAmount = payments.reduce((acc, p) => acc + p.amount, 0n)
  return { payments, totalAmount }
}
