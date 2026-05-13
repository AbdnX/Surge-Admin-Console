const BASE = `${import.meta.env.VITE_API_URL ?? 'https://api.gosurge.xyz'}/api/v1`;

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = sessionStorage.getItem('flex_admin_token');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    sessionStorage.removeItem('flex_admin_token');
    sessionStorage.removeItem('flex_admin_authed');
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface Merchant {
  id: string;
  legal_name: string;
  display_name: string;
  business_type: string;
  country: string;
  onboarding_status: string;
  operating_status: string;
  approval_status: string;
  flex_settings: Record<string, unknown> | null;
  created_at: string;
  api_key_enabled: boolean;
  fee_group_id: string | null;
}

export interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  verification_status: string;
  account_status: string;
  surge_score: number | null;
  role: string;
  created_at: string;
  json?: any;
}

export interface Transaction {
  id: string;
  merchant_id: string;
  customer_id: string;
  status: string;
  created_at: string;
  // JSON blob fields (flattened)
  merchantId?: string;
  customerId?: string;
  title?: string;
  scheduleType?: string;
  installmentCount?: number;
  principalAmount?: { amount: number; currency: string };
  depositAmount?: { amount: number; currency: string };
  amountPaid?: { amount: number; currency: string };
  amountOutstanding?: { amount: number; currency: string };
  totalAmountDue?: { amount: number; currency: string };
  installments?: Array<{
    id: string;
    sequenceNumber: number;
    status: string;
    dueDate: string;
    amountDue: { amount: number; currency: string };
    amountPaid: { amount: number; currency: string };
  }>;
  orderReference?: string;
  orderId?: string;
  flexScoreAtCreation?: number | null;
  createdAt?: string;
}

export interface ScheduledJob {
  job_id: string;
  next_run_time: string | null;
  args: unknown[];
}

export interface PaymentAttempt {
  id: string;
  transaction_id: string;
  amount?: number;
  currency?: string;
  status: string;
  gateway_response?: string;
  attempted_at: string;
  json?: Record<string, unknown>;
}

export interface SettlementEntry {
  id: string;
  merchant_id: string;
  amount: number;
  currency?: string;
  type?: string;
  created_at: string;
  json?: Record<string, unknown>;
}

export interface ScoreSnapshot {
  score: number;
  tier: string;
  onboarding_completed: boolean;
  factors?: Record<string, unknown>;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  customer_id: string;
  type: string;           // 'card' | 'bank_account'
  is_default: boolean;
  is_active: boolean;
  last_four?: string;
  bank_name?: string;
  account_name?: string;
  card_type?: string;
  expiry_month?: string;
  expiry_year?: string;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  merchant_id: string;
  event_type: string;
  status?: string;
  delivered?: boolean;
  latency_ms?: number;
  created_at: string;
  data?: Record<string, unknown>;
}

export interface WebhookAttempt {
  id: string;
  merchant_id: string;
  webhook_event_id?: string;
  event_type?: string;
  status: string;
  error_message?: string;
  last_attempted_at: string;
  attempt_count?: number;
}

export interface DelinquencyCase {
  id: string;
  payment_plan_id: string;
  customer_id: string;
  merchant_id: string;
  status: string;
  reason_code: string;
  opened_at: string;
  next_retry_at?: string;
}

// ---------------------------------------------------------------------------
// Fee configuration types
// ---------------------------------------------------------------------------

export type FeeScope = 'global' | 'group' | 'merchant';
export type FeeType  = 'percentage' | 'flat' | 'mixed';

export interface FeeGroup {
  id:          string;
  name:        string;
  description: string | null;
  created_at:  string;
  updated_at:  string;
}

export interface FeeConfig {
  id:              string;
  name:            string;
  scope:           FeeScope;
  merchant_id:     string | null;
  group_id:        string | null;
  fee_type:        FeeType;
  percentage_rate: number | null;
  flat_amount:     number | null;
  min_fee:         number | null;
  max_fee:         number | null;
  is_active:       boolean;
  effective_from:  string | null;
  effective_until: string | null;
  created_at:      string;
  updated_at:      string;
}

export interface FeeCalculationResult {
  merchant_id:        string | null;
  resolved_config_id: string;
  resolved_scope:     FeeScope;
  config_name:        string;
  gross_amount:       number;
  fee_amount:         number;
  merchant_payable:   number;
  currency:           string;
  effective_rate_pct: number;
}

