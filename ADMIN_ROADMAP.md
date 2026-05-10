# Admin Console Roadmap

Feature backlog for expanding admin visibility and control across the Surge platform.
Work through these in order — check off each feature as it ships.

---

## Completed

- [x] **Merchants** — list, approve/reject, set minimum tier
- [x] **Customers** — list, view detail, suspend, approve/reject BVN/NIN verification
- [x] **Delinquency** — list cases, run sweep
- [x] **Transactions** — list all payment plans, filter by status, view installment schedule detail
- [x] **Platform Overview Dashboard** — stat cards (transactions, customers, delinquency, pending merchants), alert strip, recent transactions table, click-through nav to each section
- [x] **Merchant Detail Page** — wallet balance (available/pending/lifetime), payment plans table, settlement entries, business info, Surge settings, tier gate, approve/reject
- [x] **Webhook Event Monitor** — all events table with type/status/latency, event type filter, replay button per event; Dead Letter Queue tab showing permanently failed attempts with replay
- [x] **Customer Detail — Risk & Payments** — Surge Score history table, Force Refresh button, linked payment methods (card/bank with active/default status), full transaction history
- [x] **Scheduling & Auto-Debit Control** — active jobs table, Trigger Now, Cancel Job, slide-out drawer with full payment attempt history per plan
- [x] **Settlement Ledger** — all entries with type badges (merchant payout vs platform fee), summary stats cards, search + merchant ID filter

---

## In Progress / Up Next

## All features complete ✅

The original roadmap is fully shipped. Future enhancements to consider:
- Bulk actions (bulk suspend customers, bulk approve merchants)
- Export to CSV (transactions, settlement entries)
- Date range filtering on settlement and transactions
- Real-time alerts (websocket or polling for new delinquency cases)
**Goal:** Full visibility into outbound webhook delivery so admins can debug failed orders.

- [ ] List all outbound events with status (delivered/failed), latency, merchant (`GET /api/v1/webhooks/events`)
- [ ] Dead-letter queue — events that never delivered (`GET /api/v1/webhooks/failed-attempts`)
- [ ] Replay button per event (`POST /api/v1/webhooks/events/{id}/replay`)
- [ ] Filter by merchant, event type, date range

---

### 4. Customer Detail — Risk & Payment Methods
**Goal:** Extend the existing customer detail page with financial and risk data.

- [ ] Surge Score with full score history (`GET /api/v1/risk/history/{customer_id}`)
- [ ] Force score recalculation button (`POST /api/v1/risk/score/{customer_id}/refresh`)
- [ ] All linked payment methods — card/bank, active/revoked (`GET /api/v1/payment-methods/customers/{id}`)
- [ ] Full transaction history for the customer (`GET /api/v1/transactions/user/{id}`)

---

### 5. Scheduling & Auto-Debit Control
**Goal:** Give admins visibility and control over the automated payment engine.

- [ ] List all scheduled debit jobs (`GET /api/v1/scheduling/jobs`)
- [ ] Cancel a job before it fires (`POST /api/v1/scheduling/cancel/{plan_id}`)
- [ ] View retry history for a failed debit (`GET /api/v1/payments/attempts/{tx_id}`)
- [ ] Manually trigger a charge for a specific plan (`POST /api/v1/payments/charge`)

---

### 6. Settlement Ledger
**Goal:** Full view of merchant settlements and transfer statuses.

- [ ] List all settlement entries (`GET /api/v1/settlement/entries`)
- [ ] Filter by merchant, date range
- [ ] Show transfer status (pending / confirmed / failed)

---

## Notes

- All new pages follow the existing pattern: `src/pages/XPage.tsx` + wired into `App.tsx` nav
- API client lives in `src/lib/api.ts` — add interfaces and methods there first
- Admin JWT is stored in `sessionStorage` as `flex_admin_token`
