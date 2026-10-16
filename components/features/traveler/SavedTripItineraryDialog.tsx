'use client';

import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, MapPin, X } from 'lucide-react';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import { ItineraryWorkspace, type ItineraryWorkspaceProps } from './ItineraryWorkspace';
import theme from './TravelerDashboard.module.css';
import styles from './SavedTripItineraryDialog.module.css';

type Props = { workspace: ItineraryWorkspaceProps; onClose: () => void };

export function SavedTripItineraryDialog({ workspace, onClose }: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { itinerary } = workspace;
  const travelers = itinerary.travelers ?? workspace.travelers;

  useModalAccessibility({ active: true, containerRef: dialogRef, initialFocusRef: closeRef, onClose });

  return createPortal(
    <div className={styles.overlay} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} tabIndex={-1} className={`${theme.theme} ${styles.dialog}`}>
        <header className={styles.header}>
          <div className={styles.title}>
            <p className={styles.eyebrow}>Saved itinerary</p>
            <h2 id={`${id}-title`}>{itinerary.destination}</h2>
            <p id={`${id}-description`} className={styles.description}><MapPin size={15} aria-hidden="true"/>{itinerary.days.length} {itinerary.days.length === 1 ? 'day' : 'days'}<span aria-hidden="true">·</span>{travelers} {travelers === 1 ? 'traveler' : 'travelers'}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className={styles.close} aria-label="Close itinerary"><X size={22} aria-hidden="true"/></button>
        </header>
        <div ref={scrollRef} className={styles.content} data-saved-itinerary-scroll>
          <ItineraryWorkspace {...workspace} readOnly compactHeader scrollContainerRef={scrollRef}/>
        </div>
        <footer className={styles.footer}>
          <button type="button" onClick={onClose}><ArrowLeft size={16} aria-hidden="true"/>Back to saved trips</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
