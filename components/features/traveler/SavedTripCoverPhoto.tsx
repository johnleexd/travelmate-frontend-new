'use client';

import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { placePhotoCandidates, savedCoverUnsplashSource } from '@/lib/place-image';
import styles from './SavedTripCards.module.css';

/** Card-specific failure presentation; keeps the existing cover geometry. */
export function SavedTripCoverPhoto({ src, alt, photoId, placeholderLabel = 'Destination photo unavailable' }: { src?: string; alt: string; photoId?: string; placeholderLabel?: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const unsplash = savedCoverUnsplashSource(src);
  const source = (unsplash ? [unsplash] : placePhotoCandidates(src)).find(candidate => !failed.includes(candidate));
  if (!source) return <div className={styles.placeholder}><MapPin aria-hidden="true" size={28}/><span>{placeholderLabel}</span></div>;
  return <Image key={source} src={source} alt={alt} data-photo-id={photoId} unoptimized={Boolean(unsplash)} fill loading="lazy" sizes="(max-width: 1280px) 100vw, 50vw" className="object-cover"
    onError={() => setFailed(current => current.includes(source) ? current : [...current, source])}/>;
}
