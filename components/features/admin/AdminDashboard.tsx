'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Activity, Bell, Compass, HeartPulse, LogOut, ShieldCheck, UserRound, Users, X, type LucideIcon } from 'lucide-react';
import { Overview, UsersView, ReportsView, HealthView, type AdminTab as Tab } from './AdminPanels';
import type { PlatformActionResponse, PlatformResponse } from '@/lib/contracts';
import { handleResponse, isAuthenticationError } from '@/services/api.service';
import { DashboardLoadState } from '@/components/common/DashboardLoadState';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const TAB_COPY: Record<Tab, { title: string; description: string }> = {
  overview: { title: 'Overview', description: 'See the health of the traveler journey and act on its most important constraint.' },
  reports: { title: 'Reports', description: 'Review problems reported by travelers and track their resolution.' },
  health: { title: 'System Health', description: 'Check service configuration, recent generation failures, and account activity.' },
  users: { title: 'Users', description: 'Manage traveler and admin access without exposing private data across roles.' },
};

async function request(): Promise<PlatformResponse>;
async function request(body: Record<string, unknown>): Promise<PlatformActionResponse>;
async function request(body?: Record<string, unknown>): Promise<PlatformResponse | PlatformActionResponse> {
  const response = await fetch(body ? '/api/platform' : '/api/platform?scope=admin', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  return body ? handleResponse<PlatformActionResponse>(response) : handleResponse<PlatformResponse>(response);
}

export default function AdminDashboard() {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<PlatformResponse | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [message, setMessage] = useState('');
  const sectionVersionRef = useRef(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuCloseRef = useRef<HTMLButtonElement | null>(null);

  const refresh = () => request().then(setData);
  const loadInitial = async () => { try { setData(await request()); } catch (error) { if (isAuthenticationError(error)) { router.replace('/'); return; } setLoadError(error instanceof Error ? error.message : 'TravelMate could not load the admin control room.'); } };
  useEffect(() => { void request().then(setData).catch((error: unknown) => { if (isAuthenticationError(error)) { router.replace('/'); return; } setLoadError(error instanceof Error ? error.message : 'TravelMate could not load the admin control room.'); }); }, [router]);
  useModalAccessibility({ active: profileMenuOpen, containerRef: profileMenuRef, initialFocusRef: profileMenuCloseRef, onClose: () => setProfileMenuOpen(false) });

  useGSAP(() => {
    if (!data || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.from('[data-admin-reveal]', { y: 24, opacity: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out' });
    gsap.from('[data-admin-card]', { y: 36, opacity: 0, duration: 0.75, stagger: 0.07, ease: 'power3.out' });
    ScrollTrigger.refresh();
  }, { scope: pageRef, dependencies: [data, tab], revertOnUpdate: true });

  async function act(body: Record<string, unknown>, success = 'Action persisted and added to the audit log.', onError?: (message: string) => void) {
    const sectionVersion = sectionVersionRef.current;
    setBusy(true); setMessage('');
    try { await request(body); if (sectionVersion === sectionVersionRef.current) setMessage(success); await refresh().catch(() => undefined); return true; }
    catch (error) { const message = error instanceof Error ? error.message : 'Action failed.'; if (sectionVersion === sectionVersionRef.current) { setMessage(message); onError?.(message); } return false; }
    finally { setBusy(false); }
  }
  async function logout() { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); router.replace('/'); }
  function openTab(next: Tab) { sectionVersionRef.current += 1; setMessage(''); setTab(next); setFilter('all'); setSearch(''); }

  const users = useMemo(() => data?.directory.filter((item) => (filter === 'all' || item.role === filter || item.accountStatus === filter) && `${item.name} ${item.email}`.toLowerCase().includes(search.toLowerCase())) ?? [], [data, filter, search]);
  if (!data) return <DashboardLoadState label="the admin control room" error={loadError} onRetry={() => { setLoadError(''); void loadInitial(); }}/ >;

  const pending = data.moderation.filter(item => item.kind === 'report' && item.status === 'pending').length;
  const copy = TAB_COPY[tab];
  const adminInitials = data.user.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AD';
  const nav: Array<[Tab, string, LucideIcon]> = [['overview', 'Overview', Activity], ['users', 'Users', Users], ['reports', 'Reports', Bell], ['health', 'System Health', HeartPulse]];

  return <div ref={pageRef} className="admin-dashboard min-h-screen w-full max-w-full overflow-x-clip bg-[#0b1d1a] pt-20 text-slate-100">
    <a href="#admin-main-content" className="sr-only z-[100] bg-[#f1ead8] px-4 py-2 font-bold text-[#14231f] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to admin workspace</a>
    <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4 sm:px-6">
      <div className="mx-auto flex h-16 w-full max-w-[1380px] items-center justify-between border border-white/15 bg-[#102824]/88 px-4 text-white shadow-[0_18px_50px_rgba(8,24,22,.22)] backdrop-blur-xl sm:px-6">
        <button onClick={() => router.push('/')} className="group flex items-center gap-3 text-left" aria-label="TravelMate home">
          <span className="grid size-9 place-items-center bg-[#ffcf70] text-[#102824] transition-transform duration-500 group-hover:-rotate-6"><Compass size={20} strokeWidth={2.2}/></span>
          <span className="text-lg font-semibold">TravelMate</span>
        </button>
        <div className="flex min-w-0 items-center">
          <button type="button" onClick={() => setProfileMenuOpen(true)} aria-label={`Open profile menu for ${data.user.name}`} aria-haspopup="dialog" aria-expanded={profileMenuOpen} aria-controls="admin-profile-menu" className="flex min-w-0 items-center gap-2 border border-white/15 bg-white/[0.04] py-1.5 pl-1.5 pr-3 text-left transition-colors hover:border-[#ffcf70]/50 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffcf70] sm:gap-3">
            <span className="grid size-9 shrink-0 place-items-center bg-[#ffcf70] text-xs font-black text-[#102824]">{adminInitials}</span>
            <span className="hidden min-w-0 sm:block"><strong className="block max-w-36 truncate text-xs font-bold text-white">{data.user.name}</strong><span className="block max-w-44 truncate text-[10px] text-white/60">Admin · {data.user.email}</span></span>
            <UserRound size={15} className="shrink-0 text-[#ffcf70]" />
          </button>
        </div>
      </div>
    </header>

    {profileMenuOpen && <div className="fixed inset-0 z-[80]">
      <button type="button" aria-label="Close profile menu" onClick={() => setProfileMenuOpen(false)} className="traveler-profile-backdrop absolute inset-0 bg-[#061714]/65 backdrop-blur-sm" />
      <aside ref={profileMenuRef} id="admin-profile-menu" role="dialog" aria-modal="true" aria-labelledby="admin-profile-menu-title" tabIndex={-1} className="traveler-profile-drawer absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-white/15 bg-[#102824] text-white shadow-[-24px_0_70px_rgba(0,0,0,.35)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#ffcf70]">TravelMate</p><h2 id="admin-profile-menu-title" className="mt-1 text-lg font-semibold">Admin account</h2></div>
          <button ref={profileMenuCloseRef} type="button" aria-label="Close profile menu" onClick={() => setProfileMenuOpen(false)} className="grid size-10 place-items-center border border-white/20 text-white/75 transition-colors hover:bg-white/10 hover:text-white"><X size={18}/></button>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3 border border-white/15 bg-white/[0.04] p-3">
            <span className="grid size-12 shrink-0 place-items-center bg-[#ffcf70] text-sm font-black text-[#102824]">{adminInitials}</span>
            <span className="min-w-0"><strong className="block truncate text-sm text-white">{data.user.name}</strong><span className="mt-1 block truncate text-xs text-white/55">{data.user.email}</span></span>
          </div>
          <div className="mt-4 flex items-center justify-between border-b border-white/10 pb-4 text-xs"><span className="text-white/55">Account role</span><span className="border border-[#ffcf70]/35 bg-[#ffcf70]/10 px-2 py-1 font-bold text-[#ffcf70]">Administrator</span></div>
        </div>
        <div className="mt-auto border-t border-white/10 p-5 sm:p-6">
          <button type="button" onClick={() => { setProfileMenuOpen(false); openTab('reports'); }} className="flex min-h-12 w-full items-center gap-3 border border-white/15 px-4 text-sm font-semibold text-white/85 transition-colors hover:border-[#ffcf70]/50 hover:bg-white/[0.06]"><Bell size={17} className="text-[#ffcf70]"/>Reports{pending > 0 && <span className="ml-auto bg-[#ffcf70] px-1.5 py-0.5 text-[10px] font-black text-[#102824]">{pending}</span>}</button>
          <button type="button" onClick={() => { setProfileMenuOpen(false); openTab('health'); }} className="mt-2 flex min-h-12 w-full items-center gap-3 border border-white/15 px-4 text-sm font-semibold text-white/85 transition-colors hover:border-[#ffcf70]/50 hover:bg-white/[0.06]"><ShieldCheck size={17} className="text-[#ffcf70]"/>System Health<span className="ml-auto text-xs text-white/45">{data.audit.length}</span></button>
          <button type="button" onClick={() => void logout()} className="mt-2 flex min-h-12 w-full items-center gap-3 border border-white/15 px-4 text-sm font-semibold text-white/85 transition-colors hover:border-[#ffcf70]/50 hover:bg-white/[0.06]"><LogOut size={17} className="text-[#ffcf70]"/>Sign out</button>
        </div>
      </aside>
    </div>}

    <div data-admin-shell className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,1fr)] px-4 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10 lg:px-6 xl:gap-14">
      <aside className="min-w-0 max-w-[calc(100vw-2rem)] py-4 lg:sticky lg:top-24 lg:max-w-none lg:self-start lg:py-8">
        <div data-admin-rail className="lg:flex lg:h-[calc(100vh-144px)] lg:w-[248px] lg:flex-col lg:overflow-y-auto">
          <nav aria-label="Admin workspace" className="traveler-mobile-nav flex max-w-full snap-x gap-px overflow-x-auto border border-white/10 bg-white/10 p-px lg:flex-col lg:overflow-visible">
            {nav.map(([id, label, Icon]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => openTab(id)} className={`group relative flex shrink-0 snap-start items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-colors lg:w-full ${tab === id ? 'bg-[#f1ead8] text-[#14231f]' : 'bg-[#0b1d1a] text-white/55 hover:bg-[#16302b] hover:text-white'}`}><span className={`absolute inset-y-0 left-0 w-0.5 ${tab === id ? 'bg-amber-400' : 'bg-transparent'}`}/><Icon size={17}/>{label}{id === 'reports' && pending > 0 && <span className="ml-auto bg-amber-300 px-1.5 py-0.5 text-[10px] font-black text-[#14231f]">{pending}</span>}</button>)}
          </nav>
          <p className="mt-8 hidden border-t border-white/10 pt-5 text-xs leading-5 text-white/38 lg:block">Protect travelers, manage platform access, and keep every decision traceable.</p>
        </div>
      </aside>

      <main id="admin-main-content" tabIndex={-1} className="min-w-0 w-full max-w-[calc(100vw-2rem)] overflow-x-hidden pb-20 pt-5 outline-none lg:max-w-none lg:pt-10"><div data-admin-reveal className="mb-7 border-b border-white/10 pb-6"><h1 className="max-w-6xl text-[clamp(2rem,4vw,3.75rem)] font-black leading-[0.96] tracking-[-0.05em]">{copy.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/52">{copy.description}</p></div>{message && <div role="status" aria-live="polite" className="mb-6 border-l-2 border-amber-300 bg-white/[0.055] px-4 py-3 text-sm text-white/80">{message}</div>}

        {tab === 'overview' && <Overview data={data} onOpen={openTab}/>}
        {tab === 'users' && <UsersView users={users} search={search} filter={filter} busy={busy} onSearch={setSearch} onFilter={setFilter} onAction={act}/>}
        {tab === 'reports' && <ReportsView data={data} busy={busy} onAction={act}/>}
        {tab === 'health' && <HealthView data={data} search={search} onSearch={setSearch}/>}
      </main>
    </div>
  </div>;
}
