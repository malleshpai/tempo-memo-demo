import { create } from 'xmlbuilder2'
import type { PayrollPayment } from './pain001'

export function buildPain002(params: {
  msgId: string
  createdAtIso: string
  originalPain001MsgId?: string
  payments: PayrollPayment[]
  statuses: Record<string, 'SUCCESS' | 'FAILED'>
  // All tx hashes (one per batch). We’ll include them as one semicolon-separated string for “batch-level”.
  batchTxHashes: (`0x${string}`)[]
}): string {
  const {
    msgId,
    createdAtIso,
    originalPain001MsgId,
    payments,
    statuses,
    batchTxHashes,
  } = params

  const batchHashStr = batchTxHashes.join(';')

  const pmtInfNode = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('Document')
      .ele('CstmrPmtStsRpt')
        .ele('GrpHdr')
          .ele('MsgId').txt(msgId).up()
          .ele('CreDtTm').txt(createdAtIso).up()
        .up()

        .ele('OrgnlGrpInfAndSts')
          .ele('OrgnlMsgId').txt(originalPain001MsgId ?? 'UNKNOWN').up()
          .ele('GrpSts').txt('ACTC').up()
        .up()

        // “Reports section / batch-level tx hash”
        // You asked for a suggested field: we can place it in an “Other Id” spot in a status reason block.
        .ele('PmtInf')
          .ele('StsRsnInf')
            .ele('Orgtr')
              .ele('Id')
                .ele('OrgId')
                  .ele('Othr')
                    .ele('Id').txt(batchHashStr || 'NO_TX').up()
                  .up()
                .up()
              .up()
            .up()
          .up()

  for (const p of payments) {
    const st = statuses[p.endToEndId] ?? 'FAILED'

    const txHashForThisItem = batchTxHashes[0] ?? 'NO_TX'

    pmtInfNode
      .ele('CdtTrfTxInf')
        .ele('PmtId')
          .ele('EndToEndId').txt(p.endToEndId).up()
        .up()
        .ele('TxSts').txt(st === 'SUCCESS' ? 'ACSC' : 'RJCT').up()

        // Your requirement:
        // include tx address per line item in CdtrAcct/Id/Othr/Id (same hash for all items in that batch)
        .ele('CdtrAcct')
          .ele('Id')
            .ele('Othr')
              .ele('Id').txt(txHashForThisItem).up()
            .up()
          .up()
        .up()
      .up()
  }

  return pmtInfNode.end({ prettyPrint: true })
}
