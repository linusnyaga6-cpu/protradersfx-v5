export async function endSession() {
  try {
    const response = await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
    if (!response.ok) {
      await fetch("/api/logout", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      }).catch(() => undefined)
    }
  } catch {
    await fetch("/api/logout", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).catch(() => undefined)
  } finally {
    window.location.replace("/")
  }
}