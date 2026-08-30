import { useState } from "react"
import { getGetMarketTickerQueryKey, useGetMarketTicker } from "@workspace/api-client-react"
import { formatDisplayMoney as formatMoney, formatDisplaySignedMoney as formatSignedMoney } from "@/lib/format"

export type DisplayCurrency = "USD" | "KES"

export function useDisplayCurrency(accountCurrency?: string) {
  const sourceCurrency = String(accountCurrency || "USD").toUpperCase()
  const [currency, setCurrency] = useState<DisplayCurrency>(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("protraders-display-currency") === "KES") return "KES"
    return sourceCurrency === "KES" ? "KES" : "USD"
  })
  const canConvert = sourceCurrency === "USD" || sourceCurrency === "KES"
  const conversion = useGetMarketTicker("frxUSDKES", {
    query: {
      queryKey: getGetMarketTickerQueryKey("frxUSDKES"),
      enabled: canConvert && sourceCurrency !== currency,
      refetchInterval: 30_000,
    },
  })
  const conversionRate = Number((conversion.data as any)?.quote ?? (conversion.data as any)?.price)
  const hasRate = sourceCurrency === currency
    || (Number.isFinite(conversionRate) && conversionRate > 0 && (conversion.data as any)?.available !== false)

  const chooseCurrency = (next: string) => {
    if (next !== "USD" && next !== "KES") return
    setCurrency(next)
    try { window.localStorage.setItem("protraders-display-currency", next) } catch { /* display preference is optional */ }
  }

  const convert = (value: unknown) => {
    const amount = Number(value)
    if (!Number.isFinite(amount) || !hasRate) return null
    if (sourceCurrency === currency) return amount
    return sourceCurrency === "USD" ? amount * conversionRate : amount / conversionRate
  }

  const formatDisplayMoney = (value: unknown) => {
    const amount = convert(value)
    return amount == null ? (conversion.isFetching ? "Loading rate…" : "Rate unavailable") : formatMoney(amount, currency)
  }

  const formatDisplaySignedMoney = (value: unknown) => {
    const amount = convert(value)
    return amount == null ? (conversion.isFetching ? "Loading rate…" : "Rate unavailable") : formatSignedMoney(amount, currency)
  }

  return {
    currency,
    sourceCurrency,
    conversionRate,
    hasRate,
    isLoadingRate: conversion.isFetching,
    chooseCurrency,
    formatMoney: formatDisplayMoney,
    formatSignedMoney: formatDisplaySignedMoney,
    conversionLabel: sourceCurrency === currency
      ? `Display currency: ${currency}`
      : hasRate
        ? `Converted from ${sourceCurrency} at the latest available USD/KES rate`
        : "USD/KES conversion rate unavailable",
  }
}