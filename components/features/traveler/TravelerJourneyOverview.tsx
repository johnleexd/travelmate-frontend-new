'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CloudSun,
  Compass,
  ListChecks,
  MapPin,
  PencilLine,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { formatMoney, type CurrencyCode } from '@/lib/domain';
import type { ExchangeRateQuote } from '@/lib/contracts';
import { ReferenceAmount } from '@/components/common/ReferenceAmount';

const JOURNEY_STEPS = [
  {
    title: 'Define the trip', shortTitle: 'Define',
    youDo: 'Choose a destination, dates, travelers, and one total budget.',
    systemDoes: 'TravelMate checks that the trip length, group, and budget are valid.',
    result: 'A clear brief for the entire trip.', action: 'Enter trip details', icon: MapPin,
  },
  {
    title: 'Generate a draft', shortTitle: 'Generate',
    youDo: 'Add any interests or travel preferences, then request a plan.',
    systemDoes: 'TravelMate gathers available context, estimates costs, and creates a validated day-by-day draft.',
    result: 'An editable itinerary, not a booking.', action: 'Build the itinerary', icon: Sparkles,
  },
  {
    title: 'Understand the plan', shortTitle: 'Understand',
    youDo: 'Review the schedule, estimated budget, travel options, and conditions.',
    systemDoes: 'TravelMate keeps every estimate and provider source labeled beside the same trip.',
    result: 'You can see why the plan is practical.', action: 'Review trip context', icon: ListChecks,
  },
  {
    title: 'Refine your days', shortTitle: 'Refine',
    youDo: 'Add, edit, remove, or reorder activities until the pace feels right.',
    systemDoes: 'TravelMate recalculates the affected day and budget totals after each change.',
    result: 'A plan shaped by your decisions.', action: 'Edit the itinerary', icon: PencilLine,
  },
  {
    title: 'Save deliberately', shortTitle: 'Save',
    youDo: 'Choose Save trip only after the draft is useful enough to keep.',
    systemDoes: 'TravelMate stores the itinerary under your account. Generation alone never saves it.',
    result: 'A persistent trip you can retrieve later.', action: 'Save or update the plan', icon: Save,
  },
  {
    title: 'Reopen anytime', shortTitle: 'Reopen',
    youDo: 'Return through Saved trips when you want to continue planning.',
    systemDoes: 'TravelMate restores the saved destination, dates, budget, and itinerary together.',
    result: 'Your planning context stays connected.', action: 'Open saved trips', icon: RotateCcw,
  },
] as const;

const PLANNING_NOTES = [
  ['You only need four details', 'Destination, dates, travelers, and budget are enough to generate a first draft. Everything else improves personalization.'],
  ['Generation and saving are different', 'Generate creates a temporary draft for review. Save trip is the deliberate action that keeps it in your account.'],
  ['Options are supporting evidence', 'Budget, flights, stays, weather, and crowd context help you judge one itinerary. They are not separate planning flows.'],
] as const;

const HERO_EXPLANATION = 'You provide the trip boundaries. TravelMate builds a reviewable draft. You judge the itinerary, costs, options, and conditions, then edit and save only when it works for you.';

interface UpcomingTripSummary {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: number;
  currency: CurrencyCode;
}

interface TravelerJourneyOverviewProps {
  userName: string;
  profileVerified: boolean;
  savedTripCount: number;
  currentPlan: { destination: string; days: number } | null;
  upcomingTrip: UpcomingTripSummary | null;
  referenceCurrency: CurrencyCode;
  exchangeQuotes: Partial<Record<CurrencyCode, ExchangeRateQuote>>;
  onStartPlanning: () => void;
  onOpenCurrentPlan: () => void;
  onOpenUpcomingTrip: () => void;
  onOpenSavedTrips: () => void;
  onOpenBudget: () => void;
  onOpenOptions: () => void;
  onOpenAccount: () => void;
}

