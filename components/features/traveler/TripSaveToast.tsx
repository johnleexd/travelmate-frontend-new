'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, CircleAlert, X } from 'lucide-react';
import styles from './TravelerDashboard.module.css';

export type TripSaveFeedback = { id: number; kind: 'success' | 'error' };

export function TripSaveToast({ toast, onDismiss }: { toast: TripSaveFeedback; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [toast.id, paused, onDismiss]);
  const success = toast.kind === 'success';
  return <div className={styles.saveToast} data-trip-save-toast onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
    <div role={success ? 'status' : 'alert'} aria-atomic="true" className={styles.toastContent}>
      {success ? <CircleCheck size={25} aria-hidden="true" className={styles.toastSuccessIcon}/> : <CircleAlert size={25} aria-hidden="true" className={styles.toastErrorIcon}/>}
      <div><p className={styles.toastTitle}>{success ? 'Trip updated successfully' : 'Couldn’t update trip. Please try again.'}</p>{success && <p className={styles.toastMessage}>Your changes have been saved.</p>}</div>
    </div>
    <button type="button" aria-label={success ? 'Dismiss success notification' : 'Dismiss error notification'} onClick={onDismiss} className={styles.toastClose}><X size={16} aria-hidden="true"/></button>
  </div>;
}
