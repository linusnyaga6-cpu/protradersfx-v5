import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Navbar } from '@/components/layout/navbar';
import Home from '@/pages/home';
import Dashboard from '@/pages/dashboard';
import Readiness from '@/pages/readiness';
import Activity from '@/pages/activity';
import Markets from '@/pages/markets';
import Bots from '@/pages/bots';
import Snapshots from '@/pages/snapshots';
import Recovery from '@/pages/recovery';
import NotFound from '@/pages/not-found';
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
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/readiness" component={Readiness} />
            <Route path="/activity" component={Activity} />
            <Route path="/markets" component={Markets} />
            <Route path="/bots" component={Bots} />
            <Route path="/snapshots" component={Snapshots} />
            <Route path="/recovery" component={Recovery} />
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
      </main>
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
