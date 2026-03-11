import React, { useEffect, useState } from 'react';
import { api, type Customer } from '../lib/api';

const ACCOUNT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: '#F0FDF4', color: '#16A34A' },
  suspended: { bg: '#FFF1F2', color: '#E11D48' },
  restricted: { bg: '#FFF7ED', color: '#F97316' },
};

const VERIFICATION_COLORS: Record<string, { bg: string; color: string }> = {
  verified: { bg: '#EFF6FF', color: '#3B82F6' },
  unverified: { bg: '#F1F5F9', color: '#64748B' },
};

const F: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const LBL: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' };
const INP: React.CSSProperties = { padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.875rem', color: '#0F172A', background: '#fff', outline: 'none' };

function Badge({ status, map }: { status: string; map: Record<string, { bg: string; color: string }> }) {
  const safe = status ?? 'unknown';
  const s = map[safe] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>
      {safe.replace(/_/g, ' ')}
    </span>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterVerified, setFilterVerified] = useState<boolean | undefined>(undefined);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
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
    } catch {
      notify('Failed to load customers', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterVerified]);

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.customers.getDetail(id);
      if (res.ok) setSelectedCustomer(res.data);
      else notify('Failed to fetch details', false);
    } catch {
      notify('An error occurred while fetching details', false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSuspend = async (id: string) => {
    if (!confirm('Are you sure you want to suspend this customer account? They will be blocked from initializing new Flex sessions.')) return;
    setActionLoading(true);
    try {
      const res = await api.customers.suspend(id);
      if (res.ok) {
        notify('Customer suspended successfully');
        if (selectedCustomer?.id === id) {
          setSelectedCustomer({ ...selectedCustomer, account_status: 'suspended' });
        }
        await load();
      } else {
        notify('Failed to suspend customer', false);
      }
    } catch {
      notify('Error communicating with server', false);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000,
          background: toast.ok ? '#0F172A' : '#DC2626', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '10px', fontWeight: 600,
          fontSize: '0.875rem', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', maxWidth: '340px',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2px' }}>Customers</h1>
        <p style={{ color: '#64748B', fontSize: '0.875rem' }}>Monitor and manage all platform consumers.</p>
      </div>

      {/* Filters & Search */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...INP, width: '100%', paddingLeft: '2.5rem' }}
          />
          <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>🔍</span>
        </div>
        
        <select 
          style={{ ...INP, width: '180px' }} 
          value={filterVerified === undefined ? '' : filterVerified.toString()}
          onChange={(e) => {
            const val = e.target.value;
            setFilterVerified(val === '' ? undefined : val === 'true');
          }}
        >
          <option value="">All Statuses</option>
          <option value="true">Verified Only</option>
          <option value="false">Unverified Only</option>
        </select>
      </div>

      {/* Main Table */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>Loading customer records…</div>
        ) : customers.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>No customers match your criteria.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Customer', 'Verification', 'Account Status', 'Flex Score', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '1rem' }}>
                    <p style={{ fontWeight: 700, color: '#0F172A' }}>{c.full_name}</p>
                    <p style={{ fontSize: '0.75rem', color: '#64748B' }}>{c.email}</p>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <Badge status={c.verification_status} map={VERIFICATION_COLORS} />
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <Badge status={c.account_status} map={ACCOUNT_STATUS_COLORS} />
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: (c.flex_score ?? 0) >= 400 ? '#16A34A' : (c.flex_score ?? 0) >= 0 ? '#F97316' : '#E11D48' }}>
                        {c.flex_score ?? '—'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>pts</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button 
                      onClick={() => void handleViewDetail(c.id)}
                      style={{ background: '#F1F5F9', color: '#0F172A', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {selectedCustomer && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
        }} onClick={() => setSelectedCustomer(null)}>
          <div style={{
            width: '100%', maxWidth: '600px', background: '#fff', borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Customer Detail</h2>
              <button onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#94A3B8', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                <div style={F}>
                  <label style={LBL}>Full Name</label>
                  <p style={{ fontWeight: 600 }}>{selectedCustomer.full_name}</p>
                </div>
                <div style={F}>
                  <label style={LBL}>Email Address</label>
                  <p style={{ fontWeight: 600 }}>{selectedCustomer.email}</p>
                </div>
                <div style={F}>
                  <label style={LBL}>Phone Number</label>
                  <p style={{ fontWeight: 600 }}>{selectedCustomer.phone || '—'}</p>
                </div>
                <div style={F}>
                  <label style={LBL}>Customer ID</label>
                  <code style={{ fontSize: '0.75rem', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>{selectedCustomer.id}</code>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={F}>
                  <label style={LBL}>Current Flex Score</label>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>{selectedCustomer.flex_score ?? 0}</span>
                    <span style={{ fontSize: '0.875rem', color: '#64748B', fontWeight: 600 }}>points</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <label style={{ ...LBL, display: 'block', marginBottom: '8px' }}>Account Status</label>
                  <Badge status={selectedCustomer.account_status} map={ACCOUNT_STATUS_COLORS} />
                </div>
              </div>
            </div>

            <div style={{ padding: '1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.6rem 1.2rem', fontWeight: 600, fontSize: '0.875rem', color: '#64748B', cursor: 'pointer' }}>
                Close
              </button>
              
              {selectedCustomer.account_status !== 'suspended' && (
                <button 
                  disabled={actionLoading}
                  onClick={() => handleSuspend(selectedCustomer.id)}
                  style={{ 
                    background: '#DC2626', color: '#fff', border: 'none', borderRadius: '8px', 
                    padding: '0.6rem 1.2rem', fontWeight: 700, fontSize: '0.875rem', 
                    cursor: 'pointer', opacity: actionLoading ? 0.6 : 1,
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.2)'
                  }}
                >
                  {actionLoading ? 'Suspending…' : 'Suspend Account'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay for Detail Fetch */}
      {detailLoading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600 }}>
          <div style={{ fontWeight: 700, color: '#0F172A' }}>Loading Profile…</div>
        </div>
      )}
    </div>
  );
}
