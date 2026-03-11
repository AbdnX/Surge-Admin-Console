import { useEffect, useState } from 'react';
import { api, type DelinquencyCase } from '../lib/api';

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
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 100,
          background: '#0F172A', color: '#fff', padding: '0.75rem 1.25rem',
          borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        }}>{toast}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2px' }}>Delinquency</h1>
          <p style={{ color: '#64748B', fontSize: '0.875rem' }}>Monitor overdue cases and trigger collection actions.</p>
        </div>
        <button
          onClick={handleSweep}
          disabled={sweeping}
          style={{
            background: '#0F172A', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '0.55rem 1rem', fontWeight: 700, fontSize: '0.825rem',
            opacity: sweeping ? 0.6 : 1,
          }}
        >
          {sweeping ? 'Sweeping…' : '🔁 Run Delinquency Sweep'}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Cases', value: cases.length, color: '#0F172A' },
          { label: 'Open', value: open, color: '#C2410C' },
          { label: 'Defaulted', value: defaulted, color: '#BE123C' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{s.label}</p>
            <p style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Cases table */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>Loading…</div>
        ) : cases.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>No delinquency cases.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Plan ID', 'Customer ID', 'Reason', 'Status', 'Opened', 'Next Retry'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map(c => {
                const s = STATUS_COLORS[c.status] ?? { bg: '#F1F5F9', color: '#64748B' };
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748B' }}>{(c.payment_plan_id ?? '').slice(0, 12) || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748B' }}>{(c.customer_id ?? '').slice(0, 12) || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B', textTransform: 'capitalize' }}>{(c.reason_code ?? '').replace(/_/g, ' ')}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B', fontSize: '0.78rem' }}>{new Date(c.opened_at).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B', fontSize: '0.78rem' }}>
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
