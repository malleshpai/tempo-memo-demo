'use client'

import React from 'react'
import { formatUnits, parseAbi } from 'viem'
import { useConnection, useReadContracts } from 'wagmi'
import { Actions } from 'tempo.ts/wagmi'
import { wagmiConfig } from '../lib/wagmi'
import { TOKENS } from '../lib/constants'

const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)'])
const tokenList = Object.values(TOKENS)

const formatAmount = (raw: string) => {
  const [wholeRaw, fractionRaw = ''] = raw.split('.')
  const whole = wholeRaw.replace(/^0+/, '') || '0'
  const fraction = (fractionRaw + '00').slice(0, 2)
  const withSeparators = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${withSeparators}.${fraction}`
}

export function BalancePanel() {
  const { address } = useConnection()
  const [hasAutoFunded, setHasAutoFunded] = React.useState(false)
  const [isFunding, setIsFunding] = React.useState(false)

  const { data, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: address
      ? tokenList.map((token) => ({
          address: token.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        }))
      : [],
    query: { enabled: !!address, refetchInterval: 6_000 },
  })

  const balances = tokenList.map((token, index) => {
    const balance = (data?.[index]?.result as bigint | undefined) ?? BigInt(0)
    return { token, balance }
  })

  const hasAnyBalance = balances.some(({ balance }) => balance > BigInt(0))

  const requestFunds = async () => {
    if (!address) return
    setIsFunding(true)
    try {
      await Actions.faucet.fund(wagmiConfig, { account: address })
    } finally {
      setIsFunding(false)
    }
  }

  React.useEffect(() => {
    if (!address || hasAutoFunded || isLoading) return
    if (!hasAnyBalance) {
      setHasAutoFunded(true)
      void requestFunds()
    }
  }, [address, hasAnyBalance, hasAutoFunded, isLoading])

  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Balances</h3>
        <div className="panel-header-actions">
          <button
            className="btn btn-secondary"
            disabled={!address || isFunding}
            onClick={() => void requestFunds()}
          >
            {isFunding ? 'Funding…' : 'Request faucet funds'}
          </button>
        </div>
      </div>

      {!address && <div className="muted">Log in to view balances.</div>}
      {address && (
        <div className="stack-md" style={{ marginTop: 12 }}>
          {balances.map(({ token, balance }) => (
            <div key={token.symbol} className="card card-plain balance-row">
              <div>
                <div style={{ fontWeight: 600 }}>{token.symbol}</div>
                <div className="muted mono" style={{ fontSize: 12 }}>
                  {token.address}
                </div>
              </div>
              <div className="balance-amount">
                {formatAmount(formatUnits(balance, token.decimals))}
              </div>
            </div>
          ))}
          {!hasAnyBalance && (
            <div className="muted" style={{ fontSize: 13 }}>
              Faucet funds are on the way. Refresh if they do not appear within a minute.
            </div>
          )}
        </div>
      )}
    </section>
  )
}
