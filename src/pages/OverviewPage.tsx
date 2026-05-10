import { useEffect, useState } from 'react';
import { Building2, Users, ArrowLeftRight, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { api, type Transaction, type Merchant, type DelinquencyCase } from '../lib/api';

interface Stats {
  totalTransactions: number;
  totalVolume: number;
  activePlans: number;
  totalCustomers: number;
  pendingMerchants: number;
  openDelinquency: number;
}

type Tab = 'merchants' | 'customers' | 'transactions' | 'delinquency';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:     { bg: '#EFF6FF', color: '#3B82F6' },
  completed:  { bg: '#F0FDF4', color: '#16A34A' },
  delinquent: { bg: '#FFF1F2', color: '#E11D48' },
  cancelled:  { bg: '#F1F5F9', color: '#64748B' },
  pending:    { bg: '#FFFBEB', color: '#D97706' },
};

function TxBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span style={{ background: s.bg, color: s.color }} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize">
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  onClick,
  alert,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
  onClick?: () => void;
  alert?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-[#CBD5E1]' : ''
      } ${alert ? 'border-amber-200 bg-amber-50' : 'border-[#E8ECF0]'}`}
    >
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent ? 'bg-[#0F172A]' : alert ? 'bg-amber-100' : 'bg-[#F1F5F9]'}`}>
          <Icon size={16} color={accent ? '#00d66f' : alert ? '#D97706' : '#64748B'} strokeWidth={2} />
        </div>
        {onClick && (
          <span className="text-[11px] font-bold text-[#94A3B8]">View →</span>
        )}
      </div>
      <div>
        <p className={`text-[28px] font-black leading-none mb-1 ${accent ? 'text-[#0F172A]' : alert ? 'text-amber-900' : 'text-[#0F172A]'}`}>
          {value}
        </p>
        <p className={`text-[12px] font-semibold ${alert ? 'text-amber-700' : 'text-[#64748B]'}`}>{label}</p>
        {sub && <p className="text-[11px] text-[#94A3B8] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function OverviewPage({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [txRes, activeTxRes, customersRes, pendingMerchantsRes, delinquencyRes] = await Promise.allSettled([
          api.transactions.list(1, 10),           // recent 10 for table + total count
          api.transactions.list(1, 1, 'active'),   // active plan count
          api.customers.list(),                    // all customers
          api.merchants.listPending(),              // pending merchants
          api.delinquency.cases(),                 // open cases
        ]);

        const txData = txRes.status === 'fulfilled' ? txRes.value.data : { data: [], total: 0 };
        const activeTxData = activeTxRes.status === 'fulfilled' ? activeTxRes.value.data : { total: 0 };
        const customersData = customersRes.status === 'fulfilled' ? customersRes.value : { data: [], total: 0 };
        const pendingData = pendingMerchantsRes.status === 'fulfilled' ? pendingMerchantsRes.value : [];
        const delinquencyData = delinquencyRes.status === 'fulfilled' ? delinquencyRes.value : { data: [], total: 0 };

        const txList: Transaction[] = txData.data ?? [];
        const totalVolume = txList.reduce((sum, tx) => {
          return sum + (tx.totalAmountDue?.amount ?? tx.principalAmount?.amount ?? 0);
        }, 0);

        setRecent(txList);
        setStats({
          totalTransactions: txData.total ?? 0,
          totalVolume,
          activePlans: activeTxData.total ?? 0,
          totalCustomers: (customersData as any).total ?? ((customersData as any).data?.length ?? 0),
          pendingMerchants: Array.isArray(pendingData) ? pendingData.length : 0,
          openDelinquency: (delinquencyData as any).total ?? ((delinquencyData as any).data?.length ?? 0),
        });
      } catch {
        // partial data is fine — stats stay null and we show skeleton
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const fmtVolume = (n: number) => {
    if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
    return `₦${n.toLocaleString('en-NG')}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">Platform Overview</h1>
        <p className="text-[13px] text-[#64748B]">Real-time snapshot of all activity across the Surge platform.</p>
      </div>

      {/* Alert strip — pending approvals */}
      {!loading && stats && stats.pendingMerchants > 0 && (
        <div
          onClick={() => onNavigate('merchants')}
          className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 mb-6 cursor-pointer hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-200 flex items-center justify-center shrink-0">
              <Clock size={13} color="#D97706" strokeWidth={2.5} />
            </div>
            <p className="text-[13px] font-bold text-amber-900">
              {stats.pendingMerchants} merchant{stats.pendingMerchants !== 1 ? 's' : ''} awaiting approval
            </p>
          </div>
          <span className="text-[12px] font-bold text-amber-700">Review →</span>
        </div>
      )}

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4 mb-7">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E8ECF0] p-5 h-[120px] animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-4 gap-4 mb-7">
          <StatCard
            label="Total Transactions"
            value={stats.totalTransactions.toLocaleString()}
            sub={`${stats.activePlans} active`}
            icon={ArrowLeftRight}
            accent
            onClick={() => onNavigate('transactions')}
          />
          <StatCard
            label="Total Customers"
            value={stats.totalCustomers.toLocaleString()}
            icon={Users}
            onClick={() => onNavigate('customers')}
          />
          <StatCard
            label="Open Delinquency Cases"
            value={stats.openDelinquency.toLocaleString()}
            icon={AlertTriangle}
            alert={stats.openDelinquency > 0}
            onClick={() => onNavigate('delinquency')}
          />
          <StatCard
            label="Pending Merchant Approvals"
            value={stats.pendingMerchants.toLocaleString()}
            icon={Building2}
            alert={stats.pendingMerchants > 0}
            onClick={() => onNavigate('merchants')}
          />
        </div>
      ) : null}

      {/* Recent transactions */}
      <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} color="#64748B" />
            <p className="text-[13px] font-bold text-[#0F172A]">Recent Transactions</p>
          </div>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-[12px] font-bold text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            View all →
          </button>
        </div>

        {loading ? (
          <div className="py-14 text-center text-[#94A3B8] text-[13px]">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="py-14 text-center text-[#94A3B8] text-[13px]">No transactions yet.</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Plan', 'Amount', 'Progress', 'Status', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map(tx => {
                const total = tx.totalAmountDue?.amount ?? tx.principalAmount?.amount ?? 0;
                const paid = tx.amountPaid?.amount ?? 0;
                const installments = tx.installments ?? [];
                const paidCount = installments.filter(i => i.status === 'paid').length;
                const pct = installments.length > 0 ? Math.round((paidCount / installments.length) * 100) : 0;

                return (
                  <tr
                    key={tx.id}
                    className="border-b border-[#F1F5F9] last:border-0 cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                    onClick={() => onNavigate('transactions')}
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-[#0F172A] truncate max-w-[160px]">{tx.title ?? 'Payment Plan'}</p>
                      <code className="text-[10px] text-[#94A3B8]">{tx.id.slice(0, 12)}…</code>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-[#0F172A]">₦{total.toLocaleString('en-NG')}</p>
                      <p className="text-[11px] text-[#16A34A]">₦{paid.toLocaleString('en-NG')} paid</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className="h-full bg-[#00d66f] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-[#64748B] font-semibold">{paidCount}/{installments.length}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><TxBadge status={tx.status} /></td>
                    <td className="px-4 py-3.5 text-[#64748B] text-[12px]">
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
