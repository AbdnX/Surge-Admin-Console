const BASE = 'http://localhost:8000/api/v1';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
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
  flex_settings: Record<string, unknown> | null;
  created_at: string;
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
  },
  customers: {
    restrict: (id: string) =>
      req<{ id: string; account_status: string }>('POST', `/identity/customers/${id}/restrict`),
  },
  delinquency: {
    cases: () =>
      req<{ data: DelinquencyCase[]; total: number }>('GET', '/delinquency/cases'),
    sweep: (asOf: string) =>
      req<unknown>('POST', `/delinquency/sweep?as_of_date=${asOf}`),
  },
};
