'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { PlacePhoto, type PhotoStatus, type PlacePhotoProps } from './PlacePhoto';
import { ActivityPhotoCredit } from './ActivityPhotoCredit';
import { verifiedActivityImage } from '@/lib/place-image';

type Props = Omit<PlacePhotoProps, 'requireAttribution' | 'onStatusChange'> & {
  frameClassName: string;
  creditClassName?: string;
  creditPosition?: 'below' | 'inside';
  showCredit?: boolean;
  caption?: ReactNode;
  children?: ReactNode;
  onPhotoFailure?: () => void;
  uncertainLocation?: boolean;
  fit?: 'cover' | 'contain';
};

/** Keep attribution attached to the actual loaded photo, never to its placeholder. */
export function ActivityPhoto({ frameClassName, creditClassName, creditPosition = 'below', showCredit = true, caption, children, onPhotoFailure, uncertainLocation = false, fit = 'cover', ...photo }: Props) {
  const asset = JSON.stringify([photo.src, photo.attribution]);
  const [load, setLoad] = useState<{ asset: string; status: PhotoStatus } | null>(null);
  const onStatusChange = useCallback((status: PhotoStatus) => { setLoad({ asset, status }); if (status === 'error') onPhotoFailure?.(); }, [asset, onPhotoFailure]);
  const uncertain = !verifiedActivityImage(photo.src, photo.attribution) ? 'Saved photo · Details unconfirmed' : uncertainLocation ? 'Saved photo · Location unconfirmed' : null;
  const loaded = load?.asset === asset && load.status === 'loaded';
  const credit = showCredit && (loaded || fit === 'contain' && photo.attribution) ? <div className={creditClassName} aria-hidden={!loaded} style={!loaded ? { visibility: 'hidden' } : undefined}>{uncertain && <>{uncertain}<br/></>}<ActivityPhotoCredit credit={photo.attribution} cropped={fit !== 'contain'}/></div> : null;
  return <>
    <div className={frameClassName}>
      <PlacePhoto {...photo} className={fit === 'contain' ? 'object-contain object-center' : photo.className} requireAttribution allowStored onStatusChange={onStatusChange}/>
      {children}
      {creditPosition === 'inside' && credit}
    </div>
    {caption}
    {!showCredit && loaded && (photo.attribution?.illustrative || photo.attribution?.photoType === 'destination') && !caption && <span data-illustrative-photo>{photo.attribution.photoType === 'destination' ? 'Destination photo' : 'Illustrative photo'}</span>}
    {creditPosition === 'below' && credit}
  </>;
}
