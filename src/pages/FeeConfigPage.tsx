import { useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp, X, Calculator,
  Globe, Users, Building2, Info
} from 'lucide-react';
import { api } from '../lib/api';
import type { FeeConfig, FeeGroup, FeeScope, FeeType, FeeCalculationResult, Merchant } from '../lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtRate(cfg: FeeConfig): string {
  const parts: string[] = [];
  if (cfg.fee_type === 'percentage' || cfg.fee_type === 'mixed') {
    if (cfg.percentage_rate != null) parts.push(`${(cfg.percentage_rate * 100).toFixed(4)}%`);
  }
  if (cfg.fee_type === 'flat' || cfg.fee_type === 'mixed') {
    if (cfg.flat_amount != null) parts.push(`₦${cfg.flat_amount.toLocaleString()}`);
  }
  return parts.join(' + ') || '—';
}

function fmtNgn(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const SCOPE_COLORS: Record<FeeScope, string> = {
  global:   'bg-violet-100 text-violet-700',
  group:    'bg-blue-100 text-blue-700',
  merchant: 'bg-emerald-100 text-emerald-700',
};

const SCOPE_ICONS: Record<FeeScope, React.ElementType> = {
  global:   Globe,
  group:    Users,
  merchant: Building2,
};

function ScopeBadge({ scope }: { scope: FeeScope }) {
  const Icon = SCOPE_ICONS[scope];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${SCOPE_COLORS[scope]}`}>
      <Icon size={10} />
      {scope}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function Toast({ msg, ok, onDismiss }: { msg: string; ok: boolean; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-[13px] font-semibold text-white ${ok ? 'bg-[#16A34A]' : 'bg-[#E11D48]'}`}>
      {msg}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Global Config Card
// ---------------------------------------------------------------------------

function GlobalConfigCard({
  configs,
  onEdit,
}: {
  configs: FeeConfig[];
  onEdit: (cfg: FeeConfig) => void;
}) {
  const global = configs.find(c => c.scope === 'global' && c.is_active);
  if (!global) return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
      <p className="text-[13px] text-amber-700 font-semibold">
        No active global default found. All merchants will use the system fallback (2.5%).
      </p>
    </div>
  );

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 mb-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe size={16} color="#7C3AED" />
            <p className="text-[13px] font-bold text-[#0F172A] uppercase tracking-widest">Global Default</p>
          </div>
          <p className="text-[24px] font-black text-[#0F172A] mt-2">{fmtRate(global)}</p>
          <p className="text-[12px] text-[#64748B] mt-1">{global.name}</p>
          <div className="flex items-center gap-3 mt-3 text-[12px] text-[#64748B]">
            {global.min_fee != null && <span>Floor: {fmtNgn(global.min_fee)}</span>}
            {global.max_fee != null && <span>Cap: {fmtNgn(global.max_fee)}</span>}
            {global.fee_type === 'mixed' && <span className="text-violet-600 font-semibold">Mixed (% + flat)</span>}
          </div>
        </div>
        <button
          onClick={() => onEdit(global)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] rounded-lg text-[12px] font-semibold transition-colors"
        >
          <Pencil size={12} /> Edit
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-[#F1F5F9] grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-[11px] text-[#94A3B8] uppercase tracking-widest">Fee Type</p>
          <p className="text-[14px] font-bold text-[#0F172A] capitalize mt-0.5">{global.fee_type}</p>
        </div>
        <div>
          <p className="text-[11px] text-[#94A3B8] uppercase tracking-widest">Effective From</p>
          <p className="text-[14px] font-bold text-[#0F172A] mt-0.5">{global.effective_from ? new Date(global.effective_from).toLocaleDateString() : 'Always'}</p>
        </div>
        <div>
          <p className="text-[11px] text-[#94A3B8] uppercase tracking-widest">Effective Until</p>
          <p className="text-[14px] font-bold text-[#0F172A] mt-0.5">{global.effective_until ? new Date(global.effective_until).toLocaleDateString() : 'No end'}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fee Preview Calculator
// ---------------------------------------------------------------------------

function FeeCalculator({ merchants }: { merchants: { id: string; display_name: string }[] }) {
  const [amount, setAmount] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [result, setResult] = useState<FeeCalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.feeConfigs.preview(num, merchantId || undefined);
      setResult(res.data);
    } catch (e: any) {
      setError(e.message ?? 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Calculator size={16} color="#0F172A" />
        <p className="text-[13px] font-bold text-[#0F172A]">Fee Preview Calculator</p>
      </div>
      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Amount (NGN)</label>
          <input
            type="number"
            placeholder="e.g. 50000"
            value={amount}
            onChange={e => { setAmount(e.target.value); setResult(null); }}
            className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A]"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Merchant (optional)</label>
          <select
            value={merchantId}
            onChange={e => { setMerchantId(e.target.value); setResult(null); }}
            className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white"
          >
            <option value="">Use global default</option>
            {merchants.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        </div>
        <button
          onClick={() => void run()}
          disabled={loading || !amount}
          className="px-4 py-2.5 bg-[#0F172A] text-white rounded-lg text-[13px] font-bold disabled:opacity-50 transition-opacity whitespace-nowrap"
        >
          {loading ? 'Calculating…' : 'Calculate'}
        </button>
      </div>
      {error && <p className="text-[#E11D48] text-[12px] font-semibold mt-2">{error}</p>}
      {result && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Gross Amount',      value: fmtNgn(result.gross_amount) },
            { label: 'Platform Fee',      value: fmtNgn(result.fee_amount),      accent: true },
            { label: 'Merchant Payable',  value: fmtNgn(result.merchant_payable) },
            { label: 'Effective Rate',    value: `${result.effective_rate_pct.toFixed(4)}%` },
          ].map(({ label, value, accent }) => (
            <div key={label} className={`rounded-xl p-3 ${accent ? 'bg-violet-50 border border-violet-100' : 'bg-[#F8FAFC]'}`}>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">{label}</p>
              <p className={`text-[15px] font-black mt-0.5 ${accent ? 'text-violet-700' : 'text-[#0F172A]'}`}>{value}</p>
            </div>
          ))}
          <div className="col-span-2 sm:col-span-4 text-[11px] text-[#94A3B8] flex items-center gap-1.5">
            <Info size={11} />
            Resolved via: <span className="font-semibold text-[#64748B]">{result.config_name}</span>
            <ScopeBadge scope={result.resolved_scope} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Config Form Modal (create / edit)
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  name: '',
  scope: 'global' as FeeScope,
  merchant_id: '',
  group_id: '',
  fee_type: 'percentage' as FeeType,
  percentage_rate: '',
  flat_amount: '',
  min_fee: '',
  max_fee: '',
  is_active: true,
  effective_from: '',
  effective_until: '',
};

function ConfigModal({
  initial,
  groups,
  merchants,
  onSave,
  onClose,
}: {
  initial?: FeeConfig;
  groups: FeeGroup[];
  merchants: { id: string; display_name: string }[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY_FORM;
    return {
      name: initial.name,
      scope: initial.scope,
      merchant_id: initial.merchant_id ?? '',
      group_id: initial.group_id ?? '',
      fee_type: initial.fee_type,
      percentage_rate: initial.percentage_rate != null ? String(initial.percentage_rate * 100) : '',
      flat_amount: initial.flat_amount != null ? String(initial.flat_amount) : '',
      min_fee: initial.min_fee != null ? String(initial.min_fee) : '',
      max_fee: initial.max_fee != null ? String(initial.max_fee) : '',
      is_active: initial.is_active,
      effective_from: initial.effective_from ? initial.effective_from.slice(0, 16) : '',
      effective_until: initial.effective_until ? initial.effective_until.slice(0, 16) : '',
    };
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      const payload: any = {
        name: form.name,
        scope: form.scope,
        fee_type: form.fee_type,
        is_active: form.is_active,
      };
      if (form.scope === 'merchant') payload.merchant_id = form.merchant_id;
      if (form.scope === 'group')    payload.group_id    = form.group_id;
      if (form.fee_type !== 'flat' && form.percentage_rate)
        payload.percentage_rate = parseFloat(form.percentage_rate) / 100;
      if (form.fee_type !== 'percentage' && form.flat_amount)
        payload.flat_amount = parseFloat(form.flat_amount);
      if (form.min_fee)       payload.min_fee        = parseFloat(form.min_fee);
      if (form.max_fee)       payload.max_fee        = parseFloat(form.max_fee);
      if (form.effective_from)  payload.effective_from  = new Date(form.effective_from).toISOString();
      if (form.effective_until) payload.effective_until = new Date(form.effective_until).toISOString();
      await onSave(payload);
    } catch (e: any) {
      setErr(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const showPercent = form.fee_type === 'percentage' || form.fee_type === 'mixed';
  const showFlat    = form.fee_type === 'flat'       || form.fee_type === 'mixed';

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <p className="text-[15px] font-black text-[#0F172A]">{initial ? 'Edit Fee Config' : 'New Fee Config'}</p>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Name</label>
            <input value={form.name} onChange={e => f('name', e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A]"
              placeholder="e.g. Enterprise Rate" />
          </div>

          {/* Scope — only editable on create */}
          {!initial && (
            <div>
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Scope</label>
              <div className="grid grid-cols-3 gap-2">
                {(['global', 'group', 'merchant'] as FeeScope[]).map(s => {
                  const Icon = SCOPE_ICONS[s];
                  return (
                    <button key={s}
                      onClick={() => f('scope', s)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[12px] font-semibold capitalize transition-colors ${form.scope === s ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#0F172A]'}`}
                    >
                      <Icon size={12} /> {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scope-specific ID pickers */}
          {form.scope === 'merchant' && !initial && (
            <div>
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Merchant</label>
              <select value={form.merchant_id} onChange={e => f('merchant_id', e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white">
                <option value="">— select merchant —</option>
                {merchants.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </div>
          )}
          {form.scope === 'group' && !initial && (
            <div>
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Group</label>
              <select value={form.group_id} onChange={e => f('group_id', e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white">
                <option value="">— select group —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}

          {/* Fee Type */}
          <div>
            <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Fee Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['percentage', 'flat', 'mixed'] as FeeType[]).map(t => (
                <button key={t}
                  onClick={() => f('fee_type', t)}
                  className={`py-2 rounded-lg border text-[12px] font-semibold capitalize transition-colors ${form.fee_type === t ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#0F172A]'}`}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Rate inputs */}
          <div className="grid grid-cols-2 gap-3">
            {showPercent && (
              <div>
                <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Rate (%)</label>
                <input type="number" step="0.0001" min="0" max="100" value={form.percentage_rate}
                  onChange={e => f('percentage_rate', e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A]"
                  placeholder="e.g. 2.5" />
              </div>
            )}
            {showFlat && (
              <div>
                <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Flat Amount (NGN)</label>
                <input type="number" step="0.01" min="0" value={form.flat_amount}
                  onChange={e => f('flat_amount', e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A]"
                  placeholder="e.g. 50" />
              </div>
            )}
          </div>

          {/* Floor / Cap */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Min Fee (NGN)</label>
              <input type="number" step="0.01" min="0" value={form.min_fee}
                onChange={e => f('min_fee', e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A]"
                placeholder="No minimum" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Max Fee (NGN)</label>
              <input type="number" step="0.01" min="0" value={form.max_fee}
                onChange={e => f('max_fee', e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A]"
                placeholder="No cap" />
            </div>
          </div>

          {/* Effective dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Effective From</label>
              <input type="datetime-local" value={form.effective_from}
                onChange={e => f('effective_from', e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Effective Until</label>
              <input type="datetime-local" value={form.effective_until}
                onChange={e => f('effective_until', e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A]" />
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className={`w-10 h-5 rounded-full transition-colors relative ${form.is_active ? 'bg-[#00d66f]' : 'bg-[#CBD5E1]'}`}
              onClick={() => f('is_active', !form.is_active)}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-[13px] font-semibold text-[#0F172A]">{form.is_active ? 'Active' : 'Inactive'}</span>
          </label>

          {err && <p className="text-[#E11D48] text-[12px] font-semibold">{err}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-end border-t border-[#F1F5F9] pt-4">
          <button onClick={onClose} className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-lg text-[13px] font-semibold hover:bg-[#F1F5F9]">Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving || !form.name}
            className="px-4 py-2 bg-[#0F172A] text-white rounded-lg text-[13px] font-bold disabled:opacity-50">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Config'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group Form Modal
// ---------------------------------------------------------------------------

function GroupModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: FeeGroup;
  onSave: (name: string, description: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    setSaving(true); setErr('');
    try { await onSave(name, desc); }
    catch (e: any) { setErr(e.message ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <p className="text-[15px] font-black text-[#0F172A]">{initial ? 'Edit Group' : 'New Fee Group'}</p>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Group Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A]"
              placeholder="e.g. Enterprise, SMB, High Volume" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] resize-none"
              placeholder="Optional notes about this group" />
          </div>
          {err && <p className="text-[#E11D48] text-[12px] font-semibold">{err}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-end border-t border-[#F1F5F9] pt-4">
          <button onClick={onClose} className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-lg text-[13px] font-semibold hover:bg-[#F1F5F9]">Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving || !name}
            className="px-4 py-2 bg-[#0F172A] text-white rounded-lg text-[13px] font-bold disabled:opacity-50">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assign merchant to group modal
// ---------------------------------------------------------------------------

function AssignGroupModal({
  merchantId,
  currentGroupId,
  groups,
  onSave,
  onClose,
}: {
  merchantId: string;
  currentGroupId: string | null;
  groups: FeeGroup[];
  onSave: (groupId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [groupId, setGroupId] = useState<string>(currentGroupId ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    setSaving(true); setErr('');
    try { await onSave(groupId || null); }
    catch (e: any) { setErr(e.message ?? 'Assignment failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <p className="text-[15px] font-black text-[#0F172A]">Assign Fee Group</p>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">
          <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Group</label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)}
            className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white">
            <option value="">No group (use global default)</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {err && <p className="text-[#E11D48] text-[12px] font-semibold mt-2">{err}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-end border-t border-[#F1F5F9] pt-4">
          <button onClick={onClose} className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-lg text-[13px] font-semibold hover:bg-[#F1F5F9]">Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving}
            className="px-4 py-2 bg-[#0F172A] text-white rounded-lg text-[13px] font-bold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------


export default function FeeConfigPage() {
  const [configs, setConfigs]   = useState<FeeConfig[]>([]);
  const [groups, setGroups]     = useState<FeeGroup[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading]   = useState(true);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig]     = useState<FeeConfig | undefined>();
  const [showGroupModal, setShowGroupModal]   = useState(false);
  const [editingGroup, setEditingGroup]       = useState<FeeGroup | undefined>();
  const [assignTarget, setAssignTarget]       = useState<Merchant | null>(null);

  const [scopeFilter, setScopeFilter] = useState<FeeScope | ''>('');
  const [showGroups, setShowGroups]   = useState(true);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = (msg: string, ok = true) => setToast({ msg, ok });

  const load = async () => {
    setLoading(true);
    try {
      const [cfgRes, grpRes, mRes] = await Promise.all([
        api.feeConfigs.list(),
        api.feeGroups.list(),
        api.merchants.list(),
      ]);
      setConfigs(cfgRes.data);
      setGroups(grpRes.data);
      setMerchants(mRes.data);
    } catch (e: any) {
      notify(e.message ?? 'Failed to load', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // ---- Config actions ----
  const handleSaveConfig = async (data: any) => {
    if (editingConfig) {
      await api.feeConfigs.update(editingConfig.id, data);
      notify('Fee config updated');
    } else {
      await api.feeConfigs.create(data);
      notify('Fee config created');
    }
    setShowConfigModal(false);
    setEditingConfig(undefined);
    await load();
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Delete this fee config?')) return;
    await api.feeConfigs.delete(id);
    notify('Deleted');
    await load();
  };

  // ---- Group actions ----
  const handleSaveGroup = async (name: string, description: string) => {
    if (editingGroup) {
      await api.feeGroups.update(editingGroup.id, { name, description });
      notify('Group updated');
    } else {
      await api.feeGroups.create({ name, description });
      notify('Group created');
    }
    setShowGroupModal(false);
    setEditingGroup(undefined);
    await load();
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Delete this group? Merchants in this group will revert to the global default.')) return;
    await api.feeGroups.delete(id);
    notify('Group deleted');
    await load();
  };

  // ---- Merchant group assignment ----
  const handleAssignGroup = async (groupId: string | null) => {
    if (!assignTarget) return;
    await api.feeConfigs.assignMerchantGroup(assignTarget.id, groupId);
    notify('Group assignment updated');
    setAssignTarget(null);
    await load();
  };

  const filteredConfigs = scopeFilter
    ? configs.filter(c => c.scope === scopeFilter)
    : configs;

  const groupConfigs    = filteredConfigs.filter(c => c.scope === 'group');
  const merchantConfigs = filteredConfigs.filter(c => c.scope === 'merchant');
  const allNonGlobal    = filteredConfigs.filter(c => c.scope !== 'global');

  const getGroupName = (id: string | null) => groups.find(g => g.id === id)?.name ?? '—';

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">Loading fee configuration…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDismiss={() => setToast(null)} />}

      {/* Modals */}
      {showConfigModal && (
        <ConfigModal
          initial={editingConfig}
          groups={groups}
          merchants={merchants}
          onSave={handleSaveConfig}
          onClose={() => { setShowConfigModal(false); setEditingConfig(undefined); }}
        />
      )}
      {showGroupModal && (
        <GroupModal
          initial={editingGroup}
          onSave={handleSaveGroup}
          onClose={() => { setShowGroupModal(false); setEditingGroup(undefined); }}
        />
      )}
      {assignTarget && (
        <AssignGroupModal
          merchantId={assignTarget.id}
          currentGroupId={assignTarget.fee_group_id ?? null}
          groups={groups}
          onSave={handleAssignGroup}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[22px] font-black text-[#0F172A] tracking-tight">Fee Configuration</p>
          <p className="text-[13px] text-[#64748B] mt-0.5">Manage platform fees — global defaults, group pricing, and merchant-specific overrides.</p>
        </div>
        <button
          onClick={() => { setEditingConfig(undefined); setShowConfigModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> New Config
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Configs',       value: configs.length },
          { label: 'Active Configs',      value: configs.filter(c => c.is_active).length },
          { label: 'Fee Groups',          value: groups.length },
          { label: 'Merchant Overrides',  value: configs.filter(c => c.scope === 'merchant').length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">{label}</p>
            <p className="text-[22px] font-black text-[#0F172A] mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Global default card */}
      <GlobalConfigCard
        configs={configs}
        onEdit={cfg => { setEditingConfig(cfg); setShowConfigModal(true); }}
      />

      {/* Fee calculator */}
      <FeeCalculator merchants={merchants} />

      {/* Groups section */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl mb-6 overflow-hidden">
        <div
          className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors"
          onClick={() => setShowGroups(v => !v)}
        >
          <div className="flex items-center gap-2">
            <Users size={15} color="#3B82F6" />
            <p className="text-[13px] font-bold text-[#0F172A]">Fee Groups</p>
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{groups.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); setEditingGroup(undefined); setShowGroupModal(true); }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg text-[11px] font-semibold text-[#0F172A] transition-colors"
            >
              <Plus size={11} /> New Group
            </button>
            {showGroups ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
          </div>
        </div>
        {showGroups && (
          <div className="border-t border-[#F1F5F9]">
            {groups.length === 0 ? (
              <p className="px-6 py-8 text-center text-[13px] text-[#94A3B8]">No groups yet. Create one to assign group-level pricing.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F8FAFC]">
                    {['Group Name', 'Description', 'Config', 'Members', ''].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => {
                    const cfg = configs.find(c => c.scope === 'group' && c.group_id === g.id && c.is_active);
                    const memberCount = merchants.filter(m => m.fee_group_id === g.id).length;
                    return (
                      <tr key={g.id} className="border-t border-[#F1F5F9] hover:bg-[#FAFAFA]">
                        <td className="px-6 py-3 font-semibold text-[#0F172A]">{g.name}</td>
                        <td className="px-6 py-3 text-[#64748B]">{g.description ?? '—'}</td>
                        <td className="px-6 py-3">{cfg ? <span className="font-semibold text-[#0F172A]">{fmtRate(cfg)}</span> : <span className="text-[#94A3B8]">No active config</span>}</td>
                        <td className="px-6 py-3 text-[#64748B]">{memberCount}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingGroup(g); setShowGroupModal(true); }}
                              className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#64748B] hover:text-[#0F172A] transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => void handleDeleteGroup(g.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-[#94A3B8] hover:text-[#E11D48] transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* All configs (non-global) */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-[#0F172A]">All Fee Rules</p>
            <span className="bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold px-2 py-0.5 rounded-full">{filteredConfigs.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <select value={scopeFilter} onChange={e => setScopeFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-[12px] text-[#0F172A] bg-white outline-none">
              <option value="">All scopes</option>
              <option value="global">Global</option>
              <option value="group">Group</option>
              <option value="merchant">Merchant</option>
            </select>
          </div>
        </div>
        {filteredConfigs.length === 0 ? (
          <p className="px-6 py-8 text-center text-[13px] text-[#94A3B8]">No configs match the filter.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC]">
                {['Name', 'Scope', 'Type', 'Rate', 'Floor / Cap', 'Window', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredConfigs.map(cfg => (
                <tr key={cfg.id} className="border-t border-[#F1F5F9] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3 font-semibold text-[#0F172A] max-w-[160px] truncate">{cfg.name}</td>
                  <td className="px-4 py-3">
                    <div>
                      <ScopeBadge scope={cfg.scope} />
                      {cfg.scope === 'group' && cfg.group_id && (
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">{getGroupName(cfg.group_id)}</p>
                      )}
                      {cfg.scope === 'merchant' && cfg.merchant_id && (
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">{merchants.find(m => m.id === cfg.merchant_id)?.display_name ?? cfg.merchant_id.slice(0, 8)}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-[#64748B]">{cfg.fee_type}</td>
                  <td className="px-4 py-3 font-semibold text-[#0F172A]">{fmtRate(cfg)}</td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {(cfg.min_fee != null || cfg.max_fee != null)
                      ? `${cfg.min_fee != null ? fmtNgn(cfg.min_fee) : '—'} / ${cfg.max_fee != null ? fmtNgn(cfg.max_fee) : '—'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#64748B] text-[11px]">
                    {cfg.effective_from || cfg.effective_until
                      ? `${cfg.effective_from ? new Date(cfg.effective_from).toLocaleDateString() : '∞'} → ${cfg.effective_until ? new Date(cfg.effective_until).toLocaleDateString() : '∞'}`
                      : 'Always'}
                  </td>
                  <td className="px-4 py-3"><ActiveBadge active={cfg.is_active} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingConfig(cfg); setShowConfigModal(true); }}
                        className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#64748B] hover:text-[#0F172A] transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => void handleDeleteConfig(cfg.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-[#94A3B8] hover:text-[#E11D48] transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Merchant group assignments */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden mt-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-2">
            <Building2 size={15} color="#0F172A" />
            <p className="text-[13px] font-bold text-[#0F172A]">Merchant Group Assignments</p>
          </div>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#F8FAFC]">
              {['Merchant', 'Current Group', 'Applied Rate', ''].map(h => (
                <th key={h} className="text-left px-6 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {merchants.map(m => {
              const groupName = m.fee_group_id ? getGroupName(m.fee_group_id) : null;
              const groupCfg  = m.fee_group_id ? configs.find(c => c.scope === 'group' && c.group_id === m.fee_group_id && c.is_active) : null;
              const merchantCfg = configs.find(c => c.scope === 'merchant' && c.merchant_id === m.id && c.is_active);
              const appliedCfg  = merchantCfg ?? groupCfg ?? configs.find(c => c.scope === 'global' && c.is_active);
              return (
                <tr key={m.id} className="border-t border-[#F1F5F9] hover:bg-[#FAFAFA]">
                  <td className="px-6 py-3 font-semibold text-[#0F172A]">{m.display_name}</td>
                  <td className="px-6 py-3">
                    {groupName
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[11px] font-bold"><Users size={10} />{groupName}</span>
                      : <span className="text-[#94A3B8] text-[12px]">No group</span>}
                  </td>
                  <td className="px-6 py-3">
                    {appliedCfg ? (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#0F172A]">{fmtRate(appliedCfg)}</span>
                        <ScopeBadge scope={appliedCfg.scope} />
                      </div>
                    ) : <span className="text-[#94A3B8]">—</span>}
                  </td>
                  <td className="px-6 py-3">
                    <button onClick={() => setAssignTarget(m)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] rounded-lg text-[11px] font-semibold transition-colors">
                      <Users size={11} /> Assign Group
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
