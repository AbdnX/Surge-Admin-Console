import { useEffect, useState } from 'react';
import { api, type Transaction } from '../lib/api';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:      { bg: '#EFF6FF', color: '#3B82F6' },
  completed:   { bg: '#F0FDF4', color: '#16A34A' },
  delinquent:  { bg: '#FFF1F2', color: '#E11D48' },
  cancelled:   { bg: '#F1F5F9', color: '#64748B' },
  pending:     { bg: '#FFFBEB', color: '#D97706' },
};

function fmt(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtNaira(naira: number) {
  return `₦${naira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function Badge({ status }: { status: string }) {
  const safe = status ?? 'unknown';
  const s = STATUS_COLORS[safe] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span style={{ background: s.bg, color: s.color }} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize">
      {safe}
    </span>
  );
}

function InstallmentBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    paid:      { bg: '#F0FDF4', color: '#16A34A' },
    scheduled: { bg: '#F1F5F9', color: '#64748B' },
    overdue:   { bg: '#FFF1F2', color: '#E11D48' },
    pending:   { bg: '#FFFBEB', color: '#D97706' },
  };
  const s = colors[status] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span style={{ background: s.bg, color: s.color }} className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize">
      {status}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">{label}</span>
      <span className="font-semibold text-[14px] text-[#0F172A]">{value ?? '—'}</span>
    </div>
  );
}

// ── Transaction Detail ────────────────────────────────────────────────────────
function TransactionDetail({
  tx,
  onBack,
  onNavigate,
}: {
  tx: Transaction;
  onBack: () => void;
  onNavigate: (tab: string) => void;
}) {
  // undefined = still fetching, null = fetch failed/not found, string/object = loaded
  const [merchantName, setMerchantName] = useState<string | null | undefined>(undefined);
  const [customerProfile, setCustomerProfile] = useState<{ full_name: string; email: string } | null | undefined>(undefined);

  useEffect(() => {
    const mid = tx.merchant_id ?? tx.merchantId;
    const cid = tx.customer_id ?? tx.customerId;

    if (mid) {
      api.merchants.getDetail(mid)
        .then(res => setMerchantName(res.data.display_name || res.data.legal_name || null))
        .catch(() => setMerchantName(null));
    } else {
      setMerchantName(null);
    }

    if (cid) {
      api.customers.getDetail(cid)
        .then(res => setCustomerProfile({ full_name: res.data.full_name, email: res.data.email }))
        .catch(() => setCustomerProfile(null));
    } else {
      setCustomerProfile(null);
    }
  }, [tx.id]);

  const installments = tx.installments ?? [];
  const paidCount = installments.filter(i => i.status === 'paid').length;
  const total = tx.totalAmountDue?.amount ?? tx.principalAmount?.amount ?? 0;
  const paid = tx.amountPaid?.amount ?? 0;
  const outstanding = tx.amountOutstanding?.amount ?? (total - paid);

  const mid = tx.merchant_id ?? tx.merchantId ?? '—';
  const cid = tx.customer_id ?? tx.customerId ?? '—';

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[#64748B] text-[14px] font-semibold mb-7 hover:text-[#0F172A] transition-colors"
      >
        ← Back to Transactions
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">
            {tx.title ?? 'Payment Plan'}
          </h1>
          <code className="text-[12px] bg-[#F1F5F9] px-2 py-0.5 rounded text-[#475569]">{tx.id}</code>
        </div>
        <Badge status={tx.status} />
      </div>

      <div className="grid grid-cols-3 gap-5 mb-5">
        {/* Summary card */}
        <div className="col-span-3 bg-[#0F172A] rounded-2xl p-6 grid grid-cols-4 gap-6">
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Total Amount</p>
            <p className="text-[22px] font-black text-white">{fmtNaira(total)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Amount Paid</p>
            <p className="text-[22px] font-black text-[#00d66f]">{fmtNaira(paid)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Outstanding</p>
            <p className="text-[22px] font-black text-white/70">{fmtNaira(outstanding)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Installments</p>
            <p className="text-[22px] font-black text-white">
              {paidCount}
              <span className="text-white/35 text-[16px] font-bold"> / {installments.length}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Plan details */}
        <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <p className="text-[13px] font-bold text-[#0F172A]">Plan Details</p>
          </div>
          <div className="p-5 grid grid-cols-2 gap-5">
            <DetailRow label="Plan ID" value={<code className="text-[11px] break-all">{tx.id}</code>} />
            <DetailRow label="Order Ref" value={tx.orderReference ?? tx.orderId ?? '—'} />

            {/* Merchant */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Merchant</span>
              <button
                onClick={() => onNavigate('merchants')}
                className="text-left group"
              >
                <p className="font-bold text-[14px] text-[#0F172A] group-hover:text-[#00d66f] transition-colors">
                  {merchantName === undefined
                    ? <span className="text-[#94A3B8] font-normal italic text-[12px]">loading…</span>
                    : merchantName
                      ? merchantName
                      : <span className="text-[#94A3B8] font-normal">Unknown merchant</span>}
                </p>
                <code className="text-[10px] text-[#94A3B8] break-all">{mid}</code>
              </button>
            </div>

            {/* Customer */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Customer</span>
              <button
                onClick={() => onNavigate('customers')}
                className="text-left group"
              >
                <p className="font-bold text-[14px] text-[#0F172A] group-hover:text-[#00d66f] transition-colors">
                  {customerProfile === undefined
                    ? <span className="text-[#94A3B8] font-normal italic text-[12px]">loading…</span>
                    : customerProfile
                      ? customerProfile.full_name
                      : <span className="text-[#94A3B8] font-normal">Unknown customer</span>}
                </p>
                {customerProfile?.email && (
                  <p className="text-[11px] text-[#64748B]">{customerProfile.email}</p>
                )}
                <code className="text-[10px] text-[#94A3B8] break-all">{cid}</code>
              </button>
            </div>

            <DetailRow label="Schedule" value={<span className="capitalize">{tx.scheduleType ?? '—'}</span>} />
            <DetailRow
              label="Created"
              value={tx.created_at ? new Date(tx.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            />
            {tx.flexScoreAtCreation != null && (
              <DetailRow label="Surge Score at Creation" value={`${tx.flexScoreAtCreation} pts`} />
            )}
          </div>
        </section>

        {/* Progress bar */}
        <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <p className="text-[13px] font-bold text-[#0F172A]">Repayment Progress</p>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <div>
              <div className="flex justify-between text-[12px] font-bold text-[#64748B] mb-1.5">
                <span>{paidCount} of {installments.length} installments paid</span>
                <span>{installments.length > 0 ? Math.round((paidCount / installments.length) * 100) : 0}%</span>
              </div>
              <div className="w-full h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00d66f] rounded-full transition-all"
                  style={{ width: `${installments.length > 0 ? (paidCount / installments.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="flex gap-4 text-[12px]">
              <div>
                <p className="text-[#94A3B8] font-bold uppercase tracking-widest text-[10px] mb-0.5">Deposit</p>
                <p className="font-bold text-[#0F172A]">{fmtNaira(tx.depositAmount?.amount ?? 0)}</p>
              </div>
              <div>
                <p className="text-[#94A3B8] font-bold uppercase tracking-widest text-[10px] mb-0.5">Per Installment</p>
                <p className="font-bold text-[#0F172A]">
                  {installments.length > 0
                    ? fmtNaira(installments[0]?.amountDue?.amount ?? 0)
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Installment schedule */}
      {installments.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <p className="text-[13px] font-bold text-[#0F172A]">Installment Schedule</p>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['#', 'Due Date', 'Amount Due', 'Amount Paid', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {installments.map((inst) => (
                <tr key={inst.id} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-4 py-3.5 font-bold text-[#0F172A]">{inst.sequenceNumber}</td>
                  <td className="px-4 py-3.5 text-[#475569]">
                    {inst.dueDate ? new Date(inst.dueDate).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—'}
                  </td>
                  <td className="px-4 py-3.5 font-semibold">{fmtNaira(inst.amountDue?.amount ?? 0)}</td>
                  <td className="px-4 py-3.5 font-semibold text-[#16A34A]">
                    {inst.amountPaid?.amount > 0 ? fmtNaira(inst.amountPaid.amount) : '—'}
                  </td>
                  <td className="px-4 py-3.5"><InstallmentBadge status={inst.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TransactionsPage({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const LIMIT = 50;

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.transactions.list(page, LIMIT, statusFilter || undefined);
      setTransactions(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      notify('Failed to load transactions', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, statusFilter]);

  const handleView = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.transactions.get(id);
      if (res.ok) setSelected(res.data);
      else notify('Failed to fetch plan details', false);
    } catch {
      notify('An error occurred', false);
    } finally {
      setDetailLoading(false);
    }
  };

  const Toast = () => toast ? (
    <div className={`fixed top-4 right-4 z-[1000] px-5 py-3 rounded-xl text-white text-[13px] font-semibold shadow-xl max-w-xs ${toast.ok ? 'bg-[#0F172A]' : 'bg-red-600'}`}>
      {toast.msg}
    </div>
  ) : null;

  if (selected) {
    return (
      <>
        <Toast />
        <TransactionDetail tx={selected} onBack={() => setSelected(null)} onNavigate={onNavigate ?? (() => {})} />
      </>
    );
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <Toast />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">Transactions</h1>
          <p className="text-[13px] text-[#64748B]">All payment plans across the platform.</p>
        </div>
        {!loading && (
          <span className="bg-[#F1F5F9] text-[#64748B] px-3 py-1 rounded-full text-[12px] font-bold">
            {total} total
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 items-center">
        <select
          className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] bg-white outline-none w-[200px]"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="delinquent">Delinquent</option>
          <option value="cancelled">Cancelled</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden mb-4">
        {loading ? (
          <div className="py-16 text-center text-[#94A3B8] text-[13px]">Loading transactions…</div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-[#94A3B8] text-[13px]">No transactions found.</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Plan', 'Customer', 'Merchant', 'Amount', 'Progress', 'Status', 'Created', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const total = tx.totalAmountDue?.amount ?? tx.principalAmount?.amount ?? 0;
                const paid = tx.amountPaid?.amount ?? 0;
                const installments = tx.installments ?? [];
                const paidCount = installments.filter(i => i.status === 'paid').length;
                const pct = installments.length > 0 ? Math.round((paidCount / installments.length) * 100) : 0;
                const mid = tx.merchant_id ?? tx.merchantId ?? '—';
                const cid = tx.customer_id ?? tx.customerId ?? '—';

                return (
                  <tr
                    key={tx.id}
                    className="border-b border-[#F1F5F9] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                    onClick={() => void handleView(tx.id)}
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-[#0F172A] truncate max-w-[140px]">{tx.title ?? 'Payment Plan'}</p>
                      <code className="text-[10px] text-[#94A3B8]">{tx.id.slice(0, 12)}…</code>
                    </td>
                    <td className="px-4 py-3.5">
                      <code className="text-[11px] text-[#475569]">{cid.slice(0, 10)}…</code>
                    </td>
                    <td className="px-4 py-3.5">
                      <code className="text-[11px] text-[#475569]">{mid.slice(0, 10)}…</code>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-[#0F172A]">₦{total.toLocaleString('en-NG')}</p>
                      <p className="text-[11px] text-[#16A34A]">₦{paid.toLocaleString('en-NG')} paid</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00d66f] rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[#64748B] font-semibold">{paidCount}/{installments.length}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><Badge status={tx.status} /></td>
                    <td className="px-4 py-3.5 text-[#64748B] text-[12px]">
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—'}
                    </td>
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => void handleView(tx.id)}
                        className="px-3 py-1.5 bg-[#F1F5F9] text-[#0F172A] rounded-lg text-[12px] font-semibold hover:bg-[#E2E8F0] transition-colors"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-[#64748B]">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] font-semibold disabled:opacity-40 hover:bg-[#F1F5F9] transition-colors"
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] font-semibold disabled:opacity-40 hover:bg-[#F1F5F9] transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {detailLoading && (
        <div className="fixed inset-0 bg-white/65 flex items-center justify-center z-[600]">
          <div className="font-bold text-[#0F172A]">Loading Plan…</div>
        </div>
      )}
    </div>
  );
}
