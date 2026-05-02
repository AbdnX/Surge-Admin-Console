import React, { useEffect, useState } from 'react';
import { api, type Customer } from '../lib/api';

const ACCOUNT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:     { bg: '#F0FDF4', color: '#16A34A' },
  suspended:  { bg: '#FFF1F2', color: '#E11D48' },
  restricted: { bg: '#FFF7ED', color: '#F97316' },
};

const VERIFICATION_COLORS: Record<string, { bg: string; color: string }> = {
  verified:    { bg: '#F0FDF4', color: '#16A34A' },
  in_progress: { bg: '#FFFBEB', color: '#D97706' },
  rejected:    { bg: '#FFF1F2', color: '#E11D48' },
  unverified:  { bg: '#F1F5F9', color: '#64748B' },
};

const F: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const LBL: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' };
const INP: React.CSSProperties = { padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.875rem', color: '#0F172A', background: '#fff', outline: 'none' };

function Badge({ status, map }: { status: string; map: Record<string, { bg: string; color: string }> }) {
  const safe = status ?? 'unknown';
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

// ── Customer Detail Page ───────────────────────────────────────────────────────
function CustomerDetailPage({ customer: initial, onBack, notify }: {
  customer: Customer;
  onBack: () => void;
  notify: (msg: string, ok?: boolean) => void;
}) {
  const [customer, setCustomer] = useState(initial);
  const [actionLoading, setActionLoading] = useState(false);

  const handleApproveVerification = async () => {
    setActionLoading(true);
    try {
      const res = await api.customers.approveVerification(customer.id);
      if (res.ok) {
        setCustomer(c => ({ ...c, verification_status: 'verified' }));
        notify('Verification approved — customer is now verified');
      } else {
        notify('Failed to approve verification', false);
      }
    } catch { notify('Error communicating with server', false); }
    finally { setActionLoading(false); }
  };

  const handleRejectVerification = async () => {
    if (!confirm('Reject this identity submission? The customer will be asked to resubmit.')) return;
    setActionLoading(true);
    try {
      const res = await api.customers.rejectVerification(customer.id);
      if (res.ok) {
        setCustomer(c => ({ ...c, verification_status: 'rejected' }));
        notify('Verification rejected');
      } else {
        notify('Failed to reject verification', false);
      }
    } catch { notify('Error communicating with server', false); }
    finally { setActionLoading(false); }
  };

  const handleSuspend = async () => {
    if (!confirm('Suspend this customer account? They will be blocked from new Surge sessions.')) return;
    setActionLoading(true);
    try {
      const res = await api.customers.suspend(customer.id);
      if (res.ok) {
        setCustomer(c => ({ ...c, account_status: 'suspended' }));
        notify('Customer suspended successfully');
      } else {
        notify('Failed to suspend customer', false);
      }
    } catch { notify('Error communicating with server', false); }
    finally { setActionLoading(false); }
  };

  const scoreColor = (customer.surge_score ?? 0) >= 400 ? '#4ade80' : (customer.surge_score ?? 0) >= 0 ? '#fb923c' : '#f87171';

  return (
    <div>
      {/* Back nav */}
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748B', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', marginBottom: '1.75rem', padding: 0 }}
      >
        ← Back to Customers
      </button>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '4px', color: '#0F172A' }}>{customer.full_name}</h1>
          <p style={{ color: '#64748B', fontSize: '0.875rem' }}>{customer.email}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge status={customer.verification_status} map={VERIFICATION_COLORS} />
          <Badge status={customer.account_status} map={ACCOUNT_STATUS_COLORS} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Score card */}
        <section style={{ background: '#0F172A', borderRadius: '14px', padding: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Surge Score</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1, color: scoreColor }}>{customer.surge_score ?? 0}</span>
              <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>pts</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Verification</p>
              <Badge status={customer.verification_status} map={VERIFICATION_COLORS} />
            </div>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Account</p>
              <Badge status={customer.account_status} map={ACCOUNT_STATUS_COLORS} />
            </div>
          </div>
        </section>

        {/* Contact Info */}
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.5rem' }}>
          <p style={{ ...LBL, marginBottom: '1.25rem' }}>Contact Information</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <DetailRow label="Full Name" value={customer.full_name} />
            <DetailRow label="Email" value={customer.email} />
            <DetailRow label="Phone" value={customer.phone || '—'} />
            <DetailRow label="Role" value={<span style={{ textTransform: 'capitalize' }}>{customer.role || '—'}</span>} />
            <DetailRow label="Joined" value={customer.created_at ? new Date(customer.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—'} />
            <div style={F}>
              <span style={LBL}>Customer ID</span>
              <code style={{ fontSize: '0.68rem', background: '#F1F5F9', padding: '3px 7px', borderRadius: '5px', color: '#475569', wordBreak: 'break-all' }}>{customer.id}</code>
            </div>
          </div>
        </section>

        {/* Identity Submission — only shown when pending */}
        {customer.verification_status === 'in_progress' && customer.json?.id_number && (
          <section style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '14px', padding: '1.5rem' }}>
            <p style={{ ...LBL, color: '#92400E', marginBottom: '1.25rem' }}>⏳ Pending Identity Submission</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div style={F}>
                <span style={LBL}>ID Type</span>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', textTransform: 'uppercase', color: '#92400E' }}>{customer.json.id_type || '—'}</span>
              </div>
              <div style={F}>
                <span style={LBL}>ID Number</span>
                <code style={{ fontWeight: 700, background: '#FEF3C7', padding: '4px 12px', borderRadius: '6px', fontSize: '1.05rem', color: '#78350F' }}>
                  {customer.json.id_number}
                </code>
              </div>
            </div>
          </section>
        )}

        {/* Actions */}
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.5rem' }}>
          <p style={{ ...LBL, marginBottom: '1.25rem' }}>Actions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {customer.verification_status === 'in_progress' && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  disabled={actionLoading}
                  onClick={() => void handleApproveVerification()}
                  style={{ flex: 1, background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.65rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', opacity: actionLoading ? 0.6 : 1, boxShadow: '0 2px 8px rgba(22,163,74,0.2)' }}
                >
                  {actionLoading ? 'Processing…' : '✓ Approve Verification'}
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => void handleRejectVerification()}
                  style={{ flex: 1, background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: '8px', padding: '0.65rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}
                >
                  {actionLoading ? 'Processing…' : 'Reject'}
                </button>
              </div>
            )}
            {customer.verification_status === 'verified' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '0.6rem 1rem' }}>
                <span style={{ color: '#16A34A', fontWeight: 700, fontSize: '0.875rem' }}>✓ Identity verified</span>
              </div>
            )}
            {customer.account_status !== 'suspended' ? (
              <button
                disabled={actionLoading}
                onClick={() => void handleSuspend()}
                style={{ background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: '8px', padding: '0.65rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}
              >
                {actionLoading ? 'Processing…' : 'Suspend Account'}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '8px', padding: '0.6rem 1rem' }}>
                <span style={{ color: '#E11D48', fontWeight: 700, fontSize: '0.875rem' }}>Account suspended</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterVerified, setFilterVerified] = useState<boolean | undefined>(undefined);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.customers.list(search || undefined, filterVerified);
      setCustomers(res.data ?? []);
    } catch { notify('Failed to load customers', false); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 300);
    return () => clearTimeout(t);
  }, [search, filterVerified]);

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.customers.getDetail(id);
      if (res.ok) setSelectedCustomer(res.data);
      else notify('Failed to fetch details', false);
    } catch { notify('An error occurred while fetching details', false); }
    finally { setDetailLoading(false); }
  };

  const Toast = () => toast ? (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000, background: toast.ok ? '#0F172A' : '#DC2626', color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', maxWidth: '340px' }}>
      {toast.msg}
    </div>
  ) : null;

  // ── Detail Page ──
  if (selectedCustomer) {
    return (
      <>
        <Toast />
        <CustomerDetailPage
          customer={selectedCustomer}
          onBack={() => { setSelectedCustomer(null); void load(); }}
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2px' }}>Customers</h1>
          <p style={{ color: '#64748B', fontSize: '0.875rem' }}>All platform users — consumers and merchants who shop.</p>
        </div>
        {!loading && (
          <span style={{ background: '#F1F5F9', color: '#64748B', padding: '4px 12px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
            {customers.length} record{customers.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...INP, width: '100%', paddingLeft: '2.5rem' }}
          />
          <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>🔍</span>
        </div>
        <select
          style={{ ...INP, width: '220px' }}
          value={filterVerified === undefined ? '' : filterVerified.toString()}
          onChange={e => {
            const val = e.target.value;
            setFilterVerified(val === '' ? undefined : val === 'true');
          }}
        >
          <option value="">All Statuses</option>
          <option value="true">Verified Only</option>
          <option value="false">Not Yet Verified</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>Loading customer records…</div>
        ) : customers.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>No customers match your criteria.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Customer', 'Verification', 'Account Status', 'Surge Score', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr
                  key={c.id}
                  style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  onClick={() => void handleViewDetail(c.id)}
                >
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontWeight: 700, color: '#0F172A' }}>{c.full_name}</p>
                      {c.role === 'merchant' && (
                        <span style={{ background: '#EFF6FF', color: '#3B82F6', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Merchant</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#64748B' }}>{c.email}</p>
                  </td>
                  <td style={{ padding: '1rem' }}><Badge status={c.verification_status} map={VERIFICATION_COLORS} /></td>
                  <td style={{ padding: '1rem' }}><Badge status={c.account_status} map={ACCOUNT_STATUS_COLORS} /></td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: (c.surge_score ?? 0) >= 400 ? '#16A34A' : (c.surge_score ?? 0) >= 0 ? '#F97316' : '#E11D48' }}>
                        {c.surge_score ?? '—'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>pts</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => void handleViewDetail(c.id)}
                      style={{ background: '#F1F5F9', color: '#0F172A', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Loading overlay during detail fetch */}
      {detailLoading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600 }}>
          <div style={{ fontWeight: 700, color: '#0F172A' }}>Loading Profile…</div>
        </div>
      )}
    </div>
  );
}
