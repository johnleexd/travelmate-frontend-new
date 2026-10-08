'use client';

import { ArrowRight, Check, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { ReportProblem } from './ReportProblem';
import type { PublicUser } from '@/lib/domain';

type TravelerAccountCenterProps = {
  user: PublicUser;
  busy: boolean;
  onSaveProfile: (form: HTMLFormElement) => void | Promise<void>;
  onReport: (title: string, details: string) => void | Promise<unknown>;
};

const inputClass = 'mt-2 min-h-12 w-full border border-white/15 bg-[#071a16] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 hover:border-white/30 focus:border-[#ffcf70] focus:ring-2 focus:ring-[#ffcf70]/25';

export function TravelerAccountCenter({ user, busy, onSaveProfile, onReport }: TravelerAccountCenterProps) {
  const verified = user.emailVerified;
  const initials = user.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TM';

  return (
    <section className="account-center space-y-5 text-slate-100">
      <div className="relative grid min-h-[280px] grid-flow-dense gap-px border border-white/10 bg-white/10 lg:grid-cols-12">
        <div className="flex flex-col justify-between bg-[#102824] p-6 sm:p-8 lg:col-span-7 lg:p-10">
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ffcf70]"><Sparkles size={15} /> Account center</span>
              <span className={`inline-flex min-h-9 items-center gap-2 border px-3 text-xs font-bold ${verified ? 'border-emerald-300/35 bg-emerald-300/10 text-emerald-200' : 'border-[#ffcf70]/35 bg-[#ffcf70]/10 text-[#ffcf70]'}`}>
                {verified ? <Check size={14} /> : <LockKeyhole size={14} />}{verified ? 'Email verified' : 'Email not verified'}
              </span>
            </div>
            <h2 className="mt-8 max-w-3xl text-4xl font-black leading-[0.96] tracking-[-0.045em] sm:text-5xl">Your details, ready for every trip.</h2>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">Keep your contact information accurate and report any problems you encounter. Your saved itineraries remain private to this account.</p>
          </div>
          <div className="relative mt-8 flex items-center gap-4 border-t border-white/12 pt-6">
            <span className="grid size-14 shrink-0 place-items-center bg-[#ffcf70] text-lg font-black text-[#102824]">{initials}</span>
            <div className="min-w-0"><strong className="block truncate text-lg text-white">{user.name}</strong><span className="block truncate text-sm text-white/55">{user.email}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-2 bg-[#0d211d] text-white lg:col-span-5">
          <div className="flex min-h-36 flex-col justify-between border-b border-r border-white/10 p-5 sm:p-7">
            <Mail size={20} className="text-[#ffcf70]" />
            <div><span className="text-xs text-white/45">Email status</span><strong className="mt-1 block text-xl">{user.emailVerified ? 'Verified' : 'Unverified'}</strong></div>
          </div>
          <div className="flex min-h-36 flex-col justify-between border-b border-white/10 p-5 sm:p-7">
            <ShieldCheck size={20} className="text-[#ffcf70]" />
            <div><span className="text-xs text-white/45">Account status</span><strong className="mt-1 block text-xl">{user.accountStatus}</strong></div>
          </div>
          <div className="col-span-2 flex items-start gap-4 p-5 sm:p-7">
            <span className="grid size-10 shrink-0 place-items-center border border-white/15"><LockKeyhole size={17} className="text-white/70" /></span>
            <p className="text-sm leading-6 text-white/60">Email verification protects sign-in. You can create, edit, and save trips without an admin review.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-flow-dense gap-px border border-white/10 bg-white/10 lg:grid-cols-12">
        <form onSubmit={(event) => { event.preventDefault(); void onSaveProfile(event.currentTarget); }} className="bg-[#102622] p-6 sm:p-8 lg:col-span-7 lg:p-10">
          <div className="flex items-start gap-4 border-b border-white/10 pb-6">
            <span className="grid size-11 shrink-0 place-items-center border border-[#ffcf70]/30 bg-[#ffcf70]/5 text-[#ffcf70]"><UserRound size={19} /></span>
            <div><h3 className="text-xl font-black tracking-[-0.03em] text-white">Contact details</h3><p className="mt-1 text-sm text-white/55">Keep your TravelMate account details up to date.</p></div>
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="text-xs font-bold text-white/75">Full name<input required minLength={2} maxLength={80} name="name" defaultValue={user.name} autoComplete="name" className={inputClass} /></label>
            <label className="text-xs font-bold text-white/75">Email address<input readOnly value={user.email} autoComplete="email" aria-describedby="account-email-note" className={`${inputClass} cursor-not-allowed bg-white/[0.07] text-white/55`} /><span id="account-email-note" className="mt-2 block text-[11px] font-normal text-white/45">Email changes require account support.</span></label>
            <label className="text-xs font-bold text-white/75 sm:col-span-2">Phone number<input maxLength={30} name="phone" defaultValue={user.phone || ''} autoComplete="tel" placeholder="Add a contact number" className={inputClass} /></label>
            <label className="text-xs font-bold text-white/75 sm:col-span-2">Profile photo URL<input type="url" maxLength={2048} name="avatarUrl" defaultValue={user.avatarUrl || ''} placeholder="https://?" className={inputClass}/><span className="mt-2 block text-xs font-normal text-white/45">Use an HTTPS image URL, or leave blank for a default avatar.</span></label>
            <label className="text-xs font-bold text-white/75 sm:col-span-2">Travel profile<textarea maxLength={500} name="bio" defaultValue={user.bio || ''} rows={5} placeholder="Share your travel style, accessibility needs, or preferences" className={inputClass} /></label>
          </div>
          <button disabled={busy} className="group mt-7 inline-flex min-h-12 items-center gap-3 bg-[#ffcf70] px-6 py-3 text-sm font-extrabold text-[#102824] transition hover:bg-[#ffe1a1] disabled:opacity-50">{busy ? 'Saving changes...' : 'Save profile'}<ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></button>
        </form>

        <aside className="bg-[#14231f] p-6 sm:p-8 lg:col-span-5 lg:p-10">
          <ReportProblem busy={busy} onSubmit={onReport}/>
        </aside>
      </div>
    </section>
  );
}
