'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bot,
  CalendarRange,
  Check,
  ChevronDown,
  CloudSun,
  Compass,
  Gauge,
  Hotel,
  Layers3,
  LockKeyhole,
  MapPinned,
  Menu,
  PlaneTakeoff,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { handleResponse } from '@/lib/apiService';

type AuthMode = 'login' | 'register' | 'verify' | 'forgot';
type AuthRole = 'traveler' | 'owner';

const travelerSteps = [
  ['Tell us the essentials', 'Choose a destination, travel dates, budget, and interests.'],
  ['Shape your preferences', 'Add your travel style, group size, and the experiences you care about.'],
  ['Compare useful options', 'Review owner-listed stays, estimated local costs, and Amadeus hotel offers when that provider is configured.'],
  ['Generate your itinerary', 'TravelMate combines your brief, budget, and conditions into a practical day-by-day plan.'],
  ['Adjust and save', 'Refine the plan, monitor costs, and keep the trip available from your account.'],
] as const;

const hostSteps = [
  ['Create an owner account', 'Set up an owner account for your Cebu-based travel business.'],
  ['Complete verification', 'Submit the profile details needed for platform review.'],
  ['Publish your offering', 'Describe your stay or activity, pricing, location, and capacity.'],
  ['Manage availability', 'Keep listing information and traveler requests organized in one workspace.'],
  ['Build traveler trust', 'Use transparent status updates and an auditable activity trail.'],
] as const;

const problemCards: Array<{ icon: LucideIcon; title: string; description: string }> = [
  { icon: Layers3, title: 'Too many disconnected tabs', description: 'Flights, stays, activities, weather, and notes rarely live in one useful planning view.' },
  { icon: WalletCards, title: 'Budgets drift quickly', description: 'A list of ideas is not enough when the combined cost no longer matches what you can spend.' },
  { icon: Route, title: 'Recommendations lack structure', description: 'Search results still leave you to decide what fits each day, in what order, and under which conditions.' },
];

const featureCards: Array<{ icon: LucideIcon; title: string; description: string; className: string; label: string }> = [
  { icon: WandSparkles, title: 'A plan built around you', description: 'Generate a structured itinerary from your destination, dates, interests, group, and travel style—not a generic city checklist.', className: 'lg:col-span-2 bg-[#0d2929] text-white', label: 'Personalized AI' },
  { icon: Gauge, title: 'Budget-aware by design', description: 'See estimated spend, category breakdowns, remaining budget, and clear over-budget warnings.', className: 'bg-[#f4c765] text-[#142423]', label: 'Cost clarity' },
  { icon: PlaneTakeoff, title: 'Comparable travel options', description: 'Provider results are normalized so source, price, and freshness remain understandable.', className: 'bg-white text-slate-950', label: 'Travel data' },
  { icon: CloudSun, title: 'Conditions in context', description: 'Weather appears only for dates covered by the provider. Crowd levels are explicitly labeled as calendar-based estimates, not live foot traffic.', className: 'lg:col-span-2 bg-[#dcefeb] text-slate-950', label: 'Weather & crowds' },
];

const exampleDays = [
  ['01', 'Arrival & orientation', 'Partly cloudy', '₱3,200'],
  ['02', 'Old town & food trail', 'Clear', '₱4,150'],
  ['03', 'Island nature day', 'Clear', '₱5,400'],
  ['04', 'Museum & café route', 'Rain watch', '₱2,850'],
  ['05', 'Regional day trip', 'Partly cloudy', '₱4,900'],
  ['06', 'Open exploration', 'Clear', '₱3,100'],
  ['07', 'Departure & reserve', 'Light rain', '₱1,600'],
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
  ['What happens when a travel provider is unavailable?', 'Your saved itinerary remains accessible. TravelMate explains that fresh pricing is temporarily unavailable instead of presenting old or mock results as live.'],
  ['Does TravelMate purchase flights or hotels?', 'No. Flight search and online payment are not currently integrated. TravelMate is a planning system; configured Amadeus hotel results are availability references, not completed bookings.'],
  ['How are weather and crowd conditions handled?', 'Weather is matched to relevant dates when forecasts are available. Crowd information is displayed only with a valid source; otherwise it is clearly marked unavailable or estimated.'],
  ['Why do I need to verify my email?', 'Email verification protects account access and must be completed before login. Profile verification is separate and does not prevent itinerary planning.'],
] as const;

