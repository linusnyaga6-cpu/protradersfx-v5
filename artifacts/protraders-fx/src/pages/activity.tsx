import * as React from "react"
import { 
  Activity as ActivityIcon, 
  Users, 
  UserPlus, 
  LogIn, 
  Wallet,
  Clock,
  Database
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  useGetAnalytics,
  getGetAnalyticsQueryKey
} from "@workspace/api-client-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function Activity() {
  const { data: analytics, isLoading, isError } = useGetAnalytics({
    query: { 
      queryKey: getGetAnalyticsQueryKey(),
      refetchInterval: 10000 // refresh every 10s
    }
  })

  return (
    <div className="flex-1 p-4 md:p-8 bg-background max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ActivityIcon className="h-8 w-8 text-primary" />
            System Activity
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time ephemeral telemetry and conversion events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {analytics?.ephemeral && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10 gap-1.5 py-1">
              <Clock className="h-3.5 w-3.5" /> In-Memory State
            </Badge>
          )}
          {isLoading && <Badge variant="secondary" className="animate-pulse">Syncing...</Badge>}
        </div>
      </div>

      {isError ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6 text-center text-destructive">
            Failed to retrieve telemetry data. The service might be temporarily unavailable.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard 
            title="Total Visitors" 
            value={analytics?.visitors} 
            icon={Users} 
            loading={isLoading}
            testId="metric-visitors"
          />
          <MetricCard 
            title="Registrations" 
            value={analytics?.registrations} 
            icon={UserPlus} 
            loading={isLoading}
            testId="metric-registrations"
          />
          <MetricCard 
            title="OAuth Logins" 
            value={analytics?.oauthSuccesses} 
            icon={LogIn} 
            loading={isLoading}
            testId="metric-logins"
          />
          <MetricCard 
            title="Funded Accounts" 
            value={analytics?.fundedAccounts} 
            icon={Wallet} 
            loading={isLoading}
            testId="metric-funded"
            fallback="N/A"
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            Telemetry Status
          </CardTitle>
          <CardDescription>
            System diagnostic notes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="bg-secondary p-4 rounded-md font-mono text-sm border">
              {analytics?.note || "No diagnostics available."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  loading, 
  testId,
  fallback = "0"
}: { 
  title: string, 
  value?: number | null, 
  icon: React.ElementType, 
  loading: boolean,
  testId: string,
  fallback?: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-muted-foreground text-sm tracking-tight">{title}</h3>
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          {loading ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <span className="text-4xl font-bold font-numeric tracking-tighter" data-testid={testId}>
              {value !== undefined && value !== null ? value.toLocaleString() : fallback}
            </span>
          )}
        </div>
      </CardContent>
      <div className="h-1 w-full bg-secondary/50">
        {!loading && value !== undefined && value !== null && value > 0 && (
          <div className="h-full bg-primary" style={{ width: '100%', opacity: 0.5 }} />
        )}
      </div>
    </Card>
  )
}
