# TravelMate frontend routes

| Route | App Router entry | Feature screen |
| --- | --- | --- |
| `/` | `app/(guest)/(index)/page.tsx` | `components/features/home/TravelMateLanding.tsx` |
| `/dashboard` | `app/dashboard/page.tsx` | `components/features/traveler/TravelerDashboard.tsx` |
| `/owner/dashboard` | `app/owner/dashboard/page.tsx` | `components/features/owner/OwnerDashboard.tsx` |
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | `components/features/admin/AdminDashboard.tsx` |

The parentheses in `(guest)` and `(index)` are organizational route groups and
do not add URL segments. The dashboard routes retain their existing URLs and are
protected by the optimistic cookie-presence check in `proxy.ts`; backend requests
perform authoritative session and role validation.
