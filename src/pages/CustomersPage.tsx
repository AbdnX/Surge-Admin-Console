import { useState } from 'react';
import { api } from '../lib/api';

export default function CustomersPage() {
  const [customerId, setCustomerId] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestrict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await api.customers.restrict(customerId.trim()) as { id: string; account_status: string };
      setResult(`Customer ${res.id} status: ${res.account_status}`);
    } catch {
      setError('Action failed. Check the customer ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  const INPUT: React.CSSProperties = {
    padding: '0.65rem 0.9rem', borderRadius: '8px',
    border: '1px solid #E2E8F0', fontSize: '0.875rem',
    color: '#0F172A', background: '#fff', outline: 'none', width: '100%',
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2px' }}>Customers</h1>
        <p style={{ color: '#64748B', fontSize: '0.875rem' }}>Perform administrative actions on customer accounts.</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.5rem', maxWidth: '480px' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>Restrict Customer</h2>
        <p style={{ color: '#64748B', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Sets the customer's <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: '4px' }}>account_status</code> to <strong>suspended</strong>, blocking them from new checkouts.
        </p>
        <form onSubmit={handleRestrict} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Customer ID
            </label>
            <input
              style={INPUT}
              placeholder="e.g. 4a3f1b2c-..."
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#DC2626', color: '#fff', border: 'none',
              borderRadius: '8px', padding: '0.65rem',
              fontWeight: 700, fontSize: '0.875rem',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Processing…' : 'Restrict Account'}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: '1rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '0.75rem 1rem', color: '#15803D', fontSize: '0.875rem', fontWeight: 600 }}>
            {result}
          </div>
        )}
        {error && (
          <div style={{ marginTop: '1rem', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '8px', padding: '0.75rem 1rem', color: '#E11D48', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '14px', padding: '1rem 1.25rem', maxWidth: '480px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#92400E', marginBottom: '4px' }}>Where to find Customer IDs</p>
        <p style={{ fontSize: '0.8rem', color: '#78350F', lineHeight: 1.6 }}>
          Customer IDs are UUIDs assigned at registration. You can find them via <strong>GET /api/v1/transactions/user/{'{userId}'}</strong> or in the Supabase <code>customers</code> table.
        </p>
      </div>
    </div>
  );
}
