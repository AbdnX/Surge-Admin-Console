import { useEffect, useState } from 'react';
import { RefreshCw, AlertOctagon } from 'lucide-react';
import { api, type WebhookEvent, type WebhookAttempt } from '../lib/api';

const EVENT_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  'payment.success':                { bg: '#F0FDF4', color: '#16A34A' },
  'payment.failed':                 { bg: '#FFF1F2', color: '#E11D48' },
  'payment_plan.installment_paid':  { bg: '#EFF6FF', color: '#3B82F6' },
  'installment.paid':               { bg: '#EFF6FF', color: '#3B82F6' },
  'goods.release':                  { bg: '#F5F3FF', color: '#7C3AED' },
  'debit.scheduled':                { bg: '#FFFBEB', color: '#D97706' },
  'transfer.success':               { bg: '#F0FDF4', color: '#16A34A' },
};

function EventTypeBadge({ type }: { type: string }) {
  const s = EVENT_TYPE_COLORS[type] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span style={{ background: s.bg, color: s.color }} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold">
      {type}
    </span>
  );
}

function DeliveryBadge({ delivered }: { delivered?: boolean }) {
  if (delivered === true) return (
    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F0FDF4] text-[#16A34A]">Delivered</span>
  );
  if (delivered === false) return (
    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF1F2] text-[#E11D48]">Failed</span>
  );
  return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F1F5F9] text-[#64748B]">Unknown</span>;
}

