'use client';

import React, { useState } from 'react';
import { LookupResult } from '@/lib/types';

interface CopyAllButtonProps {
  results: LookupResult[];
}

export default function CopyAllButton({ results }: CopyAllButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const foundResults = results.filter((r) => r.found && r.kode_enroll);
    if (foundResults.length === 0) return;

    const text = foundResults.map((r) => `${r.nama_mk} (${r.kelas}): ${r.kode_enroll}`).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const foundCount = results.filter((r) => r.found).length;
  if (foundCount === 0) return null;

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 border-2 border-primary text-primary rounded-lg font-semibold text-sm hover:bg-primary hover:text-white transition-all duration-200 group"
    >
      <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
      {copied ? 'Tersalin!' : 'Salin Semua Kode'}
    </button>
  );
}
