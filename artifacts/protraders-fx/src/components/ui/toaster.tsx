import { useToast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <div className="fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px] gap-2">
      {toasts.map(function ({ id, title, description, action, variant }) {
        return (
          <div
            key={id}
            className={`group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all ${
              variant === "destructive" 
                ? "border-destructive bg-destructive text-destructive-foreground" 
                : variant === "success"
                  ? "border-success bg-success text-success-foreground"
                  : "border bg-background text-foreground"
            }`}
          >
            <div className="flex items-start gap-3">
              {variant === "destructive" && <AlertCircle className="h-5 w-5 mt-0.5 opacity-80" />}
              {variant === "success" && <CheckCircle2 className="h-5 w-5 mt-0.5 opacity-80" />}
              {!variant && <Info className="h-5 w-5 mt-0.5 opacity-60" />}
              <div className="grid gap-1">
                {title && <div className="text-sm font-semibold">{title}</div>}
                {description && (
                  <div className="text-sm opacity-90">{description}</div>
                )}
              </div>
            </div>
            {action}
          </div>
        )
      })}
    </div>
  )
}
