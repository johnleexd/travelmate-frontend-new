'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { latestTestCheckout, testCheckoutRequest, type PlanCheckout, type PlanUsage } from '@/services/plan.service';
import styles from './MyPlan.module.css';

const failureMessage = (error: unknown) => error instanceof Error ? error.message : 'Test checkout could not be checked. Your current plan is unchanged.';
export function TestPlanCheckout({ usage, open, onOpenChange, opener }: { usage: PlanUsage; open: boolean; onOpenChange: (open: boolean) => void; opener: RefObject<HTMLButtonElement | null> }) {
  const [order, setOrder] = useState<PlanCheckout | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false);
  const orderId = order?.id, orderStatus = order?.status;
  useEffect(() => {
    const abort = new AbortController();
    const load = async () => {
      try {
        const params = new URLSearchParams(window.location.search), id = params.get('order'), returned = params.get('checkout');
        const result = id && /^[a-f0-9-]{36}$/i.test(id) && ['success', 'cancelled'].includes(returned || '')
          ? await testCheckoutRequest(returned === 'cancelled' ? 'cancel' : 'verify', id, abort.signal)
          : await latestTestCheckout(abort.signal);
        if (!abort.signal.aborted) { setOrder(result.order); window.dispatchEvent(new Event('travelmate-plan-refresh')); }
      } catch (reason) { if (!abort.signal.aborted) setError(failureMessage(reason)); }
    };
    void load();
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!orderId || !orderStatus || !['creating', 'pending'].includes(orderStatus)) return;
    const abort = new AbortController();
    let checking = false;
    const timer = window.setInterval(async () => {
      if (locked.current || checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const result = await testCheckoutRequest('verify', orderId, abort.signal);
        if (!abort.signal.aborted) { setOrder(result.order); if (result.order.status === 'paid') window.dispatchEvent(new Event('travelmate-plan-refresh')); }
      } catch (reason) { if (!abort.signal.aborted) setError(failureMessage(reason)); }
      finally { checking = false; }
    }, 5000);
    return () => { clearInterval(timer); abort.abort(); };
  }, [orderId, orderStatus]);
  async function run(action: 'create' | 'verify' | 'cancel', redirect = false) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await testCheckoutRequest(action, order?.id);
      setOrder(result.order); window.dispatchEvent(new Event('travelmate-plan-refresh'));
      if (redirect && result.order.checkoutUrl) {
        const url = new URL(result.order.checkoutUrl);
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.paymongo.com' || url.username || url.password || url.port) throw new Error('Invalid test checkout destination.');
        window.location.assign(url.href);
      }
    } catch (reason) { setError(failureMessage(reason)); }
    finally { locked.current = false; setBusy(false); }
  }
  const active = !!order && ['pending', 'creating'].includes(order.status);
  return <>{(order || error) && <section className={styles.recovery} aria-label="PayMongo test checkout">
    {error && <p role="alert">{error}</p>}
    {order && <><p role="status">{order.status === 'paid' ? 'Test payment verified. Demo Plus is ready; your monthly usage was preserved.' : order.status === 'cancelled' || order.status === 'expired' ? 'Test checkout cancelled. No Plus upgrade was applied.' : order.lastError === 'PAYMENT_FAILED' ? 'Payment attempt failed. You can retry at checkout or cancel. Plus has not been activated.' : order.status === 'failed' ? 'Test checkout could not be created. You can try again.' : order.status === 'creating' ? 'Preparing your test checkout. An interrupted request will be checked before another checkout can start.' : 'Test checkout is awaiting payment. Plus activates only after PayMongo verifies the payment.'}</p>
      {active && <div className={styles.actions}>{order.checkoutUrl && <button className={styles.button} disabled={busy} onClick={() => void run('create', true)}>Resume test checkout</button>}<button className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={() => void run('verify')}>Check payment status</button><button className={`${styles.button} ${styles.secondary}`} disabled={busy || order.status === 'creating'} onClick={() => void run('cancel')}>Cancel test checkout</button></div>}</>}
    </section>}
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent showCloseButton={false} overlayClassName="z-[115]" className={styles.dialog} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}><DialogTitle>Demo Plus — test checkout</DialogTitle><DialogDescription>Test payment — no real money charged. Live payments remain disabled.</DialogDescription><p>{usage.pricing} for {usage.testCheckout?.durationDays} days of demo Plus. Demo values only, not final live pricing.</p><p>Includes {usage.plans.plus} monthly AI generations. Usage already recorded this month remains counted.</p><button className={styles.button} disabled={busy || !usage.checkoutAvailable} onClick={() => void run('create', true)}>{busy ? 'Preparing checkout…' : active ? 'Resume test checkout' : 'Continue to PayMongo test checkout'}</button><button className={`${styles.button} ${styles.secondary}`} onClick={() => onOpenChange(false)}>Close</button>{error && <p role="alert">{error}</p>}</DialogContent></Dialog>
  </>;
}
