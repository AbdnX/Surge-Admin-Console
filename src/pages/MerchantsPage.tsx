import React, { useEffect, useState } from 'react';
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
    <span style={{ background: s.bg, color: s.color, padding: '3px 12px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>
      {safe.replace(/_/g, ' ')}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={F}>
      <span style={LBL}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0F172A' }}>{value ?? '—'}</span>
    </div>
  );
}

const TIERS = ['Surge Restricted', 'Surge Starter', 'Surge Bronze', 'Surge Silver', 'Surge Gold', 'Surge Elite'];
const EMPTY = { legal_name: '', display_name: '', business_type: 'retail', country: 'NG', email: '', phone: '', password: '' };

// ── Merchant Detail Page ───────────────────────────────────────────────────────
function MerchantDetailPage({ merchant, onBack, onApprove, onReject, onTierChange, onUpdate, actionId, tierSaving, notify }: {
  merchant: Merchant;
  onBack: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onTierChange: (id: string, tier: string) => Promise<void>;
  onUpdate: (m: Merchant) => void;
  actionId: string | null;
  tierSaving: string | null;
  notify: (msg: string, ok?: boolean) => void;
}) {
  const fs = merchant.flex_settings ?? {};
  const currentTier = (fs as any).min_accepted_tier ?? 'Surge Bronze';

  return (
    <div>
      {/* Back nav */}
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748B', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', marginBottom: '1.75rem', padding: 0 }}
      >
        ← Back to Merchants
      </button>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '4px', color: '#0F172A' }}>{merchant.display_name}</h1>
          <p style={{ color: '#64748B', fontSize: '0.875rem' }}>{merchant.legal_name}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge status={merchant.onboarding_status} map={STATUS_COLORS} />
          <Badge status={merchant.operating_status} map={OP_COLORS} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Business Info */}
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.5rem' }}>
          <p style={{ ...LBL, marginBottom: '1.25rem' }}>Business Information</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <DetailRow label="Display Name" value={merchant.display_name} />
            <DetailRow label="Legal Name" value={merchant.legal_name} />
            <DetailRow label="Business Type" value={<span style={{ textTransform: 'capitalize' }}>{merchant.business_type}</span>} />
            <DetailRow label="Country" value={merchant.country} />
            <DetailRow label="Joined" value={merchant.created_at ? new Date(merchant.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—'} />
            <div style={F}>
              <span style={LBL}>Merchant ID</span>
              <code style={{ fontSize: '0.68rem', background: '#F1F5F9', padding: '3px 7px', borderRadius: '5px', color: '#475569', wordBreak: 'break-all' }}>{merchant.id}</code>
            </div>
          </div>
        </section>

        {/* Surge Settings */}
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.5rem' }}>
          <p style={{ ...LBL, marginBottom: '1.25rem' }}>Surge Settings</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <DetailRow label="Min Accepted Tier" value={currentTier} />
            <DetailRow label="Default Deposit" value={(fs as any).default_deposit_percent != null ? `${(fs as any).default_deposit_percent}%` : '—'} />
            <DetailRow label="Max Installments" value={(fs as any).max_installment_count ?? '—'} />
            <DetailRow label="Release Rule" value={(fs as any).release_rule_type?.replace(/_/g, ' ') ?? '—'} />
            <DetailRow label="Allowed Schedules" value={(fs as any).allowed_schedule_types?.join(', ') ?? '—'} />
            <DetailRow label="Risk Bearer" value={(fs as any).risk_bearer?.replace(/_/g, ' ') ?? '—'} />
            {(fs as any).webhook_url && (
              <div style={{ ...F, gridColumn: '1 / -1' }}>
                <span style={LBL}>Webhook URL</span>
                <code style={{ fontSize: '0.72rem', wordBreak: 'break-all', color: '#475569' }}>{(fs as any).webhook_url}</code>
              </div>
            )}
          </div>
        </section>

        {/* Customer Gate */}
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.5rem' }}>
          <p style={{ ...LBL, marginBottom: '1.25rem' }}>Customer Gate</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A', marginBottom: '3px' }}>Minimum Accepted Tier</p>
              <p style={{ fontSize: '0.78rem', color: '#64748B' }}>Customers below this tier cannot start a Surge plan with this merchant.</p>
            </div>
            <select
              disabled={tierSaving === merchant.id}
              value={currentTier}
              onChange={async e => {
                const tier = e.target.value;
                await onTierChange(merchant.id, tier);
                onUpdate({ ...merchant, flex_settings: { ...(merchant.flex_settings ?? {}), min_accepted_tier: tier } });
              }}
              style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.45rem 0.875rem', background: '#fff', opacity: tierSaving === merchant.id ? 0.5 : 1, cursor: 'pointer' }}
            >
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </section>

        {/* Actions */}
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.5rem' }}>
          <p style={{ ...LBL, marginBottom: '1.25rem' }}>Actions</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {merchant.onboarding_status !== 'approved' && (
              <button
                disabled={!!actionId}
                onClick={async () => {
                  await onApprove(merchant.id);
                  onUpdate({ ...merchant, onboarding_status: 'approved' });
                }}
                style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', opacity: actionId ? 0.6 : 1, boxShadow: '0 2px 8px rgba(22,163,74,0.2)' }}
              >
                {actionId === merchant.id ? 'Processing…' : '✓ Approve Merchant'}
              </button>
            )}
            {merchant.onboarding_status === 'approved' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '0.6rem 1rem' }}>
                <span style={{ color: '#16A34A', fontWeight: 700, fontSize: '0.875rem' }}>✓ Approved</span>
              </div>
            )}
            {merchant.onboarding_status !== 'rejected' && (
              <button
                disabled={!!actionId}
                onClick={async () => {
                  if (!confirm('Reject this merchant?')) return;
                  await onReject(merchant.id);
                  onUpdate({ ...merchant, onboarding_status: 'rejected' });
                }}
                style={{ background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', opacity: actionId ? 0.6 : 1 }}
              >
                {actionId === merchant.id ? 'Processing…' : 'Reject'}
              </button>
            )}
          </div>
          {merchant.onboarding_status === 'approved' && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#94A3B8' }}>
              This merchant is live and can accept Surge payment plans.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [tierSaving, setTierSaving] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [lastCreated, setLastCreated] = useState<{ email: string; merchantId: string } | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const load = async (s?: string) => {
    setLoading(true);
    try {
      let r;
      if (s === 'pending') {
        const data = await api.merchants.listPending();
        r = { data, total: data.length };
      } else {
        r = await api.merchants.list(s || undefined);
      }
      setMerchants(r.data ?? []);
    } catch { notify('Failed to load merchants', false); }
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
    try {
      await api.merchants.updateStatus(id, 'approved');
      notify('Merchant approved');
      await load(filter);
    } catch (err) { notify(err instanceof Error ? err.message : 'Failed', false); }
    finally { setActionId(null); }
  };

  const handleReject = async (id: string) => {
    setActionId(id);
    try {
      await api.merchants.updateStatus(id, 'rejected');
      notify('Merchant rejected');
      await load(filter);
    } catch (err) { notify(err instanceof Error ? err.message : 'Failed', false); }
    finally { setActionId(null); }
  };

  const handleTierChange = async (id: string, tier: string) => {
    setTierSaving(id);
    try {
      await api.merchants.updateTier(id, tier);
      notify(`Min tier updated to ${tier}`);
      await load(filter);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update tier', false);
    } finally { setTierSaving(null); }
  };

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const Toast = () => toast ? (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 100, background: toast.ok ? '#0F172A' : '#DC2626', color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', maxWidth: '340px' }}>
      {toast.msg}
    </div>
  ) : null;

  // ── Detail Page ──
  if (selectedMerchant) {
    return (
      <>
        <Toast />
        <MerchantDetailPage
          merchant={selectedMerchant}
          onBack={() => setSelectedMerchant(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onTierChange={handleTierChange}
          onUpdate={setSelectedMerchant}
          actionId={actionId}
          tierSaving={tierSaving}
          notify={notify}
        />
      </>
    );
  }

  // ── List Page ──
  return (
    <div>
      <Toast />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2px' }}>Merchants</h1>
          <p style={{ color: '#64748B', fontSize: '0.875rem' }}>Register and manage merchant accounts.</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setLastCreated(null); }} style={{ background: '#0F172A', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.2rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ Add Merchant'}
        </button>
      </div>

      {/* Success banner */}
      {lastCreated && (
        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
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
        <form onSubmit={handleOnboard} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem' }}>
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
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Login Credentials</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={F}><label style={LBL}>Email *</label><input style={INP} required type="email" value={form.email} onChange={set('email')} placeholder="merchant@example.com" /></div>
              <div style={F}><label style={LBL}>Phone *</label><input style={INP} required value={form.phone} onChange={set('phone')} placeholder="08012345678" /></div>
              <div style={{ ...F, gridColumn: '1 / -1' }}><label style={LBL}>Password *</label><input style={INP} required type="password" value={form.password} onChange={set('password')} placeholder="Minimum 8 characters" minLength={8} /></div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', padding: '0.6rem 1.2rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '0.875rem', opacity: submitting ? 0.6 : 1, cursor: 'pointer' }}>
              {submitting ? 'Creating…' : 'Create Merchant'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {['', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ background: filter === s ? '#0F172A' : '#F1F5F9', color: filter === s ? '#fff' : '#64748B', border: 'none', borderRadius: '8px', padding: '0.4rem 1rem', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
            {s === '' ? 'All' : s === 'pending' ? 'Approvals' : s.charAt(0).toUpperCase() + s.slice(1)}
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
                {['Business', 'Type', 'Onboarding', 'Operating', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {merchants.map(m => (
                <tr
                  key={m.id}
                  style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  onClick={() => setSelectedMerchant(m)}
                >
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <p style={{ fontWeight: 700 }}>{m.display_name}</p>
                    <p style={{ color: '#94A3B8', fontSize: '0.75rem' }}>{m.legal_name}</p>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#64748B', textTransform: 'capitalize' }}>{m.business_type}</td>
                  <td style={{ padding: '0.875rem 1rem' }}><Badge status={m.onboarding_status} map={STATUS_COLORS} /></td>
                  <td style={{ padding: '0.875rem 1rem' }}><Badge status={m.operating_status} map={OP_COLORS} /></td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedMerchant(m)}
                        style={{ background: '#F1F5F9', color: '#0F172A', border: 'none', borderRadius: '6px', padding: '0.35rem 0.85rem', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                      >
                        View →
                      </button>
                      {m.onboarding_status !== 'approved' && (
                        <button disabled={actionId === m.id} onClick={() => handleApprove(m.id)} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.35rem 0.85rem', fontWeight: 600, fontSize: '0.78rem', opacity: actionId === m.id ? 0.6 : 1, cursor: 'pointer' }}>
                          Approve
                        </button>
                      )}
                      {m.onboarding_status !== 'rejected' && (
                        <button disabled={actionId === m.id} onClick={() => { if (confirm('Reject this merchant?')) handleReject(m.id); }} style={{ background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: '6px', padding: '0.35rem 0.85rem', fontWeight: 600, fontSize: '0.78rem', opacity: actionId === m.id ? 0.6 : 1, cursor: 'pointer' }}>
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
