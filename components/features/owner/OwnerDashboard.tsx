'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Bell, Building2, CalendarCheck, LogOut, Pencil, Plus, Search, Settings, Trash2, WalletCards, X } from 'lucide-react';
import type { Booking, Listing, PublicUser } from '@/lib/domain';
import { CEBU_LOCATIONS } from '@/constants/cebu-locations';
import { handleResponse, isAuthenticationError } from '@/services/api.service';
import { DashboardLoadState } from '@/components/common/DashboardLoadState';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';

type OwnerData = { user: PublicUser; listings: Listing[]; bookings: Booking[]; directory: PublicUser[]; metrics: { held: number; released: number; frozen: number } };
type Tab = 'overview' | 'listings' | 'bookings' | 'finance' | 'profile';

async function request(body?: Record<string, unknown>) {
  const response = await fetch(body ? '/api/platform' : '/api/platform?scope=owner', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  return handleResponse<OwnerData & { result?: unknown }>(response);
}

const money = (value: number) => `PHP ${value.toLocaleString()}`;

export default function OwnerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<OwnerData | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<Listing | 'new' | null>(null);
  const [loadError, setLoadError] = useState('');

  const refresh = () => request().then(setData);
  const loadInitial = async () => {
    try { setData(await request()); }
    catch (error) {
      if (isAuthenticationError(error)) { router.replace('/'); return; }
      setLoadError(error instanceof Error ? error.message : 'TravelMate could not load the owner workspace.');
    }
  };
  useEffect(() => {
    void request().then(setData).catch((error: unknown) => {
      if (isAuthenticationError(error)) { router.replace('/'); return; }
      setLoadError(error instanceof Error ? error.message : 'TravelMate could not load the owner workspace.');
    });
  }, [router]);
  async function act(body: Record<string, unknown>, success: string) { setBusy(true); setMessage(''); try { await request(body); await refresh(); setMessage(success); } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed.'); } finally { setBusy(false); } }
  async function logout() { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); router.replace('/'); }

  const filtered = useMemo(() => data?.listings.filter((item) => (status === 'all' || item.status === status) && item.name.toLowerCase().includes(search.toLowerCase())) ?? [], [data, search, status]);
  if (!data) return <DashboardLoadState label="the owner workspace" error={loadError} onRetry={() => { setLoadError(''); void loadInitial(); }} />;
  const requests = data.bookings.filter((item) => item.status === 'cancel_requested' || item.status === 'change_requested');
  const occupancy = data.listings.reduce((sum, item) => sum + item.capacity - item.available, 0);
  const capacity = data.listings.reduce((sum, item) => sum + item.capacity, 0);
  const listingName = (id: string) => data.listings.find((item) => item.id === id)?.name || id;
  const travelerName = (id: string) => data.directory.find((item) => item.id === id)?.name || 'Traveler';

  return <div className="min-h-screen bg-[#07111f] text-slate-100">
    <header className="sticky top-0 z-40 h-16 border-b border-slate-800 bg-[#07111f]/95 backdrop-blur px-5 flex items-center justify-between">
      <button onClick={() => router.push('/')} className="font-extrabold flex items-center gap-2"><Building2 className="text-emerald-400"/>TravelMate Owner</button>
      <div className="flex items-center gap-3"><button type="button" aria-label="Open booking requests" title="Open booking requests" onClick={()=>setTab('bookings')} className="relative p-2"><Bell size={18}/>{requests.length>0&&<span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] grid place-items-center">{requests.length}</span>}</button><button type="button" aria-label="Sign out" title="Sign out" onClick={logout} className="p-2"><LogOut size={18}/></button></div>
    </header>
    <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-8 px-4 lg:grid-cols-[210px_minmax(0,1fr)] lg:px-8">
      <aside aria-label="Owner workspace" className="flex min-w-0 max-w-full gap-1 overflow-x-auto py-5 [scrollbar-width:thin] lg:flex-col lg:py-8">
        {([['overview','Overview',BarChart3],['listings','Listings',Building2],['bookings','Bookings',CalendarCheck],['finance','Finance',WalletCards],['profile','Profile',Settings]] as const).map(([id,label,Icon])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)} className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold ${tab===id?'bg-emerald-400 text-slate-950':'text-slate-400 hover:bg-slate-900'}`}><Icon size={16}/>{label}</button>)}
      </aside>
      <main className="py-5 lg:py-8 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-7"><div><p className="text-xs uppercase tracking-widest text-emerald-400">Destination operations</p><h1 className="text-2xl font-bold">{tab[0].toUpperCase()+tab.slice(1)}</h1></div><span className="border border-slate-700 rounded-full px-3 py-1 text-xs">Trust {data.user.trustScore}/100 · {data.user.profileStatus}</span></div>
        {message&&<p role="status" className="mb-5 border border-slate-700 bg-slate-900 px-4 py-3 rounded-md text-sm">{message}</p>}

        {tab==='overview'&&<div className="space-y-8">
          <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><Stat label="Active listings" value={String(data.listings.filter(x=>x.status==='approved').length)}/><Stat label="Bookings" value={String(data.bookings.length)}/><Stat label="Occupancy" value={capacity?`${Math.round(occupancy/capacity*100)}%`:'0%'}/><Stat label="Held funds" value={money(data.metrics.held)}/></section>
          <section className="grid lg:grid-cols-2 gap-8"><div><SectionTitle title="Needs attention"/><div className="divide-y divide-slate-800">{requests.length===0&&data.listings.every(x=>x.status!=='pending')?<Empty text="No operational items need attention."/>:<>{requests.map(item=><button key={item.id} onClick={()=>setTab('bookings')} className="w-full text-left py-4"><strong className="text-sm">{travelerName(item.travelerId)} requested {item.status==='cancel_requested'?'cancellation':'a change'}</strong><p className="text-xs text-slate-500">{listingName(item.listingId)}</p></button>)}{data.listings.filter(x=>x.status==='pending').map(item=><button key={item.id} onClick={()=>setTab('listings')} className="w-full text-left py-4"><strong className="text-sm">{item.name} is awaiting review</strong><p className="text-xs text-slate-500">Submitted to the admin queue</p></button>)}</>}</div></div><div><SectionTitle title="Inventory health"/><div className="space-y-4">{data.listings.slice(0,5).map(item=><div key={item.id}><div className="flex justify-between text-xs mb-1"><span>{item.name}</span><span className="text-slate-500">{item.capacity-item.available}/{item.capacity}</span></div><div className="h-2 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-emerald-400" style={{width:`${item.capacity?((item.capacity-item.available)/item.capacity)*100:0}%`}}/></div></div>)}</div></div></section>
        </div>}

        {tab==='listings'&&<div className="space-y-5">
          <div className="flex flex-wrap gap-3 justify-between"><div className="flex gap-2 flex-1 max-w-xl"><label className="relative flex-1"><span className="sr-only">Search listings</span><Search size={15} className="absolute left-3 top-3 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search listings" className="w-full bg-slate-950 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm"/></label><select aria-label="Filter listings by status" value={status} onChange={e=>setStatus(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-md px-3 text-sm"><option value="all">All status</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></div><button type="button" onClick={()=>setEditing('new')} className="bg-emerald-400 text-slate-950 px-3 py-2 rounded-md font-bold text-sm flex items-center gap-2"><Plus size={16}/>New listing</button></div>
          <div className="overflow-x-auto border border-slate-800 rounded-md"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-900 text-slate-400 text-xs"><tr><th className="text-left p-3">Listing</th><th className="text-left">Status</th><th className="text-left">Price</th><th className="text-left">Capacity</th><th className="text-left">Location</th><th className="text-right p-3">Actions</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id} className="border-t border-slate-800"><td className="p-3"><strong>{item.name}</strong><p className="text-xs text-slate-500">{item.category}</p></td><td><Status value={item.status}/></td><td>{money(item.price)}</td><td>{item.available}/{item.capacity}</td><td className="text-slate-400 max-w-48"><strong className="text-slate-300">{item.municipality}</strong><p className="truncate text-xs">{item.address||'Address not set'}</p></td><td className="p-3"><div className="flex justify-end gap-1"><button type="button" aria-label={`Edit ${item.name}`} title="Edit listing" onClick={()=>setEditing(item)} className="p-2 hover:bg-slate-800 rounded"><Pencil size={15}/></button><button type="button" aria-label={`Delete ${item.name}`} title="Delete listing" onClick={()=>{if(confirm(`Delete ${item.name}?`))void act({action:'delete-listing',id:item.id},'Listing deleted.')}} className="p-2 hover:bg-red-950 text-red-300 rounded"><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>
        </div>}

        {tab==='bookings'&&<div className="space-y-4"><div className="overflow-x-auto border border-slate-800 rounded-md"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-900 text-xs text-slate-400"><tr><th className="text-left p-3">Traveler</th><th className="text-left">Listing</th><th className="text-left">Guests / stay</th><th className="text-left">Booking</th><th className="text-left">Payment</th><th className="text-right p-3">Decision</th></tr></thead><tbody>{data.bookings.map(item=><tr key={item.id} className="border-t border-slate-800"><td className="p-3"><strong>{travelerName(item.travelerId)}</strong><p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</p></td><td>{listingName(item.listingId)}</td><td>{item.guests}{item.nights>1?<p className="text-xs text-slate-500">{item.nights} nights</p>:null}</td><td><Status value={item.status}/></td><td>{item.paymentStatus}</td><td className="p-3"><div className="flex justify-end gap-2">{['cancel_requested','change_requested'].includes(item.status)&&<><button disabled={busy} onClick={()=>void act({action:'owner-request-decision',id:item.id,decision:'approve'},'Traveler request approved.')} className="bg-emerald-400 text-slate-950 px-2 py-1 rounded text-xs font-bold disabled:opacity-50">Approve</button><button disabled={busy} onClick={()=>void act({action:'owner-request-decision',id:item.id,decision:'decline'},'Traveler request declined.')} className="border border-slate-600 px-2 py-1 rounded text-xs disabled:opacity-50">Decline</button></>}</div></td></tr>)}</tbody></table></div></div>}

        {tab==='finance'&&<div className="space-y-7"><p className="rounded-md border border-amber-900 bg-amber-950/20 p-3 text-sm text-amber-200">Payment states are a database-backed simulation. No money moves until PayMongo is integrated.</p><section className="grid sm:grid-cols-3 gap-4"><Stat label="Held (simulated)" value={money(data.metrics.held)}/><Stat label="Released (simulated)" value={money(data.metrics.released)}/><Stat label="Frozen (simulated)" value={money(data.metrics.frozen)}/></section><div className="border border-slate-800 rounded-md divide-y divide-slate-800">{data.bookings.map(item=><div key={item.id} className="p-4 flex flex-wrap justify-between gap-3"><div><strong>{listingName(item.listingId)}</strong><p className="text-xs text-slate-500">{item.id} · {travelerName(item.travelerId)}</p></div><div className="text-right"><p className="font-mono">{money(item.amount)}</p><p className="text-xs text-slate-400">{item.paymentStatus}</p></div>{item.paymentStatus==='PAID_HELD'&&<button disabled={busy} onClick={()=>void act({action:'release-payment',id:item.id},'Simulated payment marked as released.')} className="border border-emerald-500 text-emerald-300 px-3 py-1 rounded-md text-xs">Mark released</button>}</div>)}</div></div>}

        {tab==='profile'&&<div className="max-w-2xl grid gap-7"><section className="grid sm:grid-cols-2 gap-4"><Stat label="Account" value={data.user.accountStatus}/><Stat label="Verification" value={data.user.profileStatus}/><Stat label="Email" value={data.user.email}/><Stat label="Trust score" value={`${data.user.trustScore}/100`}/></section><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void act({action:'submit-profile',phone:f.get('phone'),bio:f.get('bio')},'Profile sent for verification.')}} className="space-y-3"><SectionTitle title="Profile details"/><label className="block text-xs text-slate-400">Phone<input name="phone" defaultValue={data.user.phone} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white"/></label><label className="block text-xs text-slate-400">About your business<textarea name="bio" defaultValue={data.user.bio} rows={5} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white"/></label><button className="bg-emerald-400 text-slate-950 px-4 py-2 rounded-md font-bold">Submit verification update</button></form></div>}
      </main>
    </div>
    {editing&&<ListingDialog key={editing==='new'?'new':editing.id} listing={editing==='new'?undefined:editing} busy={busy} onClose={()=>setEditing(null)} onSave={async body=>{await act(body,editing==='new'?'Listing submitted for approval.':'Listing updated.');setEditing(null)}}/>}
  </div>;
}

function ListingDialog({listing,busy,onClose,onSave}:{listing?:Listing;busy:boolean;onClose:()=>void;onSave:(body:Record<string,unknown>)=>Promise<void>}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  useModalAccessibility({ active: true, containerRef, initialFocusRef: nameRef, onClose });

  return <div ref={containerRef} className="fixed inset-0 z-50 bg-black/70 p-4 grid place-items-center" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><form role="dialog" aria-modal="true" aria-labelledby="listing-dialog-title" aria-describedby="listing-dialog-description" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void onSave({action:listing?'update-listing':'create-listing',id:listing?.id,name:f.get('name'),category:f.get('category'),municipality:f.get('municipality'),price:Number(f.get('price')),capacity:Number(f.get('capacity')),address:f.get('address'),description:f.get('description'),amenities:f.get('amenities'),imageUrl:f.get('imageUrl')})}} className="bg-[#0b1726] border border-slate-700 rounded-md p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"><div className="flex justify-between mb-5"><div><p className="text-xs text-emerald-300 uppercase">Listing editor</p><h2 id="listing-dialog-title" className="text-xl font-bold">{listing?'Edit listing':'New listing'}</h2><p id="listing-dialog-description" className="sr-only">Enter the listing details, then submit them for administrator review.</p></div><button type="button" aria-label="Close listing editor" title="Close" onClick={onClose}><X/></button></div><div className="grid sm:grid-cols-2 gap-3"><Field label="Name"><input ref={nameRef} required name="name" defaultValue={listing?.name}/></Field><Field label="Category"><select name="category" defaultValue={listing?.category||'stay'}><option value="stay">Stay</option><option value="activity">Activity</option><option value="food">Food</option><option value="transport">Transport</option></select></Field><Field label="City / municipality"><select required name="municipality" defaultValue={listing?.municipality||'Cordova'}>{CEBU_LOCATIONS.map(location=><option key={location} value={location}>{location}</option>)}</select></Field><Field label="Price (PHP)"><input required min="1" type="number" name="price" defaultValue={listing?.price}/></Field><Field label="Capacity"><input required min="1" type="number" name="capacity" defaultValue={listing?.capacity}/></Field><Field label="Address" wide><input name="address" defaultValue={listing?.address}/></Field><Field label="Amenities (comma separated)" wide><input name="amenities" defaultValue={listing?.amenities.join(', ')}/></Field><Field label="Image URL" wide><input type="url" name="imageUrl" defaultValue={listing?.imageUrl}/></Field><Field label="Description" wide><textarea rows={4} name="description" defaultValue={listing?.description}/></Field></div><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={onClose} className="px-4 py-2">Cancel</button><button disabled={busy} className="bg-emerald-400 text-slate-950 px-4 py-2 rounded-md font-bold">{listing?'Save changes':'Submit listing'}</button></div></form></div>
}
function Field({label,wide=false,children}:{label:string;wide?:boolean;children:React.ReactNode}) { return <label className={`text-xs text-slate-400 ${wide?'sm:col-span-2':''}`}>{label}<div className="mt-1 [&>*]:w-full [&>*]:bg-slate-950 [&>*]:border [&>*]:border-slate-700 [&>*]:rounded-md [&>*]:px-3 [&>*]:py-2 [&>*]:text-white">{children}</div></label> }
function Stat({label,value}:{label:string;value:string}) { return <div className="border-t border-slate-700 py-4 min-w-0"><p className="text-xs text-slate-500 uppercase">{label}</p><strong className="text-xl break-words">{value}</strong></div> }
function SectionTitle({title}:{title:string}) { return <h2 className="font-bold text-lg mb-3">{title}</h2> }
function Status({value}:{value:string}) { const color=value==='approved'||value==='confirmed'||value==='completed'?'text-emerald-300':value==='rejected'||value==='cancelled'?'text-red-300':'text-amber-300';return <span className={`text-xs ${color}`}>{value.replaceAll('_',' ')}</span> }
function Empty({text}:{text:string}) { return <p className="text-sm text-slate-500 py-6">{text}</p> }
