import { Component, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, EyeOff, Zap, Users, Building2, AlertTriangle, LogOut, ChevronRight } from 'lucide-react';
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
        <div className="p-8 max-w-2xl mx-auto mt-8">
          <h2 className="text-red-600 font-bold text-lg mb-3">Runtime Error</h2>
          <pre className="bg-red-50 border border-red-100 rounded-xl p-4 text-[12px] whitespace-pre-wrap text-red-800 font-mono">
            {(this.state.error as Error).message}{'\n\n'}{(this.state.error as Error).stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-4 py-2 bg-[#0F172A] text-white rounded-lg text-[13px] font-bold"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AUTH_KEY = 'flex_admin_authed';
type Tab = 'merchants' | 'customers' | 'delinquency';

const NAV: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'merchants',   label: 'Merchants',   icon: Building2,     desc: 'Manage merchant accounts' },
  { id: 'customers',   label: 'Customers',   icon: Users,         desc: 'View consumer profiles'   },
  { id: 'delinquency', label: 'Delinquency', icon: AlertTriangle, desc: 'Monitor overdue cases'    },
];

function LoginGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.auth.login(pw.trim());
      if (res.ok && res.data.token) {
        sessionStorage.setItem(AUTH_KEY, '1');
        sessionStorage.setItem('flex_admin_token', res.data.token);
        onAuth();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setPw('');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F7F8FA]">
      {/* Left panel */}
      <div className="w-[420px] bg-[#0F172A] flex flex-col justify-between p-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-[#00d66f] flex items-center justify-center">
            <Zap size={16} color="#0F172A" strokeWidth={2.5} />
          </div>
          <span className="font-[800] text-[17px] text-white tracking-tight">Surge</span>
          <span className="text-[10px] font-bold text-[#00d66f] bg-[rgba(0,214,111,0.15)] px-2 py-0.5 rounded-full tracking-widest uppercase">Admin</span>
        </div>

        <div>
          <p className="text-[28px] font-black text-white leading-tight mb-3 tracking-tight">
            Platform<br />Control Centre
          </p>
          <p className="text-[14px] text-white/40 leading-relaxed">
            Manage merchants, monitor customer accounts, and oversee delinquency cases from one place.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {NAV.map(({ label, icon: Icon, desc }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Icon size={14} color="rgba(255,255,255,0.4)" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white/70">{label}</p>
                <p className="text-[11px] text-white/30">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h1 className="text-[24px] font-black text-[#0F172A] mb-1.5 tracking-tight">Sign in</h1>
            <p className="text-[14px] text-[#64748B]">Enter your admin credentials to access the console.</p>
          </div>

          <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Admin password"
                  value={pw}
                  autoFocus
                  onChange={e => { setPw(e.target.value); setError(false); }}
                  className={`w-full px-3.5 py-3 pr-11 rounded-[10px] border-[1.5px] text-[14px] text-[#0F172A] bg-white outline-none transition-colors ${error ? 'border-red-300 bg-red-50' : 'border-[#E2E8F0]'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] p-1"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-[#E11D48] text-[12px] font-semibold mt-1.5">Incorrect password. Please try again.</p>}
            </div>

            <button
              type="submit"
              disabled={loading || !pw}
              className="flex items-center justify-center gap-2 py-3 bg-[#0F172A] text-white rounded-[10px] font-bold text-[14px] disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Signing in…' : <>Sign in <ChevronRight size={16} /></>}
            </button>
          </form>
        </div>
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
    sessionStorage.removeItem('flex_admin_token');
    setAuthed(false);
  };

  const activeNav = NAV.find(n => n.id === tab)!;

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex bg-[#F7F8FA]">

        {/* ── Sidebar ── */}
        <aside className="w-[220px] bg-[#0F172A] flex flex-col shrink-0 sticky top-0 h-screen">
          {/* Logo */}
          <div className="h-[60px] flex items-center gap-2.5 px-4 border-b border-white/[0.07] shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#00d66f] flex items-center justify-center shrink-0">
              <Zap size={13} color="#0F172A" strokeWidth={2.5} />
            </div>
            <span className="font-[800] text-white text-[15px] tracking-tight">Surge</span>
            <span className="text-[10px] font-bold text-[#00d66f] bg-[rgba(0,214,111,0.15)] px-1.5 py-0.5 rounded-full tracking-widest uppercase">Admin</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
            <p className="px-3 py-1 mb-1 text-[10px] font-bold text-white/25 uppercase tracking-widest">Management</p>
            {NAV.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold w-full text-left transition-all ${
                    active ? 'bg-white/10 text-white' : 'text-white/45 hover:bg-white/[0.06] hover:text-white/75'
                  }`}
                >
                  <Icon size={14} color={active ? '#00d66f' : 'currentColor'} strokeWidth={active ? 2.5 : 2} />
                  {label}
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00d66f]" />}
                </button>
              );
            })}
          </nav>

          {/* Sign out */}
          <div className="px-2 py-3 border-t border-white/[0.07]">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-white/30 w-full hover:bg-red-500/10 hover:text-red-400 transition-all"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <header className="h-[60px] bg-white border-b border-[#E8ECF0] flex items-center justify-between px-7 shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <activeNav.icon size={15} color="#64748B" />
              <h1 className="text-[15px] font-bold text-[#0F172A]">{activeNav.label}</h1>
            </div>
            <span className="text-[10px] font-bold text-[#64748B] bg-[#F1F5F9] px-2.5 py-1 rounded-md uppercase tracking-widest">
              Admin Console
            </span>
          </header>

          {/* Page content */}
          <main className="flex-1 p-7 overflow-y-auto">
            {tab === 'merchants'   && <MerchantsPage />}
            {tab === 'customers'   && <CustomersPage />}
            {tab === 'delinquency' && <DelinquencyPage />}
          </main>
        </div>

      </div>
    </ErrorBoundary>
  );
}