export const api = {
  merchants: {
    list: (status?: string) =>
      req<{ data: Merchant[]; total: number }>('GET', `/identity/merchants${status ? `?onboarding_status=${status}` : ''}`),
    getDetail: (id: string) =>
      req<{ ok: boolean; data: Merchant }>('GET', `/admin/merchants/${id}`),
    onboard: (data: {
      legal_name: string; display_name: string; business_type: string;
      country: string; email: string; phone: string; password: string;
    }) => req<{ merchant: Merchant; credentials: { email: string; user_id: string; merchant_id: string } }>(
      'POST', '/identity/merchants/onboard', data
    ),
    approve: (id: string) =>
      req<Merchant>('POST', `/identity/merchants/${id}/approve`, {}),
    reject: (id: string) =>
      req<Merchant>('POST', `/identity/merchants/${id}/reject`),

    // New Admin API Endpoints
    listPending: () =>
      req<Merchant[]>('GET', '/admin/merchants/pending'),
    updateStatus: (id: string, status: 'approved' | 'rejected') =>
      req<{ ok: boolean; data: { merchantId: string; status: string } }>('PUT', `/admin/merchants/${id}/status`, { status }),
    updateTier: (id: string, min_accepted_tier: string) =>
      req<any>('PUT', `/admin/merchants/${id}/tier`, { min_accepted_tier }),
    enableApiAccess: (merchantId: string) =>
      req<{ ok: boolean; data: { merchantId: string; apiKeyEnabled: boolean } }>('PUT', `/admin/merchants/${merchantId}/enable-api-access`),
    disableApiAccess: (merchantId: string) =>
      req<{ ok: boolean; data: { merchantId: string; apiKeyEnabled: boolean } }>('PUT', `/admin/merchants/${merchantId}/disable-api-access`),
    rotateApiKey: (merchantId: string, name = 'Support Rotation') =>
      req<{ ok: boolean; data: { merchantId: string; apiKey: string; apiKeyPrefix: string; apiKeyName: string } }>('POST', `/merchant/${merchantId}/rotate-api-key`, { name }),
  },
  customers: {
    restrict: (id: string) =>
      req<{ id: string; account_status: string }>('POST', `/identity/customers/${id}/restrict`),
    
    // New Admin API Endpoints
    list: (search?: string, onboardingCompleted?: boolean) => {
      let url = '/admin/customers';
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (onboardingCompleted !== undefined) params.append('onboarding_completed', onboardingCompleted.toString());
      if (params.toString()) url += `?${params.toString()}`;
      return req<{ data: Customer[]; total: number }>('GET', url);
    },
    getDetail: (id: string) =>
      req<{ ok: boolean; data: Customer }>('GET', `/admin/customers/${id}`),
    suspend: (id: string) =>
      req<{ ok: boolean; data: any }>('PUT', `/admin/customers/${id}/suspend`),
    approveVerification: (id: string) =>
      req<{ ok: boolean; data: any }>('PUT', `/admin/customers/${id}/approve-verification`),
    rejectVerification: (id: string) =>
      req<{ ok: boolean; data: any }>('PUT', `/admin/customers/${id}/reject-verification`),
  },
  risk: {
    score: (customerId: string) =>
      req<{ ok: boolean; data: { score: number; tier: string; onboarding_completed: boolean; factors?: Record<string, unknown> } }>('GET', `/risk/score/${customerId}`),
    history: (customerId: string, limit = 12) =>
      req<{ ok: boolean; data: { customer_id: string; data: ScoreSnapshot[] } }>('GET', `/risk/score/${customerId}/history?limit=${limit}`),
    refresh: (customerId: string) =>
      req<{ ok: boolean; data: { score: number; tier: string } }>('POST', `/risk/score/${customerId}/refresh`),
  },
  paymentMethods: {
    list: (customerId: string) =>
      req<{ ok: boolean; data: PaymentMethod[]; total: number }>('GET', `/payment-methods/customers/${customerId}`),
  },
  customerTransactions: {
    list: (userId: string) =>
      req<{ ok: boolean; data: Transaction[] }>('GET', `/transactions/user/${userId}`),
  },
  merchantDetail: {
    wallet: (merchantId: string) =>
      req<{ available_balance: number; pending_balance: number; currency: string; total_earned?: number }>('GET', `/merchant/${merchantId}/wallet`),
    transactions: (merchantId: string) =>
      req<{ ok: boolean; data: Transaction[] }>('GET', `/transactions/merchant/${merchantId}`),
    settlement: (merchantId: string) =>
      req<{ data: Array<{ id: string; merchant_id: string; amount: number; currency: string; type: string; created_at: string; json?: any }>; total: number }>('GET', `/settlement/entries?merchant_id=${merchantId}`),
  },
  transactions: {
    list: (page = 1, limit = 50, status?: string) => {
      let url = `/transactions/?page=${page}&limit=${limit}`;
      if (status) url += `&tx_status=${status}`;
      return req<{ ok: boolean; data: { data: Transaction[]; total: number; page: number; limit: number } }>('GET', url);
    },
    get: (id: string) =>
      req<{ ok: boolean; data: Transaction }>('GET', `/transactions/${id}`),
  },
  delinquency: {
    cases: () =>
      req<{ data: DelinquencyCase[]; total: number }>('GET', '/delinquency/cases'),
    sweep: (asOf: string) =>
      req<unknown>('POST', `/delinquency/sweep?as_of_date=${asOf}`),
  },
  scheduling: {
    jobs: (planId?: string) => {
      const url = planId ? `/scheduling/jobs?plan_id=${planId}` : '/scheduling/jobs';
      return req<{ data: ScheduledJob[]; total: number }>('GET', url);
    },
    cancel: (jobId: string) =>
      fetch(`${BASE}/scheduling/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('flex_admin_token') ?? ''}` },
      }).then(r => { if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`); }),
    trigger: (jobId: string) =>
      req<{ job_id: string; triggered: boolean }>('POST', `/scheduling/jobs/${jobId}/trigger`),
    attempts: (planId: string) =>
      req<{ transaction_id: string; data: PaymentAttempt[]; total: number }>('GET', `/payments/attempts/${planId}`),
  },
  settlement: {
    list: (merchantId?: string) => {
      const url = merchantId ? `/settlement/entries?merchant_id=${merchantId}` : '/settlement/entries';
      return req<{ data: SettlementEntry[]; total: number }>('GET', url);
    },
  },
  webhooks: {
    events: (page = 1, limit = 50) =>
      req<{ data: WebhookEvent[]; page: number; limit: number; total: number }>('GET', `/webhooks/events?page=${page}&limit=${limit}`),
    failedAttempts: (limit = 100) =>
      req<{ ok: boolean; data: WebhookAttempt[] }>('GET', `/webhooks/failed-attempts?limit=${limit}`),
    replay: (eventId: string) =>
      req<{ ok: boolean; delivered: boolean }>('POST', `/webhooks/events/${eventId}/replay`),
  },
  auth: {
    login: (password: string) =>
      req<{ ok: boolean; data: { token: string; userId: string } }>('POST', '/auth/login', {
        email: 'admin@flex.com',
        password
      })
  },
  feeGroups: {
    list: () =>
      req<{ data: FeeGroup[]; total: number }>('GET', '/admin/fee-groups'),
    get: (groupId: string) =>
      req<{ ok: boolean; data: FeeGroup }>('GET', `/admin/fee-groups/${groupId}`),
    create: (data: { name: string; description?: string }) =>
      req<{ ok: boolean; data: FeeGroup }>('POST', '/admin/fee-groups', data),
    update: (groupId: string, data: { name?: string; description?: string }) =>
      req<{ ok: boolean; data: FeeGroup }>('PUT', `/admin/fee-groups/${groupId}`, data),
    delete: (groupId: string) =>
      fetch(`${BASE}/admin/fee-groups/${groupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('flex_admin_token') ?? ''}` },
      }).then(r => { if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`); }),
  },
  feeConfigs: {
    list: (params?: { scope?: FeeScope; merchant_id?: string; group_id?: string }) => {
      const qs = new URLSearchParams();
      if (params?.scope)       qs.append('scope', params.scope);
      if (params?.merchant_id) qs.append('merchant_id', params.merchant_id);
      if (params?.group_id)    qs.append('group_id', params.group_id);
      const url = `/admin/fee-configs${qs.toString() ? `?${qs}` : ''}`;
      return req<{ data: FeeConfig[]; total: number }>('GET', url);
    },
    get: (configId: string) =>
      req<{ ok: boolean; data: FeeConfig }>('GET', `/admin/fee-configs/${configId}`),
    create: (data: Partial<FeeConfig> & { name: string; scope: FeeScope; fee_type: FeeType }) =>
      req<{ ok: boolean; data: FeeConfig }>('POST', '/admin/fee-configs', data),
    update: (configId: string, data: Partial<FeeConfig>) =>
      req<{ ok: boolean; data: FeeConfig }>('PUT', `/admin/fee-configs/${configId}`, data),
    delete: (configId: string) =>
      fetch(`${BASE}/admin/fee-configs/${configId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('flex_admin_token') ?? ''}` },
      }).then(r => { if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`); }),
    resolve: (merchantId: string) =>
      req<{ ok: boolean; data: FeeConfig }>('GET', `/admin/fee-configs/resolve/${merchantId}`),
    preview: (amount: number, merchantId?: string, currency = 'NGN') =>
      req<{ ok: boolean; data: FeeCalculationResult }>('POST', '/admin/fee-configs/preview', {
        amount, merchant_id: merchantId ?? null, currency,
      }),
    assignMerchantGroup: (merchantId: string, groupId: string | null) =>
      req<{ ok: boolean; data: { merchant_id: string; fee_group_id: string | null } }>(
        'PUT', `/admin/merchants/${merchantId}/fee-group`, { group_id: groupId }
      ),
  },
};
