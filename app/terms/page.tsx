import Link from 'next/link';
export default function TermsPage() {
  return <main className="mx-auto min-h-screen max-w-3xl space-y-5 px-6 py-12"><Link href="/">TravelMate</Link><h1 className="text-3xl font-bold">Terms of use</h1><p>TravelMate provides travel planning estimates and suggestions. Confirm opening hours, access, prices and bookings with the relevant provider.</p><p>When Google Places photos are displayed, your use of that content is also subject to the <a className="underline" href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noreferrer">Google Maps/Google Earth Additional Terms of Service</a>. Photo and source credits are shown with each Google photo.</p><Link className="underline" href="/privacy">Privacy policy</Link></main>;
}
