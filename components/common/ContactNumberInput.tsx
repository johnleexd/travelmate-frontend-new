'use client';

import { useLayoutEffect, useRef } from 'react';
import { formatPhilippineMobile, philippineMobileDigits } from '@/lib/philippine-mobile';
import { getContactNumberError } from '@/lib/registration-validation';
import styles from './ContactNumberInput.module.css';

export function ContactNumberInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<{ value: string; position: number } | null>(null);
  const error = getContactNumberError(value);
  useLayoutEffect(() => {
    const pending = pendingCaret.current;
    pendingCaret.current = null;
    if (pending?.value === value && document.activeElement === inputRef.current) inputRef.current?.setSelectionRange(pending.position, pending.position);
  }, [value]);

  function update(raw: string, caret: number) {
    const formatted = formatPhilippineMobile(raw);
    const digits = philippineMobileDigits(raw);
    let position = caret;
    if (digits !== null) {
      const removedPrefix = raw.replace(/\D/g, '').length - digits.length;
      const beforeCaret = Math.max(0, raw.slice(0, caret).replace(/\D/g, '').length - removedPrefix);
      position = 0;
      let seen = 0;
      while (position < formatted.length && seen < beforeCaret) { if (/\d/.test(formatted[position])) seen += 1; position += 1; }
      if (formatted[position] === ' ') position += 1;
    }
    pendingCaret.current = { value: formatted, position };
    onChange(formatted);
  }

  return <>
    <div className={styles.field} data-invalid={Boolean(error)}>
      <span id={`${id}-prefix`} className={styles.prefix}><span className="sr-only">Philippines country code</span>
        <svg aria-hidden="true" width="20" height="14" viewBox="0 0 24 16"><path fill="#0038A8" d="M0 0h24v8H0z"/><path fill="#CE1126" d="M0 8h24v8H0z"/><path fill="#FFF" d="M0 0l14 8L0 16z"/><g fill="#FCD116"><circle cx="4" cy="8" r="1.6"/><path d="M3.7 4.9h.6v1.2h-.6zm0 5h.6v1.2h-.6zM.9 7.7h1.2v.6H.9zm5 0h1.2v.6H5.9zM1.6 5.2l.4-.4.9.9-.4.4zm3.6 3.6.4-.4.9.9-.4.4zm-3.6 1 .9-.9.4.4-.9.9zm3.6-3.6.9-.9.4.4-.9.9zM1.8 1.8l.3.7.8.1-.6.5.2.8-.7-.4-.7.4.2-.8-.6-.5.8-.1zm0 10l.3.7.8.1-.6.5.2.8-.7-.4-.7.4.2-.8-.6-.5.8-.1zM10.2 7l.3.7.8.1-.6.5.2.8-.7-.4-.7.4.2-.8-.6-.5.8-.1z"/></g></svg>
        <span>+63</span>
      </span>
      <input ref={inputRef} id={id} name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={12} value={value} placeholder="917 123 4567" aria-invalid={Boolean(error)} aria-describedby={`${id}-prefix ${id}-note`} className={styles.input} onChange={event => update(event.target.value, event.target.selectionStart ?? event.target.value.length)} onKeyDown={event => {
        const input = event.currentTarget;
        const caret = input.selectionStart;
        if (caret === null || caret !== input.selectionEnd) return;
        if (event.key === 'Backspace' && input.value[caret - 1] === ' ') {
          event.preventDefault(); update(input.value.slice(0, caret - 2) + input.value.slice(caret), caret - 2);
        } else if (event.key === 'Delete' && input.value[caret] === ' ') {
          event.preventDefault(); update(input.value.slice(0, caret) + input.value.slice(caret + 2), caret);
        }
      }} onPaste={event => {
        // Read the complete paste before the browser's maxlength could truncate it.
        event.preventDefault();
        const input = event.currentTarget;
        const pasted = event.clipboardData.getData('text');
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        update(input.value.slice(0, start) + pasted + input.value.slice(end), start + pasted.length);
      }}/>
    </div>
    <p id={`${id}-note`} aria-live="polite" className={`mt-2 text-xs font-normal ${error ? 'text-[#9f3025]' : 'text-[#596b66]'}`}>{error || 'Philippine mobile number (e.g. 917 123 4567)'}</p>
  </>;
}
