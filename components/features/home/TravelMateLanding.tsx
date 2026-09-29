'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CloudSun,
  Compass,
  Gauge,
  Hotel,
  LockKeyhole,
  MapPin,
  Menu,
  Route,
  ShieldCheck,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { ApiError, handleResponse } from '@/services/api.service';
import type { AuthActionResponse, CurrentUserResponse } from '@/lib/contracts';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import {
  getPasswordStrength,
  isStrongPassword,
  STRONG_PASSWORD_PATTERN,
  STRONG_PASSWORD_REQUIREMENTS,
} from '@/lib/password-validation';

gsap.registerPlugin(useGSAP, ScrollTrigger);

type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
type AuthRole = 'traveler' | 'owner';
type WorkflowRole = 'traveler' | 'host';

const travelerSteps = [
  ['Set the brief', 'Choose a destination, travel dates, budget, and interests.', '/cordova-cclex.png'],
  ['Shape the pace', 'Add your group size, travel style, and the experiences worth making time for.', '/cordova-mangrove.png'],
  ['Compare options', 'Review clearly sourced stays, flights, and activities when providers are available.', '/cordova-resort.png'],
  ['Build the days', 'Generate an itinerary that considers cost, timing, weather, and your preferences.', '/cordova-nalusuan.png'],
  ['Refine and save', 'Edit activities, monitor the budget, and return to the plan from your account.', '/cordova-10000-roses.png'],
] as const;

const hostSteps = [
  ['Create your profile', 'Open an owner account for a Cebu-based travel business.', '/solea-mactan.jpg'],
  ['Submit details', 'Complete the profile information needed for a transparent platform review.', '/cordova-resort.png'],
  ['Publish an offering', 'Describe the location, capacity, price, and experience travelers can expect.', '/cordova-seafood.png'],
  ['Manage availability', 'Keep listing details and traveler requests organized in one workspace.', '/cordova-nalusuan.png'],
  ['Earn confidence', 'Build trust through accurate information, visible status, and an auditable trail.', '/cordova-mangrove.png'],
] as const;

const exampleDays = [
  ['Mon', 'Arrival and orientation', 'Partly cloudy', '₱3,200'],
  ['Tue', 'Old town and food trail', 'Clear', '₱4,150'],
  ['Wed', 'Island nature day', 'Clear', '₱5,400'],
  ['Thu', 'Museum and café route', 'Rain watch', '₱2,850'],
  ['Fri', 'Regional day trip', 'Partly cloudy', '₱4,900'],
  ['Sat', 'Open exploration', 'Clear', '₱3,100'],
  ['Sun', 'Departure and reserve', 'Light rain', '₱1,600'],
] as const;

const comparisonRows = [
  ['One personalized planning flow', false, false, true],
  ['Day-by-day itinerary', true, false, true],
  ['Budget status and breakdown', false, false, true],
  ['Weather beside trip dates', false, true, true],
  ['Saved plan you can revisit', true, true, true],
  ['Live, test, and estimate labels', false, false, true],
] as const;

const faqs = [
  ['What does TravelMate generate?', 'TravelMate creates a structured day-by-day itinerary using your destination, dates, budget, interests, preferences, and available condition data.'],
  ['Are prices guaranteed?', 'No. Prices and activity costs are estimates unless a provider explicitly returns current availability. TravelMate labels provider and mock data so you can tell the difference.'],
  ['What happens when a travel provider is unavailable?', 'Your saved itinerary remains accessible. TravelMate explains that fresh pricing is unavailable instead of presenting old or mock results as live.'],
  ['Does TravelMate purchase flights or hotels?', 'No. TravelMate is a planning system. Provider results are availability references, not completed bookings.'],
  ['How are weather and crowd conditions handled?', 'Weather is matched to relevant dates when forecasts are available. Crowd information is shown only with a valid source; otherwise it is marked unavailable or estimated.'],
  ['Why do I need to verify my email?', 'Email verification protects account access and must be completed before login. Profile verification is separate and does not prevent itinerary planning.'],
] as const;

const planningPrinciples = [
  ['Every day earns its place.', 'A usable itinerary protects breathing room. TravelMate builds around realistic timing instead of packing every recommendation into the same afternoon.', 'Pace before volume'],
  ['The budget stays visible.', 'Estimated spend, category totals, and remaining budget stay close to the plan so a good idea does not quietly become an expensive one.', 'Clarity before commitment'],
  ['Uncertainty is named.', 'Weather windows, crowd estimates, provider results, and sample data are labeled for what they are. The plan should help you decide, not pretend to book.', 'Context before confidence'],
] as const;

const capabilityRail = ['Itinerary planning', 'Budget clarity', 'Flight comparison', 'Stay options', 'Weather context', 'Crowd estimates', 'Saved trips'];

async function auth(body: Record<string, unknown>) {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<AuthActionResponse>(response);
}

