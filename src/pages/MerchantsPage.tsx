import { useEffect, useState } from 'react';
import { api, type Merchant } from '../lib/api';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:        { bg: '#F1F5F9', color: '#64748B' },
  submitted:    { bg: '#EFF6FF', color: '#3B82F6' },
  under_review: { bg: '#FFF7ED', color: '#F97316' },
  approved:     { bg: '#F0FDF4', color: '#16A34A' },
  rejected:     { bg: '#FFF1F2', color: '#E11D48' },
};
const OP_COLORS: Record<string, { bg: string; color: string }> = {
  active:     { bg: '#F0FDF4', color: '#16A34A' },
  inactive:   { bg: '#F1F5F9', color: '#64748B' },
  restricted: { bg: '#FFF1F2', color: '#E11D48' },
};

const F: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const LBL: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' };
const INP: React.CSSProperties = { padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.875rem', color: '#0F172A', background: '#fff', outline: 'none' };

function Badge({ status, map }: { status: string; map: Record<string, { bg: string; color: string }> }) {
  const safe = status ?? '';
  const s = map[safe] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>
      {safe.replace(/_/g, ' ')}
    </span>
  );
}

const EMPTY = { legal_name: '', display_name: '', business_type: 'retail', country: 'NG', email: '', phone: '', password: '' };

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [lastCreated, setLastCreated] = useState<{ email: string; merchantId: string } | null>(null);

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const load = async (s?: string) => {
    setLoading(true);
    try { const r = await api.merchants.list(s || undefined); setMerchants(r.data ?? []); }
    catch { notify('Failed to load merchants', false); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(filter); }, [filter]);

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.merchants.onboard(form);
      setLastCreated({ email: res.credentials.email, merchantId: res.credentials.merchant_id });
      notify(`Merchant "${form.display_name}" created successfully`);
      setForm(EMPTY);
      setShowForm(false);
      await load(filter);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Registration failed', false);
    } finally { setSubmitting(false); }
  };

  const handleApprove = async (id: string) => {
    setActionId(id);
    try { await api.merchants.approve(id); notify('Merchant approved'); await load(filter); }
    catch (err) { notify(err instanceof Error ? err.message : 'Failed', false); }
    finally { setActionId(null); }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Reject this merchant?')) return;
    setActionId(id);
    try { await api.merchants.reject(id); notify('Merchant rejected'); await load(filter); }
    catch (err) { notify(err instanceof Error ? err.message : 'Failed', false); }
    finally { setActionId(null); }
  };

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 100,
          background: toast.ok ? '#0F172A' : '#DC2626', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '10px', fontWeight: 600,
          fontSize: '0.875rem', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', maxWidth: '340px',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2px' }}>Merchants</h1>
          <p style={{ color: '#64748B', fontSize: '0.875rem' }}>Register and manage merchant accounts.</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setLastCreated(null); }} style={{
          background: '#0F172A', color: '#fff', border: 'none',
          borderRadius: '10px', padding: '0.6rem 1.2rem', fontWeight: 700, fontSize: '0.875rem',
        }}>
          {showForm ? 'Cancel' : '+ Add Merchant'}
        </button>
      </div>

      {/* Success info card */}
      {lastCreated && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '12px',
          padding: '1rem 1.25rem', marginBottom: '1.25rem',
        }}>
          <p style={{ fontWeight: 700, color: '#15803D', marginBottom: '6px' }}>Merchant created</p>
          <p style={{ fontSize: '0.8rem', color: '#166534', lineHeight: 1.7 }}>
            <strong>Login email:</strong> {lastCreated.email}<br />
            <strong>Merchant ID:</strong> <code style={{ background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>{lastCreated.merchantId}</code><br />
            The merchant can now log in at the Merchant Dashboard using their email and password.
          </p>
        </div>
      )}

      {/* Registration form */}
      {showForm && (
        <form onSubmit={handleOnboard} style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px',
          padding: '1.5rem', marginBottom: '1.5rem',
        }}>
          <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem' }}>New Merchant</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={F}><label style={LBL}>Legal Name *</label><input style={INP} required value={form.legal_name} onChange={set('legal_name')} placeholder="Acme Ltd." /></div>
            <div style={F}><label style={LBL}>Display Name *</label><input style={INP} required value={form.display_name} onChange={set('display_name')} placeholder="Acme Store" /></div>
            <div style={F}>
              <label style={LBL}>Business Type *</label>
              <select style={{ ...INP }} value={form.business_type} onChange={set('business_type')}>
                {['retail','ecommerce','services','fmcg','electronics','fashion','pharmacy','travel'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div style={F}>
              <label style={LBL}>Country *</label>
              <select style={{ ...INP }} value={form.country} onChange={set('country')}>
                <option value="NG">Nigeria</option>
                <option value="GH">Ghana</option>
                <option value="KE">Kenya</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Login Credentials (for Merchant Dashboard)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={F}><label style={LBL}>Email *</label><input style={INP} required type="email" value={form.email} onChange={set('email')} placeholder="merchant@example.com" /></div>
              <div style={F}><label style={LBL}>Phone *</label><input style={INP} required value={form.phone} onChange={set('phone')} placeholder="08012345678" /></div>
              <div style={{ ...F, gridColumn: '1 / -1' }}><label style={LBL}>Password *</label><input style={INP} required type="password" value={form.password} onChange={set('password')} placeholder="Minimum 8 characters" minLength={8} /></div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', padding: '0.6rem 1.2rem', fontWeight: 600, fontSize: '0.875rem' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '0.875rem', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Creating…' : 'Create Merchant'}
            </button>
          </div>
        </form>
      )}

      {/* Status filters */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {['', 'draft', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            background: filter === s ? '#0F172A' : '#F1F5F9',
            color: filter === s ? '#fff' : '#64748B',
            border: 'none', borderRadius: '8px', padding: '0.4rem 1rem', fontWeight: 600, fontSize: '0.8rem',
          }}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>Loading…</div>
        ) : merchants.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>No merchants found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Business', 'Type', 'Onboarding', 'Operating', 'Gate', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {merchants.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <p style={{ fontWeight: 700 }}>{m.display_name}</p>
                    <p style={{ color: '#94A3B8', fontSize: '0.75rem' }}>{m.legal_name}</p>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#64748B', textTransform: 'capitalize' }}>{m.business_type}</td>
                  <td style={{ padding: '0.875rem 1rem' }}><Badge status={m.onboarding_status} map={STATUS_COLORS} /></td>
                  <td style={{ padding: '0.875rem 1rem' }}><Badge status={m.operating_status} map={OP_COLORS} /></td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                      {(m as any).flex_settings?.min_accepted_tier ?? 'Bronze'}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {m.onboarding_status !== 'approved' && (
                        <button disabled={actionId === m.id} onClick={() => handleApprove(m.id)} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.35rem 0.85rem', fontWeight: 600, fontSize: '0.78rem', opacity: actionId === m.id ? 0.6 : 1 }}>
                          Approve
                        </button>
                      )}
                      {m.onboarding_status !== 'rejected' && (
                        <button disabled={actionId === m.id} onClick={() => handleReject(m.id)} style={{ background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: '6px', padding: '0.35rem 0.85rem', fontWeight: 600, fontSize: '0.78rem', opacity: actionId === m.id ? 0.6 : 1 }}>
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p style={{ marginTop: '0.75rem', color: '#94A3B8', fontSize: '0.78rem' }}>{merchants.length} merchant{merchants.length !== 1 ? 's' : ''}</p>
    </div>
  );
}
