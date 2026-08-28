import * as React from "react"
import { ShieldCheck, Server, Lock, Globe, Zap, AlertTriangle, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  useGetProtradersPreflight,
  getGetProtradersPreflightQueryKey,
  useGetProtradersConfig,
  getGetProtradersConfigQueryKey,
  useHealthCheck,
  getHealthCheckQueryKey
} from "@workspace/api-client-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function Readiness() {
  const { data: preflight, isLoading: preflightLoading } = useGetProtradersPreflight({
    query: { queryKey: getGetProtradersPreflightQueryKey() }
  })
  
  const { data: config, isLoading: configLoading } = useGetProtradersConfig({
    query: { queryKey: getGetProtradersConfigQueryKey() }
  })

  const { data: health, isLoading: healthLoading } = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey() }
  })

  const isLoading = preflightLoading || configLoading || healthLoading

  return (
    <div className="flex-1 p-4 md:p-8 bg-background max-w-5xl mx-auto w-full space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          System Preflight
        </h1>
        <p className="text-muted-foreground mt-1">
          Diagnostics and deployment readiness state.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {preflight?.readyForControlledLiveTest ? (
            <Alert variant="success" className="bg-success/5">
              <ShieldCheck className="h-5 w-5" />
              <AlertTitle>System Ready</AlertTitle>
              <AlertDescription>
                All required components are configured. The system is ready for controlled live operations.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive" className="bg-destructive/5">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle>Configuration Incomplete</AlertTitle>
              <AlertDescription>
                One or more critical subsystems are unconfigured. The trading engine is restricted.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  Security & Auth
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <StatusRow 
                  label="OAuth Client ID" 
                  ready={preflight?.oauthClientConfigured} 
                  detail={config?.publicAppId || "Missing"}
                />
                <StatusRow 
                  label="Session Secret" 
                  ready={preflight?.sessionSecretConfigured} 
                />
                <StatusRow 
                  label="HTTPS Enforcement" 
                  ready={preflight?.https} 
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Server className="h-5 w-5 text-muted-foreground" />
                  Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <StatusRow 
                  label="Login Endpoint" 
                  ready={config?.loginConfigured} 
                />
                <StatusRow 
                  label="Signup Endpoint" 
                  ready={config?.signupConfigured} 
                />
                <StatusRow 
                  label="Partner Tracking" 
                  ready={preflight?.partnerTrackingConfigured} 
                  detail={config?.partnerParam ? `param: ${config.partnerParam}` : undefined}
                />
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                  Operational State
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <StatusRow 
                   label="API Service" 
                   ready={health?.status === "ok"} 
                 />
                 <StatusRow 
                  label="Trading Engine" 
                  ready={preflight?.tradingEnabled} 
                  statusText={preflight?.tradingEnabled ? "ENABLED" : "DISABLED"}
                />
                 <StatusRow
                   label="Live Trading Gate"
                   ready={preflight?.readyForRealTrading}
                   statusText={preflight?.readyForRealTrading ? "READY" : "LOCKED"}
                   variant={preflight?.readyForRealTrading ? "default" : "warning"}
                 />
                <StatusRow 
                  label="App Configuration" 
                  ready={preflight?.publicAppConfigured} 
                />
                 <StatusRow
                   label="Web Frontend"
                   ready={preflight?.frontendConfigured}
                 />
                <StatusRow 
                  label="Environment Mode" 
                  ready={true} 
                   variant={preflight?.executionMode === "BOTH" ? "default" : "warning"}
                   statusText={preflight?.executionMode || "UNKNOWN"}
                />
                <div className="flex flex-col py-2 border-b last:border-0 border-border/50">
                  <span className="text-sm font-medium text-muted-foreground mb-1">Redirect URI</span>
                  <span className="text-sm font-mono truncate bg-secondary px-2 py-1 rounded w-fit" title={preflight?.redirectUri}>
                    {preflight?.redirectUri}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function StatusRow({ 
  label, 
  ready, 
  detail,
  statusText,
  variant = "default"
}: { 
  label: string, 
  ready?: boolean, 
  detail?: string,
  statusText?: string,
  variant?: "default" | "warning"
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0 border-border/50">
      <div className="flex flex-col">
        <span className="font-medium text-sm">{label}</span>
        {detail && <span className="text-xs text-muted-foreground font-mono">{detail}</span>}
      </div>
      {variant === "warning" ? (
        <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/10">
          {statusText || "WARNING"}
        </Badge>
      ) : (
        <Badge variant={ready ? "success" : "destructive"}>
          {statusText || (ready ? "READY" : "MISSING")}
        </Badge>
      )}
    </div>
  )
}
