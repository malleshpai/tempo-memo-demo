'use client'

import { createConfig, http } from 'wagmi'
import { tempoTestnet } from 'viem/chains'
import { KeyManager, webAuthn } from 'tempo.ts/wagmi'
import { DEFAULT_FEE_TOKEN } from './constants'

export const wagmiConfig = createConfig({
  chains: [
    // Tempo TS README shows extending chain with feeToken :contentReference[oaicite:7]{index=7}
    tempoTestnet.extend({ feeToken: DEFAULT_FEE_TOKEN.address }),
  ],
  connectors: [
    webAuthn({
      keyManager: KeyManager.localStorage(),
    }),
  ],
  transports: {
    [tempoTestnet.id]: http(),
  },
})
