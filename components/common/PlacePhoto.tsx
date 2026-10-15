'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { placePhotoCandidates, savedCoverUnsplashSource, verifiedActivityImage } from '@/lib/place-image';
import type { ImageAttribution } from '@/lib/contracts';
import { storedActivityImage } from '@/lib/stored-trip-photos';

export type PhotoStatus = 'missing' | 'loading' | 'loaded' | 'error';
export type PlacePhotoProps = {
  src: string | undefined;
  alt: string;
  sizes: string;
  className?: string;
  emptyMessage?: string;
  eager?: boolean;
  attribution?: ImageAttribution;
  requireAttribution?: boolean;
  allowStored?: boolean;
  onStatusChange?: (status: PhotoStatus) => void;
};

export function PlacePhoto(props: PlacePhotoProps) {
  // A replacement (including returning to an earlier URL) starts with fresh load state.
  return <PlacePhotoAsset key={JSON.stringify([props.src, props.attribution, props.requireAttribution, props.allowStored])} {...props}/>;
}

function PlacePhotoAsset({ src, alt, sizes, className = 'object-cover', emptyMessage = 'No verified place photo available.', eager = false, attribution, requireAttribution = false, allowStored = false, onStatusChange }: PlacePhotoProps) {
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null);
  const verified = allowStored ? storedActivityImage(src, attribution) : verifiedActivityImage(src, attribution);
  const unsplash = savedCoverUnsplashSource(verified);
  const candidates = unsplash ? [unsplash] : placePhotoCandidates(requireAttribution ? verified || undefined : src);
  const source = candidates.find(candidate => !failed.includes(candidate));
  const status: PhotoStatus = !source ? candidates.length ? 'error' : 'missing' : loaded === source ? 'loaded' : 'loading';
  useEffect(() => { onStatusChange?.(status); }, [onStatusChange, status]);

  if (!source) return <div data-photo-unavailable data-photo-state={status} className="absolute inset-0 grid place-items-center bg-slate-900 px-3 text-center text-xs text-slate-400">
    <div><MapPin className="mx-auto mb-2" size={22}/><p>{status === 'error' ? 'Photo could not load. Please retry.' : emptyMessage}</p>
      {status === 'error' && <button type="button" onClick={() => { setLoaded(null); setFailed([]); }} className="relative z-10 mt-2 min-h-8 border border-slate-600 px-3 text-xs text-slate-200 hover:bg-slate-800">Retry photo</button>}
    </div>
  </div>;

  return <>
    {loaded !== source && <div aria-hidden="true" className="absolute inset-0 grid animate-pulse place-items-center bg-slate-900 text-xs text-slate-400 motion-reduce:animate-none">Loading photo...</div>}
    <Image key={source} src={source} alt={attribution?.photoType === 'destination' ? alt.startsWith('Destination photo') ? alt : `Destination photo: ${alt}` : attribution?.illustrative ? `Illustrative photo for ${alt}` : alt} fill sizes={sizes} className={className} unoptimized={Boolean(unsplash)} data-photo-id={attribution?.photoId}
      loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} quality={75}
      onLoad={() => setLoaded(source)}
      onError={() => setFailed(previous => previous.includes(source) ? previous : [...previous, source])}
    />
  </>;
}
