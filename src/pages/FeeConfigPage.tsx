import { useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, X, Calculator, Globe, Users, Building2,
  Info, ArrowRight, ChevronDown, ChevronUp, Check,
} from 'lucide-react';
import { api } from '../lib/api';
import type { FeeConfig, FeeGroup, FeeScope, FeeType, FeeCalculationResult, Merchant } from '../lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtRate(cfg: FeeConfig): string {
  const parts: string[] = [];
  if ((cfg.fee_type === 'percentage' || cfg.fee_type === 'mixed') && cfg.percentage_rate != null)
    parts.push(`${(cfg.percentage_rate * 100).toFixed(4)}%`);
  if ((cfg.fee_type === 'flat' || cfg.fee_type === 'mixed') && cfg.flat_amount != null)
    parts.push(`₦${cfg.flat_amount.toLocaleString()}`);
  return parts.join(' + ') || '—';
}

function fmtNgn(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const SCOPE_ICONS: Record<FeeScope, React.ElementType> = {
  global: Globe, group: Users, merchant: Building2,
};

function ScopeBadge({ scope, label }: { scope: FeeScope; label?: string }) {
  const cfg = {
    global:   { cls: 'bg-slate-100 text-slate-500',    Icon: Globe     },
    group:    { cls: 'bg-blue-100 text-blue-700',       Icon: Users     },
    merchant: { cls: 'bg-emerald-100 text-emerald-700', Icon: Building2 },
  }[scope];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${cfg.cls}`}>
      <cfg.Icon size={10} />
      {label ?? scope}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function Toast({ msg, ok, onDismiss }: { msg: string; ok: boolean; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-[13px] font-semibold text-white ${ok ? 'bg-[#16A34A]' : 'bg-[#E11D48]'}`}>
      {msg}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">{children}</p>;
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white ${props.className ?? ''}`}
    />
  );
}

// Card with consistent header pattern
function SectionCard({
  title, subtitle, count, countColor = 'slate', action, children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  count?: number;
  countColor?: 'slate' | 'blue' | 'emerald';
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const countCls = {
    slate:   'bg-[#F1F5F9] text-[#64748B]',
    blue:    'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  }[countColor];
  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-[#0F172A]">{title}</p>
            {count !== undefined && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${countCls}`}>{count}</span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-[#94A3B8] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resolution info bar (compact)
// ---------------------------------------------------------------------------

function ResolutionBar() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-[#F8FAFC] border border-[#E8ECF0] rounded-xl mb-5 flex-wrap">
      <Info size={13} className="text-[#94A3B8] shrink-0" />
      <span className="text-[12px] text-[#64748B]">Fee resolution priority:</span>
      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
        <Building2 size={11} /> Merchant Override
      </span>
      <ArrowRight size={12} className="text-[#CBD5E1]" />
      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
        <Users size={11} /> Group Rule
      </span>
      <ArrowRight size={12} className="text-[#CBD5E1]" />
      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-0.5 rounded-full">
        <Globe size={11} /> Global Default
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Global Default Hero
// ---------------------------------------------------------------------------

function GlobalHero({
  configs, onSave, onOpenModal,
}: {
  configs: FeeConfig[];
  onSave: (id: string, data: any) => Promise<void>;
  onOpenModal: (cfg: FeeConfig) => void;
}) {
  const global = configs.find(c => c.scope === 'global' && c.is_active);
  const [editing, setEditing] = useState(false);
  const [rate, setRate]       = useState('');
  const [riskRate, setRiskRate] = useState('');
  const [minFee, setMinFee]   = useState('');
  const [maxFee, setMaxFee]   = useState('');
  const [saving, setSaving]   = useState(false);

  const startEdit = () => {
    if (!global) return;
    setRate(global.percentage_rate != null ? String(global.percentage_rate * 100) : '');
    setRiskRate(global.risk_premium_rate != null ? String(global.risk_premium_rate * 100) : '');
    setMinFee(global.min_fee != null ? String(global.min_fee) : '');
    setMaxFee(global.max_fee != null ? String(global.max_fee) : '');
    setEditing(true);
  };

  const save = async () => {
    if (!global) return;
    setSaving(true);
    try {
      const payload: any = {};
      if (rate)     payload.percentage_rate   = parseFloat(rate) / 100;
      if (riskRate) payload.risk_premium_rate = parseFloat(riskRate) / 100;
      if (minFee)   payload.min_fee = parseFloat(minFee);
      if (maxFee)   payload.max_fee = parseFloat(maxFee);
      await onSave(global.id, payload);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!global) return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-5">
      <p className="text-[13px] text-amber-700 font-semibold">No active global default found. System fallback: 1.5% base + 3.5% risk premium.</p>
    </div>
  );

  return (
    <div className="bg-[#0F172A] rounded-2xl mb-5 text-white overflow-hidden">
      <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Globe size={12} className="text-violet-300" />
          </div>
          <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Global Default Rate</p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white/40 hover:text-white/70 transition-colors">
                Cancel
              </button>
              <button onClick={() => void save()} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00d66f] text-[#0F172A] rounded-lg text-[12px] font-bold disabled:opacity-50">
                <Check size={12} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-[12px] font-semibold transition-colors">
                <Pencil size={12} /> Quick Edit
              </button>
              <button onClick={() => onOpenModal(global)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-[12px] font-semibold transition-colors">
                Full Edit
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-6 py-5">
        {editing ? (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Base Rate (%)', value: rate, onChange: setRate, placeholder: '1.5' },
              { label: 'Risk Premium (%)', value: riskRate, onChange: setRiskRate, placeholder: '3.5' },
              { label: 'Min Fee (₦)', value: minFee, onChange: setMinFee, placeholder: 'None' },
              { label: 'Max Fee (₦)', value: maxFee, onChange: setMaxFee, placeholder: 'None' },
            ].map(({ label, value, onChange, placeholder }) => (
              <div key={label}>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">{label}</p>
                <input value={value} onChange={e => onChange(e.target.value)} type="number" step="0.0001"
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-[15px] font-bold text-white outline-none focus:border-white/40 placeholder:text-white/20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-3">
                <p className="text-[42px] font-black tracking-tight leading-none">{fmtRate(global)}</p>
                {global.risk_premium_rate != null && global.risk_premium_rate > 0 && (
                  <span className="text-[11px] font-bold text-amber-400/80 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full pb-1">
                    +{(global.risk_premium_rate * 100).toFixed(2)}% risk
                  </span>
                )}
              </div>
              <p className="text-[13px] text-white/40 mt-1.5">{global.name}</p>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Surge-backed total</p>
                <p className="text-[15px] font-bold text-amber-300 mt-1">
                  {global.percentage_rate != null && global.risk_premium_rate != null
                    ? `${((global.percentage_rate + global.risk_premium_rate) * 100).toFixed(2)}%`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Tx fee paid by</p>
                <p className="text-[15px] font-bold text-white capitalize mt-1">{global.transaction_fee_bearer}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Risk fee paid by</p>
                <p className="text-[15px] font-bold text-white capitalize mt-1">{global.risk_fee_bearer}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Floor / Cap</p>
                <p className="text-[15px] font-bold text-white mt-1">
                  {global.min_fee != null ? fmtNgn(global.min_fee) : '—'} / {global.max_fee != null ? fmtNgn(global.max_fee) : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Config Form Modal
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  name: '', scope: 'global' as FeeScope, merchant_id: '', group_id: '',
  fee_type: 'percentage' as FeeType, percentage_rate: '', flat_amount: '',
  min_fee: '', max_fee: '',
  risk_premium_rate: '3.5',
  transaction_fee_bearer: 'customer' as 'merchant' | 'customer',
  risk_fee_bearer: 'merchant' as 'merchant' | 'customer',
  is_active: true, effective_from: '', effective_until: '',
};

function ConfigModal({ initial, groups, merchants, onSave, onClose }: {
  initial?: FeeConfig; groups: FeeGroup[]; merchants: Merchant[];
  onSave: (data: any) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState(() => !initial ? EMPTY_FORM : ({
    name: initial.name, scope: initial.scope,
    merchant_id: initial.merchant_id ?? '', group_id: initial.group_id ?? '',
    fee_type: initial.fee_type,
    percentage_rate: initial.percentage_rate != null ? String(initial.percentage_rate * 100) : '',
    flat_amount: initial.flat_amount != null ? String(initial.flat_amount) : '',
    min_fee: initial.min_fee != null ? String(initial.min_fee) : '',
    max_fee: initial.max_fee != null ? String(initial.max_fee) : '',
    risk_premium_rate: initial.risk_premium_rate != null ? String(initial.risk_premium_rate * 100) : '3.5',
    transaction_fee_bearer: (initial.transaction_fee_bearer ?? 'customer') as 'merchant' | 'customer',
    risk_fee_bearer: (initial.risk_fee_bearer ?? 'merchant') as 'merchant' | 'customer',
    is_active: initial.is_active,
    effective_from: initial.effective_from ? initial.effective_from.slice(0, 16) : '',
    effective_until: initial.effective_until ? initial.effective_until.slice(0, 16) : '',
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      const p: any = { name: form.name, scope: form.scope, fee_type: form.fee_type, is_active: form.is_active };
      if (form.scope === 'merchant') p.merchant_id = form.merchant_id;
      if (form.scope === 'group')    p.group_id    = form.group_id;
      if (form.fee_type !== 'flat' && form.percentage_rate)
        p.percentage_rate = parseFloat(form.percentage_rate) / 100;
      if (form.fee_type !== 'percentage' && form.flat_amount)
        p.flat_amount = parseFloat(form.flat_amount);
      if (form.min_fee)           p.min_fee            = parseFloat(form.min_fee);
      if (form.max_fee)           p.max_fee            = parseFloat(form.max_fee);
      if (form.risk_premium_rate) p.risk_premium_rate  = parseFloat(form.risk_premium_rate) / 100;
      p.transaction_fee_bearer = form.transaction_fee_bearer;
      p.risk_fee_bearer        = form.risk_fee_bearer;
      if (form.effective_from)  p.effective_from  = new Date(form.effective_from).toISOString();
      if (form.effective_until) p.effective_until = new Date(form.effective_until).toISOString();
      await onSave(p);
    } catch (e: any) { setErr(e.message ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const showPct  = form.fee_type === 'percentage' || form.fee_type === 'mixed';
  const showFlat = form.fee_type === 'flat'       || form.fee_type === 'mixed';

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <p className="text-[15px] font-black text-[#0F172A]">{initial ? 'Edit Fee Config' : 'New Fee Config'}</p>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div><Label>Name</Label>
            <FieldInput value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Enterprise Rate" />
          </div>
          {!initial && (
            <div>
              <Label>Scope</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['global', 'group', 'merchant'] as FeeScope[]).map(s => {
                  const Icon = SCOPE_ICONS[s];
                  return (
                    <button key={s} onClick={() => f('scope', s)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[12px] font-semibold capitalize transition-colors ${form.scope === s ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#0F172A]'}`}>
                      <Icon size={12} /> {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {form.scope === 'merchant' && !initial && (
            <div><Label>Merchant</Label>
              <select value={form.merchant_id} onChange={e => f('merchant_id', e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white">
                <option value="">— select merchant —</option>
                {merchants.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </div>
          )}
          {form.scope === 'group' && !initial && (
            <div><Label>Group</Label>
              <select value={form.group_id} onChange={e => f('group_id', e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white">
                <option value="">— select group —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label>Fee Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['percentage', 'flat', 'mixed'] as FeeType[]).map(t => (
                <button key={t} onClick={() => f('fee_type', t)}
                  className={`py-2 rounded-lg border text-[12px] font-semibold capitalize transition-colors ${form.fee_type === t ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#0F172A]'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {showPct && <div><Label>Rate (%)</Label>
              <FieldInput type="number" step="0.0001" min="0" max="100" value={form.percentage_rate}
                onChange={e => f('percentage_rate', e.target.value)} placeholder="e.g. 2.5" />
            </div>}
            {showFlat && <div><Label>Flat Amount (₦)</Label>
              <FieldInput type="number" step="0.01" min="0" value={form.flat_amount}
                onChange={e => f('flat_amount', e.target.value)} placeholder="e.g. 50" />
            </div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Min Fee (₦)</Label>
              <FieldInput type="number" step="0.01" min="0" value={form.min_fee}
                onChange={e => f('min_fee', e.target.value)} placeholder="No minimum" />
            </div>
            <div><Label>Max Fee (₦)</Label>
              <FieldInput type="number" step="0.01" min="0" value={form.max_fee}
                onChange={e => f('max_fee', e.target.value)} placeholder="No cap" />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-3">
            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">Risk Premium — Surge-backed transactions</p>
            <div>
              <Label>Risk Premium Rate (%)</Label>
              <FieldInput type="number" step="0.0001" min="0" max="100" value={form.risk_premium_rate}
                onChange={e => f('risk_premium_rate', e.target.value)} placeholder="e.g. 3.5" />
              <p className="text-[11px] text-amber-600 mt-1">Only charged when Surge bears transaction risk.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Transaction fee paid by</Label>
                <select value={form.transaction_fee_bearer} onChange={e => f('transaction_fee_bearer', e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white">
                  <option value="customer">Customer (default)</option>
                  <option value="merchant">Merchant</option>
                </select>
              </div>
              <div>
                <Label>Risk premium paid by</Label>
                <select value={form.risk_fee_bearer} onChange={e => f('risk_fee_bearer', e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white">
                  <option value="merchant">Merchant (default)</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Effective From</Label>
              <FieldInput type="datetime-local" value={form.effective_from}
                onChange={e => f('effective_from', e.target.value)} />
            </div>
            <div><Label>Effective Until</Label>
              <FieldInput type="datetime-local" value={form.effective_until}
                onChange={e => f('effective_until', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className={`w-10 h-5 rounded-full relative transition-colors ${form.is_active ? 'bg-[#00d66f]' : 'bg-[#CBD5E1]'}`}
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
// Group Modal
// ---------------------------------------------------------------------------

function GroupModal({ initial, onSave, onClose }: {
  initial?: FeeGroup; onSave: (name: string, desc: string) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <p className="text-[15px] font-black text-[#0F172A]">{initial ? 'Edit Group' : 'New Fee Group'}</p>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div><Label>Group Name</Label>
            <FieldInput value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Enterprise, SMB, High Volume" />
          </div>
          <div><Label>Description</Label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] resize-none"
              placeholder="Optional notes about this group" />
          </div>
          {err && <p className="text-[#E11D48] text-[12px] font-semibold">{err}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-end border-t border-[#F1F5F9] pt-4">
          <button onClick={onClose} className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-lg text-[13px] font-semibold hover:bg-[#F1F5F9]">Cancel</button>
          <button disabled={saving || !name} onClick={async () => {
            setSaving(true); setErr('');
            try { await onSave(name, desc); }
            catch (e: any) { setErr(e.message ?? 'Save failed'); }
            finally { setSaving(false); }
          }} className="px-4 py-2 bg-[#0F172A] text-white rounded-lg text-[13px] font-bold disabled:opacity-50">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assign Group Modal
// ---------------------------------------------------------------------------

function AssignGroupModal({ merchantId, currentGroupId, groups, onSave, onClose }: {
  merchantId: string; currentGroupId: string | null; groups: FeeGroup[];
  onSave: (groupId: string | null) => Promise<void>; onClose: () => void;
}) {
  const [groupId, setGroupId] = useState<string>(currentGroupId ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <p className="text-[15px] font-black text-[#0F172A]">Assign Fee Group</p>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">
          <Label>Group</Label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)}
            className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white">
            <option value="">No group (use global default)</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {err && <p className="text-[#E11D48] text-[12px] font-semibold mt-2">{err}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-end border-t border-[#F1F5F9] pt-4">
          <button onClick={onClose} className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-lg text-[13px] font-semibold hover:bg-[#F1F5F9]">Cancel</button>
          <button disabled={saving} onClick={async () => {
            setSaving(true); setErr('');
            try { await onSave(groupId || null); }
            catch (e: any) { setErr(e.message ?? 'Failed'); }
            finally { setSaving(false); }
          }} className="px-4 py-2 bg-[#0F172A] text-white rounded-lg text-[13px] font-bold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Rules
// ---------------------------------------------------------------------------

function RulesTab({
  configs, groups, merchants,
  onEditConfig, onDeleteConfig, onOpenModal,
  onSaveGlobal,
}: {
  configs: FeeConfig[]; groups: FeeGroup[]; merchants: Merchant[];
  onEditConfig: (cfg: FeeConfig) => void;
  onDeleteConfig: (id: string) => void;
  onOpenModal: () => void;
  onSaveGlobal: (id: string, data: any) => Promise<void>;
}) {
  const getGroupName = (id: string | null) => groups.find(g => g.id === id)?.name ?? '—';

  const resolveFor = (m: Merchant) => {
    const override = configs.find(c => c.scope === 'merchant' && c.merchant_id === m.id && c.is_active);
    if (override) return { cfg: override, via: 'override' as const };
    const grpCfg = m.fee_group_id
      ? configs.find(c => c.scope === 'group' && c.group_id === m.fee_group_id && c.is_active)
      : null;
    if (grpCfg) return { cfg: grpCfg, via: 'group' as const };
    const global = configs.find(c => c.scope === 'global' && c.is_active);
    if (global) return { cfg: global, via: 'global' as const };
    return null;
  };

  const groupConfigs    = configs.filter(c => c.scope === 'group');
  const merchantConfigs = configs.filter(c => c.scope === 'merchant');

  return (
    <div className="flex flex-col gap-5">
      <ResolutionBar />
      <GlobalHero configs={configs} onSave={onSaveGlobal} onOpenModal={onEditConfig} />

      {/* Group Rules */}
      <SectionCard
        title={<span className="flex items-center gap-1.5"><Users size={13} className="text-blue-600" />Group Rules</span>}
        subtitle="A shared rate applied to all merchants within a named group."
        count={groupConfigs.length}
        countColor="blue"
        action={
          <button onClick={onOpenModal}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] text-[#0F172A] rounded-lg text-[12px] font-semibold hover:bg-[#F8FAFC] transition-colors">
            <Plus size={12} /> Add Group Rule
          </button>
        }
      >
        {groupConfigs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <Users size={16} className="text-blue-400" />
            </div>
            <p className="text-[13px] font-semibold text-[#64748B]">No group rules yet</p>
            <p className="text-[12px] text-[#94A3B8] mt-1">Create a group rule to apply a shared rate to multiple merchants at once.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {groupConfigs.map(cfg => (
              <div key={cfg.id} className="flex items-center justify-between px-5 py-4 hover:bg-[#F8FAFC] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <Users size={13} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-[#0F172A]">{cfg.name}</p>
                      <ActiveBadge active={cfg.is_active} />
                    </div>
                    <p className="text-[12px] text-[#94A3B8] mt-0.5">
                      {cfg.group_id ? getGroupName(cfg.group_id) : '—'}
                      {' · '}
                      {merchants.filter(m => m.fee_group_id === cfg.group_id).length} members
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[18px] font-black text-[#0F172A]">{fmtRate(cfg)}</p>
                    {(cfg.min_fee != null || cfg.max_fee != null) && (
                      <p className="text-[11px] text-[#94A3B8]">
                        {[cfg.min_fee != null && `floor ${fmtNgn(cfg.min_fee)}`, cfg.max_fee != null && `cap ${fmtNgn(cfg.max_fee)}`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEditConfig(cfg)} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#94A3B8] hover:text-[#0F172A] transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => onDeleteConfig(cfg.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-[#94A3B8] hover:text-[#E11D48] transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Merchant Overrides */}
      <SectionCard
        title={<span className="flex items-center gap-1.5"><Building2 size={13} className="text-emerald-600" />Merchant Overrides</span>}
        subtitle="Bespoke rates set for a specific merchant — always take precedence over group and global rules."
        count={merchantConfigs.length}
        countColor="emerald"
        action={
          <button onClick={onOpenModal}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] text-[#0F172A] rounded-lg text-[12px] font-semibold hover:bg-[#F8FAFC] transition-colors">
            <Plus size={12} /> Add Override
          </button>
        }
      >
        {merchantConfigs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Building2 size={16} className="text-emerald-400" />
            </div>
            <p className="text-[13px] font-semibold text-[#64748B]">No merchant overrides yet</p>
            <p className="text-[12px] text-[#94A3B8] mt-1">Add a merchant-specific rate for bespoke pricing arrangements.</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC]">
                {['Merchant', 'Config Name', 'Rate', 'Floor / Cap', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest border-b border-[#F1F5F9]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {merchantConfigs.map(cfg => {
                const merchant = merchants.find(m => m.id === cfg.merchant_id);
                return (
                  <tr key={cfg.id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-[#0F172A]">{merchant?.display_name ?? cfg.merchant_id?.slice(0, 8) ?? '—'}</td>
                    <td className="px-5 py-3.5 text-[#64748B]">{cfg.name}</td>
                    <td className="px-5 py-3.5 font-bold text-[#0F172A]">{fmtRate(cfg)}</td>
                    <td className="px-5 py-3.5 text-[#64748B]">
                      {(cfg.min_fee != null || cfg.max_fee != null)
                        ? `${cfg.min_fee != null ? fmtNgn(cfg.min_fee) : '—'} / ${cfg.max_fee != null ? fmtNgn(cfg.max_fee) : '—'}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5"><ActiveBadge active={cfg.is_active} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => onEditConfig(cfg)} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#94A3B8] hover:text-[#0F172A] transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => onDeleteConfig(cfg.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-[#94A3B8] hover:text-[#E11D48] transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Effective Rate per Merchant */}
      <SectionCard
        title="Effective Rate per Merchant"
        subtitle="The rate each merchant actually pays, resolved through the priority chain."
      >
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#F8FAFC]">
              {['Merchant', 'Effective Rate', 'Resolved via', 'Group'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest border-b border-[#F1F5F9]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {merchants.map(m => {
              const res = resolveFor(m);
              return (
                <tr key={m.id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-[#0F172A]">{m.display_name}</td>
                  <td className="px-5 py-3.5 font-bold text-[#0F172A]">{res ? fmtRate(res.cfg) : '—'}</td>
                  <td className="px-5 py-3.5">
                    {res
                      ? <ScopeBadge scope={res.cfg.scope} label={res.via === 'override' ? 'Override' : res.via === 'group' ? 'Group' : 'Global'} />
                      : <span className="text-[#94A3B8]">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {m.fee_group_id
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[11px] font-bold"><Users size={10} />{getGroupName(m.fee_group_id)}</span>
                      : <span className="text-[#94A3B8]">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Groups
// ---------------------------------------------------------------------------

function GroupsTab({
  groups, configs, merchants,
  onEditGroup, onDeleteGroup, onCreateGroup, onAssignMerchant,
}: {
  groups: FeeGroup[]; configs: FeeConfig[]; merchants: Merchant[];
  onEditGroup: (g: FeeGroup) => void; onDeleteGroup: (id: string) => void;
  onCreateGroup: () => void;
  onAssignMerchant: (m: Merchant) => void;
}) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const getGroupCfg = (groupId: string) =>
    configs.find(c => c.scope === 'group' && c.group_id === groupId && c.is_active);

  const unassigned = merchants.filter(m => !m.fee_group_id);

  return (
    <div className="flex flex-col gap-5">
      {groups.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E8ECF0] rounded-2xl px-6 py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Users size={22} className="text-blue-400" />
          </div>
          <p className="text-[14px] font-bold text-[#0F172A]">No groups yet</p>
          <p className="text-[13px] text-[#94A3B8] mt-1 mb-5">Create your first group to start applying shared pricing rules.</p>
          <button onClick={onCreateGroup}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold">
            <Plus size={14} /> Create a Group
          </button>
        </div>
      ) : (
        groups.map(g => {
          const cfg     = getGroupCfg(g.id);
          const members = merchants.filter(m => m.fee_group_id === g.id);
          const open    = openGroupId === g.id;
          return (
            <div key={g.id} className="bg-white border border-[#E8ECF0] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <Users size={15} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold text-[#0F172A]">{g.name}</p>
                      {cfg && <ActiveBadge active={cfg.is_active} />}
                    </div>
                    <p className="text-[12px] text-[#94A3B8] mt-0.5">
                      {g.description || 'No description'} · {members.length} {members.length === 1 ? 'merchant' : 'merchants'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-[20px] font-black text-[#0F172A]">
                      {cfg ? fmtRate(cfg) : <span className="text-[#CBD5E1] text-[14px] font-semibold">No rate set</span>}
                    </p>
                    {cfg && (cfg.min_fee != null || cfg.max_fee != null) && (
                      <p className="text-[11px] text-[#94A3B8]">
                        {[cfg.min_fee != null && `floor ${fmtNgn(cfg.min_fee)}`, cfg.max_fee != null && `cap ${fmtNgn(cfg.max_fee)}`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEditGroup(g)} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#94A3B8] hover:text-[#0F172A] transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => onDeleteGroup(g.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-[#94A3B8] hover:text-[#E11D48] transition-colors"><Trash2 size={13} /></button>
                    <button onClick={() => setOpenGroupId(open ? null : g.id)}
                      className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#94A3B8] hover:text-[#0F172A] transition-colors ml-0.5">
                      {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {open && (
                <div className="border-t border-[#F1F5F9]">
                  {members.length === 0 ? (
                    <p className="px-5 py-5 text-[13px] text-[#94A3B8] text-center">
                      No merchants in this group yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#F1F5F9]">
                      {members.map(m => (
                        <div key={m.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#F8FAFC]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                              <Building2 size={13} className="text-[#64748B]" />
                            </div>
                            <span className="text-[13px] font-semibold text-[#0F172A]">{m.display_name}</span>
                          </div>
                          <button onClick={() => onAssignMerchant(m)}
                            className="text-[12px] font-semibold text-[#94A3B8] hover:text-[#E11D48] transition-colors">
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {unassigned.length > 0 && (
        <SectionCard
          title="Unassigned Merchants"
          subtitle="These merchants have no group assignment and fall back to the global default rate."
          count={unassigned.length}
        >
          <div className="divide-y divide-[#F1F5F9]">
            {unassigned.map(m => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#F8FAFC] transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                    <Building2 size={13} className="text-[#64748B]" />
                  </div>
                  <span className="text-[13px] font-semibold text-[#0F172A]">{m.display_name}</span>
                </div>
                <button onClick={() => onAssignMerchant(m)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] rounded-lg text-[11px] font-semibold transition-colors">
                  <Users size={11} /> Assign to Group
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Preview  (two-column layout at full width)
// ---------------------------------------------------------------------------

function PreviewTab({ configs, merchants }: { configs: FeeConfig[]; merchants: Merchant[] }) {
  const [amount, setAmount]         = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [riskBearer, setRiskBearer] = useState<'merchant_backed' | 'surge_backed'>('merchant_backed');
  const [result, setResult]         = useState<FeeCalculationResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const run = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.feeConfigs.preview(num, merchantId || undefined, 'NGN', riskBearer);
      setResult(res.data);
    } catch (e: any) { setError(e.message ?? 'Preview failed'); }
    finally { setLoading(false); }
  };

  const selectedMerchant = merchants.find(m => m.id === merchantId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Left: inputs */}
      <div className="bg-white border border-[#E8ECF0] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-2 mb-0.5">
            <Calculator size={14} className="text-[#64748B]" />
            <p className="text-[13px] font-bold text-[#0F172A]">Fee Calculator</p>
          </div>
          <p className="text-[11px] text-[#94A3B8]">Enter an amount and optionally pick a merchant to see exactly how the fee resolves.</p>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          <div>
            <Label>Transaction Amount (NGN)</Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#94A3B8]">₦</span>
              <input
                type="number" placeholder="0.00" value={amount}
                onChange={e => { setAmount(e.target.value); setResult(null); }}
                className="w-full pl-8 pr-4 py-3 border border-[#E2E8F0] rounded-xl text-[18px] font-bold text-[#0F172A] outline-none focus:border-[#0F172A]"
              />
            </div>
          </div>

          <div>
            <Label>Merchant <span className="normal-case font-normal text-[#94A3B8]">(optional)</span></Label>
            <select value={merchantId} onChange={e => { setMerchantId(e.target.value); setResult(null); }}
              className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white">
              <option value="">Global default</option>
              {merchants.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </div>

          <div>
            <Label>Risk Model</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'merchant_backed', label: 'Merchant-backed', sub: '1.5% base only' },
                { value: 'surge_backed',    label: 'Surge-backed',    sub: '1.5% + 3.5% risk premium' },
              ] as const).map(opt => (
                <button key={opt.value} onClick={() => { setRiskBearer(opt.value); setResult(null); }}
                  className={`flex flex-col items-start px-4 py-3 rounded-xl border text-left transition-colors ${riskBearer === opt.value ? 'bg-[#0F172A] border-[#0F172A] text-white' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#0F172A]'}`}>
                  <span className="text-[13px] font-bold">{opt.label}</span>
                  <span className={`text-[11px] mt-0.5 ${riskBearer === opt.value ? 'text-white/50' : 'text-[#94A3B8]'}`}>{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => void run()} disabled={loading || !amount}
            className="w-full py-3 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold disabled:opacity-40 transition-opacity">
            {loading ? 'Calculating…' : 'Calculate Fee'}
          </button>
          {error && <p className="text-[#E11D48] text-[12px] font-semibold">{error}</p>}
        </div>
      </div>

      {/* Right: result */}
      <div>
        {!result ? (
          <div className="bg-white border border-dashed border-[#E8ECF0] rounded-2xl px-6 py-16 text-center">
            <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
              <Calculator size={18} className="text-[#CBD5E1]" />
            </div>
            <p className="text-[13px] font-semibold text-[#64748B]">Results will appear here</p>
            <p className="text-[12px] text-[#94A3B8] mt-1">Enter an amount and click Calculate.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E8ECF0] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2 flex-wrap">
                <Info size={13} className="text-[#64748B] shrink-0" />
                <p className="text-[12px] text-[#64748B]">
                  Resolved via <span className="font-bold text-[#0F172A]">{result.config_name}</span>
                </p>
                <ScopeBadge scope={result.resolved_scope} />
                {selectedMerchant && (
                  <span className="text-[12px] text-[#94A3B8]">for {selectedMerchant.display_name}</span>
                )}
                <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${result.risk_bearer === 'surge_backed' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  {result.risk_bearer === 'surge_backed' ? 'Surge-backed' : 'Merchant-backed'}
                </span>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F8FAFC] rounded-xl p-4">
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Gross Amount</p>
                  <p className="text-[22px] font-black text-[#0F172A] mt-1">{fmtNgn(result.gross_amount)}</p>
                </div>
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Total Fee</p>
                  <p className="text-[22px] font-black text-violet-700 mt-1">{fmtNgn(result.fee_amount)}</p>
                </div>
                <div className="bg-[#F8FAFC] rounded-xl p-4">
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">
                    Tx Fee <span className="normal-case font-normal">({result.transaction_fee_bearer} pays)</span>
                  </p>
                  <p className="text-[22px] font-black text-[#0F172A] mt-1">{fmtNgn(result.transaction_fee)}</p>
                </div>
                {result.risk_fee > 0 ? (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                      Risk Premium <span className="normal-case font-normal">({result.risk_fee_bearer} pays)</span>
                    </p>
                    <p className="text-[22px] font-black text-amber-700 mt-1">{fmtNgn(result.risk_fee)}</p>
                  </div>
                ) : (
                  <div className="bg-[#F8FAFC] rounded-xl p-4">
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Risk Premium</p>
                    <p className="text-[22px] font-black text-[#CBD5E1] mt-1">₦0.00</p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">Merchant-backed</p>
                  </div>
                )}
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Merchant Payable</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <p className="text-[26px] font-black text-emerald-700">{fmtNgn(result.merchant_payable)}</p>
                  <p className="text-[13px] font-semibold text-emerald-500">{result.effective_rate_pct.toFixed(4)}% effective rate</p>
                </div>
              </div>

              <div>
                <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(result.effective_rate_pct * 10, 100)}%`,
                      background: result.risk_bearer === 'surge_backed'
                        ? 'linear-gradient(90deg, #8B5CF6 0%, #F59E0B 100%)'
                        : '#8B5CF6',
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-[10px] text-[#94A3B8]">0%</p>
                  <p className="text-[10px] text-[#94A3B8]">10%</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type PageTab = 'rules' | 'groups' | 'preview';

export default function FeeConfigPage() {
  const [configs, setConfigs]     = useState<FeeConfig[]>([]);
  const [groups, setGroups]       = useState<FeeGroup[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<PageTab>('rules');

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig]     = useState<FeeConfig | undefined>();
  const [showGroupModal, setShowGroupModal]   = useState(false);
  const [editingGroup, setEditingGroup]       = useState<FeeGroup | undefined>();
  const [assignTarget, setAssignTarget]       = useState<Merchant | null>(null);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const notify = (msg: string, ok = true) => setToast({ msg, ok });

  const load = async () => {
    setLoading(true);
    try {
      const [cfgRes, grpRes, mRes] = await Promise.all([
        api.feeConfigs.list(), api.feeGroups.list(), api.merchants.list(),
      ]);
      setConfigs(cfgRes.data);
      setGroups(grpRes.data);
      setMerchants(mRes.data);
    } catch (e: any) { notify(e.message ?? 'Failed to load', false); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const handleSaveConfig = async (data: any) => {
    if (editingConfig) { await api.feeConfigs.update(editingConfig.id, data); notify('Fee config updated'); }
    else               { await api.feeConfigs.create(data);                   notify('Fee config created'); }
    setShowConfigModal(false); setEditingConfig(undefined);
    await load();
  };

  const handleSaveGlobal = async (id: string, data: any) => {
    await api.feeConfigs.update(id, data);
    notify('Global rate updated');
    await load();
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Delete this fee config?')) return;
    await api.feeConfigs.delete(id);
    notify('Config deleted');
    await load();
  };

  const handleSaveGroup = async (name: string, description: string) => {
    if (editingGroup) { await api.feeGroups.update(editingGroup.id, { name, description }); notify('Group updated'); }
    else              { await api.feeGroups.create({ name, description });                    notify('Group created'); }
    setShowGroupModal(false); setEditingGroup(undefined);
    await load();
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Delete this group? Merchants in this group will revert to the global default.')) return;
    await api.feeGroups.delete(id);
    notify('Group deleted');
    await load();
  };

  const handleAssignGroup = async (groupId: string | null) => {
    if (!assignTarget) return;
    await api.feeConfigs.assignMerchantGroup(assignTarget.id, groupId);
    notify('Group assignment updated');
    setAssignTarget(null);
    await load();
  };

  const TABS: { id: PageTab; label: string; count?: number }[] = [
    { id: 'rules',   label: 'Rules',   count: configs.length },
    { id: 'groups',  label: 'Groups',  count: groups.length  },
    { id: 'preview', label: 'Preview'                        },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">Loading fee configuration…</div>
  );

  return (
    <div>
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDismiss={() => setToast(null)} />}

      {showConfigModal && (
        <ConfigModal initial={editingConfig} groups={groups} merchants={merchants}
          onSave={handleSaveConfig}
          onClose={() => { setShowConfigModal(false); setEditingConfig(undefined); }} />
      )}
      {showGroupModal && (
        <GroupModal initial={editingGroup} onSave={handleSaveGroup}
          onClose={() => { setShowGroupModal(false); setEditingGroup(undefined); }} />
      )}
      {assignTarget && (
        <AssignGroupModal merchantId={assignTarget.id} currentGroupId={assignTarget.fee_group_id ?? null}
          groups={groups} onSave={handleAssignGroup} onClose={() => setAssignTarget(null)} />
      )}

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">Fee Configuration</h1>
          <p className="text-[13px] text-[#64748B]">Set pricing rules at the platform, group, or merchant level.</p>
        </div>
        <button onClick={() => { setEditingConfig(undefined); setShowConfigModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold hover:opacity-90 transition-opacity shrink-0">
          <Plus size={14} /> New Config
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#E8ECF0] mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-bold border-b-2 transition-colors ${activeTab === t.id ? 'border-[#0F172A] text-[#0F172A]' : 'border-transparent text-[#94A3B8] hover:text-[#64748B]'}`}>
            {t.label}
            {t.count !== undefined && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-[#F1F5F9] text-[#64748B]' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'rules' && (
        <RulesTab
          configs={configs} groups={groups} merchants={merchants}
          onEditConfig={cfg => { setEditingConfig(cfg); setShowConfigModal(true); }}
          onDeleteConfig={id => void handleDeleteConfig(id)}
          onOpenModal={() => { setEditingConfig(undefined); setShowConfigModal(true); }}
          onSaveGlobal={handleSaveGlobal}
        />
      )}
      {activeTab === 'groups' && (
        <GroupsTab
          groups={groups} configs={configs} merchants={merchants}
          onEditGroup={g => { setEditingGroup(g); setShowGroupModal(true); }}
          onDeleteGroup={id => void handleDeleteGroup(id)}
          onCreateGroup={() => { setEditingGroup(undefined); setShowGroupModal(true); }}
          onAssignMerchant={m => setAssignTarget(m)}
        />
      )}
      {activeTab === 'preview' && (
        <PreviewTab configs={configs} merchants={merchants} />
      )}
    </div>
  );
}