async function auth(body: Record<string, unknown>) {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<{ user?: { role?: string }; redirect?: string; verificationCode?: string; message?: string }>(response);
}

export default function TravelMateLanding() {
  const router = useRouter();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [role, setRole] = useState<AuthRole>('traveler');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open]);

  const show = (nextMode: AuthMode) => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMode(nextMode);
    setMessage('');
    setMenu(false);
    setOpen(true);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'login') {
        const data = await auth({ action: 'login', email, password });
        if (!data.redirect) throw new Error('Login succeeded but no dashboard route was returned.');
        router.push(data.redirect);
      } else if (mode === 'register') {
        const data = await auth({ action: 'register', name, email, password, role });
        setCode(data.verificationCode || '');
        setMode('verify');
        setMessage(data.message || 'Account created. Enter the development activation code to verify your email.');
      } else if (mode === 'verify') {
        const data = await auth({ action: 'verify-email', email, code });
        setMode('login');
        setMessage(data.message || 'Email verified. You can now sign in.');
      } else {
        const data = await auth({ action: 'forgot-password', email });
        setMessage(data.message || 'Password recovery is not configured yet.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#071817] text-white selection:bg-amber-300 selection:text-slate-950">
      <a href="#main-content" className="sr-only z-[100] rounded-md bg-white px-4 py-2 text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#071817]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#top" className="group flex items-center gap-2.5 font-black tracking-tight" aria-label="TravelMate home">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-300 text-[#071817] transition-transform group-hover:-rotate-6"><Compass size={21} strokeWidth={2.5} /></span>
            <span className="text-xl">TravelMate</span>
          </a>

          <nav aria-label="Primary navigation" className="hidden items-center gap-8 text-sm font-medium text-white/70 lg:flex">
            <a className="transition hover:text-white" href="#features">Features</a>
            <a className="transition hover:text-white" href="#workflow">How it works</a>
            <a className="transition hover:text-white" href="#budget">Budget</a>
            <a className="transition hover:text-white" href="#preview">Preview</a>
            <a className="transition hover:text-white" href="#faq">FAQ</a>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button type="button" onClick={() => show('login')} className="rounded-full px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white">Sign in</button>
            <button type="button" onClick={() => show('register')} className="rounded-full bg-amber-300 px-5 py-2.5 text-sm font-extrabold text-[#102220] shadow-[0_10px_30px_rgba(252,211,77,.18)] transition hover:bg-amber-200">Plan a trip</button>
          </div>

          <button type="button" aria-expanded={menu} aria-controls="mobile-navigation" aria-label={menu ? 'Close navigation' : 'Open navigation'} onClick={() => setMenu((current) => !current)} className="grid size-10 place-items-center rounded-full border border-white/15 md:hidden">
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menu && (
          <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-white/10 bg-[#071817] px-5 py-5 md:hidden">
            <div className="mx-auto grid max-w-7xl gap-1 text-sm font-semibold">
              {([['Features', '#features'], ['How it works', '#workflow'], ['Budget', '#budget'], ['Preview', '#preview'], ['FAQ', '#faq']] as const).map(([label, href]) => <a key={href} href={href} onClick={() => setMenu(false)} className="rounded-lg px-3 py-3 text-white/75 hover:bg-white/5 hover:text-white">{label}</a>)}
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                <button type="button" onClick={() => show('login')} className="rounded-full border border-white/20 px-4 py-3">Sign in</button>
                <button type="button" onClick={() => show('register')} className="rounded-full bg-amber-300 px-4 py-3 font-extrabold text-[#102220]">Plan a trip</button>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content">
        <section id="top" className="relative isolate flex min-h-[780px] items-center overflow-hidden pt-[72px]">
          <Image src="/mountain-hero-bg.png" alt="" fill priority sizes="100vw" className="-z-30 object-cover object-center" />
          <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(3,20,19,.97)_0%,rgba(3,20,19,.87)_45%,rgba(3,20,19,.38)_100%)]" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_46%,rgba(251,191,36,.15),transparent_28%)]" />

          <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-amber-200 backdrop-blur">
                <Sparkles size={14} /> One brief. One complete plan.
              </div>
              <h1 className="text-balance text-5xl font-black leading-[.98] tracking-[-.045em] sm:text-6xl lg:text-7xl xl:text-[5.4rem]">AI Travel Planning Made Real</h1>
              <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-white/72 sm:text-xl">Turn your destination, dates, budget, and interests into a practical itinerary—with travel options, cost estimates, and conditions brought into one clear workspace.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => show('register')} className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-amber-300 px-6 py-3 font-extrabold text-[#102220] transition hover:bg-amber-200">Create my itinerary <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></button>
                <a href="#workflow" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 py-3 font-bold backdrop-blur transition hover:bg-white/10">See how it works</a>
              </div>
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/65" aria-label="TravelMate benefits">
                {['Budget-aware plans', 'Weather context', 'Saved trip workspace'].map((item) => <li key={item} className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-emerald-300/15 text-emerald-200"><Check size={12} strokeWidth={3} /></span>{item}</li>)}
              </ul>
            </div>

            <div className="relative mx-auto hidden w-full max-w-[500px] lg:block" aria-label="TravelMate itinerary preview">
              <div className="absolute -left-10 top-14 h-48 w-48 rounded-full bg-amber-300/15 blur-3xl" />
              <div className="relative rotate-[1.5deg] overflow-hidden rounded-[28px] border border-white/20 bg-[#f7f4eb] text-slate-950 shadow-[0_35px_100px_rgba(0,0,0,.45)]">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                  <div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800">Your next trip</p><h2 className="mt-1 text-xl font-black">Bohol escape</h2></div>
                  <div className="grid size-11 place-items-center rounded-2xl bg-[#0d2929] text-white"><MapPinned size={20} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2 px-6 py-4 text-xs">
                  <div className="rounded-xl bg-white p-3"><span className="text-slate-500">Dates</span><strong className="mt-1 block">Oct 12–16</strong></div>
                  <div className="rounded-xl bg-white p-3"><span className="text-slate-500">Travelers</span><strong className="mt-1 block">2 people</strong></div>
                  <div className="rounded-xl bg-white p-3"><span className="text-slate-500">Budget</span><strong className="mt-1 block">₱28,000</strong></div>
                </div>
                <div className="px-6 pb-3">
                  <div className="mb-3 flex items-center justify-between"><h3 className="font-extrabold">Itinerary</h3><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">Within budget</span></div>
                  {[['Day 1', 'Arrival & riverside walk', '₱2,800'], ['Day 2', 'Countryside highlights', '₱4,600'], ['Day 3', 'Island hopping', '₱5,200']].map(([day, title, cost], index) => <div key={day} className="flex items-center gap-3 border-t border-slate-200 py-3.5"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${index === 1 ? 'bg-amber-200' : 'bg-[#dcefeb]'} text-xs font-black`}>{index + 1}</span><div className="min-w-0 flex-1"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{day}</span><p className="truncate text-sm font-bold">{title}</p></div><strong className="text-xs">{cost}</strong></div>)}
                </div>
                <div className="mx-6 mb-6 flex items-center gap-3 rounded-2xl bg-[#0d2929] p-4 text-white"><CloudSun className="text-amber-200" /><div><strong className="text-sm">Good weather window</strong><p className="text-xs text-white/60">Move outdoor plans earlier on Day 4.</p></div></div>
              </div>
              <div className="absolute -bottom-8 -left-12 -rotate-3 rounded-2xl border border-white/20 bg-[#0d2929] px-4 py-3 shadow-2xl"><p className="text-[10px] font-bold uppercase tracking-widest text-white/45">Estimated remaining</p><strong className="mt-1 block text-xl text-amber-200">₱4,320</strong></div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#f5f1e7] to-transparent" />
        </section>

        <section className="bg-[#f5f1e7] px-5 py-24 text-slate-950 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:gap-20">
              <div><SectionLabel dark>Why planning still feels hard</SectionLabel><h2 className="mt-4 text-balance text-4xl font-black tracking-[-.035em] sm:text-5xl">A great trip should not begin with spreadsheet fatigue.</h2><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">TravelMate brings the decisions that affect one another into the same planning flow.</p></div>
              <div className="grid gap-4 sm:grid-cols-3">
                {problemCards.map(({ icon: Icon, title, description }, index) => <article key={title} className="rounded-3xl border border-slate-900/10 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,.05)]"><span className="text-xs font-black text-emerald-800">0{index + 1}</span><Icon className="mt-10 text-emerald-800" size={25} /><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{description}</p></article>)}
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-20 bg-[#071817] px-5 py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl"><SectionLabel>Designed around the traveler</SectionLabel><h2 className="mt-4 text-balance text-4xl font-black tracking-[-.035em] sm:text-5xl">From a simple trip brief to a plan you can actually use.</h2></div>
            <ol className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-5">
              {travelerSteps.map(([title, description], index) => <li key={title} className="group bg-[#0a201f] p-6 transition hover:bg-[#0d2929]"><span className="font-mono text-xs text-amber-200">0{index + 1}</span><div className="mt-16 h-px w-8 bg-amber-300/70 transition-all group-hover:w-14" /><h3 className="mt-5 font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-white/55">{description}</p></li>)}
            </ol>

            <div className="mt-16 grid items-center gap-10 rounded-[32px] border border-white/10 bg-white/[.035] p-7 lg:grid-cols-[.65fr_1.35fr] lg:p-10">
              <div><SectionLabel>For local owners</SectionLabel><h3 className="mt-3 text-3xl font-black">Make useful options easier to discover.</h3><p className="mt-4 leading-7 text-white/55">Verified owners can keep listings, pricing, and capacity organized without changing the traveler-first planning experience.</p></div>
              <ol className="grid gap-3 sm:grid-cols-5">
                {hostSteps.map(([title], index) => <li key={title} className="rounded-2xl bg-white/5 p-4"><span className="text-xs font-black text-emerald-200">0{index + 1}</span><p className="mt-8 text-sm font-bold leading-5">{title}</p></li>)}
              </ol>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 bg-[#e9eee9] px-5 py-24 text-slate-950 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div className="max-w-3xl"><SectionLabel dark>One connected workspace</SectionLabel><h2 className="mt-4 text-balance text-4xl font-black tracking-[-.035em] sm:text-5xl">The context behind the trip, not just a list of places.</h2></div><p className="max-w-sm leading-7 text-slate-600">Preferences, options, costs, and conditions work together before recommendations reach your itinerary.</p></div>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {featureCards.map(({ icon: Icon, title, description, className, label }) => <article key={title} className={`min-h-72 rounded-[28px] p-7 ${className}`}><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[.16em] opacity-60">{label}</span><span className="grid size-11 place-items-center rounded-2xl border border-current/15 bg-current/5"><Icon size={21} /></span></div><h3 className="mt-20 max-w-md text-2xl font-black tracking-tight">{title}</h3><p className="mt-4 max-w-lg leading-7 opacity-65">{description}</p></article>)}
            </div>
          </div>
        </section>

        <section id="budget" className="scroll-mt-20 bg-[#f5f1e7] px-5 py-24 text-slate-950 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div className="lg:sticky lg:top-28"><SectionLabel dark>Budget engine</SectionLabel><h2 className="mt-4 text-balance text-4xl font-black tracking-[-.035em] sm:text-5xl">Know where the money goes before the trip begins.</h2><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">TravelMate separates estimated accommodation, food, activities, and transport, then keeps a safety reserve visible. The result is reconciled against the total budget—not guessed by the interface.</p>
              <div className="mt-9 overflow-hidden rounded-3xl bg-[#0d2929] p-6 text-white"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-white/50">Example budget</p><strong className="mt-2 block text-3xl">₱35,000</strong></div><span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-bold text-emerald-200">On track</span></div><div className="mt-6 flex h-2 overflow-hidden rounded-full bg-white/10"><span className="w-[34%] bg-amber-300"/><span className="w-[22%] bg-orange-300"/><span className="w-[20%] bg-emerald-300"/><span className="w-[14%] bg-cyan-300"/><span className="w-[10%] bg-white/35"/></div><div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-xs sm:grid-cols-3">{[['34%', 'Accommodation'], ['22%', 'Food'], ['20%', 'Activities'], ['14%', 'Transport'], ['10%', 'Safety reserve']].map(([value, label]) => <div key={label}><strong className="text-base text-amber-100">{value}</strong><p className="text-white/45">{label}</p></div>)}</div></div>
            </div>
            <div><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-800">Example itinerary</p><h3 className="mt-2 text-2xl font-black">Seven days, one readable view</h3></div><CalendarRange className="text-emerald-800" /></div><div className="overflow-hidden rounded-3xl border border-slate-900/10 bg-white shadow-[0_25px_70px_rgba(15,23,42,.07)]">{exampleDays.map(([day, title, weather, cost], index) => <article key={day} className="grid grid-cols-[42px_1fr_auto] items-center gap-3 border-b border-slate-900/8 p-4 last:border-0 sm:grid-cols-[50px_1fr_150px_auto] sm:p-5"><span className={`grid size-10 place-items-center rounded-xl text-xs font-black ${index === 3 ? 'bg-amber-200 text-amber-950' : 'bg-[#dcefeb] text-emerald-950'}`}>{day}</span><div><h4 className="font-black">{title}</h4><p className="mt-1 text-xs text-slate-500 sm:hidden">{weather}</p></div><span className={`hidden items-center gap-2 text-sm sm:flex ${index === 3 ? 'text-amber-700' : 'text-slate-500'}`}><CloudSun size={16}/>{weather}</span><strong className="text-sm">{cost}</strong></article>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">Example estimates only. Actual plans use the traveler’s selected dates and clearly identify live, test, estimated, or unavailable provider data.</p></div>
          </div>
        </section>

        <section id="safety" className="bg-[#0d2929] px-5 py-24 lg:px-8">
          <div className="mx-auto max-w-7xl"><div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><div><SectionLabel>Trust through clarity</SectionLabel><h2 className="mt-4 text-balance text-4xl font-black tracking-[-.035em] sm:text-5xl">Know what is verified, estimated, and yours.</h2></div><div className="grid gap-4 sm:grid-cols-3">{[[LockKeyhole, 'Protected account access', 'Secure sessions and email verification protect access to saved travel data.'], [ShieldCheck, 'Backend ownership checks', 'Trips and profile changes are authorized on the server, not trusted to the browser.'], [Bot, 'Transparent recommendations', 'AI suggestions and external data remain planning guidance, with sources and limitations made clear.']].map(([Icon, title, description]) => { const CardIcon = Icon as LucideIcon; return <article key={String(title)} className="rounded-3xl border border-white/10 bg-white/5 p-6"><CardIcon className="text-amber-200"/><h3 className="mt-12 font-black">{String(title)}</h3><p className="mt-3 text-sm leading-6 text-white/55">{String(description)}</p></article>; })}</div></div></div>
        </section>

        <section className="bg-[#f5f1e7] px-5 py-24 text-slate-950 lg:px-8">
          <div className="mx-auto max-w-6xl"><div className="mx-auto max-w-3xl text-center"><SectionLabel dark>A more complete planning flow</SectionLabel><h2 className="mt-4 text-balance text-4xl font-black tracking-[-.035em] sm:text-5xl">Less switching. More confident decisions.</h2></div>
            <div className="mt-12 hidden overflow-hidden rounded-3xl border border-slate-900/10 bg-white md:block"><table className="w-full text-left"><thead className="bg-[#0d2929] text-white"><tr><th className="px-6 py-5 text-sm">Capability</th><th className="px-4 py-5 text-center text-sm">Notes app</th><th className="px-4 py-5 text-center text-sm">Booking site</th><th className="px-4 py-5 text-center text-sm text-amber-200">TravelMate</th></tr></thead><tbody>{comparisonRows.map(([label, notes, booking, travelMate]) => <tr key={label} className="border-t border-slate-900/8"><th className="px-6 py-4 text-sm font-bold">{label}</th>{[notes, booking, travelMate].map((value, index) => <td key={index} className="px-4 py-4 text-center">{value ? <Check className={`mx-auto ${index === 2 ? 'text-emerald-700' : 'text-slate-400'}`} size={19}/> : <span className="text-slate-300">—</span>}</td>)}</tr>)}</tbody></table></div>
            <div className="mt-10 grid gap-4 md:hidden">{comparisonRows.map(([label, , , value]) => <article key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-white p-5"><span className="text-sm font-bold">{label}</span>{value && <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800"><Check size={16}/></span>}</article>)}</div>
          </div>
        </section>

        <section id="preview" className="scroll-mt-20 bg-[#e9eee9] px-5 py-24 text-slate-950 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.72fr_1.28fr]"><div><SectionLabel dark>Platform preview</SectionLabel><h2 className="mt-4 text-balance text-4xl font-black tracking-[-.035em] sm:text-5xl">Your trip stays understandable as it grows.</h2><p className="mt-5 text-lg leading-8 text-slate-600">Move between itinerary, budget, travel options, conditions, and saved plans without losing the context of the trip.</p><button type="button" onClick={() => show('register')} className="group mt-8 inline-flex items-center gap-2 font-black text-emerald-900">Build your first plan <ArrowRight size={18} className="transition-transform group-hover:translate-x-1"/></button></div>
            <div className="overflow-hidden rounded-[30px] border border-slate-900/10 bg-[#071817] text-white shadow-[0_30px_90px_rgba(15,23,42,.16)]"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-rose-400"/><span className="size-2.5 rounded-full bg-amber-300"/><span className="size-2.5 rounded-full bg-emerald-300"/></div><span className="text-[10px] font-bold uppercase tracking-[.18em] text-white/40">Traveler workspace</span></div><div className="grid md:grid-cols-[160px_1fr]"><nav className="hidden border-r border-white/10 p-4 md:block" aria-label="Preview navigation">{['Overview', 'Itinerary', 'Budget', 'Compare', 'Conditions'].map((item, index) => <div key={item} className={`mb-1 rounded-xl px-3 py-2.5 text-xs font-bold ${index === 1 ? 'bg-amber-300 text-slate-950' : 'text-white/45'}`}>{item}</div>)}</nav><div className="p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-amber-200">Palawan · Nov 8–13</p><h3 className="mt-2 text-2xl font-black">Island and nature itinerary</h3></div><span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">Saved</span></div><div className="mt-7 grid gap-3 sm:grid-cols-3">{[[MapPinned, '6 days', 'Planned'], [WalletCards, '₱31,840', 'Estimated'], [CloudSun, '1 alert', 'Conditions']].map(([Icon, value, label]) => { const PreviewIcon = Icon as LucideIcon; return <div key={String(label)} className="rounded-2xl bg-white/5 p-4"><PreviewIcon size={18} className="text-amber-200"/><strong className="mt-7 block">{String(value)}</strong><span className="text-xs text-white/40">{String(label)}</span></div>; })}</div><div className="mt-3 rounded-2xl border border-white/10 p-4"><div className="flex items-center justify-between"><div><span className="text-[10px] font-bold uppercase tracking-widest text-white/35">Day 3</span><h4 className="mt-1 font-black">Lagoon and coastal route</h4></div><span className="text-sm font-black">₱5,280</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[72%] rounded-full bg-amber-300"/></div><p className="mt-3 text-xs text-white/45">Morning boat transfer · Lagoon visit · Coastal lunch · Sunset viewpoint</p></div></div></div></div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 bg-[#f5f1e7] px-5 py-24 text-slate-950 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.65fr_1.35fr]"><div><SectionLabel dark>Questions, answered</SectionLabel><h2 className="mt-4 text-4xl font-black tracking-[-.035em]">Plan with fewer unknowns.</h2><p className="mt-5 leading-7 text-slate-600">TravelMate distinguishes planning guidance from confirmed provider information.</p></div><div className="overflow-hidden rounded-3xl border border-slate-900/10 bg-white px-6 sm:px-8">{faqs.map(([question, answer]) => <details key={question} className="group border-b border-slate-900/10 py-6 last:border-0"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black marker:hidden">{question}<span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 transition group-open:rotate-180"><ChevronDown size={16}/></span></summary><p className="max-w-2xl pt-4 text-sm leading-7 text-slate-600">{answer}</p></details>)}</div></div>
        </section>

        <section className="bg-[#071817] px-5 py-24 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2"><article className="rounded-[30px] bg-amber-300 p-8 text-slate-950 sm:p-10"><Users size={28}/><p className="mt-16 text-xs font-black uppercase tracking-[.16em] text-slate-700">For travelers</p><h2 className="mt-3 text-3xl font-black tracking-tight">Start with the trip you have in mind.</h2><p className="mt-4 max-w-lg leading-7 text-slate-700">Bring your destination, dates, budget, and interests. TravelMate will help organize the rest.</p><button type="button" onClick={() => show('register')} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#071817] px-5 py-3 font-extrabold text-white">Create traveler account <ArrowRight size={17}/></button></article><article className="rounded-[30px] border border-white/12 bg-white/5 p-8 sm:p-10"><Hotel size={28} className="text-emerald-200"/><p className="mt-16 text-xs font-black uppercase tracking-[.16em] text-emerald-200">For owners</p><h2 className="mt-3 text-3xl font-black tracking-tight">Help travelers discover a better local option.</h2><p className="mt-4 max-w-lg leading-7 text-white/55">Create an owner profile and manage approved Cebu listings from a focused workspace.</p><button type="button" onClick={() => { setRole('owner'); show('register'); }} className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 font-extrabold">Create owner account <ArrowRight size={17}/></button></article></div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#071817] px-5 py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between"><div><a href="#top" className="flex items-center gap-2.5 text-lg font-black"><span className="grid size-8 place-items-center rounded-xl bg-amber-300 text-[#071817]"><Compass size={18}/></span>TravelMate</a><p className="mt-4 max-w-md text-sm leading-6 text-white/45">AI-powered itinerary planning, budget estimates, clearly sourced stay options, and saved-trip management in one system.</p></div><div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-white/55"><a href="#features" className="hover:text-white">Features</a><a href="#workflow" className="hover:text-white">How it works</a><a href="#faq" className="hover:text-white">FAQ</a><button type="button" onClick={() => show('login')} className="hover:text-white">Sign in</button></div></div><div className="mx-auto mt-8 flex max-w-7xl flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/35 sm:flex-row sm:justify-between"><span>© 2026 TravelMate. Capstone project.</span><span>Planning guidance—not a guarantee of price or availability.</span></div>
      </footer>

      {open && <AuthDialog mode={mode} setMode={setMode} role={role} setRole={setRole} email={email} setEmail={setEmail} password={password} setPassword={setPassword} name={name} setName={setName} code={code} setCode={setCode} message={message} busy={busy} onSubmit={submit} onClose={() => setOpen(false)} closeButtonRef={closeButtonRef} />}
    </div>
  );
}

function SectionLabel({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <p className={`text-xs font-black uppercase tracking-[.18em] ${dark ? 'text-emerald-800' : 'text-amber-200'}`}>{children}</p>;
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
  name: string;
  setName: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  message: string;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
};

function AuthDialog({ mode, setMode, role, setRole, email, setEmail, password, setPassword, name, setName, code, setCode, message, busy, onSubmit, onClose, closeButtonRef }: AuthDialogProps) {
  const title = mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : mode === 'verify' ? 'Verify your email' : 'Recover your account';
  const submitLabel = busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'verify' ? 'Verify email' : 'Send recovery message';

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#020b0b]/85 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" onMouseDown={(event) => event.stopPropagation()} className="relative my-8 w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0d2929] p-6 shadow-[0_30px_100px_rgba(0,0,0,.55)] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-emerald-300 to-cyan-300" />
        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close account dialog" className="absolute right-5 top-5 grid size-10 place-items-center rounded-full border border-white/10 text-white/65 hover:bg-white/10 hover:text-white"><X size={18}/></button>
        <span className="grid size-11 place-items-center rounded-2xl bg-amber-300 text-[#071817]"><Compass size={22}/></span>
        <h2 id="auth-dialog-title" className="mt-6 pr-12 text-3xl font-black tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-white/50">Access your TravelMate planning workspace.</p>

        {message && <p role="status" aria-live="polite" className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/75">{message}</p>}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === 'register' && <>
            <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Account type</legend><div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={role === 'traveler'} onClick={() => setRole('traveler')} className={`rounded-xl border px-3 py-3 text-sm font-bold ${role === 'traveler' ? 'border-amber-300 bg-amber-300/10 text-amber-200' : 'border-white/10 text-white/55 hover:bg-white/5'}`}>Traveler</button><button type="button" aria-pressed={role === 'owner'} onClick={() => setRole('owner')} className={`rounded-xl border px-3 py-3 text-sm font-bold ${role === 'owner' ? 'border-emerald-300 bg-emerald-300/10 text-emerald-200' : 'border-white/10 text-white/55 hover:bg-white/5'}`}>Owner</button></div></fieldset>
            <label className="block text-sm font-bold" htmlFor="auth-name">Full name<input id="auth-name" required minLength={2} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 font-normal text-white placeholder:text-white/25" placeholder="Your name" /></label>
          </>}

          {mode === 'verify' ? <label className="block text-sm font-bold" htmlFor="auth-code">Activation code<input id="auth-code" required autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 font-mono text-lg uppercase tracking-[.2em] text-white placeholder:text-white/25" placeholder="Enter code" /></label> : <label className="block text-sm font-bold" htmlFor="auth-email">Email address<input id="auth-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 font-normal text-white placeholder:text-white/25" placeholder="you@example.com" /></label>}

          {(mode === 'login' || mode === 'register') && <label className="block text-sm font-bold" htmlFor="auth-password">Password<input id="auth-password" required type="password" minLength={8} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 font-normal text-white placeholder:text-white/25" placeholder="At least 8 characters" /></label>}

          <button disabled={busy} className="mt-2 w-full rounded-full bg-amber-300 px-5 py-3.5 font-extrabold text-[#102220] transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60">{submitLabel}</button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-xs font-bold"><button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); }} className="text-amber-200 hover:text-amber-100">{mode === 'login' ? 'Create an account' : 'Back to sign in'}</button>{mode === 'login' && <button type="button" onClick={() => setMode('forgot')} className="text-white/45 hover:text-white">Forgot password?</button>}</div>
        {mode === 'login' && process.env.NODE_ENV !== 'production' && <div className="mt-6 rounded-2xl bg-black/20 p-4 text-[11px] leading-5 text-white/40"><strong className="text-white/65">Development demo access</strong><br/>traveler@travelmate.test · owner@travelmate.test · admin@travelmate.test<br/>Password: Travel123!</div>}
      </section>
    </div>
  );
}