export default function TravelMateLanding() {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const authDialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [role, setRole] = useState<AuthRole>('traveler');
  const [workflowRole, setWorkflowRole] = useState<WorkflowRole>('traveler');
  const [activeStep, setActiveStep] = useState(0);
  const [principle, setPrinciple] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dashboardPath, setDashboardPath] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refreshSession = async () => {
      try {
        const response = await fetch('/api/auth', { cache: 'no-store' });
        if (!response.ok) {
          if (mounted) {
            setDashboardPath(null);
            setSessionChecked(true);
          }
          return;
        }
        const { user } = await handleResponse<CurrentUserResponse>(response);
        if (mounted) {
          setDashboardPath(user.role === 'admin' ? '/admin/dashboard' : user.role === 'owner' ? '/owner/dashboard' : '/dashboard');
          setSessionChecked(true);
        }
      } catch {
        if (mounted) {
          setDashboardPath(null);
          setSessionChecked(true);
        }
      }
    };
    const handlePageShow = () => { void refreshSession(); };

    void refreshSession();
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      mounted = false;
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const error = url.searchParams.get('auth_error');
    if (!error?.startsWith('oauth_') && error !== 'account_link_required' && error !== 'account_suspended') return;
    const messages: Record<string, string> = {
      oauth_cancelled: 'Google sign-in was cancelled. You can try again or use email and password.',
      oauth_state_invalid: 'Google sign-in expired or could not be verified. Please try again.',
      oauth_code_invalid: 'Google did not return a valid sign-in code. Please try again.',
      oauth_token_invalid: 'Google could not verify this sign-in. Please try again.',
      oauth_rate_limited: 'Too many Google sign-in attempts. Wait a minute and try again.',
      oauth_unavailable: 'Google sign-in was interrupted. Start a new sign-in attempt.',
      oauth_not_configured: 'Google sign-in has not been set up yet. Use email and password for now.',
      account_link_required: 'An account already uses this email. Sign in with your password first; Google cannot be linked automatically.',
      account_suspended: 'This account is suspended. Contact TravelMate support.',
    };
    url.searchParams.delete('auth_error');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    const timeout = window.setTimeout(() => {
      setMode('login');
      setMessage(messages[error] || 'Google sign-in failed. Please try again.');
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useModalAccessibility({
    active: open,
    containerRef: authDialogRef,
    initialFocusRef: closeButtonRef,
    onClose: () => setOpen(false),
  });

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.from('[data-hero-reveal]', {
      y: 36,
      opacity: 0,
      duration: 1.05,
      stagger: 0.12,
      ease: 'power3.out',
    });

    const media = gsap.matchMedia();
    media.add('(min-width: 1024px)', () => {
      ScrollTrigger.create({
        trigger: '#preview',
        start: 'top top+=110',
        end: 'bottom bottom-=120',
        pin: '.preview-copy',
        pinSpacing: false,
      });
    });

    gsap.utils.toArray<HTMLElement>('.stack-card').forEach((card, index) => {
      gsap.fromTo(card, { y: 72, scale: 0.94, opacity: 0.35 }, {
        y: 0,
        scale: 1,
        opacity: 1,
        ease: 'none',
        scrollTrigger: { trigger: card, start: 'top 88%', end: 'top 32%', scrub: 0.6 },
      });
      gsap.to(card, {
        scale: 1 - index * 0.012,
        scrollTrigger: { trigger: card, start: 'top 20%', end: 'bottom 8%', scrub: true },
      });
    });

    return () => media.revert();
  }, { scope: pageRef });

  const show = (nextMode: AuthMode) => {
    setMode(nextMode);
    if (nextMode === 'login') {
      setEmail('');
      setPassword('');
    }
    setMessage('');
    setMenu(false);
    setOpen(true);
  };

  const openAccount = () => {
    setMenu(false);
    if (dashboardPath) {
      router.push(dashboardPath);
      return;
    }
    show('login');
  };

  const startPlanning = () => {
    setMenu(false);
    if (dashboardPath) {
      router.push(dashboardPath === '/dashboard' ? '/dashboard?tab=planner' : dashboardPath);
      return;
    }
    show('register');
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if ((mode === 'register' || mode === 'reset') && !isStrongPassword(password)) {
      setMessage(STRONG_PASSWORD_REQUIREMENTS);
      return;
    }
    if ((mode === 'register' || mode === 'reset') && password !== confirmPassword) {
      setMessage('Passwords do not match. Re-enter the same password in both fields.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const data = await auth({ action: 'login', email, password, role });
        if (!data.redirect) throw new Error('Login succeeded but no dashboard route was returned.');
        setDashboardPath(data.redirect);
        setSessionChecked(true);
        router.push(data.redirect);
      } else if (mode === 'register') {
        const data = await auth({ action: 'register', name, email, password, role });
        setCode(data.verificationCode || '');
        setMode('verify');
        setMessage(data.message || 'Account created. Enter the development activation code to verify your email.');
      } else if (mode === 'verify') {
        const data = await auth({ action: 'verify-email', email, code });
        setMode('login');
        setCode('');
        setMessage(data.message || 'Email verified. You can now sign in.');
      } else if (mode === 'forgot') {
        const data = await auth({ action: 'forgot-password', email });
        setCode(data.resetCode || '');
        setMode('reset');
        setMessage(data.message || 'Check your email for a password reset code.');
      } else {
        const data = await auth({ action: 'reset-password', email, code, password });
        setMode('login');
        setCode('');
        setPassword('');
        setConfirmPassword('');
        setMessage(data.message || 'Password reset complete. Sign in with your new password.');
      }
    } catch (error) {
      if (mode === 'login' && error instanceof ApiError && error.status === 403 && /verify your email/i.test(error.message)) setMode('verify');
      setMessage(error instanceof Error ? error.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setBusy(true);
    setMessage('');
    try {
      const result = await auth({ action: 'resend-verification', email });
      setCode(result.verificationCode || '');
      setMessage(result.message || 'A new verification code has been issued.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Verification email could not be resent.');
    } finally {
      setBusy(false);
    }
  }

  const workflowSteps = workflowRole === 'traveler' ? travelerSteps : hostSteps;

  return (
    <div ref={pageRef} className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#f2efe6] font-sans text-[#142421] selection:bg-[#ffcf70] selection:text-[#142421]">
      <a href="#main-content" className="sr-only z-[100] bg-white px-4 py-2 text-[#142421] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>

      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex h-16 max-w-[1380px] items-center justify-between border border-white/15 bg-[#102824]/88 px-4 text-white shadow-[0_18px_50px_rgba(8,24,22,.22)] backdrop-blur-xl sm:px-6">
          <a href="#top" className="group flex items-center gap-3 font-semibold tracking-[-.02em]" aria-label="TravelMate home">
            <span className="grid size-9 place-items-center bg-[#ffcf70] text-[#102824] transition-transform duration-500 group-hover:-rotate-6"><Compass size={20} strokeWidth={2.2} /></span>
            <span className="text-lg">TravelMate</span>
          </a>
          <nav aria-label="Primary navigation" className="hidden items-center gap-8 text-sm text-white/70 lg:flex">
            <a className="transition-colors hover:text-white" href="#features">Why TravelMate</a>
            <a className="transition-colors hover:text-white" href="#workflow">How it works</a>
            <a className="transition-colors hover:text-white" href="#budget">Budget</a>
            <a className="transition-colors hover:text-white" href="#preview">Product</a>
            <a className="transition-colors hover:text-white" href="#faq">Questions</a>
          </nav>
          <div className="hidden items-center gap-1 md:flex">
            <button type="button" onClick={openAccount} disabled={!sessionChecked} aria-busy={!sessionChecked} title={sessionChecked ? undefined : 'Checking your session'} className="px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:cursor-wait">{dashboardPath || !sessionChecked ? 'Dashboard' : 'Sign in'}</button>
            <button type="button" onClick={startPlanning} className="bg-[#ffcf70] px-5 py-2.5 text-sm font-bold text-[#102824] hover:bg-[#ffe1a1]">Plan a trip</button>
          </div>
          <button type="button" aria-expanded={menu} aria-controls="mobile-navigation" aria-label={menu ? 'Close navigation' : 'Open navigation'} onClick={() => setMenu((current) => !current)} className="grid size-10 place-items-center border border-white/20 md:hidden">
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menu && (
          <nav id="mobile-navigation" aria-label="Mobile navigation" className="mx-auto max-w-[1380px] border-x border-b border-white/15 bg-[#102824] px-4 py-5 text-white shadow-2xl md:hidden">
            <div className="grid gap-1 text-sm font-semibold">
              {([['Why TravelMate', '#features'], ['How it works', '#workflow'], ['Budget', '#budget'], ['Product', '#preview'], ['Questions', '#faq']] as const).map(([label, href]) => <a key={href} href={href} onClick={() => setMenu(false)} className="border-b border-white/10 px-2 py-3 text-white/75 hover:text-white">{label}</a>)}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={openAccount} disabled={!sessionChecked} aria-busy={!sessionChecked} title={sessionChecked ? undefined : 'Checking your session'} className="border border-white/25 px-4 py-3 disabled:cursor-wait">{dashboardPath || !sessionChecked ? 'Dashboard' : 'Sign in'}</button>
                <button type="button" onClick={startPlanning} className="bg-[#ffcf70] px-4 py-3 font-bold text-[#102824]">Plan a trip</button>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" className="w-full max-w-full overflow-x-hidden">
        <section id="top" className="relative isolate flex min-h-[860px] items-center overflow-hidden px-5 pb-20 pt-32 text-white sm:px-8 lg:min-h-screen lg:pb-24 lg:pt-36">
          <Image src="/beach-bg.png" alt="" fill priority sizes="100vw" className="-z-30 object-cover object-center saturate-[.82]" />
          <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(5,24,22,.72)_0%,rgba(5,24,22,.34)_42%,rgba(5,24,22,.9)_100%)]" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,transparent_12%,rgba(4,20,18,.56)_78%)]" />
          <div className="mx-auto grid w-full max-w-[1380px] items-center gap-14 lg:grid-cols-[1.08fr_.92fr] lg:gap-20">
            <div>
              <p data-hero-reveal className="mb-7 flex items-center gap-3 text-xs font-bold uppercase tracking-[.16em] text-white/78"><span className="h-px w-8 bg-[#ffcf70]" />From trip idea to a plan you can use</p>
              <h1 data-hero-reveal aria-label="AI Travel Planning Made Real" className="max-w-4xl text-balance text-6xl font-semibold leading-[.88] tracking-[-.06em] sm:text-7xl lg:text-8xl">AI travel planning,<br /><span className="text-[#ffcf70]">made real.</span></h1>
              <p data-hero-reveal className="mt-8 max-w-xl text-pretty text-lg leading-8 text-white/78 sm:text-xl">Bring the destination, dates, budget, and interests. TravelMate turns them into a practical day-by-day itinerary with cost and condition context kept close.</p>
              <div data-hero-reveal className="mt-9 flex w-full max-w-md flex-col gap-3 sm:flex-row">
                <button type="button" onClick={startPlanning} className="group inline-flex min-h-13 items-center justify-center gap-2 bg-[#ffcf70] px-7 py-3.5 font-bold text-[#102824] hover:bg-[#ffe1a1]">Create my itinerary <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></button>
                <a href="#workflow" className="inline-flex min-h-13 items-center justify-center border border-white/45 bg-black/15 px-7 py-3.5 font-semibold text-white backdrop-blur-sm hover:bg-white hover:text-[#102824]">See the flow</a>
              </div>
            </div>
            <article data-hero-reveal className="relative mx-auto w-full max-w-lg border border-white/35 bg-[#102824]/78 p-4 text-white shadow-[0_28px_90px_rgba(3,19,17,.38)] backdrop-blur-xl sm:p-5 lg:max-w-none">
              <div className="flex items-center justify-between gap-4 border-b border-white/20 pb-4">
                <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ffcf70]">A trip, taking shape</p><h2 className="mt-1 text-lg font-semibold">One plan. Room to wander.</h2></div>
                <Compass size={23} className="shrink-0 text-[#ffcf70]" aria-hidden="true" />
              </div>
              <div className="relative mt-4 aspect-[1.7] overflow-hidden">
                <Image src="/cordova-nalusuan.png" alt="Clear water around Nalusuan Island in Cebu" fill sizes="(min-width: 1024px) 38vw, 90vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#081b18]/85 via-transparent to-transparent" />
                <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/72">Sample destination</p><p className="mt-1 text-2xl font-semibold">Nalusuan Island</p></div><MapPin size={20} className="mb-1 shrink-0 text-[#ffcf70]" aria-hidden="true" /></div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-white/20 pt-4 text-sm">
                <div className="pr-3"><span className="block text-[10px] font-medium uppercase tracking-[.12em] text-white/48">Built around</span><strong className="mt-1 block">Your dates</strong></div>
                <div className="px-3"><span className="block text-[10px] font-medium uppercase tracking-[.12em] text-white/48">Kept in view</span><strong className="mt-1 block">Your budget</strong></div>
                <div className="pl-3"><span className="block text-[10px] font-medium uppercase tracking-[.12em] text-white/48">Ready to</span><strong className="mt-1 block">Make yours</strong></div>
              </div>
              <p className="mt-4 border-t border-white/20 pt-3 text-xs text-white/55">A sample view · costs and conditions stay clearly labeled</p>
            </article>
          </div>
          <div className="absolute inset-x-5 bottom-7 mx-auto flex max-w-[1380px] items-end justify-between border-t border-white/25 pt-4 text-xs text-white/58 sm:inset-x-8">
            <span>Planning guidance, not a booking guarantee.</span><span className="hidden sm:block">Scroll to explore</span>
          </div>
        </section>

        <div className="overflow-hidden border-y border-[#142421]/10 bg-[#ffcf70] py-4" aria-label="TravelMate capabilities">
          <div className="travelmate-marquee flex w-max items-center gap-10 whitespace-nowrap pr-10 text-sm font-semibold uppercase tracking-[.12em] text-[#142421]">
            {[...capabilityRail, ...capabilityRail].map((item, index) => <span key={`${item}-${index}`} className="flex items-center gap-10"><span>{item}</span><span className="size-1.5 bg-[#142421]" aria-hidden="true" /></span>)}
          </div>
        </div>

        <section className="px-5 py-32 sm:px-8 md:py-44">
          <div className="mx-auto grid max-w-[1380px] gap-16 lg:grid-cols-[1.08fr_.92fr] lg:gap-24">
            <div><p className="text-sm font-medium text-[#4d625d]">Planning is still too fragmented</p><h2 className="mt-6 max-w-4xl text-balance text-5xl font-semibold leading-[.98] tracking-[-.055em] sm:text-6xl lg:text-7xl">A memorable trip should not begin with spreadsheet fatigue.</h2></div>
            <div className="self-end border-t border-[#142421]">
              {[
                ['Disconnected research', 'Flights, stays, activities, weather, and notes rarely live in one useful planning view.'],
                ['Invisible budget drift', 'A list of good ideas does not help when their combined cost no longer matches what you can spend.'],
                ['Too much choice, too little order', 'Search results still leave you to decide what fits each day, in what sequence, and under which conditions.'],
              ].map(([title, description]) => <div key={title} className="grid gap-3 border-b border-[#142421]/25 py-7 sm:grid-cols-[.72fr_1.28fr]"><h3 className="text-lg font-semibold">{title}</h3><p className="leading-7 text-[#4d625d]">{description}</p></div>)}
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 bg-[#0e2723] px-5 py-32 text-white sm:px-8 md:py-44">
          <div className="mx-auto max-w-[1380px]">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="max-w-4xl text-balance text-5xl font-semibold leading-[.96] tracking-[-.055em] sm:text-6xl lg:text-7xl">One plan, with the decisions that shape it kept together.</h2>
              <p className="max-w-md text-lg leading-8 text-white/60">TravelMate is a planning workspace, not a chatbot window. It connects preferences, travel information, budget, and conditions to a plan you can keep refining.</p>
            </div>
            <div className="mt-20 grid grid-flow-dense grid-cols-1 gap-px border border-white/15 bg-white/15 lg:grid-cols-12 lg:grid-rows-2">
              <article className="group relative min-h-[560px] overflow-hidden bg-[#d8e9df] text-[#142421] lg:col-span-7 lg:row-span-2">
                <Image src="/cordova-cclex.png" alt="Cebu bridge and coastal route" fill sizes="(min-width: 1024px) 58vw, 100vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_32%,rgba(9,30,27,.92)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 p-7 text-white sm:p-10"><Route size={28} className="mb-6 text-[#ffcf70]" /><h3 className="max-w-2xl text-4xl font-semibold tracking-[-.04em] sm:text-5xl">A day-by-day plan shaped around you.</h3><p className="mt-5 max-w-xl text-lg leading-8 text-white/72">Dates, interests, group size, travel style, timing, and known conditions become a structured itinerary instead of a generic checklist.</p></div>
              </article>
              <article className="group overflow-hidden bg-[#ffcf70] p-7 text-[#142421] sm:p-10 lg:col-span-5 lg:row-span-1">
                <WalletCards size={28} /><div className="mt-16 flex items-end justify-between gap-8"><div><h3 className="text-3xl font-semibold tracking-[-.035em]">Budget that stays readable.</h3><p className="mt-4 max-w-md leading-7 text-[#40524e]">See estimated spend, category totals, remaining budget, and explicit over-budget warnings.</p></div><span className="hidden text-6xl font-semibold tracking-[-.07em] sm:block">72%</span></div>
              </article>
              <article className="group overflow-hidden bg-[#e9e5da] p-7 text-[#142421] sm:p-10 lg:col-span-5 lg:row-span-1">
                <CloudSun size={28} /><div className="mt-16"><h3 className="text-3xl font-semibold tracking-[-.035em]">Conditions without false certainty.</h3><p className="mt-4 max-w-md leading-7 text-[#4d625d]">Forecasts appear only when covered by a provider. Crowd information is marked estimated, live, or unavailable.</p></div>
              </article>
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-24 px-5 py-32 sm:px-8 md:py-44">
          <div className="mx-auto max-w-[1380px]">
            <div className="flex flex-col gap-10 border-b border-[#142421]/25 pb-10 lg:flex-row lg:items-end lg:justify-between">
              <div><p className="text-sm font-medium text-[#4d625d]">Choose the path that fits</p><h2 className="mt-5 max-w-4xl text-balance text-5xl font-semibold leading-[.98] tracking-[-.055em] sm:text-6xl">A clear flow from first detail to useful action.</h2></div>
              <div className="grid grid-cols-2 border border-[#142421]" aria-label="Workflow audience">
                <button type="button" aria-pressed={workflowRole === 'traveler'} onClick={() => { setWorkflowRole('traveler'); setActiveStep(0); }} className={`px-5 py-3 text-sm font-semibold ${workflowRole === 'traveler' ? 'bg-[#142421] text-white' : 'hover:bg-[#142421]/5'}`}>Traveler flow</button>
                <button type="button" aria-pressed={workflowRole === 'host'} onClick={() => { setWorkflowRole('host'); setActiveStep(0); }} className={`border-l border-[#142421] px-5 py-3 text-sm font-semibold ${workflowRole === 'host' ? 'bg-[#142421] text-white' : 'hover:bg-[#142421]/5'}`}>Owner flow</button>
              </div>
            </div>
            <div className="mt-12 flex min-h-[620px] flex-col gap-2 md:h-[620px] md:flex-row" aria-label={`${workflowRole} workflow`}>
              {workflowSteps.map(([title, description, image], index) => {
                const active = index === activeStep;
                return (
                  <button key={`${workflowRole}-${title}`} type="button" aria-expanded={active} onClick={() => setActiveStep(index)} onFocus={() => setActiveStep(index)} onMouseEnter={() => setActiveStep(index)} className={`group relative min-h-24 overflow-hidden text-left transition-[flex] duration-700 ease-out md:min-h-0 ${active ? 'flex-[4]' : 'flex-1'}`}>
                    <Image src={image} alt="" fill sizes={active ? '(min-width: 768px) 55vw, 100vw' : '(min-width: 768px) 15vw, 100vw'} className="object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                    <div className={`absolute inset-0 transition-colors duration-500 ${active ? 'bg-[linear-gradient(180deg,rgba(6,25,22,.05),rgba(6,25,22,.9))]' : 'bg-[#102824]/72'}`} />
                    <div className="absolute inset-0 flex flex-col justify-end p-5 text-white sm:p-7">
                      <span className={`mb-4 h-px bg-[#ffcf70] transition-all duration-500 ${active ? 'w-14 opacity-100' : 'w-0 opacity-0'}`} />
                      <h3 className={`font-semibold tracking-[-.035em] transition-all duration-500 ${active ? 'text-3xl opacity-100 sm:text-4xl' : 'text-lg opacity-90 md:[writing-mode:vertical-rl] md:rotate-180'}`}>{title}</h3>
                      <p className={`mt-4 max-w-lg overflow-hidden leading-7 text-white/70 transition-all duration-500 ${active ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>{description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section id="budget" className="scroll-mt-24 bg-[#ffcf70] px-5 py-32 sm:px-8 md:py-44">
          <div className="mx-auto grid max-w-[1380px] gap-16 lg:grid-cols-[.8fr_1.2fr] lg:gap-24">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <p className="text-sm font-medium text-[#59615a]">Illustrative itinerary and estimated costs</p>
              <h2 className="mt-6 text-balance text-5xl font-semibold leading-[.96] tracking-[-.055em] sm:text-6xl lg:text-7xl">Know what the plan asks of your time and budget.</h2>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[#40524e]">TravelMate calculates the trip as a whole, then keeps each day inspectable. Provider prices are distinguished from planning estimates.</p>
              <div className="mt-10 grid grid-cols-2 border-y border-[#142421]/35 py-6"><div><span className="block text-sm text-[#59615a]">Trip budget</span><strong className="mt-2 block text-3xl font-semibold">₱32,000</strong></div><div className="border-l border-[#142421]/30 pl-6"><span className="block text-sm text-[#59615a]">Estimated reserve</span><strong className="mt-2 block text-3xl font-semibold">₱6,800</strong></div></div>
            </div>
            <div className="border-t border-[#142421]">
              {exampleDays.map(([day, title, weather, cost], index) => (
                <article key={day} className="stack-card sticky border-b border-[#142421]/35 bg-[#ffcf70] py-7" style={{ top: `${96 + index * 8}px` }}>
                  <div className="grid items-center gap-4 sm:grid-cols-[72px_1fr_150px_100px]"><span className="font-medium text-[#59615a]">{day}</span><div><h3 className="text-xl font-semibold">{title}</h3><p className="mt-1 text-sm text-[#59615a]">Day {index + 1} of the sample plan</p></div><span className="flex items-center gap-2 text-sm"><CloudSun size={17} />{weather}</span><strong className="text-right text-lg">{cost}</strong></div>
                </article>
              ))}
              <div className="flex items-center justify-between border-b border-[#142421] py-8 text-lg"><span className="font-medium">Estimated planned spend</span><strong className="text-3xl">₱25,200</strong></div>
            </div>
          </div>
        </section>

        <section className="bg-[#102824] px-5 py-32 text-white sm:px-8 md:py-44">
          <div className="mx-auto max-w-[1380px]">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:items-end"><h2 className="max-w-4xl text-balance text-5xl font-semibold leading-[.96] tracking-[-.055em] sm:text-6xl lg:text-7xl">Useful travel guidance starts with honest context.</h2><p className="max-w-xl text-lg leading-8 text-white/62">The system keeps uncertainty visible instead of quietly turning estimates into facts. You stay in control of edits, regeneration, and every decision that follows.</p></div>
            <div className="mt-20 grid border-y border-white/20 md:grid-cols-3">
              {[
                [ShieldCheck, 'Your plan remains yours', 'Manual itinerary edits are not overwritten without a deliberate regeneration action.'],
                [Gauge, 'Estimates stay labeled', 'Sample, estimated, stale, unavailable, and provider-returned information are presented differently.'],
                [LockKeyhole, 'Accounts are protected', 'Email verification, secure sessions, role checks, and ownership rules protect trip access.'],
              ].map(([Icon, title, description], index) => (
                <article key={String(title)} className={`py-10 md:px-8 ${index > 0 ? 'border-t border-white/20 md:border-l md:border-t-0' : ''}`}><Icon size={27} className="text-[#ffcf70]" /><h3 className="mt-12 text-2xl font-semibold">{String(title)}</h3><p className="mt-4 leading-7 text-white/58">{String(description)}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-32 sm:px-8 md:py-44">
          <div className="mx-auto max-w-[1180px]">
            <div className="text-center"><p className="text-sm font-medium text-[#4d625d]">One workspace instead of another tab</p><h2 className="mx-auto mt-5 max-w-4xl text-balance text-5xl font-semibold leading-[.98] tracking-[-.055em] sm:text-6xl">See what changes when the plan is the product.</h2></div>
            <div className="mt-16 overflow-x-auto border-y border-[#142421]">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <caption className="sr-only">TravelMate feature comparison</caption>
                <thead><tr className="border-b border-[#142421]/30"><th className="py-5 pr-5 font-medium">Planning capability</th><th className="px-5 py-5 text-center font-medium">Notes app</th><th className="px-5 py-5 text-center font-medium">Search tabs</th><th className="bg-[#102824] px-5 py-5 text-center font-semibold text-white">TravelMate</th></tr></thead>
                <tbody>{comparisonRows.map(([label, notes, search, travelmate]) => <tr key={label as string} className="border-b border-[#142421]/18 last:border-0"><th scope="row" className="py-5 pr-5 font-medium">{label}</th>{[notes, search].map((value, index) => <td key={index} className="px-5 py-5 text-center text-[#62736f]">{value ? <Check className="mx-auto" size={18} aria-label="Included" /> : <span aria-label="Not included">—</span>}</td>)}<td className="bg-[#102824] px-5 py-5 text-center text-[#ffcf70]">{travelmate && <Check className="mx-auto" size={19} aria-label="Included" />}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="preview" className="scroll-mt-24 bg-[#d9e5dd] px-5 py-32 sm:px-8 md:py-44 lg:min-h-[1900px]">
          <div className="mx-auto grid max-w-[1380px] gap-16 lg:grid-cols-[.68fr_1.32fr] lg:gap-24">
            <div className="preview-copy self-start">
              <p className="text-sm font-medium text-[#4d625d]">The trip remains the context</p>
              <h2 className="mt-6 text-balance text-5xl font-semibold leading-[.96] tracking-[-.055em] sm:text-6xl">Move between details without losing the plan.</h2>
              <p className="mt-7 max-w-lg text-lg leading-8 text-[#4d625d]">Itinerary, budget, travel options, conditions, and saved trips stay connected to the same trip record.</p>
              <button type="button" onClick={startPlanning} className="group mt-9 inline-flex items-center gap-3 border-b border-[#142421] pb-2 font-semibold">Build your first plan <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></button>
            </div>
            <div className="space-y-28 lg:pt-8">
              <PreviewCard image="/cordova-mangrove.png" alt="Mangrove boardwalk in Cordova" dark={false} title="A calm first day, with room to arrive.">
                <div className="mt-10 space-y-5">{[['09:30', 'Check in and settle'], ['13:00', 'Riverside lunch'], ['16:30', 'Old town walk']].map(([time, label]) => <div key={time} className="grid grid-cols-[70px_1fr] border-t border-[#142421]/15 pt-4"><span className="text-sm text-[#62736f]">{time}</span><strong>{label}</strong></div>)}</div>
              </PreviewCard>
              <PreviewCard image="/cordova-seafood.png" alt="Local seafood dining experience" dark title="Cost belongs beside the choice.">
                <div className="mt-10 border-y border-white/20 py-6"><div className="flex justify-between"><span className="text-white/55">Planned</span><strong>₱25,200</strong></div><div className="mt-4 flex justify-between"><span className="text-white/55">Remaining</span><strong className="text-[#ffcf70]">₱6,800</strong></div></div><p className="mt-6 leading-7 text-white/58">Each edit recalculates day and trip totals so the budget story stays current.</p>
              </PreviewCard>
              <PreviewCard image="/cordova-nalusuan.png" alt="Clear water around Nalusuan Island" dark={false} title="Conditions appear where they matter." warm>
                <p className="mt-6 max-w-md leading-7 text-[#40524e]">A weather window can inform an outdoor activity without being mistaken for a guarantee. Crowd estimates retain their source and confidence.</p><div className="mt-10 border-t border-[#142421]/30 pt-6 text-sm"><strong>Rain watch on Thursday</strong><p className="mt-2 text-[#59615a]">Consider moving the museum visit earlier.</p></div>
              </PreviewCard>
            </div>
          </div>
        </section>

        <section className="px-5 py-32 sm:px-8 md:py-44">
          <div className="mx-auto max-w-[1180px]">
            <div className="grid gap-12 lg:grid-cols-[.45fr_1.55fr]">
              <div><p className="text-sm font-medium text-[#4d625d]">What a useful plan should do</p><div className="mt-8 flex gap-2"><button type="button" onClick={() => setPrinciple((current) => (current + planningPrinciples.length - 1) % planningPrinciples.length)} aria-label="Previous principle" className="grid size-12 place-items-center border border-[#142421] hover:bg-[#142421] hover:text-white"><ArrowLeft size={18} /></button><button type="button" onClick={() => setPrinciple((current) => (current + 1) % planningPrinciples.length)} aria-label="Next principle" className="grid size-12 place-items-center border border-[#142421] hover:bg-[#142421] hover:text-white"><ArrowRight size={18} /></button></div></div>
              <div aria-live="polite"><blockquote className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-.055em] sm:text-6xl">“{planningPrinciples[principle][0]}”</blockquote><p className="mt-8 max-w-3xl text-xl leading-9 text-[#4d625d]">{planningPrinciples[principle][1]}</p><p className="mt-10 border-t border-[#142421]/25 pt-5 text-sm font-semibold">{planningPrinciples[principle][2]}</p></div>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 bg-[#102824] px-5 py-32 text-white sm:px-8 md:py-44">
          <div className="mx-auto grid max-w-[1180px] gap-16 lg:grid-cols-[.72fr_1.28fr]">
            <div><p className="text-sm font-medium text-white/50">Before you begin</p><h2 className="mt-6 text-5xl font-semibold leading-[.98] tracking-[-.055em] sm:text-6xl">Questions worth answering clearly.</h2></div>
            <div className="border-t border-white/30">{faqs.map(([question, answer]) => <details key={question} className="group border-b border-white/20"><summary className="flex list-none items-center justify-between gap-6 py-7 text-left text-lg font-semibold marker:content-none"><span>{question}</span><ChevronDown size={19} className="shrink-0 transition-transform duration-300 group-open:rotate-180" /></summary><p className="max-w-2xl pb-7 pr-10 leading-7 text-white/58">{answer}</p></details>)}</div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2">
          <article className="bg-[#ffcf70] px-5 py-24 text-[#142421] sm:px-8 sm:py-28 lg:px-[max(2rem,calc((100vw-1380px)/2))] lg:pr-16">
            <Users size={29} /><h2 className="mt-16 max-w-xl text-5xl font-semibold leading-[.96] tracking-[-.055em] sm:text-6xl">Bring the trip you have in mind.</h2><p className="mt-6 max-w-lg text-lg leading-8 text-[#40524e]">Start with your destination, dates, budget, and interests. TravelMate will help organize the rest.</p><button type="button" onClick={() => { setRole('traveler'); show('register'); }} className="group mt-9 inline-flex items-center gap-3 bg-[#102824] px-6 py-3.5 font-semibold text-white">Create traveler account <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></button>
          </article>
          <article className="bg-[#d9e5dd] px-5 py-24 text-[#142421] sm:px-8 sm:py-28 lg:px-16">
            <Hotel size={29} /><h2 className="mt-16 max-w-xl text-5xl font-semibold leading-[.96] tracking-[-.055em] sm:text-6xl">Put a better local option on the map.</h2><p className="mt-6 max-w-lg text-lg leading-8 text-[#40524e]">Create an owner profile and manage approved Cebu listings from a focused workspace.</p><button type="button" onClick={() => { setRole('owner'); show('register'); }} className="group mt-9 inline-flex items-center gap-3 border border-[#142421] px-6 py-3.5 font-semibold hover:bg-[#142421] hover:text-white">Create owner account <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></button>
          </article>
        </section>
      </main>

      <footer className="bg-[#081b18] px-5 py-12 text-white sm:px-8">
        <div className="mx-auto max-w-[1380px]">
          <div className="flex flex-col gap-10 sm:flex-row sm:items-end sm:justify-between"><div><a href="#top" className="flex items-center gap-3 text-lg font-semibold"><span className="grid size-9 place-items-center bg-[#ffcf70] text-[#102824]"><Compass size={19} /></span>TravelMate</a><p className="mt-5 max-w-md text-sm leading-6 text-white/45">AI-powered itinerary planning, budget estimates, clearly sourced travel options, and saved-trip management in one system.</p></div><div className="flex flex-wrap gap-x-7 gap-y-3 text-sm text-white/58"><a href="#features" className="hover:text-white">Why TravelMate</a><a href="#workflow" className="hover:text-white">How it works</a><a href="#faq" className="hover:text-white">Questions</a><button type="button" onClick={() => show('login')} className="hover:text-white">Sign in</button></div></div>
          <div className="mt-10 flex flex-col gap-2 border-t border-white/12 pt-6 text-xs text-white/35 sm:flex-row sm:justify-between"><span>© 2026 TravelMate. Capstone project.</span><span>Planning guidance, not a guarantee of price or availability.</span></div>
        </div>
      </footer>

      {open && <AuthDialog mode={mode} setMode={setMode} role={role} setRole={setRole} email={email} setEmail={setEmail} password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} name={name} setName={setName} code={code} setCode={setCode} message={message} busy={busy} onSubmit={submit} onResendVerification={() => void resendVerification()} onClose={() => setOpen(false)} containerRef={authDialogRef} closeButtonRef={closeButtonRef} />}
    </div>
  );
}

function PreviewCard({ image, alt, dark, warm = false, title, children }: { image: string; alt: string; dark: boolean; warm?: boolean; title: string; children: React.ReactNode }) {
  return (
    <article className={`group overflow-hidden shadow-[0_35px_90px_rgba(20,36,33,.16)] ${dark ? 'bg-[#102824] text-white' : warm ? 'bg-[#ffcf70]' : 'bg-[#f5f2e9]'}`}>
      <div className="grid min-h-[540px] lg:grid-cols-[1fr_1fr]">
        <div className={`p-7 sm:p-10 ${dark ? 'lg:order-2' : ''}`}><h3 className="mt-6 text-4xl font-semibold tracking-[-.045em]">{title}</h3>{children}</div>
        <div className={`relative min-h-[340px] overflow-hidden ${dark ? 'lg:order-1' : ''}`}><Image src={image} alt={alt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-105" /></div>
      </div>
    </article>
  );
}

type AuthDialogProps = {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  role: AuthRole;
  setRole: (role: AuthRole) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  message: string;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResendVerification: () => void;
  onClose: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
};

function AuthDialog({ mode, setMode, role, setRole, email, setEmail, password, setPassword, confirmPassword, setConfirmPassword, name, setName, code, setCode, message, busy, onSubmit, onResendVerification, onClose, containerRef, closeButtonRef }: AuthDialogProps) {
  const title = mode === 'login' ? 'Welcome back.' : mode === 'register' ? 'Make room for the trip.' : mode === 'verify' ? 'Verify your email.' : mode === 'forgot' ? 'Recover your account.' : 'Choose a new password.';
  const description = mode === 'login' ? 'Return to your saved plans and pick up where you left off.' : mode === 'register' ? 'Create an account to generate, edit, and save a trip plan.' : mode === 'verify' ? 'Enter the single-use code sent to your email address.' : mode === 'forgot' ? 'Enter your verified account email to request a short-lived reset code.' : `Enter the reset code issued for ${email} and choose a strong new password.`;
  const submitLabel = busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'verify' ? 'Verify email' : mode === 'forgot' ? 'Send reset code' : 'Reset password';
  const strength = getPasswordStrength(password);
  const strengthIndicator = {
    empty: { label: 'Start typing', segments: 0, bar: 'bg-[#d8d8d0]', text: 'text-[#71807c]' },
    weak: { label: 'Weak', segments: 1, bar: 'bg-[#b54537]', text: 'text-[#9f3025]' },
    medium: { label: 'Getting stronger', segments: 2, bar: 'bg-[#c18417]', text: 'text-[#8f6211]' },
    strong: { label: 'Strong', segments: 3, bar: 'bg-[#16745f]', text: 'text-[#12624f]' },
  }[strength];
  const inputClass = 'mt-2 w-full border border-[#142421]/22 bg-white px-4 py-3.5 font-normal text-[#142421] outline-none placeholder:text-[#7b8985] focus:border-[#142421] focus:ring-2 focus:ring-[#ffcf70]';

  return (
    <div ref={containerRef} className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#061714]/90 p-3 backdrop-blur-md sm:p-6" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" aria-describedby="auth-dialog-description" onMouseDown={(event) => event.stopPropagation()} className="relative my-4 grid max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto bg-[#f2efe6] text-[#142421] shadow-[0_35px_120px_rgba(0,0,0,.45)] lg:grid-cols-[.88fr_1.12fr]">
        <div className="relative hidden min-h-[720px] overflow-hidden lg:block">
          <Image src="/mountain-hero-bg.png" alt="Mountain landscape at dusk" fill sizes="40vw" className="object-cover transition-transform duration-700 ease-out hover:scale-105" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,20,18,.18),rgba(4,20,18,.88))]" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-white"><Compass size={28} className="text-[#ffcf70]" /><p className="mt-12 text-4xl font-semibold leading-[1.02] tracking-[-.045em]">Your plan stays useful because it stays yours.</p><ul className="mt-8 space-y-4 border-t border-white/25 pt-6 text-sm text-white/68"><li className="flex items-center gap-3"><Check size={17} className="text-[#ffcf70]" />Reopen saved trips from any signed-in session</li><li className="flex items-center gap-3"><Check size={17} className="text-[#ffcf70]" />Edit individual itinerary activities</li><li className="flex items-center gap-3"><Check size={17} className="text-[#ffcf70]" />Keep budget and condition context attached</li></ul></div>
        </div>
        <div className="relative p-6 sm:p-10 lg:p-12">
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close account dialog" className="absolute right-5 top-5 grid size-11 place-items-center border border-[#142421]/20 hover:bg-[#142421] hover:text-white"><X size={19} /></button>
          <a href="#top" className="inline-flex items-center gap-3 font-semibold" onClick={onClose}><span className="grid size-9 place-items-center bg-[#ffcf70]"><Compass size={19} /></span>TravelMate</a>
          <h2 id="auth-dialog-title" className="mt-12 max-w-md pr-10 text-5xl font-semibold leading-[.98] tracking-[-.055em]">{title}</h2>
          <p id="auth-dialog-description" className="mt-5 max-w-md leading-7 text-[#596b66]">{description}</p>
          {message && <p role="status" aria-live="polite" className="mt-6 border-l-2 border-[#b6780d] bg-[#ffcf70]/35 p-4 text-sm leading-6">{message}</p>}
          <form onSubmit={onSubmit} autoComplete="on" className="mt-8 space-y-5">
            {mode === 'login' && <><div><a href="/api/auth/oauth/google" className="flex min-h-12 w-full items-center justify-center gap-3 border border-[#142421]/25 bg-white px-5 py-3.5 font-semibold transition hover:border-[#142421] hover:bg-[#faf8f1]"><span aria-hidden="true" className="grid size-7 place-items-center rounded-full border border-[#142421]/15 font-bold text-[#4285f4]">G</span>Continue with Google</a><p className="mt-2 text-xs text-[#71807c]">Google uses your saved account role. New Google accounts start as travelers.</p></div><div className="flex items-center gap-3 text-xs text-[#71807c]"><span className="h-px flex-1 bg-[#142421]/15"/><span>or use email and password</span><span className="h-px flex-1 bg-[#142421]/15"/></div></>}
            {mode === 'login' && <fieldset><legend className="mb-3 text-sm font-semibold">Sign in as</legend><div className="grid grid-cols-2 border border-[#142421]"><button type="button" aria-pressed={role === 'traveler'} onClick={() => setRole('traveler')} className={`px-3 py-3.5 text-sm font-semibold ${role === 'traveler' ? 'bg-[#142421] text-white' : 'hover:bg-[#142421]/5'}`}>Traveler</button><button type="button" aria-pressed={role === 'owner'} onClick={() => setRole('owner')} className={`border-l border-[#142421] px-3 py-3.5 text-sm font-semibold ${role === 'owner' ? 'bg-[#142421] text-white' : 'hover:bg-[#142421]/5'}`}>Owner</button></div></fieldset>}
            {mode === 'register' && <>
              <fieldset><legend className="mb-3 text-sm font-semibold">I am creating an account as</legend><div className="grid grid-cols-2 border border-[#142421]"><button type="button" aria-pressed={role === 'traveler'} onClick={() => setRole('traveler')} className={`px-3 py-3.5 text-sm font-semibold ${role === 'traveler' ? 'bg-[#142421] text-white' : 'hover:bg-[#142421]/5'}`}>Traveler</button><button type="button" aria-pressed={role === 'owner'} onClick={() => setRole('owner')} className={`border-l border-[#142421] px-3 py-3.5 text-sm font-semibold ${role === 'owner' ? 'bg-[#142421] text-white' : 'hover:bg-[#142421]/5'}`}>Property owner</button></div></fieldset>
              <label className="block text-sm font-semibold" htmlFor="auth-name">Full name<input id="auth-name" required minLength={2} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Your name" /></label>
            </>}
            {(mode === 'login' || mode === 'register' || mode === 'forgot') && <label className="block text-sm font-semibold" htmlFor="auth-email">Email address<input id="auth-email" name="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="you@example.com" /></label>}
            {(mode === 'verify' || mode === 'reset') && <label className="block text-sm font-semibold" htmlFor="auth-code">{mode === 'verify' ? 'Verification code' : 'Password reset code'}<input id="auth-code" required minLength={mode === 'verify' ? 6 : 8} maxLength={8} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className={`${inputClass} font-mono text-lg uppercase tracking-[.2em]`} placeholder="A1B2C3D4" /></label>}
            {mode === 'login' && <label className="block text-sm font-semibold" htmlFor="auth-password">Password<input id="auth-password" name="password" required type="password" minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} placeholder="At least 8 characters" /></label>}
            {(mode === 'register' || mode === 'reset') && <>
              <label className="block text-sm font-semibold" htmlFor="auth-password">Password<input id="auth-password" required type="password" minLength={8} maxLength={64} pattern={STRONG_PASSWORD_PATTERN.source} autoComplete="new-password" aria-describedby="auth-password-strength auth-password-requirements" aria-invalid={password.length > 0 && !isStrongPassword(password)} value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} ${password.length > 0 && !isStrongPassword(password) ? 'border-[#b54537]' : ''}`} placeholder="Create a strong password" title={STRONG_PASSWORD_REQUIREMENTS} /></label>
              <div id="auth-password-strength" role="status" aria-live="polite" aria-label={`Password strength: ${strengthIndicator.label}`} className="-mt-2 space-y-2"><div className="flex items-center justify-between text-xs"><span className="font-medium text-[#71807c]">Password strength</span><span className={`font-semibold ${strengthIndicator.text}`}>{strengthIndicator.label}</span></div><div className="grid grid-cols-3 gap-1.5" aria-hidden="true">{[1, 2, 3].map((segment) => <span key={segment} className={`h-1.5 ${segment <= strengthIndicator.segments ? strengthIndicator.bar : 'bg-[#d8d8d0]'}`} />)}</div></div>
              <p id="auth-password-requirements" className="-mt-2 text-xs leading-5 text-[#71807c]">{STRONG_PASSWORD_REQUIREMENTS}</p>
              <label className="block text-sm font-semibold" htmlFor="auth-confirm-password">Confirm password<input id="auth-confirm-password" required type="password" minLength={8} maxLength={64} autoComplete="new-password" aria-describedby="auth-confirm-password-message" aria-invalid={confirmPassword.length > 0 && password !== confirmPassword} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} placeholder="Re-enter your password" /></label>
              <p id="auth-confirm-password-message" aria-live="polite" className={`-mt-2 text-xs ${confirmPassword.length > 0 && password !== confirmPassword ? 'text-[#9f3025]' : 'text-[#71807c]'}`}>{confirmPassword.length > 0 && password !== confirmPassword ? 'Passwords do not match.' : 'Enter the same password again.'}</p>
            </>}
            <button disabled={busy} className="mt-2 inline-flex w-full items-center justify-center gap-2 bg-[#142421] px-5 py-4 font-semibold text-white hover:bg-[#23423c] disabled:cursor-wait disabled:opacity-55">{submitLabel}<ArrowRight size={18} /></button>
            {mode === 'verify' && <button disabled={busy || !email} type="button" onClick={onResendVerification} className="w-full border border-[#142421]/25 px-5 py-3 text-sm font-semibold text-[#405a53] hover:border-[#142421] hover:text-[#142421] disabled:opacity-50">Resend verification code</button>}
          </form>
          <div className="mt-6 flex items-center justify-between gap-3 text-sm font-semibold"><button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="border-b border-[#142421] pb-1">{mode === 'login' ? 'Create an account' : 'Back to sign in'}</button>{mode === 'login' && <button type="button" onClick={() => setMode('forgot')} className="text-[#596b66] hover:text-[#142421]">Forgot password?</button>}</div>
        </div>
      </section>
    </div>
  );
}
