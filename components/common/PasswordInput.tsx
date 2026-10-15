'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PasswordInput({ id, className = '', visibilityLabel = 'password', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { id: string; visibilityLabel?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="relative mt-2">
    <input {...props} id={id} type={visible ? 'text' : 'password'} className={cn(className, 'mt-0 block pr-14')} />
    <button type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${visibilityLabel}`} aria-controls={id} aria-pressed={visible} disabled={props.disabled} onClick={() => setVisible(current => !current)} className="absolute right-px top-1/2 grid h-11 w-12 -translate-y-1/2 place-items-center text-[#596b66] hover:bg-[#142421]/5 hover:text-[#142421] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#142421] disabled:opacity-50">
      {visible ? <EyeOff size={20} aria-hidden="true"/> : <Eye size={20} aria-hidden="true"/>}
    </button>
  </div>;
}
