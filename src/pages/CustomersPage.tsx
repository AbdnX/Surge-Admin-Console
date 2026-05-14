import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, type Customer, type ScoreSnapshot, type PaymentMethod, type Transaction } from '../lib/api';

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

const inputCls = 'w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-[14px] text-[#0F172A] bg-white outline-none';

function Badge({ status, map }: { status: string; map: Record<string, { bg: string; color: string }> }) {
  const safe = status ?? 'unknown';
  const s = map[safe] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span style={{ background: s.bg, color: s.color }} className="px-3 py-0.5 rounded-full text-[11px] font-bold capitalize">
      {safe.replace(/_/g, ' ')}
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

// ── Customer Detail Page ──────────────────────────────────────────────────────
const TX_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:     { bg: '#EFF6FF', color: '#3B82F6' },
  completed:  { bg: '#F0FDF4', color: '#16A34A' },
  delinquent: { bg: '#FFF1F2', color: '#E11D48' },
  cancelled:  { bg: '#F1F5F9', color: '#64748B' },
  pending:    { bg: '#FFFBEB', color: '#D97706' },
};

function TxBadge({ status }: { status: string }) {
  const s = TX_STATUS_COLORS[status] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span style={{ background: s.bg, color: s.color }} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize">
      {status}
    </span>
  );
}

