import { useEffect, useState, type ReactNode } from 'react';
import { ShieldCheck, Save, Clock, CheckCircle2, AlertCircle, ChevronRight, X } from 'lucide-react';
import { api } from '../lib/api';
import type {
  DecisionEngineRecord,
  DecisionEngineHistoryItem,
  ScoreComponent,
  PenaltyComponent,
  TierThreshold,
  EligibilityRules,
} from '../lib/api';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Toast({ msg, ok, onDismiss }: { msg: string; ok: boolean; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-[13px] font-semibold text-white ${ok ? 'bg-[#16A34A]' : 'bg-[#E11D48]'}`}>
      {msg}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">{children}</p>;
}

function SaveBtn({ onClick, saving, disabled = false }: { onClick: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
    >
      <Save size={13} />
      {saving ? 'Saving…' : 'Save Changes'}
    </button>
  );
}

const TH = ({ children, right }: { children: ReactNode; right?: boolean }) => (
  <th className={`px-5 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest ${right ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
);

const TD = ({ children, right, mono }: { children: ReactNode; right?: boolean; mono?: boolean }) => (
  <td className={`px-5 py-3 text-[13px] text-[#0F172A] ${right ? 'text-right' : ''} ${mono ? 'font-mono' : ''}`}>
    {children}
  </td>
);

const numInput = 'w-24 text-right border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white';

const TIERS = ['Surge Starter', 'Surge Bronze', 'Surge Silver', 'Surge Gold', 'Surge Elite'];
const GATED_TIERS = ['Surge Bronze', 'Surge Silver', 'Surge Gold', 'Surge Elite'];

// Card wrapper matching MerchantsPage section style
function SectionCard({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: ReactNode; action?: ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-bold text-[#0F172A]">{title}</p>
          {subtitle && <p className="text-[12px] text-[#64748B] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Component type metadata
// ---------------------------------------------------------------------------

const TYPE_META: Record<string, { label: string; description: (c: ScoreComponent) => string; formula: (c: ScoreComponent) => string }> = {
  boolean: {
    label: 'Boolean',
    description: c => `Awards the full ${c.max_points} points when the condition is met; zero otherwise. No partial credit.`,
    formula: c => `${c.max_points} pts  if condition = true\n0 pts  if condition = false`,
  },
  wallet: {
    label: 'Wallet',
    description: c => `Awards ${c.points_per_unit ?? '?'} points per active payment method, capped at ${c.unit_cap ?? '?'} methods. Total maximum is ${c.max_points} points.`,
    formula: c => `min(active_methods, ${c.unit_cap ?? 'cap'}) × ${c.points_per_unit ?? 'pts_per'} = max ${c.max_points} pts`,
  },
  ratio: {
    label: 'Ratio',
    description: c => `Scales linearly from 0 to ${c.max_points} points based on the payment consistency ratio — on-time payments divided by total payments.`,
    formula: c => `consistency_ratio × ${c.max_points} pts  (ratio: 0.0 – 1.0)`,
  },
  age: {
    label: 'Age',
    description: c => `Awards ${c.points_per_unit ?? '?'} point per month of account age, up to ${c.max_points} points (${c.max_points} months to reach the maximum).`,
    formula: c => `min(account_age_months × ${c.points_per_unit ?? 'pts_per'}, ${c.max_points} pts)`,
  },
  velocity: {
    label: 'Velocity',
    description: c => `Awards ${c.points_per_unit ?? '?'} points per recently paid installment, up to ${c.max_points} points.`,
    formula: c => `min(recent_installments × ${c.points_per_unit ?? 'pts_per'}, ${c.max_points} pts)`,
  },
};

// ---------------------------------------------------------------------------
// Score component detail modal
// ---------------------------------------------------------------------------

function ComponentDetailModal({
  component,
  onApply,
  onClose,
}: {
  component: ScoreComponent;
  onApply: (updated: ScoreComponent) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ScoreComponent>({ ...component });
  const meta = TYPE_META[draft.type] ?? TYPE_META.boolean;
  const hasPointsPerUnit = ['wallet', 'age', 'velocity'].includes(draft.type);
  const hasUnitCap       = draft.type === 'wallet';

  const f = (key: keyof ScoreComponent, val: unknown) =>
    setDraft(p => ({ ...p, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <div>
            <p className="text-[15px] font-black text-[#0F172A]">{draft.label}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] uppercase tracking-wide">
                {meta.label}
              </span>
              <span className="text-[12px] text-[#94A3B8] font-mono">{draft.key}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* How it's calculated */}
          <div className="bg-[#F8FAFC] rounded-xl p-4">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-2">How it's calculated</p>
            <p className="text-[13px] text-[#475569] leading-relaxed mb-3">{meta.description(draft)}</p>
            <code className="block text-[12px] font-mono text-[#0F172A] bg-white border border-[#E8ECF0] rounded-lg px-3 py-2 whitespace-pre">
              {meta.formula(draft)}
            </code>
          </div>

          {/* Editable parameters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Max Points</Label>
              <input
                type="number" min={0} max={1000} value={draft.max_points}
                onChange={e => f('max_points', Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white"
              />
            </div>
            {hasPointsPerUnit && (
              <div>
                <Label>Points per Unit</Label>
                <input
                  type="number" value={draft.points_per_unit ?? ''}
                  onChange={e => f('points_per_unit', e.target.value === '' ? undefined : Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white"
                />
              </div>
            )}
            {hasUnitCap && (
              <div>
                <Label>Unit Cap</Label>
                <input
                  type="number" min={1} value={draft.unit_cap ?? ''}
                  onChange={e => f('unit_cap', e.target.value === '' ? undefined : Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white"
                />
              </div>
            )}
          </div>

          {/* Enabled toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className={`w-10 h-5 rounded-full relative transition-colors ${draft.enabled ? 'bg-[#0F172A]' : 'bg-[#CBD5E1]'}`}
              onClick={() => f('enabled', !draft.enabled)}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${draft.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-[13px] font-semibold text-[#0F172A]">{draft.enabled ? 'Enabled' : 'Disabled'}</span>
          </label>

          <p className="text-[11px] text-[#94A3B8]">
            Changes are queued locally. Hit <span className="font-bold text-[#0F172A]">Save Changes</span> on the Score Config tab to persist them.
          </p>
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end border-t border-[#F1F5F9] pt-4">
          <button onClick={onClose}
            className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-lg text-[13px] font-semibold hover:bg-[#F1F5F9]">
            Cancel
          </button>
          <button onClick={() => { onApply(draft); onClose(); }}
            className="px-4 py-2 bg-[#0F172A] text-white rounded-lg text-[13px] font-bold">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab components
// ---------------------------------------------------------------------------

function ScoreTab({
  scoreComponents, setScoreComponents,
  penaltyComponents, setPenaltyComponents,
  onSave, saving,
}: {
  scoreComponents: ScoreComponent[];
  setScoreComponents: (v: ScoreComponent[]) => void;
  penaltyComponents: PenaltyComponent[];
  setPenaltyComponents: (v: PenaltyComponent[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [detailComponent, setDetailComponent] = useState<ScoreComponent | null>(null);
  const total = scoreComponents.filter(c => c.enabled).reduce((s, c) => s + c.max_points, 0);
  const valid = total === 1000;

  const applyDetail = (updated: ScoreComponent) => {
    setScoreComponents(scoreComponents.map(c => c.key === updated.key ? updated : c));
  };

  return (
    <div className="space-y-5">
      {detailComponent && (
        <ComponentDetailModal
          component={detailComponent}
          onApply={applyDetail}
          onClose={() => setDetailComponent(null)}
        />
      )}

      {/* Score Components */}
      <SectionCard
        title="Score Components"
        subtitle="Positive signals that contribute to the Surge Score. Enabled components must sum to exactly 1,000."
      >
        <table className="w-full">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <TH>Component</TH>
              <TH>Type</TH>
              <TH right>Max Points</TH>
              <TH right>Enabled</TH>
              <TH right> </TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {scoreComponents.map((c, i) => (
              <tr key={c.key} className="hover:bg-[#FAFAFA]">
                <TD><span className="font-semibold">{c.label}</span></TD>
                <TD>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] uppercase tracking-wide">
                    {c.type}
                  </span>
                </TD>
                <TD right>
                  <input
                    type="number" min={0} max={1000} value={c.max_points}
                    onChange={e => {
                      const updated = [...scoreComponents];
                      updated[i] = { ...c, max_points: Number(e.target.value) };
                      setScoreComponents(updated);
                    }}
                    className={numInput}
                  />
                </TD>
                <TD right>
                  <input
                    type="checkbox" checked={c.enabled}
                    onChange={e => {
                      const updated = [...scoreComponents];
                      updated[i] = { ...c, enabled: e.target.checked };
                      setScoreComponents(updated);
                    }}
                    className="accent-[#0F172A] w-4 h-4"
                  />
                </TD>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => setDetailComponent(c)}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
                  >
                    Details <ChevronRight size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={`border-t-2 ${valid ? 'border-[#BBF7D0] bg-[#F0FDF4]' : 'border-[#FECACA] bg-[#FFF1F2]'}`}>
              <td colSpan={2} className="px-5 py-2.5 text-[13px] font-bold text-[#0F172A]">
                Total (enabled)
              </td>
              <td className={`px-5 py-2.5 text-right text-[13px] font-bold ${valid ? 'text-[#16A34A]' : 'text-[#E11D48]'}`}>
                {total} / 1,000
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
        {!valid && (
          <div className="flex items-center gap-1.5 px-5 py-3 text-[12px] text-[#E11D48] border-t border-[#FECACA] bg-[#FFF1F2]">
            <AlertCircle size={12} />
            Enabled components must sum to exactly 1,000 before you can save.
          </div>
        )}
      </SectionCard>

      {/* Penalty Components */}
      <SectionCard
        title="Penalty Components"
        subtitle="Applied per event. Negative values are deductions; positive values are recovery bonuses."
      >
        <table className="w-full">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <TH>Penalty</TH>
              <TH right>Points per Event</TH>
              <TH right>Enabled</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {penaltyComponents.map((p, i) => (
              <tr key={p.key} className="hover:bg-[#FAFAFA]">
                <TD><span className="font-semibold">{p.label}</span></TD>
                <TD right>
                  <input
                    type="number" value={p.points_per_unit}
                    onChange={e => {
                      const updated = [...penaltyComponents];
                      updated[i] = { ...p, points_per_unit: Number(e.target.value) };
                      setPenaltyComponents(updated);
                    }}
                    className={numInput}
                  />
                </TD>
                <TD right>
                  <input
                    type="checkbox" checked={p.enabled}
                    onChange={e => {
                      const updated = [...penaltyComponents];
                      updated[i] = { ...p, enabled: e.target.checked };
                      setPenaltyComponents(updated);
                    }}
                    className="accent-[#0F172A] w-4 h-4"
                  />
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SaveBtn onClick={onSave} saving={saving} disabled={!valid} />
    </div>
  );
}

function TiersTab({
  tierThresholds, setTierThresholds, onSave, saving,
}: {
  tierThresholds: TierThreshold[];
  setTierThresholds: (v: TierThreshold[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-5">
      <SectionCard
        title="Tier Score Thresholds"
        subtitle="The score range that maps a consumer to each trust tier. Changes apply to all future score evaluations."
      >
        <table className="w-full">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <TH>Tier</TH>
              <TH right>Floor (min score)</TH>
              <TH right>Ceiling (max score)</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {tierThresholds.map((t, i) => (
              <tr key={t.tier} className="hover:bg-[#FAFAFA]">
                <TD><span className="font-semibold">{t.tier}</span></TD>
                <TD right>
                  <input
                    type="number" value={t.floor}
                    onChange={e => {
                      const updated = [...tierThresholds];
                      updated[i] = { ...t, floor: Number(e.target.value) };
                      setTierThresholds(updated);
                    }}
                    className={numInput}
                  />
                </TD>
                <TD right>
                  <input
                    type="number" value={t.ceiling}
                    onChange={e => {
                      const updated = [...tierThresholds];
                      updated[i] = { ...t, ceiling: Number(e.target.value) };
                      setTierThresholds(updated);
                    }}
                    className={numInput}
                  />
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
      <SaveBtn onClick={onSave} saving={saving} />
    </div>
  );
}

function GatesTab({ record }: { record: DecisionEngineRecord }) {
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[#64748B]">
        Hard requirements a consumer must satisfy to hold a tier, regardless of their score.
        Gate editing is available via the Decision Engine API — a full UI editor is planned.
      </p>
      {GATED_TIERS.map(tier => {
        const gates = record.config.tier_gates?.[tier] ?? [];
        return (
          <SectionCard
            key={tier}
            title={tier}
            action={gates.length === 0
              ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F1F5F9] text-[#94A3B8] uppercase tracking-wide">No gates</span>
              : <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F0FDF4] text-[#16A34A] uppercase tracking-wide">{gates.length} gate{gates.length !== 1 ? 's' : ''} active</span>
            }
          >
            <div className="p-5">
              {gates.length === 0 ? (
                <p className="text-[13px] text-[#94A3B8]">All consumers who reach this score range are assigned this tier.</p>
              ) : (
                <ul className="space-y-2">
                  {gates.map((g, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-[13px]">
                      <CheckCircle2 size={14} className="text-[#16A34A] shrink-0" />
                      <span className="font-mono text-[#475569]">{g.condition}</span>
                      <span className="text-[#CBD5E1]">→</span>
                      <span className="text-[#0F172A] font-semibold">{String(g.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}

function EligibilityTab({
  eligibility, setEligibility, onSave, saving,
}: {
  eligibility: EligibilityRules;
  setEligibility: (v: EligibilityRules) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-5">

      {/* Platform minimum score */}
      <SectionCard
        title="Platform Minimum Score"
        action={
          <div>
            <Label>Min Score</Label>
            <input
              type="number"
              value={eligibility.platform_min_score}
              onChange={e => setEligibility({ ...eligibility, platform_min_score: Number(e.target.value) })}
              className={numInput}
            />
          </div>
        }
      >
        <div className="px-5 py-4">
          <p className="text-[13px] text-[#64748B]">
            Consumers below this score are hard-blocked from purchasing anywhere, regardless of merchant settings.
          </p>
        </div>
      </SectionCard>

      {/* Surge-backed override */}
      <SectionCard
        title="Surge-Backed Purchase Minimum"
        action={
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] text-[#64748B] font-medium">
              {eligibility.surge_backed_enabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              onClick={() => setEligibility({ ...eligibility, surge_backed_enabled: !eligibility.surge_backed_enabled })}
              className={`relative w-10 h-5 rounded-full transition-colors ${eligibility.surge_backed_enabled ? 'bg-[#0F172A]' : 'bg-[#CBD5E1]'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${eligibility.surge_backed_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        }
      >
        <div className="px-5 py-4 flex items-center justify-between gap-6">
          <p className="text-[13px] text-[#64748B]">
            When enabled, Surge enforces a company-wide minimum tier on top of the merchant's own setting.
            A merchant accepting Starter consumers cannot override this floor when Surge is bearing the risk.
          </p>
          <div className="shrink-0">
            <Label>Minimum Tier</Label>
            <select
              value={eligibility.surge_backed_min_tier}
              disabled={!eligibility.surge_backed_enabled}
              onChange={e => setEligibility({ ...eligibility, surge_backed_min_tier: e.target.value })}
              className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Tier limits */}
      <SectionCard
        title="Tier Purchase Limits"
        subtitle="Cap how many active plans a consumer can hold and the maximum single purchase amount per tier. Leave blank for unlimited."
      >
        <table className="w-full">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <TH>Tier</TH>
              <TH right>Max Concurrent Plans</TH>
              <TH right>Max Purchase Amount (₦)</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {TIERS.map(tier => {
              const limits = eligibility.tier_limits?.[tier] ?? { max_concurrent_plans: null, max_purchase_amount: null };
              return (
                <tr key={tier} className="hover:bg-[#FAFAFA]">
                  <TD><span className="font-semibold">{tier}</span></TD>
                  <TD right>
                    <input
                      type="number" min={1} placeholder="Unlimited"
                      value={limits.max_concurrent_plans ?? ''}
                      onChange={e => setEligibility({
                        ...eligibility,
                        tier_limits: {
                          ...eligibility.tier_limits,
                          [tier]: { ...limits, max_concurrent_plans: e.target.value === '' ? null : Number(e.target.value) },
                        },
                      })}
                      className="w-32 text-right border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white placeholder:text-[#CBD5E1]"
                    />
                  </TD>
                  <TD right>
                    <input
                      type="number" min={0} placeholder="Unlimited"
                      value={limits.max_purchase_amount ?? ''}
                      onChange={e => setEligibility({
                        ...eligibility,
                        tier_limits: {
                          ...eligibility.tier_limits,
                          [tier]: { ...limits, max_purchase_amount: e.target.value === '' ? null : Number(e.target.value) },
                        },
                      })}
                      className="w-36 text-right border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-[13px] text-[#0F172A] outline-none focus:border-[#0F172A] bg-white placeholder:text-[#CBD5E1]"
                    />
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>

      <SaveBtn onClick={onSave} saving={saving} />
    </div>
  );
}

function HistoryTab({ history }: { history: DecisionEngineHistoryItem[] }) {
  if (history.length === 0) {
    return <p className="text-[13px] text-[#94A3B8]">No history yet.</p>;
  }
  return (
    <section className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
      <table className="w-full">
        <thead className="bg-[#F8FAFC]">
          <tr>
            <TH>Version</TH>
            <TH>Summary</TH>
            <TH>Changed By</TH>
            <TH right>Date</TH>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F5F9]">
          {history.map(item => (
            <tr key={item.id ?? item.version} className="hover:bg-[#FAFAFA]">
              <TD>
                <div className="flex items-center gap-2">
                  <span className="font-bold">v{item.version}</span>
                  {item.is_active && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] uppercase tracking-wide">
                      Active
                    </span>
                  )}
                </div>
              </TD>
              <TD>
                <span className="text-[#475569]">{item.change_summary ?? '—'}</span>
              </TD>
              <TD mono>{item.created_by}</TD>
              <TD right>
                <span className="text-[#64748B]">{new Date(item.created_at).toLocaleString()}</span>
              </TD>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type PageTab = 'score' | 'tiers' | 'gates' | 'eligibility' | 'history';

const TABS: { id: PageTab; label: string }[] = [
  { id: 'score',       label: 'Score Config'    },
  { id: 'tiers',       label: 'Tier Thresholds' },
  { id: 'gates',       label: 'Tier Gates'      },
  { id: 'eligibility', label: 'Eligibility'     },
  { id: 'history',     label: 'History'         },
];

export default function DecisionEnginePage() {
  const [record,  setRecord]  = useState<DecisionEngineRecord | null>(null);
  const [history, setHistory] = useState<DecisionEngineHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [activeTab, setActiveTab] = useState<PageTab>('score');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [scoreComponents,   setScoreComponents]   = useState<ScoreComponent[]>([]);
  const [penaltyComponents, setPenaltyComponents] = useState<PenaltyComponent[]>([]);
  const [tierThresholds,    setTierThresholds]    = useState<TierThreshold[]>([]);
  const [eligibility,       setEligibility]       = useState<EligibilityRules>({
    platform_min_score: 0,
    blocked_tiers: ['Surge Restricted'],
    surge_backed_enabled: false,
    surge_backed_min_tier: 'Surge Bronze',
    tier_limits: {},
  });

  const notify = (msg: string, ok = true) => setToast({ msg, ok });

  const load = async () => {
    setLoading(true);
    try {
      const [rec, hist] = await Promise.all([
        api.decisionEngine.getConfig(),
        api.decisionEngine.getHistory(20),
      ]);
      setRecord(rec);
      setHistory(hist.data);
      setScoreComponents(rec.config.score_components ?? []);
      setPenaltyComponents(rec.config.penalty_components ?? []);
      setTierThresholds(rec.config.tier_thresholds ?? []);
      setEligibility(rec.config.eligibility_rules ?? {
        platform_min_score: 0,
        blocked_tiers: ['Surge Restricted'],
        surge_backed_enabled: false,
        surge_backed_min_tier: 'Surge Bronze',
        tier_limits: {},
      });
    } catch (e: unknown) {
      notify((e as Error).message ?? 'Failed to load config', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const saveScore = async () => {
    setSaving(true);
    try {
      const rec = await api.decisionEngine.updateScore({
        score_components: scoreComponents,
        penalty_components: penaltyComponents,
        score_bounds: { min: -300, max: 1000 },
        change_summary: 'Score configuration updated via Admin Console',
      });
      setRecord(rec);
      notify('Score configuration saved');
      void load();
    } catch (e: unknown) { notify((e as Error).message ?? 'Save failed', false); }
    finally { setSaving(false); }
  };

  const saveTiers = async () => {
    setSaving(true);
    try {
      const rec = await api.decisionEngine.updateTiers({
        tier_thresholds: tierThresholds,
        change_summary: 'Tier thresholds updated via Admin Console',
      });
      setRecord(rec);
      notify('Tier thresholds saved');
      void load();
    } catch (e: unknown) { notify((e as Error).message ?? 'Save failed', false); }
    finally { setSaving(false); }
  };

  const saveEligibility = async () => {
    setSaving(true);
    try {
      const rec = await api.decisionEngine.updateEligibility({
        eligibility_rules: eligibility,
        change_summary: 'Eligibility rules updated via Admin Console',
      });
      setRecord(rec);
      notify('Eligibility rules saved');
      void load();
    } catch (e: unknown) { notify((e as Error).message ?? 'Save failed', false); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">
      Loading Decision Engine…
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDismiss={() => setToast(null)} />}

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-[#00d66f]" />
            <p className="text-[22px] font-black text-[#0F172A] tracking-tight">Decision Engine</p>
          </div>
          <p className="text-[13px] text-[#64748B]">
            Configure scoring weights, tier thresholds, and eligibility rules. Changes take effect within 60 seconds.
          </p>
        </div>
        {record && (
          <div className="flex items-center gap-2 shrink-0 ml-6 bg-[#F8FAFC] border border-[#E8ECF0] rounded-xl px-4 py-2.5">
            <Clock size={13} className="text-[#94A3B8]" />
            <span className="text-[12px] text-[#64748B]">Active config</span>
            <span className="text-[13px] font-black text-[#0F172A]">v{record.version}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-[#F1F5F9] p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              activeTab === t.id
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'score' && (
        <ScoreTab
          scoreComponents={scoreComponents}
          setScoreComponents={setScoreComponents}
          penaltyComponents={penaltyComponents}
          setPenaltyComponents={setPenaltyComponents}
          onSave={saveScore}
          saving={saving}
        />
      )}
      {activeTab === 'tiers' && (
        <TiersTab
          tierThresholds={tierThresholds}
          setTierThresholds={setTierThresholds}
          onSave={saveTiers}
          saving={saving}
        />
      )}
      {activeTab === 'gates' && record && (
        <GatesTab record={record} />
      )}
      {activeTab === 'eligibility' && (
        <EligibilityTab
          eligibility={eligibility}
          setEligibility={setEligibility}
          onSave={saveEligibility}
          saving={saving}
        />
      )}
      {activeTab === 'history' && (
        <HistoryTab history={history} />
      )}
    </div>
  );
}
