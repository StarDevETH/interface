import { Token } from '@uniswap/sdk-core'
import { Pool, Position } from '@uniswap/v3-sdk'
import { getTokensAsync } from 'components/AccountDrawer/MiniPortfolio/Pools/getTokensAsync'
import { useInterfaceMulticallContracts } from 'components/AccountDrawer/MiniPortfolio/Pools/hooks'
import { atom, useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import ms from 'ms'
import { useCallback } from 'react'
import { PositionDetails } from 'types/position'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { SerializedToken } from 'uniswap/src/features/tokens/slice/types'
import { deserializeToken, serializeToken } from 'uniswap/src/utils/currency'
import { buildCurrencyKey, currencyKey } from 'utils/currencyKey'

export type PositionInfo = {
  owner: string
  chainId: UniverseChainId
  position: Position
  pool: Pool
  details: PositionDetails
  inRange: boolean
  closed: boolean
  fees?: [number?, number?]
  prices?: [number?, number?]
}

const POSITION_CACHE_EXPIRY = ms(`1m`) // 1 minute is arbitrary here
// Allows reusing recently fetched positions between component mounts
type CachedPositionsEntry = { result: PositionInfo[]; stale: boolean }
const cachedPositionsAtom = atom<{ [address: string]: CachedPositionsEntry | undefined }>({})
type UseCachedPositionsReturnType = [CachedPositionsEntry | undefined, (positions: PositionInfo[]) => void]
/**
 * Caches positions to allow reusing between component mounts
 * @param account address to cache positions for
 * @returns cached positions for the account, whether the cache is stale, and a function to update the positions and cache
 */
export function useCachedPositions(account: string): UseCachedPositionsReturnType {
  const [cachedPositions, setCachedPositions] = useAtom(cachedPositionsAtom)
  const setPositionsAndStaleTimeout = useCallback(
    (positions: PositionInfo[]) => {
      setCachedPositions((cache) => ({ ...cache, [account]: { result: positions, stale: false } }))
      setTimeout(
        () =>
          setCachedPositions((cache) => {
            // sets stale to true if the positions haven't been updated since the timeout
            if (positions === cache[account]?.result) {
              return { ...cache, [account]: { result: positions, stale: true } }
            } else {
              return cache
            }
          }),
        POSITION_CACHE_EXPIRY,
      )
    },
    [account, setCachedPositions],
  )
  return [cachedPositions[account], setPositionsAndStaleTimeout]
}

const poolAddressKey = (details: PositionDetails, chainId: UniverseChainId) =>
  `${chainId}-${details.token0}-${details.token1}-${details.fee}`

type PoolAddressMap = { [key: string]: string | undefined }
const poolAddressCacheAtom = atomWithStorage<PoolAddressMap>('poolCache', {})
/**
 * Caches pool addresses to prevent components from having to re-compute them
 * @returns get and set functions for the cache
 */
export function usePoolAddressCache() {
  const [cache, updateCache] = useAtom(poolAddressCacheAtom)
  const get = useCallback(
    (details: PositionDetails, chainId: UniverseChainId) => cache[poolAddressKey(details, chainId)],
    [cache],
  )
  const set = useCallback(
    // eslint-disable-next-line max-params
    (details: PositionDetails, chainId: UniverseChainId, address: string) =>
      updateCache((c) => ({ ...c, [poolAddressKey(details, chainId)]: address })),
    [updateCache],
  )
  return { get, set }
}

// These values are static, so we can persist them across sessions using `WithStorage`
const tokenCacheAtom = atomWithStorage<{ [key: string]: SerializedToken | undefined }>('cachedAsyncTokens', {})
function useTokenCache() {
  const [cache, setCache] = useAtom(tokenCacheAtom)
  const get = useCallback(
    (chainId: number, address: string) => {
      const entry = cache[buildCurrencyKey(chainId, address)]
      return entry ? deserializeToken(entry) : undefined
    },
    [cache],
  )
  const set = useCallback(
    (token?: Token) => {
      if (token) {
        setCache((cache) => ({ ...cache, [currencyKey(token)]: serializeToken(token) }))
      }
    },
    [setCache],
  )
  return { get, set }
}

type TokenGetterFn = (addresses: string[], chainId: UniverseChainId) => Promise<{ [key: string]: Token | undefined }>
export function useGetCachedTokens(chains: UniverseChainId[]): TokenGetterFn {
  const multicallContracts = useInterfaceMulticallContracts(chains)
  const tokenCache = useTokenCache()

  // Used to fetch tokens not available in local state
  const fetchRemoteTokens: TokenGetterFn = useCallback(
    async (addresses, chainId) => {
      const fetched = await getTokensAsync({ addresses, chainId, multicall: multicallContracts[chainId] })
      Object.values(fetched).forEach(tokenCache.set)
      return fetched
    },
    [multicallContracts, tokenCache],
  )

  // Uses tokens from local state if available, otherwise fetches them
  const getTokens: TokenGetterFn = useCallback(
    async (addresses, chainId) => {
      const local: { [address: string]: Token | undefined } = {}
      const missing = new Set<string>()
      addresses.forEach((address) => {
        const cached = tokenCache.get(chainId, address)
        cached ? (local[address] = cached) : missing.add(address)
      })

      const fetched = await fetchRemoteTokens([...missing], chainId)
      return { ...local, ...fetched }
    },
    [fetchRemoteTokens, tokenCache],
  )

  return getTokens
}
