export const TEMPO_CHAIN = 'tempoTestnet' as const

// Tempo docs often reference AlphaUSD on testnet in examples :contentReference[oaicite:5]{index=5}
export const TOKENS = {
  AlphaUSD: {
    symbol: 'AlphaUSD',
    address: '0x20c0000000000000000000000000000000000001' as `0x${string}`,
    decimals: 6,
  },
} as const

export const DEFAULT_PAYROLL_TOKEN = TOKENS.AlphaUSD

// Reasonable UI chunk size for batching (tune as needed)
export const BATCH_SIZE = 25