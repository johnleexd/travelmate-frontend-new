import { AlertTriangle, Clock3, Database, Radio } from 'lucide-react';
import type { FreshnessMetadata } from '@/lib/contracts';

export function ProviderFreshness({ freshness, compact = false }: { freshness?: FreshnessMetadata | null; compact?: boolean }) {
  if (!freshness) return <span className="text-[10px] text-white/35">Freshness metadata unavailable</span>;
  const stale = freshness.status === 'stale-cache';
  const unavailable = freshness.status === 'unavailable';
  const Icon = stale ? AlertTriangle : freshness.status === 'fresh-cache' ? Database : freshness.status === 'live' ? Radio : Clock3;
  const label = stale ? 'STALE CACHE' : freshness.status === 'fresh-cache' ? 'FRESH CACHE' : freshness.status === 'live' ? 'JUST FETCHED' : 'UNAVAILABLE';
  return <span title={`${freshness.policy} Fetched ${new Date(freshness.fetchedAt).toLocaleString()}.`} className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-bold tracking-wide ${stale ? 'border-amber-300/50 bg-amber-300/10 text-amber-200' : unavailable ? 'border-white/15 text-white/40' : 'border-cyan-300/30 bg-cyan-300/5 text-cyan-200'}`}><Icon size={11}/>{label}{!compact && !unavailable && <span className="font-normal tracking-normal opacity-70">· fetched {new Date(freshness.fetchedAt).toLocaleString()}</span>}</span>;
}
