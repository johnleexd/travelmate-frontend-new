# TravelMate frontend routes

| Route | App Router entry | Feature screen |
| --- | --- | --- |
| `/` | `app/(guest)/(index)/page.tsx` | `components/features/home/TravelMateLanding.tsx` |
| `/dashboard` | `app/dashboard/page.tsx` | `components/features/traveler/TravelerDashboard.tsx` |
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | `components/features/admin/AdminDashboard.tsx` |

The parentheses in `(guest)` and `(index)` are organizational route groups and
do not add URL segments. The dashboard routes retain their existing URLs and are
protected by the optimistic cookie-presence check in `proxy.ts`; backend requests
perform authoritative session and role validation.

Travelers and admins use the same login form. Public signup creates traveler
accounts; admin access comes from the account's saved role. The owner role and
dashboard have been removed.

The admin workspace contains Overview, Users, Reports, and System Health. Travelers
can report problems from the account page. Profile approval, trust scores, local
booking requests, and payment controls are no longer part of the active interface.
