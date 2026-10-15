'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { countryFlagCodes } from '@/lib/country-flag-codes';

/** Names remain visible beside this decorative flag; never infer country from a label. */
export function CountryFlag({ code }: { code: string }) {
  const iso = code.toUpperCase();
  const [failed, setFailed] = useState<string | null>(null);
  if (!countryFlagCodes.has(iso) || failed === iso) return <Globe aria-hidden="true" size={20} className="shrink-0" data-country-globe={iso} />;
  // Local, licensed SVG assets have fixed dimensions and need no image optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/flags/${iso.toLowerCase()}.svg`} alt="" aria-hidden="true" width={24} height={18} className="h-[18px] w-6 shrink-0 rounded-sm object-contain" onError={() => setFailed(iso)} data-country-flag={iso} />;
}
