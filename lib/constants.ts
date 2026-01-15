export const TEMPO_CHAIN = 'tempoModerato' as const

// Tempo testnet faucet assets per docs.
export const TOKENS = {
  PathUSD: {
    symbol: 'PathUSD',
    address: '0x20c0000000000000000000000000000000000000' as `0x${string}`,
    decimals: 6,
  },
  AlphaUSD: {
    symbol: 'AlphaUSD',
    address: '0x20c0000000000000000000000000000000000001' as `0x${string}`,
    decimals: 6,
  },
  BetaUSD: {
    symbol: 'BetaUSD',
    address: '0x20c0000000000000000000000000000000000002' as `0x${string}`,
    decimals: 6,
  },
  ThetaUSD: {
    symbol: 'ThetaUSD',
    address: '0x20c0000000000000000000000000000000000003' as `0x${string}`,
    decimals: 6,
  },
} as const

export const DEFAULT_FEE_TOKEN = TOKENS.PathUSD
export const DEFAULT_TRANSFER_TOKEN = TOKENS.AlphaUSD
export const DEFAULT_PAYROLL_TOKEN = TOKENS.AlphaUSD

// Reasonable UI chunk size for batching (tune as needed)
export const BATCH_SIZE = 25
