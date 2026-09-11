import Link from 'next/link';

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-[#071817] px-5 text-white"><section className="max-w-md text-center"><p className="text-sm font-bold uppercase tracking-widest text-amber-300">404</p><h1 className="mt-3 text-3xl font-black">That route is not on the itinerary.</h1><p className="mt-3 text-white/60">The page may have moved or the address may be incomplete.</p><Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-amber-300 px-6 py-3 font-bold text-slate-950">Return home</Link></section></main>;
}
