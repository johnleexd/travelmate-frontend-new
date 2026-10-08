'use client';

import { useState } from 'react';
import type { PublicUser } from '@/lib/contracts';

export function UserAvatar({ user }: { user: Pick<PublicUser, 'name' | 'avatarUrl'> }) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>();
  const initials = user.name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const url = user.avatarUrl;
  return <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/15 bg-[#ffcf70]/15 text-xs font-bold text-[#ffcf70]">
    {url && url !== failedUrl && url.startsWith('https://') ?
      // Arbitrary user photos are remote URLs; browser loading avoids server-side fetching.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={`Profile photo of ${user.name}`} width={40} height={40} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} className="size-full object-cover"/> : <span role="img" aria-label={`Default avatar for ${user.name}`}>{initials}</span>}
  </span>;
}
