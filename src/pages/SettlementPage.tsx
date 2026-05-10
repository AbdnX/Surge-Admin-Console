import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, type SettlementEntry } from '../lib/api';

function EntryTypeBadge({ type }: { type?: string }) {
  const t = type ?? 'unknown';
  const isCredit = t.includes('credit') || t.includes('payout') || t.includes('merchant');
  const isFee = t.includes('fee') || t.includes('surge') || t.includes('platform');
  const s = isCredit
    ? { bg: '#F0FDF4', color: '#16A34A' }
    : isFee
    ? { bg: '#EFF6FF', color: '#3B82F6' }
    : { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span style={{ background: s.bg, color: s.color }} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize">
      {t.replace(/_/g, ' ')}
    </span>
  );
}

export default function SettlementPage() {
  const [entries, setEntries] = useState<SettlementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantFilter, setMerchantFilter] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.settlement.list(merchantFilter || undefined);
      setEntries(res.data ?? []);
    } catch {
      notify('Failed to load settlement entries', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [merchantFilter]);

  const filtered = search
    ? entries.filter(e =>
        e.merchant_id?.toLowerCase().includes(search.toLowerCase()) ||
        e.type?.toLowerCase().includes(search.toLowerCase()) ||
        e.id?.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  // Summary stats
  const totalCredit = filtered
    .filter(e => e.type?.includes('credit') || e.type?.includes('payout') || e.type?.includes('merchant'))
    .reduce((s, e) => s + (e.amount ?? (e.json as any)?.amount ?? 0), 0);
  const totalFees = filtered
    .filter(e => e.type?.includes('fee') || e.type?.includes('surge') || e.type?.includes('platform'))
    .reduce((s, e) => s + (e.amount ?? (e.json as any)?.amount ?? 0), 0);

  const fmtNaira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[1000] px-5 py-3 rounded-xl text-white text-[13px] font-semibold shadow-xl max-w-xs ${toast.ok ? 'bg-[#0F172A]' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">Settlement Ledger</h1>
          <p className="text-[13px] text-[#64748B]">All settlement entries across the platform — merchant payouts and Surge platform fees.</p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[#E2E8F0] text-[13px] font-semibold text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#0F172A] rounded-2xl p-5">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Total Entries</p>
            <p className="text-[26px] font-black text-white">{filtered.length.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E8ECF0] p-5">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">Merchant Payouts</p>
            <p className="text-[26px] font-black text-[#16A34A]">{fmtNaira(totalCredit)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E8ECF0] p-5">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">Platform Fees</p>
            <p className="text-[26px] font-black text-[#3B82F6]">{fmtNaira(totalFees)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-[320px]">
          <input
            type="text"
            placeholder="Search by merchant ID, type, or entry ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] bg-white outline-none"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">🔍</span>
        </div>
        <input
          type="text"
          placeholder="Filter by exact merchant ID…"
          value={merchantFilter}
          onChange={e => setMerchantFilter(e.target.value)}
          onBlur={() => void load()}
          onKeyDown={e => { if (e.key === 'Enter') void load(); }}
          className="px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] bg-white outline-none w-[260px]"
        />
        {merchantFilter && (
          <button
            onClick={() => setMerchantFilter('')}
            className="px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] font-semibold text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[#94A3B8] text-[13px]">Loading settlement entries…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[#94A3B8] text-[13px]">No settlement entries found.</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Entry ID', 'Merchant', 'Type', 'Amount', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => {
                const amount = entry.amount ?? (entry.json as any)?.amount ?? 0;
                const type = entry.type ?? (entry.json as any)?.type;
                const currency = entry.currency ?? (entry.json as any)?.currency ?? 'NGN';
                return (
                  <tr key={entry.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3.5">
                      <code className="text-[11px] text-[#475569]">{entry.id?.slice(0, 20)}…</code>
                    </td>
                    <td className="px-4 py-3.5">
                      <code className="text-[11px] text-[#94A3B8]">{entry.merchant_id?.slice(0, 14)}…</code>
                    </td>
                    <td className="px-4 py-3.5"><EntryTypeBadge type={type} /></td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-[#0F172A]">{fmtNaira(amount)}</span>
                      {currency !== 'NGN' && <span className="text-[11px] text-[#94A3B8] ml-1">{currency}</span>}
                    </td>
                    <td className="px-4 py-3.5 text-[#64748B] text-[12px]">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-[12px] text-[#94A3B8]">{filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}</p>
      )}
    </div>
  );
}
