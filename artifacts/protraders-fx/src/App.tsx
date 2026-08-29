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
import Initializing from '@/pages/initializing';
import { FloatingScanner } from '@/components/trading/floating-scanner';
import NotFound from '@/pages/not-found';
import Course from '@/pages/course';
import Analysis from '@/pages/analysis';
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
            <Route path="/activity" component={Activity} />
            <Route path="/markets" component={MarketsRoute} />
            <Route path="/bots" component={BotsRoute} />
            <Route path="/recovery" component={RecoveryRoute} />
            <Route path="/bulk-trade" component={BulkTradeRoute} />
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
      </main>
      <Footer />
      <FloatingScanner />
    </div>
  );
}

function ProtectedPage({ page: Page }: { page: ComponentType }) {
  const { data: session, isLoading, isError } = useGetSessionStatus();

  if (isLoading) {
    return <div className="grid min-h-[45vh] place-items-center text-sm text-muted-foreground">Checking your secure session…</div>;
  }

  if (isError || !session?.authenticated) {
    return (
      <section className="mx-auto grid min-h-[55vh] w-full max-w-3xl place-items-center px-5 py-12">
        <div className="w-full rounded-xl border bg-card p-7 text-center shadow-sm md:p-10">
          <div className="text-xs font-semibold uppercase tracking-[.24em] text-primary">Secure workspace</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Connect your Deriv account to continue</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Connect Deriv to open markets, bots, recovery, and demo trading.
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
const MarketsRoute = () => <ProtectedPage page={Markets} />;
const BotsRoute = () => <ProtectedPage page={Bots} />;
const RecoveryRoute = () => <ProtectedPage page={Recovery} />;
const BulkTradeRoute = () => <ProtectedPage page={BulkTrade} />;

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
