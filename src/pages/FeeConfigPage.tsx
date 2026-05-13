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
// Shared label / input primitives
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">{children}</p>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white ${props.className ?? ''}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Priority Chain — visual resolution diagram
// ---------------------------------------------------------------------------

function PriorityChain() {
  const steps = [
    {
      icon: Building2, label: 'Merchant Override', color: 'emerald',
      desc: 'A rate set specifically for one merchant. Highest priority — always wins.',
    },
    {
      icon: Users, label: 'Group Rule', color: 'blue',
      desc: 'A rate assigned to a named group. Applies if the merchant has no personal override.',
    },
    {
      icon: Globe, label: 'Global Default', color: 'violet',
      desc: 'The platform-wide fallback rate. Applies to every merchant with no other config.',
    },
  ];

  const colorMap: Record<string, { ring: string; icon: string; text: string; bg: string }> = {
    emerald: { ring: 'border-emerald-200', icon: 'text-emerald-600', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    blue:    { ring: 'border-blue-200',    icon: 'text-blue-600',    text: 'text-blue-700',    bg: 'bg-blue-50'    },
    violet:  { ring: 'border-violet-200',  icon: 'text-violet-600',  text: 'text-violet-700',  bg: 'bg-violet-50'  },
  };

  return (
    <div className="bg-white border border-[#E8ECF0] rounded-2xl p-6 mb-6">
      <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-4">How fee resolution works</p>
      <div className="flex items-stretch gap-0">
        {steps.map((s, i) => {
          const c = colorMap[s.color];
          return (
            <div key={s.label} className="flex items-stretch gap-0 flex-1">
              <div className={`flex-1 border-2 rounded-xl p-4 ${c.ring} ${c.bg}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2.5 bg-white border ${c.ring}`}>
                  <s.icon size={14} className={c.icon} />
                </div>
                <p className={`text-[12px] font-black mb-1 ${c.text}`}>{s.label}</p>
                <p className="text-[11px] text-[#64748B] leading-relaxed">{s.desc}</p>
                <div className={`mt-2.5 text-[10px] font-bold uppercase tracking-widest ${c.text}`}>
                  Priority {i + 1}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="flex items-center px-2 shrink-0">
                  <ArrowRight size={14} className="text-[#CBD5E1]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Global Default Hero — inline editable
// ---------------------------------------------------------------------------

function GlobalHero({
  configs,
  onSave,
  onOpenModal,
}: {
  configs: FeeConfig[];
  onSave: (id: string, data: any) => Promise<void>;
  onOpenModal: (cfg: FeeConfig) => void;
}) {
  const global = configs.find(c => c.scope === 'global' && c.is_active);
  const [editing, setEditing] = useState(false);
  const [rate, setRate] = useState('');
  const [minFee, setMinFee] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    if (!global) return;
    setRate(global.percentage_rate != null ? String(global.percentage_rate * 100) : '');
    setMinFee(global.min_fee != null ? String(global.min_fee) : '');
    setMaxFee(global.max_fee != null ? String(global.max_fee) : '');
    setEditing(true);
  };

  const save = async () => {
    if (!global) return;
    setSaving(true);
    try {
      const payload: any = {};
      if (rate) payload.percentage_rate = parseFloat(rate) / 100;
      if (minFee) payload.min_fee = parseFloat(minFee);
      if (maxFee) payload.max_fee = parseFloat(maxFee);
      await onSave(global.id, payload);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!global) return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
      <p className="text-[13px] text-amber-700 font-semibold">No active global default found. System fallback rate of 2.5% is in use.</p>
    </div>
  );

  return (
    <div className="bg-[#0F172A] rounded-2xl p-6 mb-6 text-white">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Globe size={14} className="text-violet-300" />
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00d66f] text-[#0F172A] rounded-lg text-[12px] font-bold disabled:opacity-50 transition-opacity">
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

      {editing ? (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label><span className="text-white/40">Rate (%)</span></Label>
            <input value={rate} onChange={e => setRate(e.target.value)} type="number" step="0.0001"
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-[15px] font-bold text-white outline-none focus:border-white/40"
              placeholder="2.5" />
          </div>
          <div>
            <Label><span className="text-white/40">Min Fee (₦)</span></Label>
            <input value={minFee} onChange={e => setMinFee(e.target.value)} type="number" step="0.01"
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-[15px] font-bold text-white outline-none focus:border-white/40"
              placeholder="None" />
          </div>
          <div>
            <Label><span className="text-white/40">Max Fee (₦)</span></Label>
            <input value={maxFee} onChange={e => setMaxFee(e.target.value)} type="number" step="0.01"
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-[15px] font-bold text-white outline-none focus:border-white/40"
              placeholder="None" />
          </div>
        </div>
      ) : (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[42px] font-black tracking-tight leading-none">
              {fmtRate(global)}
            </p>
            <p className="text-[13px] text-white/40 mt-2">{global.name}</p>
          </div>
          <div className="flex gap-6 text-right pb-1">
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Type</p>
              <p className="text-[13px] font-bold text-white capitalize mt-0.5">{global.fee_type}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Floor</p>
              <p className="text-[13px] font-bold text-white mt-0.5">{global.min_fee != null ? fmtNgn(global.min_fee) : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Cap</p>
              <p className="text-[13px] font-bold text-white mt-0.5">{global.max_fee != null ? fmtNgn(global.max_fee) : '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Config Form Modal
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  name: '', scope: 'global' as FeeScope, merchant_id: '', group_id: '',
  fee_type: 'percentage' as FeeType, percentage_rate: '', flat_amount: '',
  min_fee: '', max_fee: '', is_active: true, effective_from: '', effective_until: '',
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
      if (form.min_fee)       p.min_fee        = parseFloat(form.min_fee);
      if (form.max_fee)       p.max_fee        = parseFloat(form.max_fee);
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
            <Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Enterprise Rate" />
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
              <Input type="number" step="0.0001" min="0" max="100" value={form.percentage_rate}
                onChange={e => f('percentage_rate', e.target.value)} placeholder="e.g. 2.5" />
            </div>}
            {showFlat && <div><Label>Flat Amount (₦)</Label>
              <Input type="number" step="0.01" min="0" value={form.flat_amount}
                onChange={e => f('flat_amount', e.target.value)} placeholder="e.g. 50" />
            </div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Min Fee (₦)</Label>
              <Input type="number" step="0.01" min="0" value={form.min_fee}
                onChange={e => f('min_fee', e.target.value)} placeholder="No minimum" />
            </div>
            <div><Label>Max Fee (₦)</Label>
              <Input type="number" step="0.01" min="0" value={form.max_fee}
                onChange={e => f('max_fee', e.target.value)} placeholder="No cap" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Effective From</Label>
              <Input type="datetime-local" value={form.effective_from}
                onChange={e => f('effective_from', e.target.value)} />
            </div>
            <div><Label>Effective Until</Label>
              <Input type="datetime-local" value={form.effective_until}
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
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Enterprise, SMB, High Volume" />
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

  // Resolved-by logic for each merchant
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

  const groupConfigs  = configs.filter(c => c.scope === 'group');
  const merchantConfigs = configs.filter(c => c.scope === 'merchant');

  return (
    <div>
      <PriorityChain />
      <GlobalHero configs={configs} onSave={onSaveGlobal} onOpenModal={onEditConfig} />

      {/* Group-level rules */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-blue-600" />
            <p className="text-[13px] font-bold text-[#0F172A]">Group Rules</p>
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{groupConfigs.length}</span>
          </div>
          <button onClick={onOpenModal}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] text-[#0F172A] rounded-lg text-[12px] font-semibold hover:bg-[#F8FAFC] transition-colors">
            <Plus size={12} /> Add Group Rule
          </button>
        </div>
        {groupConfigs.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E8ECF0] rounded-2xl px-6 py-10 text-center">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <Users size={18} className="text-blue-400" />
            </div>
            <p className="text-[13px] font-semibold text-[#64748B]">No group rules yet</p>
            <p className="text-[12px] text-[#94A3B8] mt-1">Create a group rule to apply a shared rate to multiple merchants at once.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {groupConfigs.map(cfg => (
              <div key={cfg.id} className="bg-white border border-[#E8ECF0] rounded-xl px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <Users size={15} className="text-blue-600" />
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
                        {cfg.min_fee != null ? `floor ${fmtNgn(cfg.min_fee)}` : ''}
                        {cfg.min_fee != null && cfg.max_fee != null ? ' · ' : ''}
                        {cfg.max_fee != null ? `cap ${fmtNgn(cfg.max_fee)}` : ''}
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
      </div>

      {/* Merchant overrides */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-emerald-600" />
            <p className="text-[13px] font-bold text-[#0F172A]">Merchant Overrides</p>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{merchantConfigs.length}</span>
          </div>
          <button onClick={onOpenModal}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] text-[#0F172A] rounded-lg text-[12px] font-semibold hover:bg-[#F8FAFC] transition-colors">
            <Plus size={12} /> Add Override
          </button>
        </div>
        {merchantConfigs.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E8ECF0] rounded-2xl px-6 py-10 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Building2 size={18} className="text-emerald-400" />
            </div>
            <p className="text-[13px] font-semibold text-[#64748B]">No merchant overrides yet</p>
            <p className="text-[12px] text-[#94A3B8] mt-1">Add a merchant-specific rate for bespoke pricing arrangements.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E8ECF0] rounded-2xl overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  {['Merchant', 'Config Name', 'Rate', 'Floor / Cap', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {merchantConfigs.map(cfg => {
                  const merchant = merchants.find(m => m.id === cfg.merchant_id);
                  return (
                    <tr key={cfg.id} className="border-t border-[#F1F5F9] hover:bg-[#FAFAFA]">
                      <td className="px-5 py-3 font-semibold text-[#0F172A]">{merchant?.display_name ?? cfg.merchant_id?.slice(0, 8) ?? '—'}</td>
                      <td className="px-5 py-3 text-[#64748B]">{cfg.name}</td>
                      <td className="px-5 py-3 font-bold text-[#0F172A]">{fmtRate(cfg)}</td>
                      <td className="px-5 py-3 text-[#64748B]">
                        {(cfg.min_fee != null || cfg.max_fee != null)
                          ? `${cfg.min_fee != null ? fmtNgn(cfg.min_fee) : '—'} / ${cfg.max_fee != null ? fmtNgn(cfg.max_fee) : '—'}`
                          : '—'}
                      </td>
                      <td className="px-5 py-3"><ActiveBadge active={cfg.is_active} /></td>
                      <td className="px-5 py-3">
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
          </div>
        )}
      </div>

      {/* All merchants resolved rate */}
      <div>
        <p className="text-[13px] font-bold text-[#0F172A] mb-3">Effective Rate per Merchant</p>
        <div className="bg-white border border-[#E8ECF0] rounded-2xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC]">
                {['Merchant', 'Effective Rate', 'Resolved via', 'Group'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {merchants.map(m => {
                const res = resolveFor(m);
                return (
                  <tr key={m.id} className="border-t border-[#F1F5F9] hover:bg-[#FAFAFA]">
                    <td className="px-5 py-3 font-semibold text-[#0F172A]">{m.display_name}</td>
                    <td className="px-5 py-3 font-bold text-[#0F172A]">{res ? fmtRate(res.cfg) : '—'}</td>
                    <td className="px-5 py-3">
                      {res ? (
                        <ScopeBadge
                          scope={res.cfg.scope}
                          label={res.via === 'override' ? 'Override' : res.via === 'group' ? 'Group' : 'Global'}
                        />
                      ) : <span className="text-[#94A3B8]">—</span>}
                    </td>
                    <td className="px-5 py-3 text-[#64748B]">
                      {m.fee_group_id
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[11px] font-bold"><Users size={10} />{getGroupName(m.fee_group_id)}</span>
                        : <span className="text-[#94A3B8]">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Groups
// ---------------------------------------------------------------------------

function GroupsTab({
  groups, configs, merchants,
  onEditGroup, onDeleteGroup, onCreateGroup,
  onAssignMerchant,
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
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-[#64748B]">
          Groups let you apply one rate to many merchants. Assign merchants using the button on each card.
        </p>
        <button onClick={onCreateGroup}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold hover:opacity-90 transition-opacity shrink-0">
          <Plus size={14} /> New Group
        </button>
      </div>

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
        <div className="flex flex-col gap-4">
          {groups.map(g => {
            const cfg     = getGroupCfg(g.id);
            const members = merchants.filter(m => m.fee_group_id === g.id);
            const open    = openGroupId === g.id;
            return (
              <div key={g.id} className="bg-white border border-[#E8ECF0] rounded-2xl overflow-hidden">
                {/* Group header */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <Users size={16} className="text-blue-600" />
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
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[20px] font-black text-[#0F172A]">{cfg ? fmtRate(cfg) : <span className="text-[#CBD5E1] text-[14px] font-semibold">No rate set</span>}</p>
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
                        className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#94A3B8] hover:text-[#0F172A] transition-colors ml-1">
                        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Members list */}
                {open && (
                  <div className="border-t border-[#F1F5F9]">
                    {members.length === 0 ? (
                      <p className="px-5 py-5 text-[13px] text-[#94A3B8] text-center">
                        No merchants in this group. Use "Assign Group" below to add some.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#F1F5F9]">
                        {members.map(m => (
                          <div key={m.id} className="flex items-center justify-between px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                                <Building2 size={13} className="text-[#64748B]" />
                              </div>
                              <span className="text-[13px] font-semibold text-[#0F172A]">{m.display_name}</span>
                            </div>
                            <button onClick={() => onAssignMerchant(m)}
                              className="text-[12px] font-semibold text-[#64748B] hover:text-[#E11D48] transition-colors">
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
          })}
        </div>
      )}

      {/* Unassigned merchants */}
      {unassigned.length > 0 && (
        <div className="mt-6">
          <p className="text-[12px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">
            Unassigned Merchants — using Global Default
          </p>
          <div className="bg-white border border-[#E8ECF0] rounded-2xl overflow-hidden">
            <div className="divide-y divide-[#F1F5F9]">
              {unassigned.map(m => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3">
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
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Preview
// ---------------------------------------------------------------------------

function PreviewTab({ configs, merchants }: { configs: FeeConfig[]; merchants: Merchant[] }) {
  const [amount, setAmount]       = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [result, setResult]       = useState<FeeCalculationResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const run = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.feeConfigs.preview(num, merchantId || undefined);
      setResult(res.data);
    } catch (e: any) { setError(e.message ?? 'Preview failed'); }
    finally { setLoading(false); }
  };

  const selectedMerchant = merchants.find(m => m.id === merchantId);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-[#E8ECF0] rounded-2xl overflow-hidden">
        <div className="px-8 pt-8 pb-6 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-2 mb-1">
            <Calculator size={16} className="text-[#64748B]" />
            <p className="text-[15px] font-black text-[#0F172A]">Fee Preview</p>
          </div>
          <p className="text-[13px] text-[#64748B]">
            Enter an amount and optionally pick a merchant to see exactly how the fee resolves.
          </p>
        </div>

        <div className="px-8 py-6 flex flex-col gap-5">
          {/* Amount */}
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

          {/* Merchant */}
          <div>
            <Label>Merchant <span className="normal-case font-normal text-[#94A3B8]">(optional — leave blank for global rate)</span></Label>
            <select value={merchantId} onChange={e => { setMerchantId(e.target.value); setResult(null); }}
              className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white">
              <option value="">Global default</option>
              {merchants.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </div>

          <button onClick={() => void run()} disabled={loading || !amount}
            className="w-full py-3 bg-[#0F172A] text-white rounded-xl text-[14px] font-bold disabled:opacity-40 transition-opacity">
            {loading ? 'Calculating…' : 'Calculate Fee'}
          </button>
          {error && <p className="text-[#E11D48] text-[12px] font-semibold">{error}</p>}
        </div>

        {/* Result */}
        {result && (
          <div className="border-t border-[#F1F5F9] px-8 py-6">
            {/* Resolution trace */}
            <div className="flex items-center gap-2 mb-5 p-3 bg-[#F8FAFC] rounded-xl">
              <Info size={13} className="text-[#64748B] shrink-0" />
              <p className="text-[12px] text-[#64748B]">
                Resolved via <span className="font-bold text-[#0F172A]">{result.config_name}</span>
              </p>
              <ScopeBadge scope={result.resolved_scope} />
              {selectedMerchant && (
                <span className="text-[12px] text-[#94A3B8]">for {selectedMerchant.display_name}</span>
              )}
            </div>

            {/* Numbers */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-[#F8FAFC] rounded-xl p-4">
                <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Gross Amount</p>
                <p className="text-[22px] font-black text-[#0F172A] mt-1">{fmtNgn(result.gross_amount)}</p>
              </div>
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Platform Fee</p>
                <p className="text-[22px] font-black text-violet-700 mt-1">{fmtNgn(result.fee_amount)}</p>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-4">
                <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Merchant Payable</p>
                <p className="text-[22px] font-black text-[#0F172A] mt-1">{fmtNgn(result.merchant_payable)}</p>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-4">
                <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Effective Rate</p>
                <p className="text-[22px] font-black text-[#0F172A] mt-1">{result.effective_rate_pct.toFixed(4)}%</p>
              </div>
            </div>

            {/* Visual bar */}
            <div className="h-2.5 rounded-full bg-[#F1F5F9] overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(result.effective_rate_pct * 10, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-[10px] text-[#94A3B8]">0%</p>
              <p className="text-[10px] text-[#94A3B8]">10%</p>
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
    <div className="max-w-5xl mx-auto">
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
          <p className="text-[22px] font-black text-[#0F172A] tracking-tight">Fee Configuration</p>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Set pricing rules at the platform, group, or merchant level.
          </p>
        </div>
        <button onClick={() => { setEditingConfig(undefined); setShowConfigModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold hover:opacity-90 transition-opacity shrink-0">
          <Plus size={14} /> New Config
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-[#F1F5F9] p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === t.id ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}>
            {t.label}
            {t.count !== undefined && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-[#F1F5F9] text-[#64748B]' : 'bg-white/60 text-[#94A3B8]'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
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
