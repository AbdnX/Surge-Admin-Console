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

export const api = {
  merchants: {
    list: (status?: string) =>
      req<{ data: Merchant[]; total: number }>('GET', `/identity/merchants${status ? `?onboarding_status=${status}` : ''}`),
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
      req<any>('PUT', `/admin/merchants/${id}/status`, { status }),
    updateTier: (id: string, min_accepted_tier: string) =>
      req<any>('PUT', `/admin/merchants/${id}/tier`, { min_accepted_tier }),
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
  },
  delinquency: {
    cases: () =>
      req<{ data: DelinquencyCase[]; total: number }>('GET', '/delinquency/cases'),
    sweep: (asOf: string) =>
      req<unknown>('POST', `/delinquency/sweep?as_of_date=${asOf}`),
  },
  auth: {
    login: (password: string) => 
      req<{ ok: boolean; data: { token: string; userId: string } }>('POST', '/auth/login', { 
        email: 'admin@flex.com', 
        password 
      })
  }
};
