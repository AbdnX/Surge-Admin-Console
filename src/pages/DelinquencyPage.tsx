import { useEffect, useState } from 'react';
import { api, type DelinquencyCase } from '../lib/api';
import { RefreshCw } from 'lucide-react';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  open:      { bg: '#FFF7ED', color: '#C2410C' },
  resolved:  { bg: '#F0FDF4', color: '#15803D' },
  defaulted: { bg: '#FFF1F2', color: '#BE123C' },
};

export default function DelinquencyPage() {
  const [cases, setCases] = useState<DelinquencyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.delinquency.cases();
      setCases(res.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleSweep = async () => {
    setSweeping(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      await api.delinquency.sweep(today);
      notify('Delinquency sweep completed');
      await load();
    } catch (err) { notify(err instanceof Error ? err.message : 'Sweep failed'); }
    finally { setSweeping(false); }
  };

  const open = cases.filter(c => c.status === 'open').length;
  const defaulted = cases.filter(c => c.status === 'defaulted').length;

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-[100] px-5 py-3 bg-[#0F172A] text-white rounded-xl text-[13px] font-semibold shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">Delinquency</h1>
          <p className="text-[13px] text-[#64748B]">Monitor overdue cases and trigger collection actions.</p>
        </div>
        <button
          onClick={handleSweep}
          disabled={sweeping}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-[13px] font-bold transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={sweeping ? 'animate-spin' : ''} />
          {sweeping ? 'Sweeping…' : 'Run Delinquency Sweep'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Cases', value: cases.length, color: '#0F172A' },
          { label: 'Open',        value: open,          color: '#C2410C' },
          { label: 'Defaulted',   value: defaulted,     color: '#BE123C' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-[#E8ECF0] p-5">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">{s.label}</p>
            <p style={{ color: s.color }} className="text-[32px] font-black leading-none">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Cases table */}
      <div className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[#94A3B8] text-[13px]">Loading…</div>
        ) : cases.length === 0 ? (
          <div className="py-12 text-center text-[#94A3B8] text-[13px]">No delinquency cases.</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Plan ID', 'Customer ID', 'Reason', 'Status', 'Opened', 'Next Retry'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map(c => {
                const s = STATUS_COLORS[c.status] ?? { bg: '#F1F5F9', color: '#64748B' };
                return (
                  <tr key={c.id} className="border-b border-[#F1F5F9]">
                    <td className="px-4 py-3 font-mono text-[12px] text-[#64748B]">{(c.payment_plan_id ?? '').slice(0, 12) || '—'}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#64748B]">{(c.customer_id ?? '').slice(0, 12) || '—'}</td>
                    <td className="px-4 py-3 text-[#64748B] capitalize">{(c.reason_code ?? '').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span style={{ background: s.bg, color: s.color }} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize">
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#64748B] text-[12px]">{new Date(c.opened_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-[#64748B] text-[12px]">
                      {c.next_retry_at ? new Date(c.next_retry_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
