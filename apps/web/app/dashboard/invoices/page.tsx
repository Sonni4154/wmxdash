'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api'; // or ../@/lib/api

type Invoice = {
  qbo_id: string; customer_ref?: string; txn_date?: string; due_date?: string;
  balance?: number|null; total_amt?: number|null; status?: string|null; updated_at: string;
};
type ListResp<T> = { ok: boolean; total: number; limit: number; offset: number; data: T[] };

export default function InvoicesPage() {
  const [q, setQ] = useState(''); const [page, setPage] = useState(0); const limit = 25;
  const [rows, setRows] = useState<Invoice[]>([]); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true; setLoading(true);
    apiGet<ListResp<Invoice>>('/db/invoices', { limit, offset: page * limit, q })
      .then(j => { if (!alive) return; setRows(j.data || []); setTotal(j.total || 0); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [q, page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <input className="input input-bordered w-full max-w-md" placeholder="Search invoices (id/customer)…"
               value={q} onChange={e => { setPage(0); setQ(e.target.value); }} />
        <div className="text-sm text-gray-500">{total} total</div>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="table w-full">
          <thead className="bg-gray-50">
            <tr><th>Invoice #</th><th>Customer</th><th>Txn Date</th><th>Due Date</th><th>Total</th><th>Balance</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-gray-500">Loading…</td></tr>
            ) : rows.length ? rows.map(r => (
              <tr key={r.qbo_id} className="hover">
                <td>{r.qbo_id}</td>
                <td>{r.customer_ref || '—'}</td>
                <td>{r.txn_date ? new Date(r.txn_date).toLocaleDateString() : '—'}</td>
                <td>{r.due_date ? new Date(r.due_date).toLocaleDateString() : '—'}</td>
                <td>{r.total_amt ?? '—'}</td>
                <td>{r.balance ?? '—'}</td>
                <td>{r.status ?? '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="py-10 text-center text-gray-500">No invoices</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 items-center">
        <button className="btn btn-sm" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Prev</button>
        <span className="text-sm text-gray-500">Page {page+1}</span>
        <button className="btn btn-sm" disabled={(page+1)*limit>=total} onClick={()=>setPage(p=>p+1)}>Next</button>
      </div>
    </div>
  );
}