// ── Events Tab ────────────────────────────────────────────────────────────────
function EventsTab({ onReplay, notify }: {
  onReplay: (id: string) => Promise<void>;
  notify: (msg: string, ok?: boolean) => void;
}) {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const LIMIT = 50;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.webhooks.events(page, LIMIT);
      setEvents(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {
      notify('Failed to load webhook events', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page]);

  const handleReplay = async (id: string) => {
    setReplayingId(id);
    try {
      await onReplay(id);
    } finally {
      setReplayingId(null);
      void load();
    }
  };

  const filtered = typeFilter
    ? events.filter(e => e.event_type === typeFilter)
    : events;

  const eventTypes = Array.from(new Set(events.map(e => e.event_type))).sort();
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] bg-white outline-none w-[240px]"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">All Event Types</option>
          {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[#E2E8F0] text-[13px] font-semibold text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden mb-4">
        {loading ? (
          <div className="py-16 text-center text-[#94A3B8] text-[13px]">Loading events…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[#94A3B8] text-[13px]">No webhook events found.</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Event ID', 'Merchant', 'Type', 'Status', 'Latency', 'Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(ev => (
                <tr key={ev.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3.5">
                    <code className="text-[11px] text-[#475569]">{ev.id.slice(0, 16)}…</code>
                  </td>
                  <td className="px-4 py-3.5">
                    <code className="text-[11px] text-[#94A3B8]">{ev.merchant_id?.slice(0, 10)}…</code>
                  </td>
                  <td className="px-4 py-3.5"><EventTypeBadge type={ev.event_type} /></td>
                  <td className="px-4 py-3.5"><DeliveryBadge delivered={ev.delivered} /></td>
                  <td className="px-4 py-3.5 text-[#64748B] text-[12px]">
                    {ev.latency_ms != null ? `${ev.latency_ms}ms` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-[#64748B] text-[12px]">
                    {ev.created_at ? new Date(ev.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      disabled={replayingId === ev.id}
                      onClick={() => void handleReplay(ev.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F1F5F9] text-[#0F172A] rounded-lg text-[12px] font-semibold hover:bg-[#E2E8F0] transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={11} />
                      {replayingId === ev.id ? 'Replaying…' : 'Replay'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-[#64748B]">Page {page} of {totalPages} — {total} total events</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] font-semibold disabled:opacity-40 hover:bg-[#F1F5F9] transition-colors">
              ← Prev
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] font-semibold disabled:opacity-40 hover:bg-[#F1F5F9] transition-colors">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dead Letter Tab ───────────────────────────────────────────────────────────
function DeadLetterTab({ onReplay, notify }: {
  onReplay: (id: string) => Promise<void>;
  notify: (msg: string, ok?: boolean) => void;
}) {
  const [attempts, setAttempts] = useState<WebhookAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.webhooks.failedAttempts();
      setAttempts(res.data ?? []);
    } catch {
      notify('Failed to load dead-letter queue', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleReplay = async (attempt: WebhookAttempt) => {
    const id = attempt.webhook_event_id ?? attempt.id;
    setReplayingId(attempt.id);
    try {
      await onReplay(id);
      notify('Replay triggered successfully');
    } finally {
      setReplayingId(null);
      void load();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
          <AlertOctagon size={14} color="#E11D48" />
          <span>These events permanently failed delivery after all retry attempts.</span>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[#E2E8F0] text-[13px] font-semibold text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[#94A3B8] text-[13px]">Loading…</div>
        ) : attempts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[#16A34A] font-bold text-[14px] mb-1">All clear</p>
            <p className="text-[#94A3B8] text-[13px]">No permanently failed webhook deliveries.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#FFF1F2] border-b border-[#FECDD3]">
                {['Attempt ID', 'Merchant', 'Event Type', 'Error', 'Attempts', 'Last Tried', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#E11D48]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attempts.map(a => (
                <tr key={a.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#FFF8F8] transition-colors">
                  <td className="px-4 py-3.5">
                    <code className="text-[11px] text-[#475569]">{a.id.slice(0, 16)}…</code>
                  </td>
                  <td className="px-4 py-3.5">
                    <code className="text-[11px] text-[#94A3B8]">{a.merchant_id?.slice(0, 10)}…</code>
                  </td>
                  <td className="px-4 py-3.5">
                    {a.event_type ? <EventTypeBadge type={a.event_type} /> : '—'}
                  </td>
                  <td className="px-4 py-3.5 max-w-[200px]">
                    <p className="text-[11px] text-[#E11D48] truncate">{a.error_message ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3.5 font-bold text-[#0F172A]">
                    {a.attempt_count ?? '—'}
                  </td>
                  <td className="px-4 py-3.5 text-[#64748B] text-[12px]">
                    {a.last_attempted_at ? new Date(a.last_attempted_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      disabled={replayingId === a.id}
                      onClick={() => void handleReplay(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] rounded-lg text-[12px] font-semibold hover:bg-[#FFE4E6] transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={11} />
                      {replayingId === a.id ? 'Replaying…' : 'Replay'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WebhooksPage() {
  const [activeTab, setActiveTab] = useState<'events' | 'deadletter'>('events');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const handleReplay = async (eventId: string) => {
    try {
      const res = await api.webhooks.replay(eventId);
      if (res.ok && res.delivered) {
        notify('Event replayed and delivered successfully');
      } else {
        notify('Replay triggered but delivery failed — check merchant endpoint', false);
      }
    } catch {
      notify('Failed to trigger replay', false);
    }
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[1000] px-5 py-3 rounded-xl text-white text-[13px] font-semibold shadow-xl max-w-xs ${toast.ok ? 'bg-[#0F172A]' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight mb-1">Webhook Monitor</h1>
          <p className="text-[13px] text-[#64748B]">Outbound events from Surge to merchants — view delivery status and replay failures.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-[#E8ECF0]">
        {([
          { id: 'events', label: 'All Events' },
          { id: 'deadletter', label: 'Dead Letter Queue' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-5 py-2.5 text-[13px] font-bold border-b-2 transition-all -mb-px ${
              activeTab === t.id
                ? 'text-[#0F172A] border-[#0F172A]'
                : 'text-[#94A3B8] border-transparent hover:text-[#64748B]'
            }`}
          >
            {t.label}
            {t.id === 'deadletter' && (
              <span className="ml-2 text-[10px] font-bold bg-[#FFF1F2] text-[#E11D48] px-1.5 py-0.5 rounded-full">DLQ</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'events' && <EventsTab onReplay={handleReplay} notify={notify} />}
      {activeTab === 'deadletter' && <DeadLetterTab onReplay={handleReplay} notify={notify} />}
    </div>
  );
}
