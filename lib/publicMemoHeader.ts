import type { Address } from 'viem'

export const MEMO_VERSION = 'TempoMemoStandard::Version1'

export enum LocatorType {
  OnChain = 0,
  OffChain = 1,
}

export type Party = {
  addr: Address
  identifier: string
}

export type PublicMemoHeader = {
  purpose: string
  locatorType: number
  locatorHash: `0x${string}`
  locatorUrl: string
  contentHash: `0x${string}`
  signature: `0x${string}`
  sender: Party
  recipient: Party
  version: string
  createdAt: bigint
}

export type CreateMemoHeaderParams = {
  memoId: `0x${string}`
  purpose: string
  locatorType: number
  locatorHash: `0x${string}`
  locatorUrl: string
  contentHash: `0x${string}`
  signature: `0x${string}`
  sender: Party
  recipient: Party
  version: string
}

export const buildOnChainLocator = (
  memoHash: `0x${string}`
): Pick<CreateMemoHeaderParams, 'locatorType' | 'locatorHash' | 'locatorUrl'> => ({
  locatorType: LocatorType.OnChain,
  locatorHash: memoHash,
  locatorUrl: '',
})

export const buildOffChainLocator = (
  url: string
): Pick<CreateMemoHeaderParams, 'locatorType' | 'locatorHash' | 'locatorUrl'> => ({
  locatorType: LocatorType.OffChain,
  locatorHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  locatorUrl: url,
})

export const formatLocatorDisplay = (header: PublicMemoHeader, baseUrl?: string): string => {
  if (header.locatorType === LocatorType.OnChain) {
    return `On-chain: ${header.locatorHash.slice(0, 10)}...${header.locatorHash.slice(-8)}`
  }
  return header.locatorUrl
}

export const isHeaderExists = (header: PublicMemoHeader): boolean => {
  return header.createdAt > BigInt(0)
}
