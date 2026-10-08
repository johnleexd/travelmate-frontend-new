import type { SVGProps } from 'react';

/** Navigation arrow inside a satellite fix ring: distinct from the trip pin. */
export function GpsIcon({ size = 20, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="8" opacity=".55"/>
    <path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>
    <path d="m16.5 7.5-3 9-2.1-3.9-3.9-2.1 9-3Z" fill="currentColor" strokeWidth="1"/>
  </svg>;
}