function CustomerDetailPage({ customer: initial, onBack, notify }: {
  customer: Customer;
  onBack: () => void;
  notify: (msg: string, ok?: boolean) => void;
}) {
  const [customer, setCustomer] = useState(initial);
  const [actionLoading, setActionLoading] = useState(false);

  // Financial / risk data
  const [scoreHistory, setScoreHistory] = useState<ScoreSnapshot[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [financialsLoading, setFinancialsLoading] = useState(true);
  const [refreshingScore, setRefreshingScore] = useState(false);

  // Credit bureau
  const [creditCheck, setCreditCheck] = useState<any | null>(null);
  const [runningCreditCheck, setRunningCreditCheck] = useState(false);
  const [creditOverride, setCreditOverride] = useState('');

  useEffect(() => {
    const load = async () => {
      setFinancialsLoading(true);
      const [histRes, pmRes, txRes, ccRes] = await Promise.allSettled([
        api.risk.history(customer.id),
        api.paymentMethods.list(customer.id),
        api.customerTransactions.list(customer.id),
        api.customers.getCreditCheck(customer.id),
      ]);
      if (histRes.status === 'fulfilled') setScoreHistory(histRes.value.data?.data ?? []);
      if (pmRes.status === 'fulfilled') setPaymentMethods(pmRes.value.data ?? []);
      if (txRes.status === 'fulfilled') setTransactions(txRes.value.data ?? []);
      if (ccRes.status === 'fulfilled') setCreditCheck(ccRes.value.data ?? null);
      setFinancialsLoading(false);
    };
    void load();
  }, [customer.id]);

  const handleRefreshScore = async () => {
    setRefreshingScore(true);
    try {
      const res = await api.risk.refresh(customer.id);
      if (res.ok) {
        notify(`Score refreshed — new score: ${res.data.score} (${res.data.tier})`);
        setCustomer(c => ({ ...c, surge_score: res.data.score }));
        // Reload history
        const histRes = await api.risk.history(customer.id);
        setScoreHistory(histRes.data?.data ?? []);
      } else {
        notify('Failed to refresh score', false);
      }
    } catch { notify('Error refreshing score', false); }
    finally { setRefreshingScore(false); }
  };

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

  const handleRunCreditCheck = async (overrideBand?: string) => {
    setRunningCreditCheck(true);
    try {
      const res = await api.customers.runCreditCheck(customer.id, 'admin', overrideBand || undefined);
      if (res.ok) {
        setCreditCheck(res.data);
        setCreditOverride('');
        notify(`Credit check complete — band: ${res.data.credit_band}`);
        // Refresh score to reflect new band, then reload history
        const scoreRes = await api.risk.refresh(customer.id);
        if (scoreRes.ok) {
          setCustomer(c => ({ ...c, surge_score: scoreRes.data.score }));
          const histRes = await api.risk.history(customer.id);
          setScoreHistory(histRes.data?.data ?? []);
        }
      } else {
        notify('Credit check failed', false);
      }
    } catch { notify('Error running credit check', false); }
    finally { setRunningCreditCheck(false); }
  };

  const score = customer.surge_score ?? 0;
  const scoreColor = score >= 700 ? '#00d66f' : score >= 400 ? '#F97316' : '#E11D48';

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[#64748B] text-[14px] font-semibold mb-7 hover:text-[#0F172A] transition-colors"
      >
        ← Back to Customers
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">{customer.full_name}</h1>
          <p className="text-[14px] text-[#64748B]">{customer.email}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Badge status={customer.verification_status} map={VERIFICATION_COLORS} />
          <Badge status={customer.account_status} map={ACCOUNT_STATUS_COLORS} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Score card */}
        <section className="bg-[#0F172A] rounded-2xl p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Surge Score</p>
            <div className="flex items-baseline gap-1.5">
              <span style={{ color: scoreColor }} className="text-5xl font-black leading-none">{score}</span>
              <span className="text-[14px] text-white/35 font-semibold">pts</span>
            </div>
          </div>
          <div className="text-right flex flex-col gap-3">
            <div>
              <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-1.5">Verification</p>
              <Badge status={customer.verification_status} map={VERIFICATION_COLORS} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-1.5">Account</p>
              <Badge status={customer.account_status} map={ACCOUNT_STATUS_COLORS} />
            </div>
            {creditCheck?.credit_band && (() => {
              const bandColors: Record<string, string> = { Excellent: '#00d66f', Good: '#3B82F6', Fair: '#F97316', Poor: '#E11D48' };
              return (
                <div>
                  <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-1.5">Credit Band</p>
                  <span style={{ color: bandColors[creditCheck.credit_band] ?? '#94A3B8' }} className="text-[13px] font-black">
                    {creditCheck.credit_band}
                  </span>
                </div>
              );
            })()}
          </div>
        </section>

        {/* Contact Info */}
        <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <p className="text-[13px] font-bold text-[#0F172A]">Contact Information</p>
          </div>
          <div className="p-5 grid grid-cols-2 gap-5">
            <DetailRow label="Full Name" value={customer.full_name} />
            <DetailRow label="Email" value={customer.email} />
            <DetailRow label="Phone" value={customer.phone || '—'} />
            <DetailRow label="Role" value={<span className="capitalize">{customer.role || '—'}</span>} />
            <DetailRow label="Joined" value={customer.created_at ? new Date(customer.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—'} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Customer ID</span>
              <code className="text-[11px] bg-[#F1F5F9] px-1.5 py-0.5 rounded-md text-[#475569] break-all">{customer.id}</code>
            </div>
          </div>
        </section>

        {/* Pending identity submission */}
        {customer.verification_status === 'in_progress' && customer.json?.id_number && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-amber-200">
              <p className="text-[13px] font-bold text-amber-800">⏳ Pending Identity Submission</p>
            </div>
            <div className="p-5 grid grid-cols-2 gap-5">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">ID Type</span>
                <span className="font-black text-[15px] uppercase text-amber-900">{customer.json.id_type || '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">ID Number</span>
                <code className="font-bold bg-amber-100 px-3 py-1 rounded-lg text-[17px] text-amber-900">{customer.json.id_number}</code>
              </div>
            </div>
          </section>
        )}

        {/* Actions */}
        <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <p className="text-[13px] font-bold text-[#0F172A]">Actions</p>
          </div>
          <div className="p-5 flex flex-col gap-3">
            {customer.verification_status === 'in_progress' && (
              <div className="flex gap-3">
                <button
                  disabled={actionLoading}
                  onClick={() => void handleApproveVerification()}
                  className="flex-1 py-2.5 bg-[#16A34A] text-white rounded-xl text-[13px] font-bold disabled:opacity-60 shadow-sm shadow-green-200"
                >
                  {actionLoading ? 'Processing…' : '✓ Approve Verification'}
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => void handleRejectVerification()}
                  className="flex-1 py-2.5 bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] rounded-xl text-[13px] font-bold disabled:opacity-60"
                >
                  {actionLoading ? 'Processing…' : 'Reject'}
                </button>
              </div>
            )}
            {customer.verification_status === 'verified' && (
              <div className="flex items-center gap-2 bg-[#F0FDF4] border border-[#86EFAC] rounded-xl px-4 py-2.5">
                <span className="text-[#16A34A] font-bold text-[13px]">✓ Identity verified</span>
              </div>
            )}
            {customer.account_status !== 'suspended' ? (
              <button
                disabled={actionLoading}
                onClick={() => void handleSuspend()}
                className="py-2.5 bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] rounded-xl text-[13px] font-bold disabled:opacity-60"
              >
                {actionLoading ? 'Processing…' : 'Suspend Account'}
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-[#FFF1F2] border border-[#FECDD3] rounded-xl px-4 py-2.5">
                <span className="text-[#E11D48] font-bold text-[13px]">Account suspended</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Score History ── */}
      <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden mt-5">
        <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center justify-between">
          <p className="text-[13px] font-bold text-[#0F172A]">Surge Score History</p>
          <button
            disabled={refreshingScore}
            onClick={() => void handleRefreshScore()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F1F5F9] text-[#0F172A] rounded-lg text-[12px] font-semibold hover:bg-[#E2E8F0] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshingScore ? 'animate-spin' : ''} />
            {refreshingScore ? 'Recalculating…' : 'Force Refresh'}
          </button>
        </div>
        {financialsLoading ? (
          <div className="py-10 text-center text-[#94A3B8] text-[13px]">Loading…</div>
        ) : scoreHistory.length === 0 ? (
          <div className="py-10 text-center text-[#94A3B8] text-[13px]">No score history available.</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Score', 'Tier', 'Verified', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scoreHistory.map((snap, i) => {
                const c = snap.score >= 700 ? '#00d66f' : snap.score >= 400 ? '#F97316' : '#E11D48';
                return (
                  <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-4 py-3">
                      <span style={{ color: c }} className="font-black text-[16px]">{snap.score}</span>
                      <span className="text-[11px] text-[#94A3B8] ml-1">pts</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#0F172A]">{snap.tier ?? '—'}</td>
                    <td className="px-4 py-3">
                      {snap.onboarding_completed
                        ? <span className="text-[#16A34A] font-bold text-[11px]">✓ Verified</span>
                        : <span className="text-[#94A3B8] text-[11px]">Not verified</span>}
                    </td>
                    <td className="px-4 py-3 text-[#64748B] text-[12px]">
                      {snap.created_at ? new Date(snap.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Credit Bureau ── */}
      <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden mt-5">
        <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center justify-between">
          <p className="text-[13px] font-bold text-[#0F172A]">Credit Bureau</p>
          {creditCheck && (
            <span className="text-[11px] text-[#64748B]">
              Last checked {new Date(creditCheck.checked_at).toLocaleDateString('en-NG', { dateStyle: 'medium' })} · {creditCheck.bureau}
            </span>
          )}
        </div>
        <div className="p-5">
          {financialsLoading ? (
            <div className="py-6 text-center text-[#94A3B8] text-[13px]">Loading…</div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Current band display */}
              <div className="grid grid-cols-4 gap-4">
                {(['Excellent', 'Good', 'Fair', 'Poor'] as const).map(band => {
                  const bandColors: Record<string, { bg: string; border: string; text: string }> = {
                    Excellent: { bg: '#F0FDF4', border: '#86EFAC', text: '#16A34A' },
                    Good:      { bg: '#EFF6FF', border: '#93C5FD', text: '#2563EB' },
                    Fair:      { bg: '#FFF7ED', border: '#FED7AA', text: '#F97316' },
                    Poor:      { bg: '#FFF1F2', border: '#FECDD3', text: '#E11D48' },
                  };
                  const isCurrent = creditCheck?.credit_band === band;
                  const c = bandColors[band];
                  return (
                    <div
                      key={band}
                      style={isCurrent ? { background: c.bg, borderColor: c.border } : {}}
                      className={`rounded-xl border px-4 py-3 text-center transition-all ${isCurrent ? 'border-2' : 'border-[#E8ECF0]'}`}
                    >
                      <p style={isCurrent ? { color: c.text } : {}} className={`text-[13px] font-black ${isCurrent ? '' : 'text-[#CBD5E1]'}`}>{band}</p>
                      {isCurrent && creditCheck?.raw_score != null && (
                        <p style={{ color: c.text }} className="text-[11px] font-semibold mt-0.5 opacity-70">Score {creditCheck.raw_score}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  disabled={runningCreditCheck}
                  onClick={() => void handleRunCreditCheck()}
                  className="px-4 py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold disabled:opacity-50 hover:bg-[#1E293B] transition-colors"
                >
                  {runningCreditCheck ? 'Running…' : 'Run Credit Check'}
                </button>
                <button
                  disabled={runningCreditCheck}
                  onClick={() => void (async () => {
                    setRunningCreditCheck(true);
                    try {
                      await api.customers.requestReassessment(customer.id);
                      notify('Customer will be prompted to pay for a new assessment');
                    } catch { notify('Failed to request reassessment', false); }
                    finally { setRunningCreditCheck(false); }
                  })()}
                  className="px-4 py-2.5 bg-[#FFF7ED] text-[#F97316] border border-[#FED7AA] rounded-xl text-[13px] font-bold disabled:opacity-50"
                >
                  Request Re-assessment
                </button>
                <div className="flex items-center gap-2">
                  <select
                    value={creditOverride}
                    onChange={e => setCreditOverride(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-[#E8ECF0] text-[13px] text-[#0F172A] bg-white outline-none"
                  >
                    <option value="">Manual override…</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                  {creditOverride && (
                    <button
                      disabled={runningCreditCheck}
                      onClick={() => void handleRunCreditCheck(creditOverride)}
                      className="px-4 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold disabled:opacity-50"
                    >
                      Apply Override
                    </button>
                  )}
                </div>
              </div>

              {!creditCheck && (
                <p className="text-[13px] text-[#94A3B8]">No credit check on record. Run a check to populate the credit band.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Payment Methods ── */}
      <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden mt-5">
        <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center justify-between">
          <p className="text-[13px] font-bold text-[#0F172A]">Payment Methods</p>
          {!financialsLoading && (
            <span className="text-[11px] font-bold text-[#94A3B8] bg-[#F1F5F9] px-2.5 py-1 rounded-full">
              {paymentMethods.length} linked
            </span>
          )}
        </div>
        {financialsLoading ? (
          <div className="py-10 text-center text-[#94A3B8] text-[13px]">Loading…</div>
        ) : paymentMethods.length === 0 ? (
          <div className="py-10 text-center text-[#94A3B8] text-[13px]">No payment methods linked.</div>
        ) : (
          <div className="p-5 flex flex-col gap-3">
            {paymentMethods.map(pm => {
              const isCard = pm.type === 'card';
              const label = isCard
                ? `${pm.card_type ?? 'Card'} •••• ${pm.last_four ?? '????'}`
                : `${pm.bank_name ?? 'Bank'} — ${pm.account_name ?? '—'}`;
              const sub = isCard
                ? `Expires ${pm.expiry_month ?? '??'}/${pm.expiry_year ?? '??'}`
                : pm.last_four ? `Acct: •••• ${pm.last_four}` : '';

              return (
                <div key={pm.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${pm.is_default ? 'border-[#00d66f] bg-[#F0FDF4]' : 'border-[#E8ECF0] bg-[#F8FAFC]'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold ${isCard ? 'bg-[#EFF6FF] text-[#3B82F6]' : 'bg-[#FFF7ED] text-[#F97316]'}`}>
                      {isCard ? '💳' : '🏦'}
                    </div>
                    <div>
                      <p className="font-bold text-[13px] text-[#0F172A]">{label}</p>
                      {sub && <p className="text-[11px] text-[#64748B]">{sub}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pm.is_default && (
                      <span className="text-[10px] font-bold text-[#16A34A] bg-[#DCFCE7] px-2 py-0.5 rounded-full">Default</span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pm.is_active ? 'bg-[#F0FDF4] text-[#16A34A]' : 'bg-[#FFF1F2] text-[#E11D48]'}`}>
                      {pm.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Transaction History ── */}
      <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden mt-5">
        <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center justify-between">
          <p className="text-[13px] font-bold text-[#0F172A]">Transaction History</p>
          {!financialsLoading && (
            <span className="text-[11px] font-bold text-[#94A3B8] bg-[#F1F5F9] px-2.5 py-1 rounded-full">
              {transactions.length} plans
            </span>
          )}
        </div>
        {financialsLoading ? (
          <div className="py-10 text-center text-[#94A3B8] text-[13px]">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="py-10 text-center text-[#94A3B8] text-[13px]">No transactions yet.</div>
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
              {transactions.map(tx => {
                const total = tx.totalAmountDue?.amount ?? tx.principalAmount?.amount ?? 0;
                const paid = tx.amountPaid?.amount ?? 0;
                const insts = tx.installments ?? [];
                const paidCount = insts.filter(i => i.status === 'paid').length;
                const pct = insts.length > 0 ? Math.round((paidCount / insts.length) * 100) : 0;
                return (
                  <tr key={tx.id} className="border-b border-[#F1F5F9] last:border-0">
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
                        <span className="text-[11px] text-[#64748B] font-semibold">{paidCount}/{insts.length}</span>
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
    <div className={`fixed top-4 right-4 z-[1000] px-5 py-3 rounded-xl text-white text-[13px] font-semibold shadow-xl max-w-xs ${toast.ok ? 'bg-[#0F172A]' : 'bg-red-600'}`}>
      {toast.msg}
    </div>
  ) : null;

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

  return (
    <div>
      <Toast />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">Customers</h1>
          <p className="text-[13px] text-[#64748B]">All platform users — consumers and merchants who shop.</p>
        </div>
        {!loading && (
          <span className="bg-[#F1F5F9] text-[#64748B] px-3 py-1 rounded-full text-[12px] font-bold">
            {customers.length} record{customers.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-[14px]">🔍</span>
        </div>
        <select
          className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] bg-white outline-none w-[200px]"
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
      <div className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[#94A3B8] text-[13px]">Loading customer records…</div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-[#94A3B8] text-[13px]">No customers match your criteria.</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Customer', 'Verification', 'Account Status', 'Surge Score', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr
                  key={c.id}
                  className="border-b border-[#F1F5F9] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                  onClick={() => void handleViewDetail(c.id)}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#0F172A]">{c.full_name}</p>
                      {c.role === 'merchant' && (
                        <span className="bg-[#EFF6FF] text-[#3B82F6] px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">Merchant</span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#64748B]">{c.email}</p>
                  </td>
                  <td className="px-4 py-3.5"><Badge status={c.verification_status} map={VERIFICATION_COLORS} /></td>
                  <td className="px-4 py-3.5"><Badge status={c.account_status} map={ACCOUNT_STATUS_COLORS} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-baseline gap-1">
                      <span
                        style={{ color: (c.surge_score ?? 0) >= 400 ? '#16A34A' : (c.surge_score ?? 0) >= 0 ? '#F97316' : '#E11D48' }}
                        className="font-bold text-[15px]"
                      >
                        {c.surge_score ?? '—'}
                      </span>
                      <span className="text-[11px] text-[#94A3B8] font-semibold">pts</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => void handleViewDetail(c.id)}
                      className="px-3 py-1.5 bg-[#F1F5F9] text-[#0F172A] rounded-lg text-[12px] font-semibold hover:bg-[#E2E8F0] transition-colors"
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

      {detailLoading && (
        <div className="fixed inset-0 bg-white/65 flex items-center justify-center z-[600]">
          <div className="font-bold text-[#0F172A]">Loading Profile…</div>
        </div>
      )}
    </div>
  );
}
