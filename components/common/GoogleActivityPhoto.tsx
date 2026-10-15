'use client';
import { createContext, useContext, useState, type ComponentProps } from 'react';
import type { GooglePlacePhoto } from '@/lib/google-place-photos';
import type { ActivityPhoto } from './ActivityPhoto';

export const GoogleActivityPhotos = createContext<{ photos: Record<string, GooglePlacePhoto>; onFailure: (day: number, index: number) => void }>({ photos: {}, onFailure: () => {} });
export const useGoogleActivityPhotos = () => useContext(GoogleActivityPhotos);

/** Raw on-demand image: never pass Google content to Next's persistent optimizer. */
export function GoogleActivityPhoto({ photo, onFailure, ...props }: ComponentProps<typeof ActivityPhoto> & { photo: GooglePlacePhoto; onFailure: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return <>
    <div className={props.frameClassName} data-google-place-photo={photo.placeId}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.imageUrl} alt={photo.activityName || props.alt} loading={props.eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" className={`absolute inset-0 h-full w-full ${props.fit === 'contain' ? 'object-contain object-center' : props.className || 'object-cover'}`} onLoad={() => setLoaded(true)} onError={onFailure}/>
      {props.children}
    </div>
    {props.caption && <figcaption>{photo.activityName}</figcaption>}
    {loaded && <span data-google-photo-credit className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded px-2 py-1 text-xs" style={{ backgroundColor: '#fff', color: '#1f1f1f', border: '1px solid #ddd' }}>
      <span translate="no" style={{ fontFamily: 'Roboto, sans-serif', fontStyle: 'normal', fontWeight: 400, fontSize: 12, letterSpacing: 'normal', whiteSpace: 'nowrap', color: '#1f1f1f' }}>Google Maps</span>
      {photo.authors.map((author, index) => <a key={index} href={author.uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline" style={{ color: '#1f1f1f' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {author.photoUri && <img src={author.photoUri} alt="" width={16} height={16} loading="lazy" referrerPolicy="no-referrer" className="rounded-full"/>}Photo: {author.displayName}
      </a>)}
      <a href={photo.googleMapsUri} target="_blank" rel="noreferrer" className="underline" style={{ color: '#1f1f1f' }}>View source photo</a>
    </span>}
  </>;
}
