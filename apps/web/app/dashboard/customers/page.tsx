'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api'; // or ../@/lib/api

type Customer = {
  qbo_id: string; display_name: string; given_name?: string; family_name?: string;
  email?: string; phone?: string; active: boolean; updated_at: string;
};
type ListResp<T> = { ok: boolean; total: number; limit: number; offset: number; data: T[] };

export default function CustomersPage() {
  const [q, setQ] = useState(''); const [page, setPage] = useState(0); const limit = 25;
  const [rows, setRows] = useState<Customer[]>([]); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true; setLoading(true);
    apiGet<ListResp<Customer>>('/db/customers', { limit, offset: page * limit, q })
      .then(j => { if (!alive) return; setRows(j.data || []); setTotal(j.total || 0); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [q, page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <input className="input input-bordered w-full max-w-md" placeholder="Search customers…"
               value={q} onChange={e => { setPage(0); setQ(e.target.value); }} />
        <div className="text-sm text-gray-500">{total} total</div>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="table w-full">
          <thead className="bg-gray-50">
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>Active</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-10 text-center text-gray-500">Loading…</td></tr>
            ) : rows.length ? rows.map(r => (
              <tr key={r.qbo_id} className="hover">
                <td>{r.display_name}</td>
                <td>{r.email || '—'}</td>
                <td>{r.phone || '—'}</td>
                <td>{r.active ? 'Yes' : 'No'}</td>
                <td>{new Date(r.updated_at).toLocaleDateString()}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="py-10 text-center text-gray-500">No customers</td></tr>
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

