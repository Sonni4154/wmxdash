'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

type Status = { hasToken: boolean; seconds_until_expiry?: number };

export default function QboStatusChip() {
  const [st, setSt] = useState<Status | null>(null);

  useEffect(() => {
    let t: any;
    const load = () =>
      apiGet<Status>('/qbo/status')
        .then(setSt)
        .catch(() => setSt({ hasToken: false }));
    load();
    t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const ok = !!st?.hasToken;
  const mins = Math.max(0, Math.floor((st?.seconds_until_expiry ?? 0) / 60));
  const txt = ok ? `QuickBooks Connected (${mins}m)` : 'QuickBooks Not Connected';
  const cls = ok ? 'bg-green-600' : 'bg-red-600';

  return (
    <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${cls}`}>
      {txt}
    </span>
  );
}

