'use client'

import { createConfig, http } from 'wagmi'
import { defineChain } from 'viem'
import { KeyManager, webAuthn } from 'wagmi/tempo'
import { DEFAULT_FEE_TOKEN } from './constants'

// Moderato testnet - the current Tempo testnet (chain 42431)
// Defined from scratch to avoid any inheritance issues from viem's tempoTestnet (42429)
export const tempoModerato = defineChain({
  id: 42431,
  name: 'Tempo Moderato Testnet',
  nativeCurrency: {
    name: 'USD',
    symbol: 'USD',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.moderato.tempo.xyz'],
      webSocket: ['wss://rpc.moderato.tempo.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Tempo Explorer',
      url: 'https://explore.tempo.xyz',
    },
  },
  testnet: true,
  feeToken: DEFAULT_FEE_TOKEN.address,
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
