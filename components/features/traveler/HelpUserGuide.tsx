'use client';

import type { RefObject } from 'react';
import { ArrowRight, Bookmark, ChevronRight, FileText, Map, MapPin, MessageSquare, Settings, WalletCards } from 'lucide-react';
import { HELP_GUIDES, type HelpGuide, type HelpGuideDestination, type HelpGuideId } from '@/lib/help-guides';
import styles from './HelpUserGuide.module.css';

const GUIDE_ICONS = { 'create-trip': FileText, 'saved-trips': Bookmark, maps: Map, visited: MapPin, budget: WalletCards, account: Settings };

function GuideDetail({ guide, onNavigate }: { guide: HelpGuide; onNavigate: (destination: HelpGuideDestination) => void }) {
  return (
    <section id="help-guide-detail" className={styles.detail} aria-labelledby="help-guide-title">
      <div className={styles.detailHeading}>
        <h2 id="help-guide-title">{guide.title}</h2>
        <p>{guide.introduction}</p>
      </div>
      <ol className={styles.steps} role="list" aria-label={`${guide.title} steps`}>
        {guide.steps.map((step, index) => (
          <li key={`${guide.id}-${index}`}>
            <span className={styles.number} aria-hidden="true">{index + 1}</span>
            <div><h3>{step.title}</h3><p>{step.description}</p></div>
          </li>
        ))}
      </ol>
      <div className={styles.actionArea}>
        <button type="button" className={styles.action} onClick={() => onNavigate(guide.action.destination)}>
          {guide.action.label}<ArrowRight size={17} aria-hidden="true"/>
        </button>
      </div>
    </section>
  );
}

export function HelpUserGuide({ selectedGuide, onSelectGuide, onNavigate, onFeedback, headingRef }: {
  selectedGuide: HelpGuideId;
  onSelectGuide: (guide: HelpGuideId) => void;
  onNavigate: (destination: HelpGuideDestination) => void;
  onFeedback: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const guide = HELP_GUIDES.find(item => item.id === selectedGuide) || HELP_GUIDES[0];
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1 ref={headingRef} tabIndex={-1}>How can we help you?</h1>
        <p>Simple steps for planning and managing your trips.</p>
      </div>
      <div className={styles.layout}>
        <section className={styles.selector} aria-labelledby="help-choose-guide">
          <h2 id="help-choose-guide">Choose a guide</h2>
          <div className={styles.topics}>
            {HELP_GUIDES.map(item => {
              const Icon = GUIDE_ICONS[item.id];
              return <button key={item.id} type="button" className={styles.topic} aria-pressed={item.id === guide.id} aria-controls="help-guide-detail" onClick={() => onSelectGuide(item.id)}>
                <span className={styles.icon}><Icon size={20} aria-hidden="true"/></span>
                <span>{item.title}</span><ChevronRight size={17} aria-hidden="true"/>
              </button>;
            })}
          </div>
        </section>
        <GuideDetail guide={guide} onNavigate={onNavigate}/>
      </div>
      <p className={styles.announcement} role="status">{guide.title} guide selected.</p>
      <section className={styles.support} aria-labelledby="help-support-title">
        <span className={styles.icon}><MessageSquare size={21} aria-hidden="true"/></span>
        <div><h2 id="help-support-title">Still need help?</h2><p>Tell us what happened.</p></div>
        <button type="button" className={styles.feedback} onClick={onFeedback}>Send feedback</button>
      </section>
    </div>
  );
}
