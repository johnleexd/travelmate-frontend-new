'use client';

import Image from 'next/image';
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { placePhotoCandidates } from '@/lib/place-image';

type Props = {
  src: string | undefined;
  alt: string;
  sizes: string;
  className?: string;
  emptyMessage?: string;
  eager?: boolean;
};

export function PlacePhoto({ src, alt, sizes, className = 'object-cover', emptyMessage = 'No verified place photo available.', eager = false }: Props) {
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null);
  const candidates = placePhotoCandidates(src);
  const source = candidates.find(candidate => !failed.includes(candidate));

  if (!source) return <div className="absolute inset-0 grid place-items-center bg-slate-900 px-3 text-center text-xs text-slate-400">
    <div><MapPin className="mx-auto mb-2" size={22}/><p>{emptyMessage}</p>
      {candidates.length > 0 && <button type="button" onClick={() => setFailed([])} className="relative z-10 mt-2 min-h-8 border border-slate-600 px-3 text-xs text-slate-200 hover:bg-slate-800">Retry photo</button>}
    </div>
  </div>;

  return <>
    {loaded !== source && <div aria-hidden="true" className="absolute inset-0 grid animate-pulse place-items-center bg-slate-900 text-xs text-slate-400 motion-reduce:animate-none">Loading photo...</div>}
    <Image key={source} src={source} alt={alt} fill sizes={sizes} className={className}
      loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} quality={75}
      onLoad={() => setLoaded(source)}
      onError={() => setFailed(previous => previous.includes(source) ? previous : [...previous, source])}
    />
  </>;
}
