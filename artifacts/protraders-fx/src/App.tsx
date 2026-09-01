import { useEffect, type ComponentType, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetSessionStatus } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import Home from '@/pages/home';
import About from '@/pages/about';
import Dashboard from '@/pages/dashboard';
import Activity from '@/pages/activity';
import Markets from '@/pages/markets';
import Bots from '@/pages/bots';
import Recovery from '@/pages/recovery';
import BulkTrade from '@/pages/bulk-trade';
import BulkTrader from '@/pages/bulk-trader';
import AiScanner from '@/pages/ai-scanner';
import Initializing from '@/pages/initializing';
import { FloatingScanner } from '@/components/trading/floating-scanner';
import NotFound from '@/pages/not-found';
import Course from '@/pages/course';
import Analysis from '@/pages/analysis';
import { ActivityTracker } from '@/hooks/use-activity-tracking';
import { FreeVertexPreview } from '@/components/bots/freevertex-preview';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="min-h-[100dvh] flex flex-col w-full bg-background font-sans text-foreground selection:bg-primary selection:text-primary-foreground">
      <Navbar />
      <main className="flex-1 flex flex-col w-full relative">
        <RoutedErrorBoundary>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/oauth/callback" component={OAuthCallbackBridge} />
            <Route path="/initializing" component={Initializing} />
            <Route path="/about" component={About} />
            <Route path="/course" component={Course} />
            <Route path="/analysis" component={Analysis} />
            <Route path="/dashboard" component={DashboardRoute} />
            <Route path="/ai-scanner" component={AiScannerRoute} />
            <Route path="/activity" component={Activity} />
            <Route path="/markets" component={MarketsRoute} />
            <Route path="/bots" component={BotsRoute} />
            <Route path="/recovery" component={RecoveryRoute} />
            <Route path="/create-bot" component={CreateBotRoute} />
            <Route path="/bulk-trade" component={BulkTraderRoute} />
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
      </main>
      <Footer />
      <FloatingScanner />
    </div>
  );
}

function ProtectedPage({ page: Page, publicPreview }: { page: ComponentType; publicPreview?: ReactNode }) {
  const { data: session, isLoading, isError } = useGetSessionStatus();

  if (isLoading) {
    return <div className="grid min-h-[45vh] place-items-center text-sm text-muted-foreground">Checking your secure session…</div>;
  }

  if (isError || !session?.authenticated) {
    return (
      <section className={`mx-auto w-full px-5 py-12 ${publicPreview ? "max-w-5xl" : "max-w-3xl"}`}>
        <div className={`grid gap-6 ${publicPreview ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start" : "place-items-center"}`}>
        <div className="w-full rounded-xl border bg-card p-7 text-center shadow-sm md:p-10">
          <div className="text-xs font-semibold uppercase tracking-[.24em] text-primary">Secure workspace</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Connect your Deriv account to continue</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
             Connect Deriv to open markets, bots, recovery, and trading.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90" href="/api/deriv/login">
              Connect Deriv account
            </a>
            <a className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-5 text-sm font-medium hover:bg-secondary" href="/">
              Return home
            </a>
          </div>
        </div>
        {publicPreview}
        </div>
      </section>
    );
  }

  return <Page />;
}

function OAuthCallbackBridge() {
  useEffect(() => {
    window.location.replace(`/api/oauth/callback${window.location.search}`);
  }, []);

  return (
    <div className="grid min-h-[55vh] place-items-center px-5 text-center">
      <div>
        <div className="text-sm font-semibold text-foreground">Completing your secure Deriv connection…</div>
        <p className="mt-2 text-sm text-muted-foreground">Please keep this page open while your account session is verified.</p>
      </div>
    </div>
  );
}

const DashboardRoute = () => <ProtectedPage page={Dashboard} />;
const AiScannerRoute = () => <ProtectedPage page={AiScanner} />;
const MarketsRoute = () => <ProtectedPage page={Markets} />;
const BotsRoute = () => <ProtectedPage page={Bots} publicPreview={<PublicBotPreview />} />;
const RecoveryRoute = () => <ProtectedPage page={Recovery} />;
const CreateBotRoute = () => <ProtectedPage page={BulkTrade} />;
const BulkTraderRoute = () => <ProtectedPage page={BulkTrader} />;

function PublicBotPreview() {
  const sourceBots = [
    {
      number: 1,
      name: "Vertex Bot",
      description: "The free market-observer bot for reviewing EMA direction before starting.",
      badgeClass: "border-primary/30 text-primary",
    },
    {
      number: 2,
      name: "Recovery Bot",
      description: "A separate monitor-only assistant. It never increases stake, retries an order, or places a trade.",
      badgeClass: "border-amber-500/30 text-amber-600",
    },
  ];

  return (
    <div className="w-full rounded-xl border bg-card p-5 shadow-sm md:p-6">
       <div className="text-xs font-semibold uppercase tracking-[.24em] text-primary">Free Bot experience</div>
       <h2 className="mt-2 text-xl font-semibold tracking-tight">Start with a controlled strategy</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
         Vertex Bot and Recovery Bot are available after you connect Deriv. Both remain dry-run and review-first until you choose what to do.
      </p>
      <div className="mt-5 space-y-3">
        {sourceBots.map((bot) => (
          <article key={bot.number} className="rounded-lg border border-primary/20 bg-primary/[.04] p-4">
            {bot.number === 1 && <FreeVertexPreview />}
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                {bot.number}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${bot.badgeClass}`}>
                    BOT {bot.number}
                  </span>
                  <h3 className="font-semibold">{bot.name}</h3>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{bot.description}</p>
                 <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                   {bot.number === 2 ? "Monitor only · no trade controls" : "Free market observer · user started"}
                 </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <ActivityTracker />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
