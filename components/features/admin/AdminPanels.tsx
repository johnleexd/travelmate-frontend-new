'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert, X } from 'lucide-react';
import type { PlatformResponse, PublicUser } from '@/lib/contracts';
import { UserAvatar } from '@/components/common/UserAvatar';
import { handleResponse } from '@/services/api.service';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import { AccountAccessDialog } from './AccountAccessDialog';

export type AdminTab = 'overview' | 'users' | 'reports' | 'health' | 'settings' | 'feedback' | 'notifications';
type Action = (body: Record<string, unknown>, success?: string, onError?: (message: string) => void) => Promise<boolean>;
const panel = 'min-w-0 border border-white/10 bg-[#102622] p-5 sm:p-7';
const button = 'min-h-11 border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50';

export { Overview } from './AdminOverview';

export function UsersView({ users, search, filter, busy, onSearch, onFilter, onAction }: { users: PublicUser[]; search: string; filter: string; busy: boolean; onSearch: (value: string) => void; onFilter: (value: string) => void; onAction: Action }) {
  const [accessAction, setAccessAction] = useState<{ user: PublicUser; suspend: boolean } | null>(null);
  const [warningUser, setWarningUser] = useState<PublicUser | null>(null);
  const [warning, setWarning] = useState('');
  const [warningError, setWarningError] = useState('');
  const warningRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);
  const closeWarning = () => { if (!sendingRef.current) setWarningUser(null); };
  useModalAccessibility({ active: Boolean(warningUser), containerRef: warningRef, initialFocusRef: messageRef, onClose: closeWarning });
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
      <label className="text-sm">Search users<input value={search} onChange={event => onSearch(event.target.value)} placeholder="Name, email, or account status" className="mt-2 min-h-12 w-full border border-white/20 bg-[#102622] px-4 text-base"/></label>
      <label className="text-sm">Filter users<select value={filter} onChange={event => onFilter(event.target.value)} className="mt-2 min-h-12 w-full border border-white/20 bg-[#102622] px-4 text-base">{[['all','All users'],['traveler','Travelers'],['admin','Admins'],['active','Active'],['suspended','Suspended']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <div className="max-w-full overflow-x-auto border border-white/10 bg-[#102622]" role="region" aria-label="User accounts" tabIndex={0}>
      <table className="w-full min-w-[940px] whitespace-nowrap text-left text-sm">
        <thead className="border-b border-white/15 bg-white/[0.04] text-xs text-white/55"><tr>{['Avatar', 'Name', 'Email', 'Join Date', 'Role', 'Account', 'Email status', 'Actions'].map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-white/10">{users.map(user => <tr key={user.id} className="hover:bg-white/[0.025]">
          <td className="px-4 py-3"><UserAvatar user={user}/></td>
          <th scope="row" className="px-4 py-3"><span className="block max-w-44 truncate" title={user.name}>{user.name}</span></th>
          <td className="px-4 py-3 text-white/65"><span className="block max-w-56 truncate" title={user.email}>{user.email}</span></td>
          <td className="px-4 py-3">{user.createdAt ? <time dateTime={user.createdAt}>{new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}</time> : <span className="text-white/45">Unavailable</span>}</td>
          <td className="px-4 py-3"><span className={`border px-2 py-1 text-xs font-bold capitalize ${user.role === 'admin' ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'}`}>{user.role}</span></td><td className="px-4 py-3"><span className={`inline-flex items-center gap-2 capitalize ${user.accountStatus === 'active' ? 'text-emerald-200' : 'text-red-300'}`}><span aria-hidden="true" className={`size-2 rounded-full ${user.accountStatus === 'active' ? 'bg-emerald-300' : 'bg-red-400'}`}/>{user.accountStatus}</span></td><td className="px-4 py-3">{user.emailVerified ? 'Verified' : 'Not verified'}</td>
          <td className="px-4 py-3">{user.role !== 'admin' ? <div className="flex items-center gap-2"><button type="button" disabled={busy} className={`${button} inline-flex items-center gap-2 border-[#ffcf70]/40 text-[#ffcf70]`} onClick={() => { setWarningUser(user); setWarning(''); setWarningError(''); }}><TriangleAlert size={16}/>Send warning</button><button type="button" disabled={busy} aria-haspopup="dialog" className={button} onClick={() => setAccessAction({ user, suspend: user.accountStatus === 'active' })}>{user.accountStatus === 'active' ? 'Suspend account' : 'Restore access'}</button></div> : <span className="text-white/40">Admin account</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {users.length === 0 && <p className={panel}>No users match your search.</p>}
    {accessAction && <AccountAccessDialog user={accessAction.user} suspend={accessAction.suspend} busy={busy} onClose={() => setAccessAction(null)} onConfirm={onError => onAction({ action: 'admin-user-status', id: accessAction.user.id, status: accessAction.suspend ? 'suspended' : 'active' }, accessAction.suspend ? 'Account suspended.' : 'Account access restored.', onError)}/>}
    {warningUser && createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 text-slate-100 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) closeWarning(); }}>
      <div ref={warningRef} role="dialog" aria-modal="true" aria-labelledby="warning-title" aria-describedby="warning-description" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto border border-white/20 bg-[#102622] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4"><h2 id="warning-title" className="flex items-center gap-2 text-xl font-bold text-[#ffcf70]"><TriangleAlert size={22}/>Send account warning</h2><button type="button" disabled={busy} onClick={closeWarning} aria-label="Close warning" className="grid size-11 shrink-0 place-items-center border border-white/20 disabled:opacity-50"><X size={20}/></button></div>
        <p id="warning-description" className="mt-4 text-sm leading-6 text-white/70 [overflow-wrap:anywhere]">Send an in-app warning to <strong className="text-white">{warningUser.name}</strong> ({warningUser.email}). They can read it in Notifications. Their account access stays unchanged.</p>
        <form className="mt-5" onSubmit={async event => {
          event.preventDefault();
          if (sendingRef.current) return;
          if (warning.trim().length < 10) { setWarningError('Enter at least 10 characters.'); return; }
          sendingRef.current = true;
          setWarningError('');
          try {
            const sent = await onAction({ action: 'admin-user-warning', id: warningUser.id, message: warning.trim() }, `Warning sent to ${warningUser.name}.`, setWarningError);
            if (sent) setWarningUser(null);
          } finally { sendingRef.current = false; }
        }}>
          <label className="block text-sm font-semibold">Warning message<textarea ref={messageRef} required minLength={10} maxLength={2000} rows={5} value={warning} onChange={event => setWarning(event.target.value)} placeholder="Explain the issue and what the traveler needs to change." className="mt-2 block w-full resize-y border border-white/25 bg-[#071a16] p-3 text-base font-normal"/></label>
          <p className="mt-2 text-right text-xs text-white/45">{warning.length}/2000</p>
          {warningError && <p role="alert" className="mt-3 text-sm text-red-300">{warningError}</p>}
          <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={busy} className={button} onClick={closeWarning}>Cancel</button><button type="submit" disabled={busy} className={`${button} bg-[#ffcf70] text-[#102824] hover:bg-[#ffdb94]`}>{busy ? 'Sending...' : 'Send warning'}</button></div>
        </form>
      </div>
    </div>, document.body)}
  </div>;
}

