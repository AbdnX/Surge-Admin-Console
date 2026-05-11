import React, { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { api, type Merchant, type Transaction } from '../lib/api';

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

function Badge({ status, map }: { status: string; map: Record<string, { bg: string; color: string }> }) {
  const safe = status ?? '';
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

const TIERS = ['Surge Restricted', 'Surge Starter', 'Surge Bronze', 'Surge Silver', 'Surge Gold', 'Surge Elite'];
const EMPTY = { legal_name: '', display_name: '', business_type: 'retail', country: 'NG', email: '', phone: '', password: '' };

const inputCls = 'w-full px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-[14px] text-[#0F172A] bg-white outline-none';
const labelCls = 'block text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1';

// ── API Key Modal ─────────────────────────────────────────────────────────────
function ApiKeyModal({ apiKey, merchantName, onClose }: { apiKey: string; merchantName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center text-[20px]">🔑</div>
          <div>
            <p className="text-[15px] font-black text-[#0F172A]">API Key Issued</p>
            <p className="text-[12px] text-[#64748B]">{merchantName}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-[12px] font-bold text-amber-700">This key is shown once and cannot be retrieved again.</p>
          <p className="text-[11px] text-amber-600 mt-0.5">Copy it now and send it to the merchant securely.</p>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <div className="flex-1 font-mono text-[12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-[#0F172A] overflow-x-auto whitespace-nowrap select-all">
            {apiKey}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 h-10 text-[12px] font-bold text-white bg-[#0F172A] rounded-xl hover:bg-[#1E293B] transition-colors shrink-0"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-[#F1F5F9] text-[#64748B] rounded-xl text-[13px] font-semibold hover:bg-[#E2E8F0] transition-colors"
        >
          I've copied the key — close
        </button>
      </div>
    </div>
  );
}

// ── Merchant Detail Page ──────────────────────────────────────────────────────
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

  const [wallet, setWallet] = useState<{ available_balance: number; pending_balance: number; currency: string; total_earned?: number } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settlement, setSettlement] = useState<any[]>([]);
  const [financialsLoading, setFinancialsLoading] = useState(true);
  const [issuedApiKey, setIssuedApiKey] = useState<string | null>(null);
  const [enablingApiAccess, setEnablingApiAccess] = useState(false);
  const [disablingApiAccess, setDisablingApiAccess] = useState(false);
  const [apiAccessEnabled, setApiAccessEnabled] = useState<boolean>(
    merchant.api_key_enabled === true
  );
  const [reissuing, setReissuing] = useState(false);
  const [showRotateNameModal, setShowRotateNameModal] = useState(false);
  const [rotateName, setRotateName] = useState('');

  const handleEnableApiAccess = async () => {
    setEnablingApiAccess(true);
    try {
      const res = await api.merchants.enableApiAccess(merchant.id);
      if (res.ok) {
        setApiAccessEnabled(true);
        onUpdate({ ...merchant, api_key_enabled: true });
        notify('API access enabled — merchant can now generate their key');
      } else {
        notify('Failed to enable API access', false);
      }
    } catch {
      notify('Failed to enable API access', false);
    } finally {
      setEnablingApiAccess(false);
    }
  };

  const handleDisableApiAccess = async () => {
    if (!confirm('Disable API access? Their current key will stop working immediately.')) return;
    setDisablingApiAccess(true);
    try {
      const res = await api.merchants.disableApiAccess(merchant.id);
      if (res.ok) {
        setApiAccessEnabled(false);
        onUpdate({ ...merchant, api_key_enabled: false });
        notify('API access disabled');
      } else {
        notify('Failed to disable API access', false);
      }
    } catch {
      notify('Failed to disable API access', false);
    } finally {
      setDisablingApiAccess(false);
    }
  };

  const handleReissueKey = async (name: string) => {
    setShowRotateNameModal(false);
    setReissuing(true);
    try {
      const res = await api.merchants.rotateApiKey(merchant.id, name || 'Support Rotation');
      if (res.ok && res.data?.apiKey) {
        setIssuedApiKey(res.data.apiKey);
      } else {
        notify('Failed to rotate API key', false);
      }
    } catch {
      notify('Failed to rotate API key', false);
    } finally {
      setReissuing(false);
    }
  };

  useEffect(() => {
    const loadFinancials = async () => {
      setFinancialsLoading(true);
      const [walletRes, txRes, settlementRes] = await Promise.allSettled([
        api.merchantDetail.wallet(merchant.id),
        api.merchantDetail.transactions(merchant.id),
        api.merchantDetail.settlement(merchant.id),
      ]);
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value);
      if (txRes.status === 'fulfilled') setTransactions(txRes.value.data ?? []);
      if (settlementRes.status === 'fulfilled') setSettlement(settlementRes.value.data ?? []);
      setFinancialsLoading(false);
    };
    void loadFinancials();
  }, [merchant.id]);

  const fmtNaira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      {/* Admin rotate name modal */}
      {showRotateNameModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <p className="text-[15px] font-black text-[#0F172A] mb-1">Rotate API Key (Support)</p>
            <p className="text-[12px] text-[#64748B] mb-4">Give this key a name to identify it in the merchant's history.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4">
              <p className="text-[11px] text-amber-700 font-semibold">The merchant's current key will be invalidated immediately.</p>
            </div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1.5">Key Name</label>
            <input
              autoFocus
              type="text"
              value={rotateName}
              onChange={e => setRotateName(e.target.value)}
              placeholder="e.g. Support Rotation"
              maxLength={64}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none mb-5"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { handleReissueKey(rotateName); setRotateName(''); }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700 transition-colors"
              >
                Rotate Key
              </button>
              <button
                onClick={() => { setShowRotateNameModal(false); setRotateName(''); }}
                className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {issuedApiKey && (
        <ApiKeyModal
          apiKey={issuedApiKey}
          merchantName={merchant.display_name}
          onClose={() => setIssuedApiKey(null)}
        />
      )}

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[#64748B] text-[14px] font-semibold mb-7 hover:text-[#0F172A] transition-colors"
      >
        ← Back to Merchants
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">{merchant.display_name}</h1>
          <p className="text-[14px] text-[#64748B]">{merchant.legal_name}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Badge status={merchant.onboarding_status} map={STATUS_COLORS} />
          <Badge status={merchant.operating_status} map={OP_COLORS} />
        </div>
      </div>

      {/* Wallet summary */}
      <div className="bg-[#0F172A] rounded-2xl p-6 grid grid-cols-3 gap-6 mb-5">
        {financialsLoading ? (
          <div className="col-span-3 text-white/40 text-[13px]">Loading financials…</div>
        ) : wallet ? (
          <>
            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Available Balance</p>
              <p className="text-[26px] font-black text-[#00d66f]">{fmtNaira(wallet.available_balance ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Pending Balance</p>
              <p className="text-[26px] font-black text-white">{fmtNaira(wallet.pending_balance ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Total Earned (Lifetime)</p>
              <p className="text-[26px] font-black text-white/70">{fmtNaira(wallet.total_earned ?? 0)}</p>
            </div>
          </>
        ) : (
          <div className="col-span-3 text-white/40 text-[13px]">Wallet data unavailable.</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Business Info */}
        <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <p className="text-[13px] font-bold text-[#0F172A]">Business Information</p>
          </div>
          <div className="p-5 grid grid-cols-2 gap-5">
            <DetailRow label="Display Name" value={merchant.display_name} />
            <DetailRow label="Legal Name" value={merchant.legal_name} />
            <DetailRow label="Business Type" value={<span className="capitalize">{merchant.business_type}</span>} />
            <DetailRow label="Country" value={merchant.country} />
            <DetailRow label="Joined" value={merchant.created_at ? new Date(merchant.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—'} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Merchant ID</span>
              <code className="text-[11px] bg-[#F1F5F9] px-1.5 py-0.5 rounded-md text-[#475569] break-all">{merchant.id}</code>
            </div>
          </div>
        </section>

        {/* Surge Settings */}
        <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <p className="text-[13px] font-bold text-[#0F172A]">Surge Settings</p>
          </div>
          <div className="p-5 grid grid-cols-2 gap-5">
            <DetailRow label="Min Accepted Tier" value={currentTier} />
            <DetailRow label="Default Deposit" value={(fs as any).default_deposit_percent != null ? `${(fs as any).default_deposit_percent}%` : '—'} />
            <DetailRow label="Max Installments" value={(fs as any).max_installment_count ?? '—'} />
            <DetailRow label="Release Rule" value={(fs as any).release_rule_type?.replace(/_/g, ' ') ?? '—'} />
            <DetailRow label="Allowed Schedules" value={(fs as any).allowed_schedule_types?.join(', ') ?? '—'} />
            <DetailRow label="Risk Bearer" value={(fs as any).risk_bearer?.replace(/_/g, ' ') ?? '—'} />
            {(fs as any).webhook_url && (
              <div className="flex flex-col gap-1 col-span-2">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Webhook URL</span>
                <code className="text-[12px] break-all text-[#475569]">{(fs as any).webhook_url}</code>
              </div>
            )}
          </div>
        </section>

        {/* Customer Gate */}
        <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <p className="text-[13px] font-bold text-[#0F172A]">Customer Gate</p>
          </div>
          <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[13px] font-bold text-[#0F172A] mb-1">Minimum Accepted Tier</p>
              <p className="text-[12px] text-[#64748B]">Customers below this tier cannot start a Surge plan with this merchant.</p>
            </div>
            <select
              disabled={tierSaving === merchant.id}
              value={currentTier}
              onChange={async e => {
                const tier = e.target.value;
                await onTierChange(merchant.id, tier);
                onUpdate({ ...merchant, flex_settings: { ...(merchant.flex_settings ?? {}), min_accepted_tier: tier } });
              }}
              className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-[13px] font-bold text-[#0F172A] bg-white outline-none cursor-pointer disabled:opacity-50 shrink-0"
            >
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </section>

        {/* Actions */}
        <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <p className="text-[13px] font-bold text-[#0F172A]">Actions</p>
          </div>
          <div className="p-5">
            <div className="flex gap-3 flex-wrap mb-3">
              {merchant.onboarding_status !== 'approved' && (
                <button
                  disabled={!!actionId}
                  onClick={async () => {
                    await onApprove(merchant.id);
                    onUpdate({ ...merchant, onboarding_status: 'approved' });
                  }}
                  className="px-5 py-2 bg-[#16A34A] text-white rounded-xl text-[13px] font-bold disabled:opacity-60 shadow-sm shadow-green-200"
                >
                  {actionId === merchant.id ? 'Processing…' : '✓ Approve Merchant'}
                </button>
              )}
              {merchant.onboarding_status === 'approved' && (
                <div className="flex items-center gap-2 bg-[#F0FDF4] border border-[#86EFAC] rounded-xl px-4 py-2">
                  <span className="text-[#16A34A] font-bold text-[13px]">✓ Approved</span>
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
                  className="px-4 py-2 bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] rounded-xl text-[13px] font-bold disabled:opacity-60"
                >
                  {actionId === merchant.id ? 'Processing…' : 'Reject'}
                </button>
              )}
            </div>
            {merchant.onboarding_status === 'approved' && (
              <div className="flex flex-col gap-3">
                <p className="text-[12px] text-[#94A3B8]">This merchant is live and can accept Surge payment plans.</p>

                {/* API Access section */}
                <div className="border-t border-[#F1F5F9] pt-3 flex flex-col gap-2">
                  <p className="text-[12px] font-bold text-[#0F172A]">API Access</p>

                  {!apiAccessEnabled ? (
                    <>
                      <p className="text-[11px] text-[#94A3B8]">
                        Merchant cannot generate an API key yet. Enable access once they're ready to integrate.
                      </p>
                      <button
                        onClick={handleEnableApiAccess}
                        disabled={enablingApiAccess}
                        className="self-start px-4 py-2 bg-[#0F172A] text-white rounded-xl text-[12px] font-bold hover:bg-[#1E293B] transition-colors disabled:opacity-50"
                      >
                        {enablingApiAccess ? 'Enabling…' : '🔑 Enable API Access'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-[#16A34A] bg-[#F0FDF4] border border-[#86EFAC] px-2.5 py-1 rounded-full">
                          ✓ API access enabled
                        </span>
                      </div>
                      <p className="text-[11px] text-[#94A3B8]">
                        Merchant can generate and rotate their own key from their dashboard.
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setShowRotateNameModal(true)}
                          disabled={reissuing}
                          className="self-start px-4 py-2 bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] rounded-xl text-[12px] font-bold hover:bg-[#E2E8F0] transition-colors disabled:opacity-50"
                        >
                          {reissuing ? 'Rotating…' : 'Rotate Key (support)'}
                        </button>
                        <button
                          onClick={handleDisableApiAccess}
                          disabled={disablingApiAccess}
                          className="self-start px-4 py-2 bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] rounded-xl text-[12px] font-bold hover:bg-[#FFE4E6] transition-colors disabled:opacity-50"
                        >
                          {disablingApiAccess ? 'Disabling…' : 'Disable API Access'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Transactions */}
      <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden mb-5">
        <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center justify-between">
          <p className="text-[13px] font-bold text-[#0F172A]">Payment Plans</p>
          {!financialsLoading && (
            <span className="text-[11px] font-bold text-[#94A3B8] bg-[#F1F5F9] px-2.5 py-1 rounded-full">
              {transactions.length} total
            </span>
          )}
        </div>
        {financialsLoading ? (
          <div className="py-10 text-center text-[#94A3B8] text-[13px]">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="py-10 text-center text-[#94A3B8] text-[13px]">No payment plans yet.</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Plan', 'Amount', 'Progress', 'Status', 'Created'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map(tx => {
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

      {/* Settlement entries */}
      <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center justify-between">
          <p className="text-[13px] font-bold text-[#0F172A]">Settlement Entries</p>
          {!financialsLoading && (
            <span className="text-[11px] font-bold text-[#94A3B8] bg-[#F1F5F9] px-2.5 py-1 rounded-full">
              {settlement.length} entries
            </span>
          )}
        </div>
        {financialsLoading ? (
          <div className="py-10 text-center text-[#94A3B8] text-[13px]">Loading…</div>
        ) : settlement.length === 0 ? (
          <div className="py-10 text-center text-[#94A3B8] text-[13px]">No settlement entries yet.</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Entry ID', 'Type', 'Amount', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlement.slice(0, 20).map(entry => {
                const amount = entry.amount ?? entry.json?.amount ?? 0;
                const type = entry.type ?? entry.json?.type ?? '—';
                const isCredit = type.includes('credit') || type.includes('payout');
                return (
                  <tr key={entry.id} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-4 py-3.5">
                      <code className="text-[11px] text-[#94A3B8]">{entry.id?.slice(0, 16)}…</code>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${isCredit ? 'bg-[#F0FDF4] text-[#16A34A]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                        {type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#0F172A]">{fmtNaira(amount)}</td>
                    <td className="px-4 py-3.5 text-[#64748B] text-[12px]">
                      {entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—'}
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
    <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl text-white text-[13px] font-semibold shadow-xl max-w-xs ${toast.ok ? 'bg-[#0F172A]' : 'bg-red-600'}`}>
      {toast.msg}
    </div>
  ) : null;

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

  return (
    <div>
      <Toast />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">Merchants</h1>
          <p className="text-[13px] text-[#64748B]">Register and manage merchant accounts.</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setLastCreated(null); }}
          className="px-5 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-[13px] font-bold transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Merchant'}
        </button>
      </div>

      {/* Success banner */}
      {lastCreated && (
        <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-2xl p-4 mb-5">
          <p className="font-bold text-[#15803D] mb-1.5 text-[13px]">Merchant created</p>
          <p className="text-[12px] text-[#166534] leading-relaxed">
            <strong>Login email:</strong> {lastCreated.email}<br />
            <strong>Merchant ID:</strong>{' '}
            <code className="bg-[#DCFCE7] px-1.5 py-0.5 rounded text-[11px]">{lastCreated.merchantId}</code><br />
            The merchant can now log in at the Merchant Dashboard using their email and password.
          </p>
        </div>
      )}

      {/* Registration form */}
      {showForm && (
        <form onSubmit={handleOnboard} className="bg-white rounded-2xl border border-[#E8ECF0] p-5 mb-5">
          <p className="text-[13px] font-bold text-[#0F172A] mb-4">New Merchant</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className={labelCls}>Legal Name *</label><input className={inputCls} required value={form.legal_name} onChange={set('legal_name')} placeholder="Acme Ltd." /></div>
            <div><label className={labelCls}>Display Name *</label><input className={inputCls} required value={form.display_name} onChange={set('display_name')} placeholder="Acme Store" /></div>
            <div>
              <label className={labelCls}>Business Type *</label>
              <select className={inputCls} value={form.business_type} onChange={set('business_type')}>
                {['retail','ecommerce','services','fmcg','electronics','fashion','pharmacy','travel'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Country *</label>
              <select className={inputCls} value={form.country} onChange={set('country')}>
                <option value="NG">Nigeria</option>
                <option value="GH">Ghana</option>
                <option value="KE">Kenya</option>
              </select>
            </div>
          </div>
          <div className="border-t border-[#F1F5F9] pt-4 mb-4">
            <p className="text-[11px] font-bold text-[#64748B] mb-3 uppercase tracking-wider">Login Credentials</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Email *</label><input className={inputCls} required type="email" value={form.email} onChange={set('email')} placeholder="merchant@example.com" /></div>
              <div><label className={labelCls}>Phone *</label><input className={inputCls} required value={form.phone} onChange={set('phone')} placeholder="08012345678" /></div>
              <div className="col-span-2"><label className={labelCls}>Password *</label><input className={inputCls} required type="password" value={form.password} onChange={set('password')} placeholder="Minimum 8 characters" minLength={8} /></div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-xl text-[13px] font-semibold">Cancel</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 bg-[#16A34A] text-white rounded-xl text-[13px] font-bold disabled:opacity-60">
              {submitting ? 'Creating…' : 'Create Merchant'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['', 'pending', 'approved', 'rejected'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${filter === s ? 'bg-[#0F172A] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}
          >
            {s === '' ? 'All' : s === 'pending' ? 'Approvals' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[#94A3B8] text-[13px]">Loading…</div>
        ) : merchants.length === 0 ? (
          <div className="py-12 text-center text-[#94A3B8] text-[13px]">No merchants found.</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Business', 'Type', 'Onboarding', 'Operating', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {merchants.map(m => (
                <tr
                  key={m.id}
                  className="border-b border-[#F1F5F9] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                  onClick={() => setSelectedMerchant(m)}
                >
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-[#0F172A]">{m.display_name}</p>
                    <p className="text-[12px] text-[#94A3B8]">{m.legal_name}</p>
                  </td>
                  <td className="px-4 py-3.5 text-[#64748B] capitalize">{m.business_type}</td>
                  <td className="px-4 py-3.5"><Badge status={m.onboarding_status} map={STATUS_COLORS} /></td>
                  <td className="px-4 py-3.5"><Badge status={m.operating_status} map={OP_COLORS} /></td>
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => setSelectedMerchant(m)}
                        className="px-3 py-1.5 bg-[#F1F5F9] text-[#0F172A] rounded-lg text-[12px] font-semibold hover:bg-[#E2E8F0] transition-colors"
                      >
                        View →
                      </button>
                      {m.onboarding_status !== 'approved' && (
                        <button
                          disabled={actionId === m.id}
                          onClick={() => handleApprove(m.id)}
                          className="px-3 py-1.5 bg-[#16A34A] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60"
                        >
                          Approve
                        </button>
                      )}
                      {m.onboarding_status !== 'rejected' && (
                        <button
                          disabled={actionId === m.id}
                          onClick={() => { if (confirm('Reject this merchant?')) handleReject(m.id); }}
                          className="px-3 py-1.5 bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] rounded-lg text-[12px] font-semibold disabled:opacity-60"
                        >
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
      <p className="mt-3 text-[#94A3B8] text-[12px]">{merchants.length} merchant{merchants.length !== 1 ? 's' : ''}</p>
    </div>
  );
}
