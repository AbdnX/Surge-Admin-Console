import { useEffect, useState, type ReactNode } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, Save, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
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
// Helpers
// ---------------------------------------------------------------------------

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium text-white ${ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
      {ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
      {msg}
    </div>
  );
}

function SectionCard({ title, subtitle, expanded, onToggle, children }: {
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8EDF2] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F7F8FA] transition-colors"
      >
        <div className="text-left">
          <div className="text-[14px] font-semibold text-[#0F172A]">{title}</div>
          <div className="text-[12px] text-[#64748B] mt-0.5">{subtitle}</div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-[#64748B]" /> : <ChevronDown size={16} className="text-[#64748B]" />}
      </button>
      {expanded && <div className="border-t border-[#E8EDF2] px-6 py-5">{children}</div>}
    </div>
  );
}

const TIERS = ['Surge Starter', 'Surge Bronze', 'Surge Silver', 'Surge Gold', 'Surge Elite'];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DecisionEnginePage() {
  const [record, setRecord]   = useState<DecisionEngineRecord | null>(null);
  const [history, setHistory] = useState<DecisionEngineHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  const [openSection, setOpenSection] = useState<string | null>('score');

  // Local edit state per section
  const [scoreComponents,   setScoreComponents]   = useState<ScoreComponent[]>([]);
  const [penaltyComponents, setPenaltyComponents] = useState<PenaltyComponent[]>([]);
  const [scoreBounds,       setScoreBounds]       = useState({ min: -300, max: 1000 });
  const [tierThresholds,    setTierThresholds]    = useState<TierThreshold[]>([]);
  const [eligibility,       setEligibility]       = useState<EligibilityRules>({
    platform_min_score: 0,
    blocked_tiers: ['Surge Restricted'],
    surge_backed_enabled: false,
    surge_backed_min_tier: 'Surge Bronze',
    tier_limits: {},
  });

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [rec, hist] = await Promise.all([
        api.decisionEngine.getConfig(),
        api.decisionEngine.getHistory(15),
      ]);
      setRecord(rec);
      setHistory(hist.data);
      setScoreComponents(rec.config.score_components ?? []);
      setPenaltyComponents(rec.config.penalty_components ?? []);
      setScoreBounds(rec.config.score_bounds ?? { min: -300, max: 1000 });
      setTierThresholds(rec.config.tier_thresholds ?? []);
      setEligibility(rec.config.eligibility_rules ?? {
        platform_min_score: 0,
        blocked_tiers: ['Surge Restricted'],
        surge_backed_enabled: false,
        surge_backed_min_tier: 'Surge Bronze',
        tier_limits: {},
      });
    } catch {
      showToast('Failed to load config', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = (id: string) => setOpenSection(p => p === id ? null : id);

  // -------------------------------------------------------------------------
  // Save handlers
  // -------------------------------------------------------------------------

  const saveScore = async () => {
    const totalMax = scoreComponents.filter(c => c.enabled).reduce((s, c) => s + c.max_points, 0);
    if (totalMax !== 1000) {
      showToast(`Score components must sum to 1,000 (currently ${totalMax})`, false);
      return;
    }
    setSaving(true);
    try {
      const rec = await api.decisionEngine.updateScore({
        score_components: scoreComponents,
        penalty_components: penaltyComponents,
        score_bounds: scoreBounds,
        change_summary: `Score config updated via Admin Console`,
      });
      setRecord(rec);
      showToast('Score configuration saved', true);
      load();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Save failed', false);
    } finally {
      setSaving(false);
    }
  };

  const saveTiers = async () => {
    setSaving(true);
    try {
      const rec = await api.decisionEngine.updateTiers({
        tier_thresholds: tierThresholds,
        change_summary: `Tier thresholds updated via Admin Console`,
      });
      setRecord(rec);
      showToast('Tier thresholds saved', true);
      load();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Save failed', false);
    } finally {
      setSaving(false);
    }
  };

  const saveEligibility = async () => {
    setSaving(true);
    try {
      const rec = await api.decisionEngine.updateEligibility({
        eligibility_rules: eligibility,
        change_summary: `Eligibility rules updated via Admin Console`,
      });
      setRecord(rec);
      showToast('Eligibility rules saved', true);
      load();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Save failed', false);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#00d66f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const scoreTotal = scoreComponents.filter(c => c.enabled).reduce((s, c) => s + c.max_points, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <ShieldCheck size={20} className="text-[#00d66f]" />
            <h1 className="text-[18px] font-bold text-[#0F172A]">Decision Engine</h1>
          </div>
          <p className="text-[13px] text-[#64748B]">
            Configure scoring weights, tier thresholds, and eligibility rules.
            Changes take effect within 60 seconds.
          </p>
        </div>
        {record && (
          <div className="text-right shrink-0 ml-4">
            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Active Version</div>
            <div className="text-[22px] font-bold text-[#0F172A]">v{record.version}</div>
          </div>
        )}
      </div>

      {/* ── Score Configuration ── */}
      <SectionCard
        title="Score Configuration"
        subtitle="Component weights and penalties. Enabled components must sum to exactly 1,000."
        expanded={openSection === 'score'}
        onToggle={() => toggle('score')}
      >
        <div className="space-y-4">

          {/* Score components */}
          <div>
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Components</div>
            <div className="rounded-xl border border-[#E8EDF2] overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F7F8FA] border-b border-[#E8EDF2]">
                    <th className="text-left px-4 py-2.5 font-semibold text-[#64748B]">Component</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-[#64748B]">Max Points</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-[#64748B]">Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreComponents.map((c, i) => (
                    <tr key={c.key} className="border-b border-[#E8EDF2] last:border-0">
                      <td className="px-4 py-2.5 text-[#0F172A] font-medium">{c.label}</td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          max={1000}
                          value={c.max_points}
                          onChange={e => {
                            const updated = [...scoreComponents];
                            updated[i] = { ...c, max_points: Number(e.target.value) };
                            setScoreComponents(updated);
                          }}
                          className="w-20 text-right border border-[#E8EDF2] rounded-lg px-2 py-1 text-[13px] focus:outline-none focus:border-[#00d66f]"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={c.enabled}
                          onChange={e => {
                            const updated = [...scoreComponents];
                            updated[i] = { ...c, enabled: e.target.checked };
                            setScoreComponents(updated);
                          }}
                          className="accent-[#00d66f] w-4 h-4"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={`border-t-2 ${scoreTotal === 1000 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                    <td className="px-4 py-2.5 font-bold text-[#0F172A]">Total (enabled)</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${scoreTotal === 1000 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {scoreTotal} / 1,000
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            {scoreTotal !== 1000 && (
              <div className="flex items-center gap-1.5 mt-2 text-[12px] text-red-600">
                <AlertCircle size={12} />
                Enabled components must sum to exactly 1,000 before saving.
              </div>
            )}
          </div>

          {/* Penalty components */}
          <div>
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Penalties</div>
            <div className="rounded-xl border border-[#E8EDF2] overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F7F8FA] border-b border-[#E8EDF2]">
                    <th className="text-left px-4 py-2.5 font-semibold text-[#64748B]">Penalty</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-[#64748B]">Points per Event</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-[#64748B]">Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {penaltyComponents.map((p, i) => (
                    <tr key={p.key} className="border-b border-[#E8EDF2] last:border-0">
                      <td className="px-4 py-2.5 text-[#0F172A] font-medium">{p.label}</td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          value={p.points_per_unit}
                          onChange={e => {
                            const updated = [...penaltyComponents];
                            updated[i] = { ...p, points_per_unit: Number(e.target.value) };
                            setPenaltyComponents(updated);
                          }}
                          className="w-20 text-right border border-[#E8EDF2] rounded-lg px-2 py-1 text-[13px] focus:outline-none focus:border-[#00d66f]"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={e => {
                            const updated = [...penaltyComponents];
                            updated[i] = { ...p, enabled: e.target.checked };
                            setPenaltyComponents(updated);
                          }}
                          className="accent-[#00d66f] w-4 h-4"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={saveScore}
            disabled={saving || scoreTotal !== 1000}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white text-[13px] font-semibold rounded-xl disabled:opacity-40 hover:bg-[#1e293b] transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Score Config'}
          </button>
        </div>
      </SectionCard>

      {/* ── Tier Thresholds ── */}
      <SectionCard
        title="Tier Thresholds"
        subtitle="Score floors that determine which tier a consumer is assigned to."
        expanded={openSection === 'tiers'}
        onToggle={() => toggle('tiers')}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E8EDF2] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F7F8FA] border-b border-[#E8EDF2]">
                  <th className="text-left px-4 py-2.5 font-semibold text-[#64748B]">Tier</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-[#64748B]">Floor</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-[#64748B]">Ceiling</th>
                </tr>
              </thead>
              <tbody>
                {tierThresholds.map((t, i) => (
                  <tr key={t.tier} className="border-b border-[#E8EDF2] last:border-0">
                    <td className="px-4 py-2.5 font-medium text-[#0F172A]">{t.tier}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        value={t.floor}
                        onChange={e => {
                          const updated = [...tierThresholds];
                          updated[i] = { ...t, floor: Number(e.target.value) };
                          setTierThresholds(updated);
                        }}
                        className="w-24 text-right border border-[#E8EDF2] rounded-lg px-2 py-1 text-[13px] focus:outline-none focus:border-[#00d66f]"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        value={t.ceiling}
                        onChange={e => {
                          const updated = [...tierThresholds];
                          updated[i] = { ...t, ceiling: Number(e.target.value) };
                          setTierThresholds(updated);
                        }}
                        className="w-24 text-right border border-[#E8EDF2] rounded-lg px-2 py-1 text-[13px] focus:outline-none focus:border-[#00d66f]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={saveTiers}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white text-[13px] font-semibold rounded-xl disabled:opacity-40 hover:bg-[#1e293b] transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Tier Thresholds'}
          </button>
        </div>
      </SectionCard>

      {/* ── Tier Gates ── */}
      <SectionCard
        title="Tier Gates"
        subtitle="Hard requirements a consumer must satisfy to be assigned a tier, regardless of score."
        expanded={openSection === 'gates'}
        onToggle={() => toggle('gates')}
      >
        <div className="space-y-3">
          {(['Surge Bronze', 'Surge Silver', 'Surge Gold', 'Surge Elite'] as const).map(tier => {
            const gates = record?.config.tier_gates?.[tier] ?? [];
            return (
              <div key={tier} className="rounded-xl border border-[#E8EDF2] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold text-[#0F172A]">{tier}</span>
                  {gates.length === 0
                    ? <span className="text-[11px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-md">No gates configured</span>
                    : <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">{gates.length} gate{gates.length !== 1 ? 's' : ''}</span>
                  }
                </div>
                {gates.length > 0 && (
                  <ul className="space-y-1">
                    {gates.map((g, i) => (
                      <li key={i} className="flex items-center gap-2 text-[12px] text-[#475569]">
                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                        <span className="font-mono">{g.condition}</span>
                        <span className="text-[#94A3B8]">→</span>
                        <span>{String(g.value)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <p className="text-[12px] text-[#94A3B8]">
            Gate editing via API. Full UI editor coming in next iteration.
          </p>
        </div>
      </SectionCard>

      {/* ── Eligibility Rules ── */}
      <SectionCard
        title="Eligibility Rules"
        subtitle="Platform-level purchase controls: Surge-backed minimum, tier limits, and hard blocks."
        expanded={openSection === 'eligibility'}
        onToggle={() => toggle('eligibility')}
      >
        <div className="space-y-5">

          {/* Platform min score */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-[#0F172A]">Platform minimum score</div>
              <div className="text-[12px] text-[#64748B]">Consumers below this score are hard-blocked everywhere.</div>
            </div>
            <input
              type="number"
              value={eligibility.platform_min_score}
              onChange={e => setEligibility(prev => ({ ...prev, platform_min_score: Number(e.target.value) }))}
              className="w-24 text-right border border-[#E8EDF2] rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#00d66f]"
            />
          </div>

          {/* Surge-backed toggle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[13px] font-semibold text-[#0F172A]">Surge-backed minimum tier</div>
              <div className="text-[12px] text-[#64748B]">
                When enabled, Surge enforces its own minimum tier on top of any merchant setting.
                A merchant accepting Starter cannot override this.
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setEligibility(prev => ({ ...prev, surge_backed_enabled: !prev.surge_backed_enabled }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${eligibility.surge_backed_enabled ? 'bg-[#00d66f]' : 'bg-[#CBD5E1]'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${eligibility.surge_backed_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <select
                value={eligibility.surge_backed_min_tier}
                disabled={!eligibility.surge_backed_enabled}
                onChange={e => setEligibility(prev => ({ ...prev, surge_backed_min_tier: e.target.value }))}
                className="border border-[#E8EDF2] rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#00d66f] disabled:opacity-40"
              >
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Tier limits */}
          <div>
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Tier Purchase Limits</div>
            <div className="rounded-xl border border-[#E8EDF2] overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F7F8FA] border-b border-[#E8EDF2]">
                    <th className="text-left px-4 py-2.5 font-semibold text-[#64748B]">Tier</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-[#64748B]">Max Concurrent Plans</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-[#64748B]">Max Purchase (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {TIERS.map(tier => {
                    const limits = eligibility.tier_limits?.[tier] ?? { max_concurrent_plans: null, max_purchase_amount: null };
                    return (
                      <tr key={tier} className="border-b border-[#E8EDF2] last:border-0">
                        <td className="px-4 py-2.5 font-medium text-[#0F172A]">{tier}</td>
                        <td className="px-4 py-2.5 text-right">
                          <input
                            type="number"
                            min={1}
                            placeholder="Unlimited"
                            value={limits.max_concurrent_plans ?? ''}
                            onChange={e => setEligibility(prev => ({
                              ...prev,
                              tier_limits: {
                                ...prev.tier_limits,
                                [tier]: {
                                  ...limits,
                                  max_concurrent_plans: e.target.value === '' ? null : Number(e.target.value),
                                },
                              },
                            }))}
                            className="w-28 text-right border border-[#E8EDF2] rounded-lg px-2 py-1 text-[13px] focus:outline-none focus:border-[#00d66f] placeholder:text-[#CBD5E1]"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <input
                            type="number"
                            min={0}
                            placeholder="Unlimited"
                            value={limits.max_purchase_amount ?? ''}
                            onChange={e => setEligibility(prev => ({
                              ...prev,
                              tier_limits: {
                                ...prev.tier_limits,
                                [tier]: {
                                  ...limits,
                                  max_purchase_amount: e.target.value === '' ? null : Number(e.target.value),
                                },
                              },
                            }))}
                            className="w-32 text-right border border-[#E8EDF2] rounded-lg px-2 py-1 text-[13px] focus:outline-none focus:border-[#00d66f] placeholder:text-[#CBD5E1]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={saveEligibility}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white text-[13px] font-semibold rounded-xl disabled:opacity-40 hover:bg-[#1e293b] transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Eligibility Rules'}
          </button>
        </div>
      </SectionCard>

      {/* ── Change History ── */}
      <SectionCard
        title="Change History"
        subtitle="Every configuration change is versioned and audited."
        expanded={openSection === 'history'}
        onToggle={() => toggle('history')}
      >
        {history.length === 0 ? (
          <p className="text-[13px] text-[#94A3B8]">No history yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map(item => (
              <div
                key={item.id ?? item.version}
                className={`flex items-start gap-3 p-3 rounded-xl border ${item.is_active ? 'border-[#00d66f] bg-emerald-50' : 'border-[#E8EDF2] bg-white'}`}
              >
                <Clock size={14} className="text-[#64748B] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#0F172A]">v{item.version}</span>
                    {item.is_active && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Active</span>
                    )}
                    <span className="text-[12px] text-[#64748B]">by {item.created_by}</span>
                  </div>
                  {item.change_summary && (
                    <div className="text-[12px] text-[#475569] mt-0.5 truncate">{item.change_summary}</div>
                  )}
                  <div className="text-[11px] text-[#94A3B8] mt-0.5">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
