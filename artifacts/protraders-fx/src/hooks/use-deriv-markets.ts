import { getListMarketSymbolsQueryKey, useListMarketSymbols } from "@workspace/api-client-react"
import { DEFAULT_MARKET_SYMBOL, isVolatilityMarket, marketsFromResponse } from "@/lib/markets"

export function useDerivMarkets() {
  const query = useListMarketSymbols({
    query: {
      queryKey: getListMarketSymbolsQueryKey(),
      staleTime: 60_000,
      refetchInterval: 5 * 60_000,
    },
  })
  const markets = marketsFromResponse(query.data).filter(isVolatilityMarket)
  return {
    ...query,
    markets,
    volatilityMarkets: markets,
    discoveryAvailable: (query.data as any)?.discoveryAvailable !== false,
    defaultSymbol: markets.find(item => item.symbol === DEFAULT_MARKET_SYMBOL)?.symbol
      || markets[0]?.symbol
      || DEFAULT_MARKET_SYMBOL,
  }
}