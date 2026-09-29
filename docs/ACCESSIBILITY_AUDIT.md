# TravelMate accessibility audit

> Audit date: 2026-09-15 (Asia/Shanghai)
>
> Scope: current landing, authentication, and role-dashboard browser flows

This is an evidence register for the capstone, not a claim of formal WCAG
conformance. Automated and code-backed checks are complete for the behaviors
listed below. A human assistive-technology pass remains required before the
accessibility item can be signed off.

## Verified in code and browser automation

- Landing and traveler-dashboard skip links reveal on keyboard focus and move
  focus to the primary content region.
- Dashboard stage changes move focus to the newly displayed workspace heading,
  giving keyboard and screen-reader users an explicit context change.
- Current pages use semantic headings, landmarks, labels, button names, status
  regions, and alternative text for meaningful images.
- Authentication and dashboard dialogs establish initial focus, trap focus,
  close with Escape, and restore focus to the triggering control.
- Interactive controls expose visible keyboard focus, and reduced-motion user
  preferences disable or simplify non-essential animation.
- The traveler flow is covered at a 390 px viewport without horizontal page
  overflow.

The Playwright scenario `dashboard keyboard navigation skips to content and
announces workspace changes` directly verifies the dashboard skip-link and
workspace-heading focus behavior. The complete suite also covers authentication,
guided onboarding, dialogs, roles, mobile layout, persistence, provider failures,
and supported currencies.

## Manual screen-reader sign-off — pending

Run at least NVDA with Chrome or Edge on Windows. A VoiceOver and Safari pass on
macOS is recommended when that environment is available. Test without a mouse and
record the outcome for each journey.

| Journey | What to verify | Result |
| --- | --- | --- |
| Landing and authentication | Skip link, navigation names, form labels, validation errors, password recovery, and focus after navigation | Pending |
| Dashboard orientation | Page purpose, six lifecycle stages, current-stage state, skip link, and workspace heading announcement | Pending |
| Define and generate | Field instructions, required/error states, busy state, provider failure, and retry announcement | Pending |
| Understand and refine | Itinerary structure, conditions, freshness, recommendations, activity controls, dialogs, and restored focus | Pending |
| Budget and travel options | Table/list reading order, currency context, unavailable-provider states, and actionable controls | Pending |
| Save and reopen | Save status, saved-trip actions, destructive confirmation, empty state, and returned focus | Pending |
| Account and session | Profile controls, logout, expired-session handling, and redirected-page announcement | Pending |

For each test, record the screen reader/browser versions, tester, date, pass or
fail result, and a reproducible issue with severity. Automated keyboard checks do
not replace this manual listening and navigation review.