export function ReportsView({ data, busy, onAction }: { data: PlatformResponse; busy: boolean; onAction: Action }) {
  const reports = data.moderation.filter(item => item.kind === 'report' || item.kind === 'appeal');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decisionMessage, setDecisionMessage] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const selectedReport = reports.find(report => report.id === selectedId);
  const reporter = data.directory.find(user => user.id === selectedReport?.subjectId);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalAccessibility({ active: Boolean(selectedReport), containerRef: modalRef, initialFocusRef: closeRef, onClose: () => setSelectedId(null) });
  return <div className="space-y-4">{reports.length === 0 ? <p className={panel}>No traveler reports yet. Travelers can report a problem from their account page.</p> : reports.map(report => <article data-admin-card key={report.id} className={panel}>
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-bold"><button type="button" className="text-left [overflow-wrap:anywhere] hover:underline" onClick={() => { setSelectedId(report.id); setDecisionMessage(''); setDecisionError(''); }} aria-haspopup="dialog">{report.title}</button></h2>{report.status !== 'pending' && <span className="text-sm text-[#ffcf70]"><span className="sr-only">Status: </span>{report.status === 'approved' ? 'Approved' : report.status === 'rejected' ? 'Rejected' : 'Resolved'}</span>}</div>
    <p className="mt-2 break-words text-xs text-white/50">{data.directory.find(user => user.id === report.subjectId)?.name || 'Former account'} · {new Date(report.createdAt).toLocaleString()}</p>
    <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-sm leading-7 text-white/75 [overflow-wrap:anywhere]">{report.details}</p>
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={button} onClick={() => { setSelectedId(report.id); setDecisionMessage(''); setDecisionError(''); }} aria-haspopup="dialog">{report.kind === 'appeal' ? 'Review appeal' : 'View full report'}</button>{report.kind === 'report' && report.status === 'pending' && <button disabled={busy} className={button} onClick={() => void onAction({ action: 'resolve-report', id: report.id }, '')}>Mark resolved</button>}</div>
  </article>)}
  {selectedReport && createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 text-slate-100 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedId(null); }}>
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" tabIndex={-1} className="flex max-h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-2xl flex-col border border-white/20 bg-[#102622] shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/15 p-4 sm:px-6"><h2 id="report-dialog-title" className="text-lg font-bold">Full report</h2><button ref={closeRef} type="button" aria-label="Close full report" className="grid size-11 shrink-0 place-items-center border border-white/20 hover:bg-white/10" onClick={() => setSelectedId(null)}><X size={20}/></button></div>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <h3 className="text-xl font-bold [overflow-wrap:anywhere]">{selectedReport.title}</h3>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-white/50">Reported by</dt><dd className="mt-1 [overflow-wrap:anywhere]">{reporter?.name || 'Former account'}{reporter?.email && <span className="mt-1 block text-white/65">{reporter.email}</span>}</dd></div>
          <div><dt className="text-white/50">Submitted</dt><dd className="mt-1">{new Date(selectedReport.createdAt).toLocaleString()}</dd></div>
          <div><dt className="text-white/50">Status</dt><dd className="mt-1 text-[#ffcf70]">{selectedReport.status === 'pending' ? 'Open' : selectedReport.status === 'approved' ? 'Approved' : selectedReport.status === 'rejected' ? 'Rejected' : 'Resolved'}</dd></div>
          <div><dt className="text-white/50">Report ID</dt><dd className="mt-1 [overflow-wrap:anywhere]">{selectedReport.id}</dd></div>
        </dl>
        <h4 className="mt-6 font-bold">Details</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/80 [overflow-wrap:anywhere]">{selectedReport.details}</p>
        {selectedReport.kind === 'appeal' && selectedReport.status === 'pending' && <form className="mt-6 border-t border-white/15 pt-5" onSubmit={async event => {
          event.preventDefault();
          if (busy) return;
          if (decisionMessage.trim().length < 10) { setDecisionError('Enter at least 10 characters explaining your decision.'); return; }
          const decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
          if (!decision) return;
          setDecisionError('');
          await onAction({ action: 'review-appeal', id: selectedReport.id, decision, message: decisionMessage.trim() }, 'Appeal decision sent to the traveler.', setDecisionError);
        }}><label className="block text-sm font-bold">Decision message to traveler<textarea required minLength={10} maxLength={2000} rows={4} value={decisionMessage} onChange={event => setDecisionMessage(event.target.value)} className="mt-2 block w-full border border-white/25 bg-[#071a16] p-3 text-base font-normal" placeholder="Explain why access is being restored or why the suspension remains."/></label>{decisionError && <p role="alert" className="mt-3 text-sm text-red-300">{decisionError}</p>}<div className="mt-4 flex flex-wrap gap-3"><button type="submit" value="approved" disabled={busy} className={`${button} bg-[#ffcf70] text-[#102824]`}>Approve & restore access</button><button type="submit" value="rejected" disabled={busy} className={button}>Reject appeal</button></div></form>}
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/15 p-4 sm:px-6"><button type="button" className={button} onClick={() => setSelectedId(null)}>Close</button>{selectedReport.kind === 'report' && selectedReport.status === 'pending' && <button type="button" disabled={busy} className={button} onClick={() => void onAction({ action: 'resolve-report', id: selectedReport.id }, '')}>{busy ? 'Saving...' : 'Mark resolved'}</button>}</div>
    </div>
  </div>, document.body)}
  </div>;
}