export function TravelerJourneyOverview({
  userName, profileVerified, savedTripCount, currentPlan, upcomingTrip, referenceCurrency, exchangeQuotes,
  onStartPlanning, onOpenCurrentPlan, onOpenUpcomingTrip, onOpenSavedTrips,
  onOpenBudget, onOpenOptions, onOpenAccount,
}: TravelerJourneyOverviewProps) {
  const [activeStep, setActiveStep] = useState(currentPlan ? 2 : savedTripCount > 0 ? 5 : 0);
  const [planningNote, setPlanningNote] = useState(0);
  const firstName = userName.split(/\s+/).filter(Boolean)[0] || 'traveler';
  const hasPlan = Boolean(currentPlan);
  const hasSavedTrip = savedTripCount > 0;
  const nextAction = currentPlan
    ? { title: 'Review the plan already in progress', detail: `${currentPlan.destination} · ${currentPlan.days} days`, action: 'Continue with this plan', onClick: onOpenCurrentPlan, stage: 'Understand and refine' }
    : upcomingTrip
      ? { title: 'Reopen your saved trip', detail: `${upcomingTrip.destination} · ${upcomingTrip.startDate} to ${upcomingTrip.endDate}`, action: 'Open the saved plan', onClick: onOpenUpcomingTrip, stage: 'Return and continue' }
      : { title: 'Define your first trip', detail: 'Destination, dates, travelers, and budget are enough.', action: 'Enter trip details', onClick: onStartPlanning, stage: 'Start here' };

  const runStepAction = (index: number) => {
    if (index <= 1) return hasPlan ? onOpenCurrentPlan() : onStartPlanning();
    if (index === 2) return hasPlan ? onOpenBudget() : hasSavedTrip ? onOpenSavedTrips() : onStartPlanning();
    if (index <= 4) return hasPlan ? onOpenCurrentPlan() : hasSavedTrip ? onOpenSavedTrips() : onStartPlanning();
    return onOpenSavedTrips();
  };

  const stepState = (index: number) => {
    if (hasPlan && index < 2) return 'Complete';
    if (hasPlan && index === 2) return 'Continue here';
    if (!hasPlan && hasSavedTrip && index < 5) return 'Saved previously';
    if (!hasPlan && hasSavedTrip && index === 5) return 'Continue here';
    if (!hasPlan && !hasSavedTrip && index === 0) return 'Start here';
    return 'Comes next';
  };

  return (
    <div className="space-y-10">
      <section aria-labelledby="travel-home-title" className="grid grid-flow-dense gap-px border border-white/10 bg-white/10 lg:grid-cols-12">
        <article className="group relative min-h-[470px] overflow-hidden bg-[#102824] p-6 text-white sm:p-10 lg:col-span-8 lg:p-12">
          <Image src="/cordova-nalusuan.png" alt="Island coastline near Cebu" fill sizes="(min-width: 1024px) 65vw, 100vw" className="object-cover object-center transition-transform duration-700 group-hover:scale-[1.03]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,27,24,.97)_0%,rgba(8,27,24,.9)_60%,rgba(8,27,24,.62)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,27,24,.62)_0%,rgba(8,27,24,.2)_52%,transparent_82%)]" />
          <div className="relative flex min-h-[370px] flex-col justify-between sm:min-h-[390px]">
            <p className="flex items-center gap-3 text-sm font-semibold text-white/92"><span className="h-px w-8 bg-[#ffcf70]" />Welcome, {firstName}. Your next trip starts here.</p>
            <div>
              <h2 id="travel-home-title" className="max-w-[13ch] text-balance text-5xl font-black leading-[0.94] tracking-[-0.045em] sm:text-6xl lg:text-6xl">Turn one trip into a plan you understand.</h2>
              <p className="mt-6 max-w-[54ch] text-base leading-7 text-white/90">{HERO_EXPLANATION.split(' ').map((word, index) => <span key={`${word}-${index}`} data-lifecycle-word className="inline-block">{word}&nbsp;</span>)}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="button" onClick={nextAction.onClick} className="group inline-flex min-h-12 items-center justify-center gap-3 bg-[#ffcf70] px-6 py-3 text-sm font-extrabold text-[#14231f] transition hover:bg-[#ffe1a1]">{nextAction.action}<ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></button>
                <button type="button" onClick={onOpenSavedTrips} className="inline-flex min-h-12 items-center justify-center border border-white/45 bg-black/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-[#14231f]">Open saved trips</button>
              </div>
            </div>
          </div>
        </article>

        <aside className="flex min-h-[470px] flex-col bg-[#ffcf70] p-6 text-[#14231f] sm:p-9 lg:col-span-4">
          <div className="flex items-start justify-between gap-6 border-b border-[#14231f]/20 pb-6">
            <div><p className="text-xs font-black uppercase tracking-[.14em] text-[#49635c]">{nextAction.stage}</p><h3 className="mt-3 max-w-md text-3xl font-black leading-tight tracking-[-0.045em]">{nextAction.title}</h3></div>
            <Compass size={24} className="shrink-0 text-[#14231f]/55" />
          </div>
          <p className="mt-6 text-sm leading-6 text-[#334b43]">{nextAction.detail}</p>
          {upcomingTrip && !currentPlan && <p className="mt-3 text-sm text-[#334b43]">{upcomingTrip.travelers} traveler{upcomingTrip.travelers === 1 ? '' : 's'} · {formatMoney(upcomingTrip.budget, upcomingTrip.currency)}<ReferenceAmount amount={upcomingTrip.budget} currency={upcomingTrip.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></p>}
          <div className="mt-auto border-t border-[#14231f]/20 pt-6"><p className="text-xs font-black uppercase tracking-[.12em] text-[#49635c]">The distinction that matters</p><p className="mt-3 text-sm leading-6 text-[#334b43]"><strong className="text-[#14231f]">Generate</strong> makes a temporary draft. <strong className="text-[#14231f]">Save trip</strong> keeps it in your account.</p></div>
        </aside>
      </section>

      <section aria-labelledby="lifecycle-title">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-amber-300">The complete planning lifecycle</p><h2 id="lifecycle-title" className="mt-2 max-w-4xl text-3xl font-black tracking-[-0.045em] sm:text-5xl">Six states, one connected trip.</h2></div><p className="max-w-md text-sm leading-6 text-white/48">Select any state to see what you control, what the system handles, and what you receive.</p></div>
        <div className="flex flex-col gap-px border border-white/10 bg-white/10 lg:min-h-[430px] lg:flex-row">
          {JOURNEY_STEPS.map((step, index) => {
            const Icon = step.icon;
            const active = activeStep === index;
            return (
              <article key={step.title} data-journey-card data-lifecycle-card onMouseEnter={() => setActiveStep(index)} onFocus={() => setActiveStep(index)} className={`group overflow-hidden transition-[flex-grow,background-color,color] duration-500 ${active ? 'bg-amber-300 text-[#14231f] lg:flex-[2.4]' : 'bg-[#102622] text-white lg:flex-1'}`}>
                <div className="flex min-h-[132px] w-full flex-col p-5 text-left sm:p-6 lg:h-full lg:min-h-[430px]">
                  <button type="button" onClick={() => setActiveStep(index)} aria-expanded={active} aria-label={`Explain ${step.title}`} className="flex w-full items-center justify-between gap-3 text-left"><span className={`grid h-10 w-10 shrink-0 place-items-center border ${active ? 'border-[#14231f]/25' : 'border-white/15'}`}><Icon size={18} /></span><span className={`text-[10px] font-bold ${active ? 'text-[#446057]' : 'text-white/38'}`}>{stepState(index)}</span></button>
                  <div className="mt-auto pt-8"><h3 className={`font-black tracking-[-0.04em] ${active ? 'text-2xl sm:text-3xl' : 'text-xl lg:[writing-mode:vertical-rl] lg:rotate-180'}`}>{active ? step.title : step.shortTitle}</h3><div className={`grid transition-[grid-template-rows,opacity] duration-500 ${active ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}><div className="overflow-hidden"><dl className="mt-6 space-y-4 text-sm leading-6"><div><dt className="text-xs font-black uppercase tracking-[0.12em] text-[#49635c]">You</dt><dd>{step.youDo}</dd></div><div><dt className="text-xs font-black uppercase tracking-[0.12em] text-[#49635c]">TravelMate</dt><dd>{step.systemDoes}</dd></div></dl><p className="mt-5 flex items-start gap-2 border-t border-[#14231f]/20 pt-4 text-xs font-bold leading-5"><Check size={15} className="mt-0.5 shrink-0" />{step.result}</p><button type="button" onClick={(event) => { event.stopPropagation(); runStepAction(index); }} className="mt-5 inline-flex items-center gap-2 border-b border-[#14231f] pb-1 text-xs font-black">{step.action}<ArrowRight size={14} /></button></div></div></div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="system-work-title" className="overflow-hidden border border-white/10 bg-[#0d211d]">
        <div className="border-b border-white/10 p-6 sm:p-9"><p className="text-sm font-semibold text-cyan-200">What happens after you select Generate</p><h2 id="system-work-title" className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.045em] sm:text-4xl">The system does the assembly. You make the decisions.</h2></div>
        <div data-lifecycle-rail className="flex w-full flex-wrap gap-y-4 border-b border-white/10 py-5 text-sm font-bold text-white/58 lg:w-max lg:flex-nowrap" aria-label="TravelMate generation pipeline">
          {[...Array(2)].flatMap((_, copy) => ['Validate preferences', 'Retrieve available context', 'Estimate costs', 'Generate structured itinerary', 'Validate the result', 'Return an editable draft'].map((label, index) => <span key={`${copy}-${label}`} aria-hidden={copy === 1} className={`items-center gap-3 px-3 lg:gap-5 lg:pl-5 lg:pr-0 ${copy === 1 ? 'hidden lg:flex' : 'flex'}`}><span>{label}</span>{index < 5 || copy === 0 ? <ArrowRight size={15} className="shrink-0 text-amber-300" /> : null}</span>))}
        </div>
        <div className="grid grid-flow-dense gap-px bg-white/10 md:grid-cols-12">
          <article data-lifecycle-stack className="bg-[#14231f] p-6 sm:p-8 md:col-span-4"><CalendarCheck className="text-amber-300" /><h3 className="mt-8 text-xl font-black">Your responsibility</h3><p className="mt-3 text-sm leading-6 text-white/52">Provide honest preferences, review the result, choose changes, and save deliberately.</p></article>
          <article data-lifecycle-stack className="bg-[#14231f] p-6 sm:p-8 md:col-span-4"><WalletCards className="text-cyan-200" /><h3 className="mt-8 text-xl font-black">TravelMate’s responsibility</h3><p className="mt-3 text-sm leading-6 text-white/52">Keep the itinerary, estimates, provider options, and conditions connected and clearly labeled.</p></article>
          <article data-lifecycle-stack className="bg-[#14231f] p-6 sm:p-8 md:col-span-4"><CloudSun className="text-emerald-200" /><h3 className="mt-8 text-xl font-black">The product boundary</h3><p className="mt-3 text-sm leading-6 text-white/52">TravelMate assists planning. It does not promise availability, invent live data, or complete airline and hotel checkout.</p></article>
        </div>
      </section>

      <section aria-labelledby="planning-note-heading" className="grid border border-white/10 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-h-[190px] bg-[#dce7df] p-6 text-[#14231f] sm:p-9"><p className="text-sm font-semibold text-[#547068]">Keep this in mind</p><h2 id="planning-note-heading" className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.045em] sm:text-4xl">{PLANNING_NOTES[planningNote][0]}</h2><p className="mt-4 max-w-3xl text-sm leading-6 text-[#48625c]">{PLANNING_NOTES[planningNote][1]}</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={onOpenBudget} className="border-b border-[#14231f] pb-1 text-xs font-black">See budget review</button><button type="button" onClick={onOpenOptions} className="border-b border-[#14231f] pb-1 text-xs font-black">See travel options</button></div></div>
        <div className="flex border-t border-[#14231f]/15 bg-[#cddbd1] lg:w-28 lg:flex-col lg:border-l lg:border-t-0"><button type="button" aria-label="Previous planning guidance" onClick={() => setPlanningNote((planningNote + PLANNING_NOTES.length - 1) % PLANNING_NOTES.length)} className="grid h-16 flex-1 place-items-center border-r border-[#14231f]/15 text-[#14231f] transition hover:bg-amber-300 lg:h-auto lg:border-b lg:border-r-0"><ArrowLeft size={18} /></button><button type="button" aria-label="Next planning guidance" onClick={() => setPlanningNote((planningNote + 1) % PLANNING_NOTES.length)} className="grid h-16 flex-1 place-items-center text-[#14231f] transition hover:bg-amber-300"><ArrowRight size={18} /></button></div>
      </section>

      {!profileVerified && <section className="flex flex-col gap-5 border border-amber-300/25 bg-amber-300/8 p-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-4"><ShieldCheck className="mt-1 shrink-0 text-amber-300" /><div><h2 className="font-bold">Account verification is separate from trip planning</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-white/52">You can create and save plans in Limited Mode. Verification is only needed for trust-sensitive actions such as booking or publishing listings.</p></div></div><button type="button" onClick={onOpenAccount} className="min-h-11 shrink-0 border border-amber-300/40 px-4 py-2 text-sm font-bold text-amber-200 transition hover:bg-amber-300 hover:text-[#14231f]">Review account status</button></section>}
    </div>
  );
}
