'use client';

import type { Ref } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, BedDouble, BusFront, Check, CircleAlert, Coins, Info, LoaderCircle, ReceiptText, ShieldCheck, Ticket, Utensils, WalletCards } from 'lucide-react';
import type { ItineraryResponse } from '@/lib/contracts';
import { formatMoney } from '@/lib/domain';
import { budgetReview, budgetSavingsSuggestions, type BudgetReviewOptions } from '@/lib/budget-review';
import styles from './BudgetReview.module.css';

type Props = {
  itinerary: ItineraryResponse | null; options?: BudgetReviewOptions; loading?: boolean;
  headingRef?: Ref<HTMLHeadingElement>; onBack: () => void; onEditBudget: () => void; onTripDetails: () => void;
};
const icons = { accommodation: BedDouble, food: Utensils, transportation: BusFront, activities: Ticket, other: ReceiptText, contingency: ShieldCheck };

export function BudgetReview({ itinerary, options, loading, headingRef, onBack, onEditBudget, onTripDetails }: Props) {
  const review = itinerary ? budgetReview(itinerary, options) : null;
  const suggestions = review ? budgetSavingsSuggestions(review) : [];
  const money = (amount: number | null) => amount === null ? 'Estimate unavailable' : formatMoney(amount, review!.currency);
  const over = review?.status === 'over-budget';
  return <div className={styles.page}>
    <div className={styles.heading}>
      <div><h1 ref={headingRef} tabIndex={-1}>Does this plan fit your budget?</h1><p>Review estimated spending before you travel.</p></div>
      <span className={styles.badge}><Info size={15} aria-hidden="true"/>Planning estimates</span>
    </div>
    {loading ? <section className={styles.empty} aria-busy="true"><LoaderCircle size={26} className={styles.spinner} aria-hidden="true"/><p role="status">Loading this trip’s budget review…</p></section> : !review || !itinerary ? <section className={styles.empty}>
      <span className={styles.emptyIcon}><WalletCards size={30} aria-hidden="true"/></span>
      <h2>Budget review begins after itinerary generation.</h2>
      <p>Add your trip details and generate an itinerary to review its available cost estimates. You can choose accommodation later.</p>
      <button type="button" className={styles.primary} onClick={onTripDetails}>Go to trip details<ArrowRight size={17} aria-hidden="true"/></button>
    </section> : <>
      {(review.budgetDraft || review.accommodationDraft) && <p role="status" className={styles.notice}><Info size={18} aria-hidden="true"/><span><strong>Trip detail preview.</strong> {review.budgetDraft && <>Your saved itinerary budget is {formatMoney(itinerary.totalBudget, itinerary.currency)}. </>}{review.accommodationDraft && 'The accommodation choice has changed. '}Generate and save an updated plan from trip details to keep these changes.</span></p>}
      <section className={styles.summary} aria-label="Budget summary" aria-live="polite" aria-atomic="true">
        <article className={styles.summaryCard}><span className={styles.goldIcon}><WalletCards size={27} aria-hidden="true"/></span><div><h2>Your budget</h2><strong data-budget-amount="budget">{money(review.budget)}</strong><small>{Math.max(1, itinerary.travelers || 1) > 1 ? `Whole-group budget · ${itinerary.travelers} travelers` : 'Total trip budget'}</small></div></article>
        <article className={styles.summaryCard}><span className={styles.goldIcon}><BarChart3 size={27} aria-hidden="true"/></span><div><h2>{review.incomplete ? 'Known estimated costs' : 'Estimated trip cost'}</h2><strong data-budget-amount="cost">{money(review.total)}</strong><small>{review.incomplete ? 'Some expenses still need estimates' : 'All available estimates included'}</small></div></article>
        <article className={`${styles.summaryCard} ${over ? styles.overBudget : review.incomplete ? styles.provisional : styles.remaining}`}><span className={over || review.incomplete ? styles.statusIcon : styles.greenIcon}>{over ? <CircleAlert size={27} aria-hidden="true"/> : <Coins size={27} aria-hidden="true"/>}</span><div><h2>{over ? 'Amount over budget' : 'Remaining budget'}</h2><strong data-budget-amount="remaining">{money(review.remaining === null ? null : Math.abs(review.remaining))}</strong><small>{over ? <><CircleAlert size={14} aria-hidden="true"/>Known estimates exceed your budget</> : review.incomplete ? <><Info size={14} aria-hidden="true"/>Provisional · affordability needs confirmation</> : <><Check size={15} aria-hidden="true"/>Within your estimated budget</>}</small></div></article>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="budget-breakdown-heading">
          <h2 id="budget-breakdown-heading">Estimated cost breakdown</h2>
          <p className={styles.caption}>Whole-trip amounts in {review.currency}. Percentages show the share of known estimated costs.</p>
          <ul className={styles.breakdown}>{review.categories.map(category => {
            const Icon = icons[category.key];
            return <li key={category.key} data-budget-category={category.key} className={styles.costRow}>
              <Icon size={23} aria-hidden="true"/>
              <div className={styles.categoryName}><span>{category.label}</span>{category.key === 'accommodation' && review.accommodationName && <small>{review.accommodationName}</small>}{category.status === 'partial' && <small>Additional estimates unavailable</small>}{category.status === 'excluded' && <small>No accommodation selected; costs excluded</small>}</div>
              <div className={styles.track} aria-hidden="true"><span style={{ width: `${category.percentage ?? 0}%` }}/></div>
              <div className={styles.rowAmount}><strong>{category.status === 'excluded' ? 'Excluded' : money(category.amount)}</strong><small>{category.percentage !== null ? `${Math.round(category.percentage)}%` : category.status === 'excluded' ? 'Not selected' : 'Price not provided'}</small></div>
            </li>;
          })}</ul>
          <div className={styles.total}><h3>{review.incomplete ? 'Known estimated costs' : 'Total estimated cost'}</h3><strong>{money(review.total)}</strong></div>
          {review.incomplete && <div className={styles.incompleteNote}><CircleAlert size={18} aria-hidden="true"/><p>{review.total === null ? 'Cost estimates are not available yet. Your budget is a spending limit, not a trip cost.' : 'Some expenses are unpriced or excluded. The remaining amount is provisional and does not confirm that the whole trip fits your budget.'}</p></div>}
          {review.mixedCurrency && <p className={styles.warning}>Prices in another currency are excluded. A valid conversion or a comparable estimate is needed before including them.</p>}
          {review.inconsistent && <p className={styles.warning}>Some recorded day totals do not match their expense breakdown. Confirm those estimates before relying on the total.</p>}
          <p className={styles.disclaimer}><Info size={18} aria-hidden="true"/><span>These costs are estimates. Actual prices may vary. Accommodation suggestions do not make a booking or payment.</span></p>
          <details className={styles.basis}><summary>How these estimates are counted</summary><p>Activity, food and transport amounts already cover their recorded participants and days. Shared fares and selected quotes are counted once. A stay’s quoted total covers its recorded rooms and nights; it is not multiplied by the number of travelers. Budget allocations and day totals are not added again.</p>{review.categories.some(item => item.key === 'contingency') && <p>Contingency uses the itinerary’s recorded percentage of the available subtotal; it is an allowance rather than a confirmed expense.</p>}</details>
        </section>
        <section className={styles.panel} aria-labelledby="budget-savings-heading">
          <h2 id="budget-savings-heading">Ways to spend less</h2>
          <p className={styles.caption}>Optional ideas to consider. Your itinerary stays unchanged.</p>
          <div className={styles.suggestions}>{suggestions.map(suggestion => {
            const Icon = icons[suggestion.key];
            return <article key={suggestion.key} className={styles.suggestion}><span className={styles.suggestionIcon}><Icon size={27} aria-hidden="true"/></span><div><h3>{suggestion.title}</h3><p>{suggestion.description}</p></div></article>;
          })}</div>
          {suggestions.length === 0 && <p className={styles.caption}>Keep checking current prices and compare suitable alternatives before making changes.</p>}
        </section>
      </div>
      <div className={styles.actions}><button type="button" className={styles.secondary} onClick={onBack}><ArrowLeft size={18} aria-hidden="true"/>Back to itinerary</button><button type="button" className={styles.primary} onClick={onEditBudget}>Edit trip budget</button></div>
    </>}
  </div>;
}
