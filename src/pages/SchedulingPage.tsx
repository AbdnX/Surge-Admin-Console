import { useEffect, useState } from 'react';
import { RefreshCw, Zap, XCircle } from 'lucide-react';
import { api, type ScheduledJob, type PaymentAttempt } from '../lib/api';

const ATTEMPT_COLORS: Record<string, { bg: string; color: string }> = {
  success:  { bg: '#F0FDF4', color: '#16A34A' },
  failed:   { bg: '#FFF1F2', color: '#E11D48' },
  pending:  { bg: '#FFFBEB', color: '#D97706' },
};

function AttemptBadge({ status }: { status: string }) {
  const s = ATTEMPT_COLORS[status] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span style={{ background: s.bg, color: s.color }} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize">
      {status}
    </span>
  );
}

function planIdFromJobId(jobId: string): string {
  // Job IDs are formatted as "debit_{plan_id}_..." or similar
  const parts = jobId.replace(/^debit_/, '').split('_');
  // UUID is 5 parts joined by -
  if (parts.length >= 5) return parts.slice(0, 5).join('-');
  return jobId;
}

// ── Attempt History Drawer ────────────────────────────────────────────────────
function AttemptsDrawer({ planId, onClose }: { planId: string; onClose: () => void }) {
  const [attempts, setAttempts] = useState<PaymentAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.scheduling.attempts(planId);
        setAttempts(res.data ?? []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [planId]);

  return (
    <div className="fixed inset-0 z-[500] flex justify-end">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-[480px] bg-white h-full shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-[#E8ECF0] flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-[#0F172A]">Payment Attempt History</p>
            <code className="text-[11px] text-[#94A3B8]">{planId.slice(0, 24)}…</code>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] transition-colors">
            <XCircle size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-center text-[#94A3B8] text-[13px] mt-8">Loading…</p>
          ) : attempts.length === 0 ? (
            <p className="text-center text-[#94A3B8] text-[13px] mt-8">No payment attempts recorded.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {attempts.map((a, i) => {
                const amount = a.amount ?? (a.json as any)?.amount ?? null;
                const gateway = a.gateway_response ?? (a.json as any)?.gateway_response ?? null;
                return (
                  <div key={a.id ?? i} className={`rounded-xl border p-4 ${a.status === 'success' ? 'border-[#86EFAC] bg-[#F0FDF4]' : a.status === 'failed' ? 'border-[#FECDD3] bg-[#FFF1F2]' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <AttemptBadge status={a.status} />
                      <span className="text-[11px] text-[#64748B]">
                        {a.attempted_at ? new Date(a.attempted_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      </span>
                    </div>
                    {amount != null && (
                      <p className="font-bold text-[14px] text-[#0F172A]">₦{Number(amount).toLocaleString('en-NG')}</p>
                    )}
                    {gateway && (
                      <p className="text-[12px] text-[#64748B] mt-1">{gateway}</p>
                    )}
                    <code className="text-[10px] text-[#94A3B8] mt-1 block">{a.id}</code>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SchedulingPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [drawerPlanId, setDrawerPlanId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.scheduling.jobs();
      setJobs(res.data ?? []);
    } catch {
      notify('Failed to load scheduled jobs', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleCancel = async (jobId: string) => {
    if (!confirm(`Cancel job ${jobId}? This will stop the next scheduled debit for this plan.`)) return;
    setActionId(jobId);
    try {
      await api.scheduling.cancel(jobId);
      notify('Job cancelled — debit will not fire');
      setJobs(prev => prev.filter(j => j.job_id !== jobId));
    } catch {
      notify('Failed to cancel job', false);
    } finally {
      setActionId(null);
    }
  };

  const handleTrigger = async (jobId: string) => {
    if (!confirm(`Manually trigger job ${jobId} now? This will immediately attempt a charge.`)) return;
    setActionId(jobId);
    try {
      const res = await api.scheduling.trigger(jobId);
      if (res.triggered) {
        notify('Job triggered — charge attempt initiated');
        void load();
      } else {
        notify('Trigger sent but job may not have run', false);
      }
    } catch {
      notify('Failed to trigger job', false);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[1000] px-5 py-3 rounded-xl text-white text-[13px] font-semibold shadow-xl max-w-xs ${toast.ok ? 'bg-[#0F172A]' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {drawerPlanId && (
        <AttemptsDrawer planId={drawerPlanId} onClose={() => setDrawerPlanId(null)} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">Scheduling</h1>
          <p className="text-[13px] text-[#64748B]">Active auto-debit jobs — cancel, trigger manually, or inspect payment attempt history.</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="bg-[#F1F5F9] text-[#64748B] px-3 py-1 rounded-full text-[12px] font-bold">
              {jobs.length} active job{jobs.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[#E2E8F0] text-[13px] font-semibold text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[#94A3B8] text-[13px]">Loading scheduled jobs…</div>
        ) : jobs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-bold text-[14px] text-[#0F172A] mb-1">No active jobs</p>
            <p className="text-[#94A3B8] text-[13px]">All scheduled debits have run or been cancelled.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Job ID', 'Plan ID', 'Next Run', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => {
                const planId = planIdFromJobId(job.job_id);
                const nextRun = job.next_run_time ? new Date(job.next_run_time) : null;
                const isOverdue = nextRun && nextRun < new Date();
                const busy = actionId === job.job_id;

                return (
                  <tr key={job.job_id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3.5">
                      <code className="text-[11px] text-[#475569]">{job.job_id}</code>
                    </td>
                    <td className="px-4 py-3.5">
                      <code className="text-[11px] text-[#94A3B8]">{planId.slice(0, 18)}…</code>
                    </td>
                    <td className="px-4 py-3.5">
                      {nextRun ? (
                        <div>
                          <p className={`font-semibold text-[13px] ${isOverdue ? 'text-[#E11D48]' : 'text-[#0F172A]'}`}>
                            {nextRun.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                          {isOverdue && <p className="text-[11px] text-[#E11D48] font-bold">Overdue</p>}
                        </div>
                      ) : (
                        <span className="text-[#94A3B8]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          disabled={busy}
                          onClick={() => void handleTrigger(job.job_id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] text-white rounded-lg text-[12px] font-semibold hover:bg-[#1E293B] transition-colors disabled:opacity-50"
                        >
                          <Zap size={11} />
                          {busy ? 'Working…' : 'Trigger Now'}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => void handleCancel(job.job_id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] rounded-lg text-[12px] font-semibold hover:bg-[#FFE4E6] transition-colors disabled:opacity-50"
                        >
                          <XCircle size={11} />
                          {busy ? 'Working…' : 'Cancel Job'}
                        </button>
                        <button
                          onClick={() => setDrawerPlanId(planId)}
                          className="px-3 py-1.5 bg-[#F1F5F9] text-[#0F172A] rounded-lg text-[12px] font-semibold hover:bg-[#E2E8F0] transition-colors"
                        >
                          History →
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
    </div>
  );
}