export function HealthView({ data, search, onSearch }: { data: PlatformResponse; search: string; onSearch: (value: string) => void }) {
  const services = [
    ['Database', data.integrations?.database, 'Reachable'],
    ['OpenAI', data.integrations?.openAI, 'Configured'],
    ['Gemini', data.integrations?.gemini, 'Configured'],
    ['Weather', data.integrations?.weather, 'Enabled'],
    ['Travel comparison', data.integrations?.amadeus, 'Configured'],
  ] as const;
  const failures = data.itineraryGenerations.filter(item => item.status === 'failed');
  const events = data.audit.filter(item => `${item.action} ${item.targetId}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5">
    <section data-admin-card className={panel}><h2 className="text-xl font-bold">API Monitoring</h2><p className="mt-2 text-sm leading-6 text-white/55">Configuration is shown below. A configured external service is not a guarantee of live availability.</p><div className="mt-4 divide-y divide-white/10">{services.map(([label, ready, status]) => <div key={label} className="flex flex-wrap justify-between gap-3 py-4 text-sm"><span>{label}</span><span className={ready ? 'text-emerald-200' : 'text-amber-200'}>{ready ? status : 'Not configured'}</span></div>)}</div></section>
    <section data-admin-card className={panel}><h2 className="text-xl font-bold">Recent generation failures</h2><p className="mt-2 text-sm text-white/55">From the latest 25 generation attempts.</p>{failures.length === 0 ? <p className="mt-5 text-sm">No failures in recent attempts.</p> : failures.map(item => <div key={item.id} className="mt-4 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-4 text-sm"><span>{item.errorCode || 'Generation failed'}</span><time>{new Date(item.updatedAt).toLocaleString()}</time></div>)}</section>
    <section data-admin-card className={panel}><h2 className="text-xl font-bold">Activity log</h2><label className="mt-4 block text-sm">Search activity<input value={search} onChange={event => onSearch(event.target.value)} className="mt-2 min-h-12 w-full border border-white/20 bg-[#071a16] px-4 text-base" placeholder="Action or record ID"/></label><div className="mt-4 divide-y divide-white/10">{events.map(item => <div key={item.id} className="grid gap-2 py-4 text-xs sm:grid-cols-[1fr_1fr_1fr]"><time className="text-white/50">{new Date(item.createdAt).toLocaleString()}</time><span className="break-all text-cyan-200">{item.action}</span><span className="break-all">{item.targetId}</span></div>)}</div>{events.length === 0 && <p className="mt-4 text-sm text-white/55">No matching activity.</p>}</section>
  </div>;
}

export function AccountSettingsView({ user, onSaved }: { user: PublicUser; onSaved: () => Promise<unknown> }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  return <section className={panel}>
    <div className="flex items-center gap-3"><UserAvatar user={user}/><div><h2 className="text-xl font-bold">Admin profile</h2><p className="text-sm text-white/60">{user.email}</p></div></div>
    <form key={user.id} className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={async event => {
      event.preventDefault();
      if (savingRef.current) return;
      const fields = new FormData(event.currentTarget);
      savingRef.current = true; setSaving(true); setError(''); setMessage('');
      try {
        await handleResponse(await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: fields.get('name'), phone: fields.get('phone'), bio: fields.get('bio'), avatarUrl: fields.get('avatarUrl') }) }));
        setMessage('Profile updated.'); await onSaved();
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your profile.'); }
      finally { savingRef.current = false; setSaving(false); }
    }}>
      <label className="text-sm">Full name<input required minLength={2} maxLength={80} name="name" defaultValue={user.name} autoComplete="name" className="mt-2 min-h-12 w-full border border-white/20 bg-[#071a16] px-4"/></label>
      <label className="text-sm">Phone number<input maxLength={30} name="phone" defaultValue={user.phone || ''} autoComplete="tel" className="mt-2 min-h-12 w-full border border-white/20 bg-[#071a16] px-4"/></label>
      <label className="text-sm sm:col-span-2">Profile photo URL<input type="url" maxLength={2048} name="avatarUrl" defaultValue={user.avatarUrl || ''} placeholder="https://?" aria-describedby="admin-photo-note" className="mt-2 min-h-12 w-full border border-white/20 bg-[#071a16] px-4"/><span id="admin-photo-note" className="mt-2 block text-xs text-white/50">Use an HTTPS image URL. Clear it to use your initials.</span></label>
      <label className="text-sm sm:col-span-2">Bio<textarea maxLength={500} name="bio" defaultValue={user.bio || ''} rows={4} className="mt-2 w-full border border-white/20 bg-[#071a16] p-3"/></label>
      <p className="text-xs text-white/50 sm:col-span-2">Email: {user.email}. Email changes require account support.</p>
      {message && <p role="status" className="text-emerald-200 sm:col-span-2">{message}</p>}
      {error && <p role="alert" className="text-red-300 sm:col-span-2">{error}</p>}
      <button disabled={saving} className={button}>{saving ? 'Saving?' : 'Save profile'}</button>
    </form>
  </section>;
}
