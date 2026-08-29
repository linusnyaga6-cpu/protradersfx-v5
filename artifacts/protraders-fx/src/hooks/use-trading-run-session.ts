import { useCallback, useEffect, useRef, useState } from "react"
import { useCreateTrade, usePreviewTrade, useRefreshTransaction } from "@workspace/api-client-react"

export type TradingRunSessionState = {
  id: string | null
  status: "idle" | "running" | "stopping" | "stopped" | "completed" | "failed"
  currentRun: number
  totalRuns: number
  completedRuns: number
  netProfit: number
  message: string
  results: Array<{ id: string; run: number; status: string; netProfit?: number | null; transactionId?: string | null; message: string }>
}

export type RunSessionOrder = Record<string, unknown> & {
  symbol: string
  stake: number
  duration: number
  stop_loss: number
}

const initialState: TradingRunSessionState = {
  id: null, status: "idle", currentRun: 0, totalRuns: 0, completedRuns: 0,
  netProfit: 0, message: "", results: [],
}

const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds))

export function useTradingRunSession(storageKey: string, onChange?: () => void) {
  const preview = usePreviewTrade()
  const trade = useCreateTrade()
  const refresh = useRefreshTransaction()
  const stateRef = useRef<TradingRunSessionState>(initialState)
  const stopRequested = useRef(false)
  const cancelled = useRef(false)
  const [state, setState] = useState(initialState)

  const commit = useCallback((change: Partial<TradingRunSessionState> | ((current: TradingRunSessionState) => TradingRunSessionState)) => {
    const next = typeof change === "function" ? change(stateRef.current) : { ...stateRef.current, ...change }
    stateRef.current = next
    setState(next)
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* storage is optional */ }
  }, [storageKey])

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null")
      if (saved?.id && ["running", "stopping"].includes(saved.status)) {
        commit({ ...saved, status: "stopped", message: "Session interrupted by reload. No new order was started." })
      } else if (saved?.id && saved.status && saved.status !== "idle") {
        stateRef.current = saved
        setState(saved)
      }
    } catch { /* ignore malformed optional session state */ }
    return () => { cancelled.current = true; stopRequested.current = true }
  }, [commit, storageKey])

  const stop = useCallback(() => {
    if (!["running", "stopping"].includes(stateRef.current.status)) return
    stopRequested.current = true
    commit({ status: "stopping", message: "Stop requested. The current Deriv contract will settle; no new order will start." })
  }, [commit])

  const start = useCallback(async (order: RunSessionOrder, totalRuns: number, takeProfit: number) => {
    if (stateRef.current.status === "running" || stateRef.current.status === "stopping") return
    stopRequested.current = false
    cancelled.current = false
    const sessionId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
    commit({ ...initialState, id: sessionId, status: "running", totalRuns, message: "Run Bot started. Requesting the first Deriv proposal…" })
    try {
      for (let index = 1; index <= totalRuns; index += 1) {
        if (stopRequested.current || cancelled.current) break
        commit({ currentRun: index, status: "running", message: `Requesting a fresh Deriv proposal for run ${index} of ${totalRuns}…` })
        const proposal = await preview.mutateAsync({ data: { ...order, session_id: sessionId } as any }) as any
        if (stopRequested.current || cancelled.current) break
        commit({ message: `Submitting run ${index} of ${totalRuns} to Deriv…` })
        const receipt = await trade.mutateAsync({ data: { ...order, session_id: sessionId, proposal_token: proposal.proposalToken } as any }) as any
        const resultId = `${sessionId}-${index}`
        if (!receipt?.ok || !receipt?.transactionId) {
          commit(current => ({
            ...current,
            status: "failed",
            results: [...current.results, { id: resultId, run: index, status: "rejected", message: receipt?.message || "Deriv rejected the order." }],
            message: receipt?.message || "Deriv rejected the order. Session stopped.",
          }))
          return
        }
        commit(current => ({
          ...current,
          message: `Run ${index} accepted. Waiting for authoritative Deriv settlement…`,
          results: [...current.results, { id: resultId, run: index, status: "pending", transactionId: String(receipt.transactionId), message: `Contract ${receipt.contractId || receipt.transactionId} is open.` }],
        }))
        let settled: any = null
        for (let attempt = 0; attempt < 120 && !cancelled.current; attempt += 1) {
          await wait(3000)
          if (cancelled.current) break
          const refreshed = await refresh.mutateAsync({ id: String(receipt.transactionId) }) as any
          const transaction = refreshed?.transaction
          if (refreshed?.refreshed && transaction && ["won", "lost", "settled"].includes(String(transaction.status).toLowerCase())) {
            const profit = Number(transaction.netProfit)
            if (!Number.isFinite(profit)) throw new Error("Deriv settled the contract without a usable net-profit value.")
            settled = { transaction, profit }
            break
          }
          commit({ message: `Run ${index} is still open. Waiting for Deriv settlement…` })
        }
        if (!settled) throw new Error("Settlement was not available before the session timed out.")
        const totalProfit = stateRef.current.netProfit + settled.profit
        commit(current => ({
          ...current,
          completedRuns: index,
          netProfit: totalProfit,
          message: `Run ${index} settled with ${settled.profit >= 0 ? "+" : ""}${settled.profit.toFixed(2)}.`,
          results: current.results.map(item => item.id === resultId ? { ...item, status: String(settled.transaction.status), netProfit: settled.profit, message: `Settled by Deriv with net profit ${settled.profit >= 0 ? "+" : ""}${settled.profit.toFixed(2)}.` } : item),
        }))
        onChange?.()
        if (stopRequested.current) break
        if (totalProfit >= takeProfit) {
          commit({ status: "completed", message: `Take-profit target reached at ${totalProfit.toFixed(2)}. No further run was submitted.` })
          return
        }
      }
      if (!cancelled.current) {
        commit({ status: stopRequested.current ? "stopped" : "completed", message: stopRequested.current ? "Bot stopped after the current contract settled. No new order was submitted." : "Run plan completed." })
      }
    } catch (error) {
      commit({ status: "failed", message: error instanceof Error ? error.message : "Trading session stopped because the provider response was unavailable." })
    } finally {
      onChange?.()
    }
  }, [commit, onChange, preview, refresh, trade])

  return { state, start, stop, isBusy: state.status === "running" || state.status === "stopping" }
}