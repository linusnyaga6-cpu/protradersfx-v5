export function formatMoney(value: unknown, currency = "USD") {
  const amount = Number(value)
  const code = String(currency || "USD").toUpperCase()
  if (!Number.isFinite(amount)) return "—"
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(amount)
  } catch {
    return `${code} ${amount.toFixed(2)}`
  }
}

export function formatVolatility(level: unknown, percent: unknown) {
  if (!level) return "—"
  const label = String(level).charAt(0).toUpperCase() + String(level).slice(1).toLowerCase()
  const value = Number(percent)
  return Number.isFinite(value) ? `${label} · ${value.toFixed(3)}%` : label
}