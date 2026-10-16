'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { BookOpen, CalendarDays, Check, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { fetchPlan, fetchGeneration, formatPlanDate, type PlanUsage } from '@/services/plan.service';
import type { ItineraryResponse } from '@/lib/contracts';
import { acceptDayReplan, type DayReplanPreview } from '@/services/smart-itinerary.service';
import styles from './MyPlan.module.css';
import { TestPlanCheckout } from './TestPlanCheckout';

const Features = ({ items }: { items: string[] }) => <ul className={styles.features}>{items.map(item => <li key={item}><span className={styles.tick}><Check size={13} aria-hidden="true"/></span>{item}</li>)}</ul>;
type Props = { headingRef?: RefObject<HTMLHeadingElement | null>; onHelp: () => void; onRecover: (plan: ItineraryResponse) => void; onSavedTrips: () => void };
export function MyPlan({ headingRef, onHelp, onRecover, onSavedTrips }: Props) {
  const [usage, setUsage] = useState<PlanUsage | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [upgrade, setUpgrade] = useState(false);
  const [preview, setPreview] = useState<{ tripId: string; value: DayReplanPreview } | null>(null);
  const upgradeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    const refresh = () => { void fetchPlan(abort.signal).then(value => { if (!abort.signal.aborted) { setUsage(value); setError(''); } }).catch(reason => { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'Plan usage could not load.'); }); };
    refresh(); const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh); window.addEventListener('travelmate-plan-refresh', refresh);
    return () => { abort.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('travelmate-plan-refresh', refresh); };
  }, []);
  async function recover(key: string) {
    setBusy(true); setError('');
    try {
      const operation = await fetchGeneration<ItineraryResponse | DayReplanPreview>(key);
      if (operation.status === 'pending') { setError('This generation is still in progress. Check again shortly; no second generation has started.'); return; }
      if (operation.status === 'failed') { setError('This operation ended without a result. Its allowance is released. Start a new generation from Plan a trip.'); return; }
      if (operation.kind === 'day-replan' && operation.tripId && operation.result && 'token' in operation.result) {
        setPreview({ tripId: operation.tripId, value: operation.result });
      } else if (operation.result && 'days' in operation.result) onRecover(operation.result);
      else setError('This result cannot be reopened here. Your saved trips remain available.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not recover this operation.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.plan} aria-label="My Plan">
    <h1 ref={headingRef} tabIndex={-1}>My Plan</h1><p className={styles.subtitle}>Manage your AI itinerary allowance.</p>
    {error && <p role="alert" className={styles.note}>{error}</p>}
    {!usage ? <div className={styles.summary}><p role="status">{error ? 'Plan usage is unavailable.' : 'Loading your plan…'}</p><button className={styles.button} onClick={() => window.dispatchEvent(new Event('travelmate-plan-refresh'))}>Reload usage</button></div> : <>
      <section className={styles.summary} aria-label="AI generation allowance">
        <div><span className={styles.badge}>{usage.source === 'paymongo_test' ? 'Demo Plus' : usage.plan}</span><h2>Your AI generations</h2><p className={styles.muted}>Monthly allowance · {usage.status === 'expired' ? 'Plus expired — Free allowance applies' : usage.status === 'active' ? 'Active' : 'Free plan'}</p>{usage.source === 'admin_demo' && <p className={styles.muted}>Development/demo grant · not a paid subscription</p>}{usage.source === 'paymongo_test' && <p className={styles.muted}>Verified PayMongo test payment · demo access · no real money</p>}{usage.source === 'verified_payment' && <p className={styles.muted}>Verified paid subscription</p>}{usage.expiresAt && <p className={styles.muted}>Expires: {formatPlanDate(usage.expiresAt, usage.timezone)}</p>}</div>
        <div><p className={styles.used}>{usage.used} <small>of {usage.allowance} used</small></p><div className={styles.progress} role="progressbar" aria-label="AI allowance committed" aria-valuemin={0} aria-valuemax={usage.allowance} aria-valuenow={Math.min(usage.allowance, usage.used + usage.reserved)} aria-valuetext={`${usage.used} used, ${usage.reserved} reserved, ${usage.remaining} remaining`}><span className={styles.consumed} style={{ width: `${Math.min(100, usage.used / usage.allowance * 100)}%` }}/><span className={styles.reserved} style={{ width: `${Math.min(Math.max(0, 100 - usage.used / usage.allowance * 100), usage.reserved / usage.allowance * 100)}%` }}/></div><p className={styles.muted}>{usage.reserved} reserved/in progress · {usage.remaining} remaining</p>{usage.inProgress && <p className={styles.muted}>One generation is running. Reconnect below.</p>}</div>
        <div className={styles.reset}><CalendarDays size={19} aria-hidden="true"/><p>Resets: <time dateTime={usage.resetsAt}>{formatPlanDate(usage.resetsAt, usage.timezone)}</time><br/>{usage.timezone}</p></div>
      </section>
      <h2 className={styles.sectionTitle}>Choose a plan</h2>
      <div className={styles.cards}><article className={styles.card}><h2>Free</h2><p className={styles.price}>₱0</p><p className={styles.muted}>For occasional trip planning</p><Features items={[`${usage.plans.free} AI generations per calendar month`, 'View and manually edit saved trips', 'Maps, visited places & budget review']}/><button className={styles.button} disabled>{usage.plan === 'Free' ? 'Current plan' : 'Free after Plus expires'}</button></article>
        <article className={`${styles.card} ${styles.plus}`}><span className={styles.gold}>More AI generations</span><h2>Plus</h2><p className={styles.price}>{usage.pricing}</p><p className={styles.muted}>For travelers who plan more often</p><Features items={[`${usage.plans.plus} AI generations per calendar month`, 'The same trip-planning features', 'More allowance for AI regeneration']}/><button ref={upgradeButton} className={styles.button} onClick={() => setUpgrade(true)}>{usage.plan === 'Plus' ? 'View plan details' : 'View upgrade details'}</button></article></div>
      <p className={styles.note}>{usage.provisional && 'Provisional development limits; final limits and pricing are not approved. '}{usage.testCheckout ? 'Test payment — no real money charged. Demo values only, not final live pricing. Live payments are disabled.' : 'Checkout is unavailable.'}</p>
      {usage.testCheckout && <TestPlanCheckout usage={usage} open={upgrade} onOpenChange={setUpgrade} opener={upgradeButton}/>}
      <section className={styles.explanation} aria-label="What uses a generation?"><div><h2>What uses a generation?</h2></div><div><h3>Counts toward your limit</h3><Features items={['A successfully generated AI itinerary', 'AI regeneration, including a day-replan preview']}/></div><div><h3>Does not use your limit</h3><Features items={['Open saved trips or edit activities manually', 'View maps, visited places or Budget review', 'Retry place coverage without AI']}/></div></section>
      <p className={styles.note}>Internal AI retries count as one operation. Confirmed failures release the reservation; disconnecting does not cancel a running operation. Catalogue-only results use no AI allowance.</p>
      <p className={styles.note}>Upgrading keeps this month’s usage. When Plus expires, the Free limit applies without deleting your trips. Tracking started {formatPlanDate(usage.trackingStartedAt, usage.timezone)}; earlier usage was not backfilled.</p>
      {!!usage.recentOperations.length && <section className={styles.recovery} aria-label="Recent generation operations"><h2>Recent generations</h2><ul>{usage.recentOperations.map(operation => <li key={operation.id}><span>{operation.destination} · {operation.allowanceState} · {operation.charged ? '1 allowance used' : 'No allowance used yet'}</span><button type="button" className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={() => void recover(operation.idempotencyKey)}><RefreshCw size={13} className="mr-1 inline" aria-hidden="true"/>{['reserved', 'processing'].includes(operation.allowanceState ?? '') ? 'Check progress' : operation.allowanceState === 'succeeded' ? 'Open result' : 'Check result'}</button></li>)}</ul></section>}
    </>}
    <button type="button" className={styles.help} onClick={onHelp}><BookOpen size={17} aria-hidden="true"/>Need help? Read the User Guide</button>
    {!usage?.testCheckout && <Dialog open={upgrade} onOpenChange={setUpgrade}><DialogContent showCloseButton={false} overlayClassName="z-[115]" onCloseAutoFocus={event => { event.preventDefault(); upgradeButton.current?.focus(); }} className={styles.dialog}><DialogTitle>Plus plan details</DialogTitle><DialogDescription>Pricing not configured. Checkout is unavailable.</DialogDescription><p>Plus raises the monthly AI allowance to {usage?.plans.plus ?? 'the configured limit'}. Usage already recorded this month remains counted. Expiry returns to the Free limit; your saved trips stay accessible.</p><button className={styles.button} disabled>Checkout unavailable</button><button className={`${styles.button} ${styles.secondary}`} onClick={() => setUpgrade(false)}>Close</button></DialogContent></Dialog>}
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent className={styles.dialog}><DialogTitle>Recovered day-replan preview</DialogTitle><DialogDescription>Review this saved AI result. Accepting it does not use another generation.</DialogDescription>{preview && <><ul>{preview.value.activities.map(item => <li key={item.id}>{item.title} · {item.time}</li>)}</ul><p>Expires {formatPlanDate(preview.value.expiresAt)}. A changed saved trip requires a fresh preview.</p><button className={styles.button} disabled={busy} onClick={async () => { setBusy(true); try { await acceptDayReplan(preview.tripId, preview.value, AbortSignal.timeout(30000)); setPreview(null); onSavedTrips(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not apply preview.'); setPreview(null); } finally { setBusy(false); } }}>Accept revised day</button></>}</DialogContent></Dialog>
  </section>;
}

export function MonthlyLimitDialog({ usage, onClose, onPlans, onSavedTrips }: { usage: PlanUsage | null; onClose: () => void; onPlans: () => void; onSavedTrips: () => void }) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return <Dialog open={!!usage} onOpenChange={open => { if (!open) onClose(); }}><DialogContent showCloseButton={false} overlayClassName="z-[115]" onOpenAutoFocus={() => { previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { event.preventDefault(); if (previousFocus.current?.isConnected && previousFocus.current.getClientRects().length) previousFocus.current.focus(); }} className={styles.dialog}><DialogTitle>Monthly AI limit reached</DialogTitle><DialogDescription>Your saved trips and manual editing remain available.</DialogDescription>{usage && <><p>{usage.used} of {usage.allowance} used · {usage.reserved} reserved/in progress · {usage.remaining} remaining.</p><p>Resets: {formatPlanDate(usage.resetsAt, usage.timezone)}</p></>}<div className={styles.actions}><button className={styles.button} onClick={onPlans}>View plans</button><button className={`${styles.button} ${styles.secondary}`} onClick={onSavedTrips}>Open saved trips</button><button className={`${styles.button} ${styles.secondary}`} onClick={onClose}>Close</button></div></DialogContent></Dialog>;
}
