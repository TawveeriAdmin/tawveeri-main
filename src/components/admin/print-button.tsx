'use client';

import { Printer } from 'lucide-react';

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#d7ece5] px-3.5 py-1.5 text-xs font-black text-on-surface-variant hover:bg-[#f8fcfa] dark:border-[#263b33] dark:text-white/60"
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
