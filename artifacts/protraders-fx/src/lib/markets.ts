export const DEFAULT_MARKET_SYMBOL = "R_100"
export const SUPPORTED_VOLATILITY_SYMBOLS = new Set([
  "R_10",
  "R_25",
  "R_50",
  "R_75",
  "R_100",
  "1HZ10V",
  "1HZ25V",
  "1HZ50V",
  "1HZ75V",
  "1HZ100V",
])

export type DerivMarket = {
  symbol: string
  displayName?: string
  market?: string
  marketDisplayName?: string
  submarket?: string
  submarketDisplayName?: string
  exchangeIsOpen?: boolean
  discovered?: boolean
}

export const CONTRACT_LABELS: Record<string, { family: string; action: string; needsBarrier?: boolean }> = {
  CALL: { family: "Rise / Fall", action: "Rise" },
  PUT: { family: "Rise / Fall", action: "Fall" },
  DIGITOVER: { family: "Over / Under", action: "Over", needsBarrier: true },
  DIGITUNDER: { family: "Over / Under", action: "Under", needsBarrier: true },
  DIGITEVEN: { family: "Odd / Even", action: "Even" },
  DIGITODD: { family: "Odd / Even", action: "Odd" },
}

export function marketsFromResponse(data: unknown): DerivMarket[] {
  const rows = Array.isArray((data as any)?.symbols) ? (data as any).symbols : []
  return rows
    .filter((item: any) => typeof item?.symbol === "string")
    .map((item: any) => ({
      symbol: item.symbol,
      displayName: item.displayName || item.symbol,
      market: item.market,
      marketDisplayName: item.marketDisplayName || item.market,
      submarket: item.submarket,
      submarketDisplayName: item.submarketDisplayName || item.submarket,
      exchangeIsOpen: item.exchangeIsOpen,
      discovered: item.discovered,
    }))
}

export function isVolatilityMarket(market: DerivMarket) {
  return SUPPORTED_VOLATILITY_SYMBOLS.has(market.symbol)
}

export function marketLabel(market: DerivMarket | undefined, symbol: string) {
  return market?.displayName ? `${market.displayName} · ${symbol}` : symbol
}