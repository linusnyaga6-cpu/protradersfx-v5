import { useState, useEffect } from "react"

const TOAST_TIMEOUT = 3000

export interface Toast {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: "default" | "destructive" | "success"
}

let toasts: Toast[] = []
let listeners: ((toasts: Toast[]) => void)[] = []

function notify() {
  listeners.forEach((listener) => listener([...toasts]))
}

export const toast = (props: Omit<Toast, "id">) => {
  const id = Math.random().toString(36).substring(2, 9)
  const toast = { ...props, id }
  
  toasts = [toast, ...toasts].slice(0, 3)
  notify()

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  }, TOAST_TIMEOUT)

  return id
}

export const useToast = () => {
  const [state, setState] = useState<Toast[]>(toasts)

  useEffect(() => {
    listeners.push(setState)
    return () => {
      listeners = listeners.filter((l) => l !== setState)
    }
  }, [])

  return { toasts: state, toast }
}
