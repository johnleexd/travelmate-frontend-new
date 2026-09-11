'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[TravelMate] Page rendering failed:', error); }, [error]);
  return <main className="grid min-h-screen place-items-center bg-[#071817] px-5 text-white"><section className="max-w-md text-center" role="alert"><p className="text-sm font-bold uppercase tracking-widest text-amber-300">Something went wrong</p><h1 className="mt-3 text-3xl font-black">TravelMate could not open this page.</h1><p className="mt-3 text-white/60">Your saved data has not been changed. Try loading the page again.</p><button type="button" onClick={reset} className="mt-6 min-h-11 rounded-full bg-amber-300 px-6 py-3 font-bold text-slate-950">Try again</button></section></main>;
}
