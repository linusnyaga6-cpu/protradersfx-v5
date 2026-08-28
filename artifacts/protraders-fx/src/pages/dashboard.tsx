import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Link, useLocation } from "wouter"
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Clock, 
  DollarSign, 
  Lock,
  ChevronRight,
  ShieldAlert
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { 
  useGetAccount,
  getGetAccountQueryKey,
  useCreateTrade,
  useGetSessionStatus,
  getGetSessionStatusQueryKey,
  useGetProtradersPreflight,
  getGetProtradersPreflightQueryKey,
  TradeInputContractType
} from "@workspace/api-client-react"

const tradeSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  contract_type: z.nativeEnum(TradeInputContractType),
  stake: z.coerce.number().positive("Stake must be greater than zero"),
  duration: z.coerce.number().int().min(1, "Duration must be at least 1 tick"),
})

type TradeFormValues = z.infer<typeof tradeSchema>

export default function Dashboard() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()

  const { data: session, isLoading: sessionLoading } = useGetSessionStatus({
    query: { queryKey: getGetSessionStatusQueryKey() }
  })

  const { data: preflight } = useGetProtradersPreflight({
    query: { queryKey: getGetProtradersPreflightQueryKey() }
  })

  const { data: account, isLoading: accountLoading, error: accountError } = useGetAccount({
    query: { 
      queryKey: getGetAccountQueryKey(),
      refetchInterval: 5000,
      enabled: session?.authenticated
    }
  })

  const createTrade = useCreateTrade()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<TradeFormValues>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      symbol: "R_100", // Volatility 100 Index
      contract_type: TradeInputContractType.CALL,
      stake: 10,
      duration: 5,
    }
  })

  const contractType = watch("contract_type")
  const symbols = preflight?.allowedSymbols?.length
    ? preflight.allowedSymbols
    : ["R_100", "R_10", "1HZ100V"]
  const canTrade = Boolean(
    preflight?.tradingEnabled &&
    (preflight.demoOnly || preflight.readyForRealTrading),
  )

  React.useEffect(() => {
    if (!sessionLoading && !session?.authenticated) {
      setLocation("/")
    }
  }, [session, sessionLoading, setLocation])

  const onSubmit = (data: TradeFormValues) => {
    if (!preflight || !canTrade) {
      toast({
        title: "Trading Disabled",
        description: "The server has not enabled controlled trading yet.",
        variant: "destructive"
      })
      return
    }
    if (data.stake > preflight.maxStake || data.duration > preflight.maxDuration) {
      toast({
        title: "Safety Limit Exceeded",
        description: `Maximum stake is ${preflight.maxStake} and maximum duration is ${preflight.maxDuration} ticks.`,
        variant: "destructive"
      })
      return
    }
    createTrade.mutate({ data }, {
      onSuccess: (result) => {
        if (result.ok) {
          toast({
            title: "Trade Executed",
            description: `Order ${result.contractId} placed successfully.`,
            variant: "success"
          })
        } else {
          toast({
            title: "Trade Failed",
            description: result.message || "Execution engine rejected the order.",
            variant: "destructive"
          })
        }
      },
      onError: (err) => {
        toast({
          title: "System Error",
          description: err.message || "Failed to communicate with trading engine.",
          variant: "destructive"
        })
      }
    })
  }

  if (sessionLoading || (session?.authenticated && accountLoading)) {
    return (
      <div className="flex-1 p-4 md:p-8 w-full max-w-6xl mx-auto space-y-8">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-48 lg:col-span-1" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </div>
    )
  }

  if (!session?.authenticated) {
    return null; // Will redirect
  }

  return (
    <div className="flex-1 p-4 md:p-8 bg-background max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trading Workspace</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Lock className="h-4 w-4" /> Secure connection established
          </p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="font-mono tabular-nums text-sm bg-secondary/50">
            ID: {account?.loginid || 'CONNECTING...'}
          </Badge>
               {account?.accountType && (
                 <Badge
                   variant={account.accountType === "real" ? "destructive" : "secondary"}
                   className="mt-2 ml-2 uppercase"
                 >
                   {account.accountType} account
                 </Badge>
               )}
        </div>
      </div>

      {accountError && (
        <Alert variant="destructive" className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Interrupted</AlertTitle>
          <AlertDescription>
            Failed to fetch real-time account data from Deriv. Retrying automatically.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Overview Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-t-4 border-t-primary shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Account Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-numeric tracking-tighter" data-testid="text-balance">
                {account?.balance != null ? (
                  <>
                    <span className="text-muted-foreground text-lg mr-2">{account.currency || ''}</span>
                    {account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </>
                ) : (
                  '---'
                )}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-medium font-numeric">{account?.currency || '—'}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Open P&L</span>
                <span className={`font-medium font-numeric ${
                  account?.openPnl && account.openPnl > 0 ? 'text-success' : 
                  account?.openPnl && account.openPnl < 0 ? 'text-destructive' : ''
                }`} data-testid="text-pnl">
                  {account?.openPnl != null ? (
                    `${account.openPnl > 0 ? '+' : ''}${account.openPnl.toFixed(2)}`
                  ) : 'Unavailable'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Safety Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-muted-foreground"><ShieldAlert className="h-4 w-4" /> Max Stake</span>
                 <span className="font-mono" data-testid="text-max-stake">{preflight?.maxStake ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> Min Duration</span>
                 <span className="font-mono" data-testid="text-max-duration">{preflight?.maxDuration ? `${preflight.maxDuration} Ticks Max` : '—'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Execution Terminal */}
        <Card className="lg:col-span-2 shadow-md flex flex-col">
          <CardHeader className="border-b bg-secondary/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <TrendingUp className="h-5 w-5 text-primary" />
              Order Entry
            </CardTitle>
            <CardDescription>Configure and execute precision trades.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pt-6">
            <form id="trade-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="symbol" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Instrument</Label>
                  <Select 
                    value={watch("symbol")} 
                    onValueChange={(v) => setValue("symbol", v)}
                  >
                    <SelectTrigger id="symbol" className="h-12 text-lg font-medium shadow-sm" data-testid="input-symbol">
                      <SelectValue placeholder="Select instrument" />
                    </SelectTrigger>
                     <SelectContent>
                       {symbols.map((symbol) => (
                         <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                       ))}
                    </SelectContent>
                  </Select>
                  {errors.symbol && <p className="text-xs text-destructive mt-1">{errors.symbol.message}</p>}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="duration" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Duration (Ticks)</Label>
                  <div className="relative">
                    <Input 
                      id="duration" 
                      type="number" 
                      className="h-12 text-lg font-mono pl-10 shadow-sm"
                      {...register("duration")}
                      data-testid="input-duration"
                    />
                    <Clock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                  </div>
                  {errors.duration && <p className="text-xs text-destructive mt-1">{errors.duration.message}</p>}
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="stake" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Stake Amount (USD)</Label>
                <div className="relative">
                  <Input 
                    id="stake" 
                    type="number" 
                    step="0.01"
                    className="h-16 text-2xl font-mono pl-12 font-bold shadow-sm"
                    {...register("stake")}
                    data-testid="input-stake"
                  />
                  <DollarSign className="absolute left-4 top-5 h-6 w-6 text-muted-foreground" />
                </div>
                {errors.stake && <p className="text-xs text-destructive mt-1">{errors.stake.message}</p>}
              </div>

              <div className="space-y-3">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Direction</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant={contractType === TradeInputContractType.CALL ? "default" : "outline"}
                    className={`h-16 text-lg tracking-wider font-bold transition-all ${
                      contractType === TradeInputContractType.CALL ? 'bg-success hover:bg-success/90 text-success-foreground ring-2 ring-success ring-offset-2 ring-offset-background' : ''
                    }`}
                    onClick={() => setValue("contract_type", TradeInputContractType.CALL)}
                    data-testid="button-type-call"
                  >
                    <TrendingUp className="mr-2 h-6 w-6" />
                    CALL (UP)
                  </Button>
                  <Button
                    type="button"
                    variant={contractType === TradeInputContractType.PUT ? "default" : "outline"}
                    className={`h-16 text-lg tracking-wider font-bold transition-all ${
                      contractType === TradeInputContractType.PUT ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground ring-2 ring-destructive ring-offset-2 ring-offset-background' : ''
                    }`}
                    onClick={() => setValue("contract_type", TradeInputContractType.PUT)}
                    data-testid="button-type-put"
                  >
                    <TrendingDown className="mr-2 h-6 w-6" />
                    PUT (DOWN)
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
          <CardFooter className="bg-secondary/10 border-t p-6 mt-auto">
            <Button 
              type="submit" 
              form="trade-form"
              size="xl" 
              className="w-full text-lg shadow-xl uppercase tracking-widest font-bold"
              disabled={isSubmitting || createTrade.isPending || !canTrade}
              data-testid="button-submit-trade"
            >
              {createTrade.isPending ? "Transmitting..." : canTrade ? "Execute Trade" : "Trading Disabled"}
              {!createTrade.isPending && <ChevronRight className="ml-2 h-5 w-5" />}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
