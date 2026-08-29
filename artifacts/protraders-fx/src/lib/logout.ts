export async function endSession() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
  } finally {
    window.location.assign("/")
  }
}