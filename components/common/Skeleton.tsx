import type { ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse bg-white/[0.09] ${className}`} />;
}

export function SkeletonRegion({ label, children, className = '', showLabel = false }: {
  label: string;
  children: ReactNode;
  className?: string;
  showLabel?: boolean;
}) {
  return <div role="status" aria-label={label} aria-busy="true" className={className}>
    <span className={showLabel ? 'mb-4 block text-sm text-white/60' : 'sr-only'}>{label}</span>
    <div aria-hidden="true">{children}</div>
  </div>;
}
