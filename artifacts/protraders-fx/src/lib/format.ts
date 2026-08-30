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

export function formatSignedMoney(value: unknown, currency = "USD") {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return "—"
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : ""
  return `${sign}${formatMoney(Math.abs(amount), currency)}`
}

export function formatDisplayMoney(value: unknown, currency = "USD") {
  const formatted = formatMoney(value, currency)
  return String(currency || "USD").toUpperCase() === "KES"
    ? formatted.replace(/^KES(?:\s|\u00a0)*/, "KSh ")
    : formatted
}

export function formatDisplaySignedMoney(value: unknown, currency = "USD") {
  const formatted = formatSignedMoney(value, currency)
  return String(currency || "USD").toUpperCase() === "KES"
    ? formatted.replace(/^([+-]?)KES(?:\s|\u00a0)*/, "$1KSh ")
    : formatted
}

export function isSettledStatus(status: unknown) {
  return ["won", "lost", "settled"].includes(String(status || "").toLowerCase())
}

export function formatVolatility(level: unknown, percent: unknown) {
  if (!level) return "—"
  const label = String(level).charAt(0).toUpperCase() + String(level).slice(1).toLowerCase()
  const value = Number(percent)
  return Number.isFinite(value) ? `${label} · ${value.toFixed(3)}%` : label
}