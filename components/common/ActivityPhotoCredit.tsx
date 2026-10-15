import type { ImageAttribution } from '@/lib/contracts';
import { commonsPhotoLicenseUrl } from '@/lib/place-image';

export function ActivityPhotoCredit({ credit, className, cropped = true }: { credit?: ImageAttribution; className?: string; cropped?: boolean }) {
  if (!credit) return null;
  if (credit.provider !== 'unsplash' && credit.license !== 'Unsplash') {
    const licenseUrl = commonsPhotoLicenseUrl(credit.license, credit.licenseUrl);
    if (!licenseUrl) return null;
    return <span className={className}>{(credit.illustrative || credit.photoType === 'destination') && <span data-illustrative-photo>{credit.photoType === 'destination' ? 'Destination photo' : 'Illustrative photo'} · </span>}<a href={credit.sourceUrl} target="_blank" rel="noreferrer">Photo: {credit.creator}</a> · <a href={licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a>{cropped && <> · Cropped to fit</>}</span>;
  }
  return <span className={className}>
    {(credit.illustrative || credit.photoType === 'destination') && <span data-illustrative-photo>{credit.photoType === 'destination' ? 'Destination photo' : 'Illustrative photo'} · </span>}
    Photo by <a href={credit.photographerUrl} target="_blank" rel="noreferrer" className="underline">{credit.creator}</a> on <a href={credit.sourceUrl} target="_blank" rel="noreferrer" className="underline">Unsplash</a>
  </span>;
}
