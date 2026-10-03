'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { WorkspaceSkeleton, type WorkspaceSkeletonVariant } from './WorkspaceSkeleton';

export function DashboardLoadState({ label, error, onRetry, variant = 'traveler' }: { label: string; error?: string; onRetry?: () => void; variant?: WorkspaceSkeletonVariant }) {
  if (!error) {
    return <WorkspaceSkeleton label={`Loading ${label}...`} variant={variant} />;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#07111f] px-5 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-red-900/70 bg-slate-950 p-6 text-center" role="alert" aria-labelledby="load-error-title">
        <AlertTriangle className="mx-auto text-red-300" aria-hidden="true" />
        <h1 id="load-error-title" className="mt-4 text-xl font-bold">Workspace unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{error}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mx-auto mt-5 flex min-h-11 items-center gap-2 rounded-lg bg-amber-300 px-4 py-2 font-bold text-slate-950"><RotateCw size={16} aria-hidden="true" />Try again</button>}
      </section>
    </main>
  );
}
