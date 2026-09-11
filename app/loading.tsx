import { LoaderCircle } from 'lucide-react';

export default function Loading() {
  return <main className="grid min-h-screen place-items-center bg-[#071817] text-white" aria-busy="true" aria-live="polite"><div className="flex items-center gap-3"><LoaderCircle className="animate-spin text-amber-300" aria-hidden="true" />Loading TravelMate...</div></main>;
}
