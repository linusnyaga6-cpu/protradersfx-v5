export const VOLATILITY_SYMBOLS = [
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
  "1HZ150V",
  "1HZ250V",
] as const

export const ALL_MARKET_SYMBOLS = [
  ...VOLATILITY_SYMBOLS,
  "frxAUDUSD",
  "frxEURUSD",
  "frxGBPUSD",
  "frxUSDJPY",
] as const

export type MarketSymbol = (typeof ALL_MARKET_SYMBOLS)[number]