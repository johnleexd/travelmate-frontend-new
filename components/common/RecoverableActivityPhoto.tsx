'use client';
import { useState, type ComponentProps } from 'react';
import type { ImageAttribution } from '@/lib/contracts';
import { ActivityPhoto } from './ActivityPhoto';
import { useActivityPhotoFailure } from './ActivityPhotoRecovery';
import { GoogleActivityPhoto, useGoogleActivityPhotos } from './GoogleActivityPhoto';
import { usePlacesPhotoMapBoundary } from './PlacesPhotoMapBoundary';

export function RecoverableActivityPhoto({ day = 0, activityIndex = -1, fallbackSrc, fallbackAttribution, ...props }: ComponentProps<typeof ActivityPhoto> & { day?: number; activityIndex?: number; fallbackSrc?: string; fallbackAttribution?: ImageAttribution }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const failure = useActivityPhotoFailure(day, activityIndex, props.src);
  const google = useGoogleActivityPhotos();
  const boundary = usePlacesPhotoMapBoundary();
  const photo = google.photos[`${day}:${activityIndex}`];
  if (photo && (!boundary.active || boundary.hasPhotos) && boundary.mode === 'photos' && boundary.mapsOpen === 0) return <GoogleActivityPhoto key={photo.imageUrl} {...props} photo={photo} onFailure={() => google.onFailure(day, activityIndex)}/>;
  const destinationFallback = failedSrc === props.src && fallbackSrc && fallbackSrc !== props.src;
  return <ActivityPhoto {...props} {...(destinationFallback ? { src: fallbackSrc, attribution: fallbackAttribution ? { ...fallbackAttribution, photoType: 'destination', illustrative: true } : undefined, alt: 'Destination photo' } : {})} onPhotoFailure={!destinationFallback ? () => { setFailedSrc(props.src); if (day > 0 && activityIndex >= 0) failure(); } : undefined}/>;
}
