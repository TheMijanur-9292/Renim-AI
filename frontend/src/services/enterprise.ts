export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  plan: string;
  my_role: string;
  member_count: number;
  created_at?: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_email: string;
  full_name: string;
  role: string;
  status: string;
  invited_by: string;
  created_at?: string;
}

export interface SaasPlan {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  ai_credits_limit: number;
  storage_mb_limit: number;
  seats_limit: number;
  features: string[];
}

export interface SubscriptionStatus {
  plan_id: string;
  status: string;
  ai_credits_limit: number;
  ai_credits_used: number;
  storage_mb_limit: number;
  seats_limit: number;
  billing_cycle: string;
  amount_usd: number;
}

export interface RagHit {
  source_type: 'document' | 'note' | 'meeting' | 'task';
  source_id: string;
  title: string;
  score: number;
  snippet: string;
  created_at: string;
}

export interface IntegrationConfig {
  id?: string;
  provider: string;
  webhook_url: string;
  channel_or_project: string;
  is_enabled: boolean;
  events: string[];
  updated_at?: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  secret_key?: string;
  last_used_at?: string;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  user_email: string;
  org_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  ip_address: string;
  created_at: string;
}

export function getStoredJwtToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const rawSession = localStorage.getItem('sb_session');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed?.access_token && parsed.access_token !== 'neon-session-token') {
        return String(parsed.access_token);
      }
    }
  } catch {}
  return localStorage.getItem('renim_jwt_token') || localStorage.getItem('renim_access_token');
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredJwtToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function apiJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { ...getHeaders(), ...(opts?.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

// --- Organizations & RBAC ---
export const fetchOrganizations = (userEmail: string) =>
  apiJson<{ organizations: Organization[]; active_email: string }>(
    `/api/orgs?user_email=${encodeURIComponent(userEmail)}`
  );

export const createOrganization = (name: string, plan: string, userEmail: string) =>
  apiJson<{ organization: Organization }>('/api/orgs', {
    method: 'POST',
    body: JSON.stringify({ name, plan, user_email: userEmail })
  });

export const fetchOrgMembers = (orgId: string, userEmail: string) =>
  apiJson<{ members: OrgMember[]; my_role: string }>(
    `/api/orgs/${encodeURIComponent(orgId)}/members?user_email=${encodeURIComponent(userEmail)}`
  );

export const inviteOrgMember = (
  orgId: string,
  inviteEmail: string,
  fullName: string,
  role: string,
  userEmail: string
) =>
  apiJson<{ member: OrgMember }>(`/api/orgs/${encodeURIComponent(orgId)}/invite`, {
    method: 'POST',
    body: JSON.stringify({
      invite_email: inviteEmail,
      full_name: fullName,
      role,
      user_email: userEmail
    })
  });

export const updateOrgMemberRole = (
  orgId: string,
  memberEmail: string,
  role: string,
  userEmail: string
) =>
  apiJson<{ member: OrgMember }>(
    `/api/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberEmail)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role, user_email: userEmail })
    }
  );

export const removeOrgMember = (orgId: string, memberEmail: string, userEmail: string) =>
  apiJson<{ status: string }>(
    `/api/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberEmail)}?user_email=${encodeURIComponent(userEmail)}`,
    { method: 'DELETE' }
  );

// --- Billing & Usage Metering ---
export const fetchBillingPlans = () => apiJson<{ plans: SaasPlan[] }>('/api/billing/plans');

export const fetchBillingStatus = (userEmail: string, orgId = 'personal') =>
  apiJson<{
    subscription: SubscriptionStatus;
    usage_breakdown: Array<{ feature: string; credits: number; tokens: number; calls: number }>;
  }>(`/api/billing/status?user_email=${encodeURIComponent(userEmail)}&org_id=${encodeURIComponent(orgId)}`);

export const upgradeBillingPlan = async (
  planId: string,
  billingCycle: 'monthly' | 'yearly',
  userEmail: string,
  orgId = 'personal'
) => {
  const res = await apiJson<{
    mode?: string;
    checkout_url?: string;
    subscription?: SubscriptionStatus;
    message?: string;
  }>('/api/billing/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle, user_email: userEmail, org_id: orgId })
  });
  if (res.checkout_url && typeof window !== 'undefined') {
    window.location.href = res.checkout_url;
  }
  return res as { subscription: SubscriptionStatus; message: string };
};

export const fetchInvoices = (userEmail: string) =>
  apiJson<{ invoices: Array<{ invoice_id: string; date: string; amount_usd: number; cycle: string; status: string }> }>(
    `/api/billing/invoices?user_email=${encodeURIComponent(userEmail)}`
  );

// --- Enterprise RAG ---
export const ragSearchWorkspace = (query: string, userEmail: string) =>
  apiJson<{ hits: RagHit[]; total: number }>('/api/rag/search', {
    method: 'POST',
    body: JSON.stringify({ query, user_email: userEmail, top_k: 8 })
  });

export const ragAskWorkspace = (
  query: string,
  userEmail: string,
  aiConfig?: { api_key?: string; model?: string; base_url?: string }
) =>
  apiJson<{ answer: string; citations: RagHit[] }>('/api/rag/ask', {
    method: 'POST',
    body: JSON.stringify({ query, user_email: userEmail, top_k: 8, ...(aiConfig || {}) })
  });

// --- Integrations & API Keys ---
export const fetchIntegrations = (userEmail: string) =>
  apiJson<{ integrations: IntegrationConfig[] }>(
    `/api/integrations?user_email=${encodeURIComponent(userEmail)}`
  );

export const saveIntegrationConfig = (cfg: IntegrationConfig & { user_email: string }) =>
  apiJson<{ integration: IntegrationConfig }>('/api/integrations/save', {
    method: 'POST',
    body: JSON.stringify(cfg)
  });

export const testIntegrationWebhook = (provider: string, webhookUrl: string, userEmail: string) =>
  apiJson<{ delivered: boolean; status_code: number }>('/api/integrations/test-webhook', {
    method: 'POST',
    body: JSON.stringify({ provider, webhook_url: webhookUrl, user_email: userEmail })
  });

export const fetchApiKeys = (userEmail: string) =>
  apiJson<{ api_keys: ApiKeyItem[] }>(`/api/api-keys?user_email=${encodeURIComponent(userEmail)}`);

export const createApiKey = (name: string, userEmail: string) =>
  apiJson<{ api_key: ApiKeyItem }>('/api/api-keys', {
    method: 'POST',
    body: JSON.stringify({ name, user_email: userEmail })
  });

export const revokeApiKey = (keyId: string, userEmail: string) =>
  apiJson<{ status: string }>(`/api/api-keys/${encodeURIComponent(keyId)}?user_email=${encodeURIComponent(userEmail)}`, {
    method: 'DELETE'
  });

// --- Analytics & BI ---
export const fetchAnalyticsOverview = (userEmail: string) =>
  apiJson<{
    kpis: {
      completion_rate: number;
      ai_hours_saved: number;
      meetings_count: number;
      notes_count: number;
      docs_count: number;
      docs_storage_mb: number;
      total_ai_calls: number;
    };
    task_breakdown: {
      tasks_done: number;
      tasks_in_progress: number;
      tasks_todo: number;
      urgent_open: number;
      tasks_total: number;
    };
    ai_usage: Array<{ feature: string; credits: number; calls: number }>;
    recent_activity: Array<{ action: string; resource_type: string; created_at: string }>;
  }>(`/api/analytics/overview?user_email=${encodeURIComponent(userEmail)}`);

// --- Audit Logs ---
export const fetchAuditLogs = (userEmail: string, actionFilter = '') =>
  apiJson<{ logs: AuditLogItem[] }>(
    `/api/audit/logs?user_email=${encodeURIComponent(userEmail)}&action_filter=${encodeURIComponent(actionFilter)}`
  );

export interface SecuritySettings {
  org_id: string;
  sso_domain: string;
  mfa_enforced: boolean;
  retention_days: number;
}

export const fetchSecuritySettings = (userEmail: string, orgId = 'personal') =>
  apiJson<{ settings: SecuritySettings }>(
    `/api/audit/settings?user_email=${encodeURIComponent(userEmail)}&org_id=${encodeURIComponent(orgId)}`
  );

export const saveSecuritySettings = (payload: SecuritySettings & { user_email: string }) =>
  apiJson<{ settings: SecuritySettings }>('/api/audit/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
