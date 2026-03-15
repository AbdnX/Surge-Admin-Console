import { Component, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api } from './lib/api';
import MerchantsPage from './pages/MerchantsPage';
import CustomersPage from './pages/CustomersPage';
import DelinquencyPage from './pages/DelinquencyPage';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '800px', margin: '2rem auto' }}>
          <h2 style={{ color: '#DC2626', marginBottom: '1rem' }}>Runtime Error</h2>
          <pre style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '8px', padding: '1rem', fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: '#9F1239' }}>
            {(this.state.error as Error).message}{'\n\n'}{(this.state.error as Error).stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#0F172A', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Simple admin gate — change this before going to production
const ADMIN_PASSWORD = 'flex-admin-2026';
const AUTH_KEY = 'flex_admin_authed';

type Tab = 'merchants' | 'customers' | 'delinquency';
const NAV: { id: Tab; label: string }[] = [
  { id: 'merchants', label: 'Merchants' },
  { id: 'customers', label: 'Customers' },
  { id: 'delinquency', label: 'Delinquency' },
];

function LoginGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.auth.login(pw.trim());
      if (res.ok && res.data.token) {
        sessionStorage.setItem(AUTH_KEY, '1');
        sessionStorage.setItem('flex_admin_token', res.data.token);
        onAuth();
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
      setPw('');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F8FAFC',
    }}>
      <div style={{
        width: '100%', maxWidth: '360px', background: '#fff',
        border: '1px solid #E2E8F0', borderRadius: '16px', padding: '2rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '4px' }}>⚡ Surge Admin</p>
          <p style={{ color: '#64748B', fontSize: '0.875rem' }}>Enter your admin password to continue.</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Admin password"
              value={pw}
              autoFocus
              onChange={e => { setPw(e.target.value); setError(false); }}
              style={{
                width: '100%',
                padding: '0.7rem 2.5rem 0.7rem 0.9rem', borderRadius: '8px',
                border: `1px solid ${error ? '#FCA5A5' : '#E2E8F0'}`,
                fontSize: '0.9rem', color: '#0F172A', outline: 'none',
                background: error ? '#FFF1F2' : '#fff',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: '#94A3B8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                outline: 'none',
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: '-0.5rem' }}>Incorrect password.</p>}
          <button type="submit" style={{
            background: '#0F172A', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '0.7rem', fontWeight: 700, fontSize: '0.9rem',
          }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1');
  const [tab, setTab] = useState<Tab>('merchants');

  if (!authed) return <LoginGate onAuth={() => setAuthed(true)} />;

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  };

  return (
    <ErrorBoundary>
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: '#0F172A', color: '#fff', padding: '0 2rem',
        display: 'flex', alignItems: 'center', gap: '2rem',
        height: '56px', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>⚡ Surge Admin</span>
        <nav style={{ display: 'flex', gap: '0.25rem', flex: 1 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              background: tab === n.id ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: tab === n.id ? '#fff' : 'rgba(255,255,255,0.55)',
              border: 'none', borderRadius: '6px', padding: '0.4rem 0.9rem',
              fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
            }}>
              {n.label}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout} style={{
          background: 'transparent', color: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
          padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
        }}>
          Sign Out
        </button>
      </header>
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {tab === 'merchants' && <MerchantsPage />}
        {tab === 'customers' && <CustomersPage />}
        {tab === 'delinquency' && <DelinquencyPage />}
      </main>
    </div>
    </ErrorBoundary>
  );
}
