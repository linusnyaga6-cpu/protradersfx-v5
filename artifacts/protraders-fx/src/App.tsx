import { type FormEvent, type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Crosshair,
  LockKeyhole,
  Menu,
  MoveRight,
  Play,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const DERIV_REFERRAL_URL = 'https://t.deriv.link?t=SSJBZ9FQTVP8';
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [email, setEmail] = useState('');
  const [signupState, setSignupState] = useState<'idle' | 'success'>('idle');

  const closeMenu = () => setMenuOpen(false);
  const handleSignup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.trim()) setSignupState('success');
  };

  return (
    <div className="grain min-h-[100dvh] bg-[#0d1617] text-[#e6e3d7]">
      <header className="fixed inset-x-0 top-0 z-40 border-b hairline bg-[#0d1617]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between px-5 md:px-10">
          <a href="#top" onClick={closeMenu} className="flex items-center gap-3" data-testid="link-logo">
            <span className="flex h-8 w-8 items-center justify-center border border-[#d9a64c] text-[#d9a64c]">
              <span className="h-2 w-2 bg-[#d9a64c]" />
            </span>
            <span className="text-[13px] font-extrabold tracking-[.21em] text-[#ebe8dc]">PROTRADERS <span className="text-[#d9a64c]">FX</span></span>
          </a>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
            <a href="#method" className="text-[11px] font-mono-brand uppercase tracking-[.16em] text-[#8c9994] transition-colors hover:text-[#e6e3d7]" data-testid="link-method">Method</a>
            <a href="#path" className="text-[11px] font-mono-brand uppercase tracking-[.16em] text-[#8c9994] transition-colors hover:text-[#e6e3d7]" data-testid="link-path">The path</a>
            <a href="#faq" className="text-[11px] font-mono-brand uppercase tracking-[.16em] text-[#8c9994] transition-colors hover:text-[#e6e3d7]" data-testid="link-faq">FAQ</a>
          </nav>
          <div className="hidden items-center gap-5 md:flex">
             <a href={`${basePath}/sign-in`} className="text-[11px] font-mono-brand uppercase tracking-[.16em] text-[#d9a64c] hover:text-[#f0c878]" data-testid="link-login">Member login</a>
              <a href={DERIV_REFERRAL_URL} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 bg-[#d9a64c] px-5 py-3 text-[11px] font-extrabold uppercase tracking-[.15em] text-[#0d1617] transition-colors hover:bg-[#edc16f]" data-testid="link-start">
                Open a Deriv account <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
          <button className="p-2 text-[#d9a64c] md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" data-testid="button-mobile-menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="border-t hairline bg-[#101d1e] px-5 py-5 md:hidden" aria-label="Mobile navigation">
            <div className="flex flex-col gap-5">
              <a href="#method" onClick={closeMenu} className="text-xs font-mono-brand uppercase tracking-[.15em] text-[#b7c0b6]" data-testid="mobile-link-method">Method</a>
              <a href="#path" onClick={closeMenu} className="text-xs font-mono-brand uppercase tracking-[.15em] text-[#b7c0b6]" data-testid="mobile-link-path">The path</a>
              <a href="#faq" onClick={closeMenu} className="text-xs font-mono-brand uppercase tracking-[.15em] text-[#b7c0b6]" data-testid="mobile-link-faq">FAQ</a>
              <a href={DERIV_REFERRAL_URL} target="_blank" rel="noopener noreferrer" onClick={closeMenu} className="flex items-center justify-center gap-2 bg-[#d9a64c] py-3 text-xs font-bold uppercase tracking-widest text-[#0d1617]" data-testid="mobile-link-start">Open a Deriv account <ArrowUpRight size={14} /></a>
            </div>
          </nav>
        )}
      </header>

      <main id="top">
        <section className="desk-grid relative overflow-hidden border-b hairline pt-[76px]">
          <div className="absolute -right-32 top-32 h-96 w-96 rounded-full bg-[#1d5753]/20 blur-3xl" />
          <div className="relative mx-auto grid min-h-[700px] max-w-[1280px] items-center gap-16 px-5 py-20 md:grid-cols-[1.05fr_.95fr] md:px-10 md:py-28">
            <div className="reveal">
              <div className="mb-8 flex items-center gap-3 text-[10px] font-mono-brand uppercase tracking-[.2em] text-[#b1b8a9]">
                <span className="pulse-dot h-2 w-2 rounded-full bg-[#d9a64c]" /> Market prep / 06:42 UTC
              </div>
              <h1 className="max-w-3xl text-balance text-[clamp(3.4rem,8vw,7.6rem)] font-extrabold leading-[.91] tracking-[-.075em] text-[#eeeade]">
                Trade the plan.<br /><span className="text-[#d9a64c]">Pass the test.</span>
              </h1>
              <p className="mt-9 max-w-lg text-base leading-7 text-[#9da9a0] md:text-lg">
                ProTraders FX is the operating system for traders who want a repeatable path from evaluation day to funded account — without the noise.
              </p>
              <div className="mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <a href={DERIV_REFERRAL_URL} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 bg-[#d9a64c] px-6 py-4 text-[11px] font-extrabold uppercase tracking-[.15em] text-[#0d1617] transition-all hover:bg-[#edc16f] hover:gap-5" data-testid="button-hero-start">
                  Start with Deriv <MoveRight size={16} />
                </a>
                <a href="#method" className="group flex items-center gap-3 text-[11px] font-mono-brand uppercase tracking-[.15em] text-[#b1b8a9] hover:text-[#d9a64c]" data-testid="link-hero-method">
                  See how it works <span className="border-b border-[#53645f] pb-1 transition-colors group-hover:border-[#d9a64c]">02:14</span> <Play size={12} fill="currentColor" />
                </a>
              </div>
            </div>
            <div className="reveal reveal-delay-2 relative">
              <div className="border hairline bg-[#101d1e]/85 p-4 shadow-2xl shadow-[#071011]/60 md:p-5">
                <div className="flex items-center justify-between border-b hairline pb-4">
                  <div>
                    <p className="font-mono-brand text-[9px] uppercase tracking-[.18em] text-[#82908a]">Execution monitor</p>
                    <p className="mt-1 text-sm font-bold text-[#e6e3d7]">EUR / USD · 15m</p>
                  </div>
                  <span className="flex items-center gap-2 font-mono-brand text-[10px] text-[#7fc2a2]"><i className="h-1.5 w-1.5 rounded-full bg-[#7fc2a2]" /> Live</span>
                </div>
                <div className="relative mt-5 h-[245px] overflow-hidden bg-[#0c1819]">
                  <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(164,182,165,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(164,182,165,.08) 1px, transparent 1px)', backgroundSize: '44px 42px' }} />
                  <svg viewBox="0 0 600 245" className="relative h-full w-full" preserveAspectRatio="none" aria-label="Illustrative rising price chart">
                    <path d="M0 184 C24 187 31 159 57 169 S85 196 105 171 S128 153 144 162 S172 127 191 143 S223 113 242 126 S271 101 286 112 S312 128 334 99 S358 119 383 91 S414 103 432 76 S461 89 483 57 S512 78 533 45 S571 55 600 24" fill="none" stroke="#d9a64c" strokeWidth="2.5" className="chart-line" />
                    <path d="M0 184 C24 187 31 159 57 169 S85 196 105 171 S128 153 144 162 S172 127 191 143 S223 113 242 126 S271 101 286 112 S312 128 334 99 S358 119 383 91 S414 103 432 76 S461 89 483 57 S512 78 533 45 S571 55 600 24 V245 H0Z" fill="url(#area)" opacity=".18" />
                    <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9a64c" /><stop offset="1" stopColor="#d9a64c" stopOpacity="0" /></linearGradient></defs>
                    <circle cx="600" cy="24" r="5" fill="#d9a64c" />
                  </svg>
                  <div className="absolute right-3 top-3 bg-[#d9a64c] px-2 py-1 font-mono-brand text-[10px] text-[#0d1617]">1.0847</div>
                  <div className="absolute bottom-3 left-3 font-mono-brand text-[9px] text-[#6d817b]">08:00 &nbsp; 10:00 &nbsp; 12:00 &nbsp; 14:00</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div><span className="font-mono-brand text-[9px] uppercase text-[#71817a]">Bias</span><p className="mt-1 text-sm text-[#7fc2a2]">Long</p></div>
                  <div><span className="font-mono-brand text-[9px] uppercase text-[#71817a]">Risk</span><p className="mt-1 text-sm text-[#e6e3d7]">0.42%</p></div>
                  <div><span className="font-mono-brand text-[9px] uppercase text-[#71817a]">R multiple</span><p className="mt-1 text-sm text-[#d9a64c]">+2.1R</p></div>
                </div>
              </div>
              <div className="absolute -bottom-7 -left-4 border hairline bg-[#162526] px-4 py-3 md:-left-12">
                <p className="font-mono-brand text-[9px] uppercase tracking-[.16em] text-[#758680]">Rule adherence</p>
                <p className="mt-1 text-lg font-bold text-[#d9a64c]">92.8%</p>
              </div>
            </div>
          </div>
          <div className="mx-auto flex max-w-[1280px] items-center justify-between border-t hairline px-5 py-5 font-mono-brand text-[9px] uppercase tracking-[.16em] text-[#657670] md:px-10">
            <span>Built for the funded stage</span><span className="hidden sm:inline">No alerts. No predictions. Just process.</span><span>Scroll to inspect ↓</span>
          </div>
        </section>

        <section className="border-b hairline bg-[#101d1e]">
          <div className="mx-auto grid max-w-[1280px] grid-cols-2 divide-x divide-[#263536] md:grid-cols-4">
            {[
              ['4,816', 'traders in the desk'],
              ['68.4%', 'evaluation pass rate'],
              ['1.7M+', 'trades journaled'],
              ['24 / 7', 'process, not predictions'],
            ].map(([value, label], index) => (
              <div key={label} className={`px-5 py-8 md:px-10 md:py-10 ${index > 1 ? 'border-t hairline md:border-t-0' : ''}`} data-testid={`stat-${index}`}>
                <p className="font-mono-brand text-2xl tracking-[-.04em] text-[#d9a64c] md:text-3xl">{value}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[.12em] text-[#86948d]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="method" className="mx-auto max-w-[1280px] scroll-mt-20 px-5 py-24 md:px-10 md:py-36">
          <div className="grid gap-14 md:grid-cols-[.72fr_1.28fr]">
            <div>
              <p className="mb-5 font-mono-brand text-[10px] uppercase tracking-[.2em] text-[#d9a64c]">01 / The method</p>
              <h2 className="max-w-sm text-4xl font-extrabold leading-[.98] tracking-[-.06em] text-[#ebe8dc] md:text-6xl">Consistency is a competitive edge.</h2>
              <p className="mt-7 max-w-sm text-sm leading-6 text-[#8f9c94]">The market does not reward the most informed trader. It rewards the trader who can execute the same edge when the outcome is uncertain.</p>
              <a href="#path" className="mt-8 inline-flex items-center gap-3 border-b border-[#51605c] pb-2 font-mono-brand text-[10px] uppercase tracking-[.17em] text-[#d9a64c] hover:border-[#d9a64c]" data-testid="link-method-path">Follow the path <ArrowUpRight size={14} /></a>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [Crosshair, '01', 'Define your edge', 'Turn a vague strategy into clear conditions you can recognize, measure, and repeat.'],
                [ShieldCheck, '02', 'Protect the downside', 'Risk is a number before it is a feeling. Build guardrails that hold under pressure.'],
                [Activity, '03', 'Read the data', 'Your journal is a mirror. Review the decisions behind the trade, not just the result.'],
                [Target, '04', 'Earn the scale', 'Move through evaluation with the same discipline that keeps a funded account alive.'],
              ].map(([Icon, number, title, copy]) => (
                <article className="hover-lift border hairline p-6 md:p-7" key={number as string} data-testid={`method-card-${number}`}>
                  <div className="flex items-start justify-between"><Icon size={19} strokeWidth={1.5} className="text-[#d9a64c]" /><span className="font-mono-brand text-[10px] text-[#61736c]">{number as string}</span></div>
                  <h3 className="mt-12 text-base font-bold text-[#e6e3d7]">{title as string}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#899890]">{copy as string}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y hairline bg-[#d9a64c] text-[#101919]">
          <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-8 px-5 py-14 md:flex-row md:items-end md:px-10 md:py-20">
            <p className="max-w-3xl text-3xl font-extrabold leading-[1.03] tracking-[-.05em] md:text-6xl">A funded account is not<br className="hidden md:block" /> a finish line. It is a new standard.</p>
            <div className="max-w-xs md:pb-1"><p className="text-sm leading-6 text-[#51472e]">Trade smaller. Think longer. Let your process do the talking when the market gets loud.</p></div>
          </div>
        </section>

        <section id="path" className="mx-auto max-w-[1280px] scroll-mt-20 px-5 py-24 md:px-10 md:py-36">
          <div className="mb-16 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><p className="mb-5 font-mono-brand text-[10px] uppercase tracking-[.2em] text-[#d9a64c]">02 / The path</p><h2 className="text-4xl font-extrabold tracking-[-.06em] text-[#ebe8dc] md:text-6xl">From intent<br />to evidence.</h2></div>
            <p className="max-w-sm text-sm leading-6 text-[#8f9c94]">Four stages. One scorecard. No mystery about what to work on next.</p>
          </div>
          <div className="relative grid gap-0 md:grid-cols-4">
            <div className="absolute left-0 right-0 top-4 hidden h-px bg-[#334442] md:block" />
            {[
              ['01', 'Orient', 'Know your market, your session, and the one setup you are here to trade.'],
              ['02', 'Prove', 'Collect enough clean reps to separate a real edge from a good week.'],
              ['03', 'Perform', 'Enter evaluation with limits that make impulsive decisions expensive.'],
              ['04', 'Compound', 'Protect your funded allocation and scale only what the data earns.'],
            ].map(([number, title, copy], index) => (
              <div key={number} className="relative border-l hairline py-3 pl-6 pr-7 md:border-l-0 md:pl-0 md:pr-10" data-testid={`path-stage-${index}`}>
                <div className="relative z-10 flex h-8 w-8 items-center justify-center border border-[#d9a64c] bg-[#0d1617] font-mono-brand text-[10px] text-[#d9a64c]">{number}</div>
                <h3 className="mt-9 text-xl font-bold text-[#e6e3d7]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#899890]">{copy}</p>
                {index < 3 && <div className="my-7 h-8 w-px bg-[#334442] md:hidden" />}
              </div>
            ))}
          </div>
        </section>

        <section className="border-y hairline bg-[#101d1e]">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-24 md:grid-cols-[1.1fr_.9fr] md:items-center md:px-10 md:py-32">
            <div>
              <p className="mb-6 font-mono-brand text-[10px] uppercase tracking-[.2em] text-[#d9a64c]">Desk note / 047</p>
              <blockquote className="max-w-2xl text-3xl font-medium leading-[1.15] tracking-[-.04em] text-[#e8e5da] md:text-5xl">“I stopped looking for a strategy to save me. I started building a process I could trust.”</blockquote>
              <div className="mt-8 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center bg-[#d9a64c] text-xs font-bold text-[#0d1617]">NS</span><div><p className="text-xs font-bold text-[#d9e0d6]">Nadia S.</p><p className="font-mono-brand text-[9px] uppercase tracking-[.12em] text-[#71817a]">Funded trader · $100k allocation</p></div></div>
            </div>
            <div className="border hairline p-6 md:p-8">
              <div className="mb-6 flex items-center justify-between"><span className="font-mono-brand text-[10px] uppercase tracking-[.15em] text-[#82908a]">Weekly review</span><Clock3 size={17} className="text-[#d9a64c]" /></div>
              {[
                ['Rule adherence', '92.8%', 'up'],
                ['Average R', '1.84R', 'up'],
                ['Unplanned entries', '0', 'down'],
              ].map(([label, value, trend]) => <div key={label} className="flex items-center justify-between border-t hairline py-4"><span className="text-sm text-[#8f9c94]">{label}</span><span className={`font-mono-brand text-sm ${trend === 'down' ? 'text-[#7fc2a2]' : 'text-[#e6e3d7]'}`}>{value}</span></div>)}
              <div className="mt-5 flex items-center gap-2 border-t hairline pt-5 font-mono-brand text-[9px] uppercase tracking-[.14em] text-[#7fc2a2]"><Check size={13} /> Within your operating range</div>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-[850px] scroll-mt-20 px-5 py-24 md:py-32">
          <div className="mb-12 text-center"><p className="mb-5 font-mono-brand text-[10px] uppercase tracking-[.2em] text-[#d9a64c]">03 / Clear the noise</p><h2 className="text-4xl font-extrabold tracking-[-.06em] text-[#ebe8dc] md:text-5xl">Questions, answered.</h2></div>
          <div className="border-t hairline">
            {[
              ['Is ProTraders FX a signals service?', 'No. We do not send entries, alerts, or predictions. The desk is built around developing your own repeatable decision-making process.'],
              ['Who is this built for?', 'Traders preparing for an evaluation, traders already managing funded capital, and serious beginners who want to start with structure instead of shortcuts.'],
              ['How much time should I expect to put in?', 'The minimum effective dose is a focused pre-market plan and a short post-session review. The framework is designed to fit around your trading, not become another distraction.'],
              ['Can I join if I am still learning the basics?', 'Yes, if you are willing to practice deliberately. The path starts with clarity around your market and setup before it asks you to perform.'],
            ].map(([question, answer], index) => {
              const isOpen = openFaq === index;
              return <div key={question} className="border-b hairline" data-testid={`faq-item-${index}`}>
                <button onClick={() => setOpenFaq(isOpen ? null : index)} className="flex w-full items-center justify-between gap-5 py-6 text-left" aria-expanded={isOpen} data-testid={`button-faq-${index}`}>
                  <span className="text-sm font-semibold text-[#deded2] md:text-base">{question}</span><ChevronDown size={17} className={`shrink-0 text-[#d9a64c] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className="accordion-content" data-open={isOpen}><div className="accordion-inner"><p className="max-w-2xl pb-6 pr-8 text-sm leading-6 text-[#899890]">{answer}</p></div></div>
              </div>;
            })}
          </div>
        </section>

        <section id="start" className="scroll-mt-20 border-t hairline bg-[#172a29]">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-24 md:grid-cols-[1fr_.8fr] md:items-end md:px-10 md:py-32">
            <div><p className="mb-6 font-mono-brand text-[10px] uppercase tracking-[.2em] text-[#d9a64c]">04 / Your next session</p><h2 className="max-w-2xl text-5xl font-extrabold leading-[.94] tracking-[-.07em] text-[#eeeade] md:text-7xl">Trade with<br /><span className="text-[#d9a64c]">a reason.</span></h2><p className="mt-7 max-w-md text-sm leading-6 text-[#a1afa5]">Get the operating framework, weekly desk notes, and a clear first step. No hype in your inbox.</p></div>
              <div>
                {signupState === 'success' ? <div className="border border-[#7fc2a2]/50 bg-[#7fc2a2]/10 p-6" data-testid="status-signup-success"><Check className="mb-4 text-[#7fc2a2]" size={22} /><p className="font-bold text-[#dce8db]">You are on the desk list.</p><p className="mt-2 text-sm leading-6 text-[#93a69b]">Watch your inbox for the next pre-market note.</p></div> : <form onSubmit={handleSignup} className="flex flex-col gap-3" data-testid="form-signup"><label htmlFor="email" className="font-mono-brand text-[10px] uppercase tracking-[.14em] text-[#84958c]">Your best trading email</label><div className="flex flex-col gap-2 sm:flex-row"><input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@desk.com" className="min-h-[52px] flex-1 border hairline bg-[#0e1b1c] px-4 text-sm text-[#e6e3d7] outline-none placeholder:text-[#586a64] focus:border-[#d9a64c]" data-testid="input-email" /><button type="submit" className="group flex min-h-[52px] items-center justify-center gap-3 bg-[#d9a64c] px-5 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0d1617] hover:bg-[#edc16f]" data-testid="button-submit-email">Enter the desk <ArrowUpRight size={15} /></button></div><p className="mt-2 flex items-center gap-2 font-mono-brand text-[9px] uppercase tracking-[.1em] text-[#70837a]"><LockKeyhole size={12} /> One useful note. No noise.</p></form>}
                <p className="mt-5 max-w-md font-mono-brand text-[9px] uppercase leading-5 tracking-[.12em] text-[#71817a]">Partner disclosure: the Deriv link opens an external registration flow. ProTraders FX may receive a partner benefit if you register through it. Trading involves risk.</p>
              </div>
            </div>
        </section>
      </main>
      <footer className="border-t hairline bg-[#0d1617]">
        <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-5 px-5 py-8 md:flex-row md:items-center md:px-10">
          <p className="text-[11px] font-extrabold tracking-[.2em] text-[#d8d8ca]">PROTRADERS <span className="text-[#d9a64c]">FX</span></p>
          <p className="font-mono-brand text-[9px] uppercase tracking-[.15em] text-[#62736d]">For educational purposes. Trade responsibly.</p>
          <p className="font-mono-brand text-[9px] uppercase tracking-[.15em] text-[#62736d]">© 2024 ProTraders FX</p>
        </div>
      </footer>
    </div>
  );
}

function Router() {
  const SignInPage = () => (
    <AuthPage>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthPage>
  );
  const SignUpPage = () => (
    <AuthPage>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthPage>
  );

  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/account" component={Account} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0d1617] px-4 py-10">
      <div className="w-full max-w-[460px]">{children}</div>
    </div>
  );
}

function Account() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <AuthPage>
      <div className="border hairline bg-[#101d1e] p-8 text-[#e6e3d7]">
        <p className="font-mono-brand text-[10px] uppercase tracking-[.2em] text-[#d9a64c]">Member account</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-[-.05em]">Welcome back.</h1>
        <p className="mt-4 text-sm leading-6 text-[#9da9a0]">
          Signed in as {user?.primaryEmailAddress?.emailAddress ?? user?.username ?? 'member'}.
        </p>
        <div className="mt-8 flex gap-3">
          <a href={basePath || '/'} className="bg-[#d9a64c] px-4 py-3 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0d1617]">Back to desk</a>
          <button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="border hairline px-4 py-3 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#d9a64c]">Log out</button>
        </div>
      </div>
    </AuthPage>
  );
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={{
        theme: shadcn,
        cssLayerName: 'clerk',
        variables: {
          colorPrimary: '#d9a64c',
          colorForeground: '#e6e3d7',
          colorMutedForeground: '#9da9a0',
          colorBackground: '#101d1e',
          colorInput: '#0d1617',
          colorInputForeground: '#e6e3d7',
          colorNeutral: '#38504b',
          fontFamily: 'Manrope, sans-serif',
          borderRadius: '0px',
        },
        elements: {
          rootBox: 'w-full',
          cardBox: 'bg-[#101d1e] border border-[#38504b] rounded-none w-full max-w-[460px]',
          card: '!shadow-none !border-0 !bg-transparent',
          footer: '!shadow-none !border-0 !bg-transparent',
          formButtonPrimary: 'bg-[#d9a64c] text-[#0d1617] hover:bg-[#edc16f]',
          formFieldInput: 'bg-[#0d1617] border-[#38504b] text-[#e6e3d7]',
        },
      }}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Router />
    </ClerkProvider>
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
        <WouterRouter base={basePath}>
          <ClerkRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
