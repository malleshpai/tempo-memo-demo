'use client'

import { createConfig, http } from 'wagmi'
import { tempoTestnet } from 'viem/chains'
import { KeyManager, webAuthn } from 'wagmi/tempo'
import { DEFAULT_FEE_TOKEN } from './constants'

// Moderato testnet - the current Tempo testnet (chain 42431)
// IMPORTANT: Must use tempoTestnet.extend() to preserve Tempo's chainConfig which includes:
// - Custom transaction formatters/serializers for Tempo transactions
// - prepareTransactionRequest hook that adds gas for nonceKey
// - Fee token handling
export const tempoModerato = tempoTestnet.extend({
  id: 42431,
  name: 'Tempo Moderato Testnet',
  feeToken: DEFAULT_FEE_TOKEN.address,
  rpcUrls: {
    default: {
      http: ['https://rpc.moderato.tempo.xyz'],
      webSocket: ['wss://rpc.moderato.tempo.xyz'],
    },
  },
} as const)

export const wagmiConfig = createConfig({
  chains: [tempoModerato],
  connectors: [
    webAuthn({
      keyManager: KeyManager.localStorage(),
    }),
  ],
  transports: {
    [tempoModerato.id]: http('https://rpc.moderato.tempo.xyz'),
  },
})
