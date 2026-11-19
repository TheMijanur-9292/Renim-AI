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
  try {
    const orgId = sessionStorage.getItem('renim_active_org_id');
    if (orgId && orgId !== 'personal') headers['X-Org-Id'] = orgId;
  } catch {}
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
  org_id?: string;
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

// --- External calendar sync (Google / Microsoft, read-only) ---
export type CalendarProviderId = 'google' | 'microsoft';

export interface CalendarProviderStatus {
  provider: CalendarProviderId;
  configured: boolean;
  connected: boolean;
  account_email: string;
  connected_at: string | null;
  last_synced_at: string | null;
}

export interface ExternalCalendarEvent {
  provider: CalendarProviderId;
  external_id: string;
  title: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  html_link: string;
}

export const fetchCalendarProviders = () =>
  apiJson<{ providers: CalendarProviderStatus[] }>('/api/calendar-sync/providers');

export const getCalendarConnectUrl = (provider: CalendarProviderId) =>
  apiJson<{ authorization_url: string }>(`/api/calendar-sync/${provider}/connect`);

export const syncCalendarProvider = (provider: CalendarProviderId) =>
  apiJson<{ provider: string; synced: number; last_synced_at: string }>(`/api/calendar-sync/${provider}/sync`, { method: 'POST' });

export const disconnectCalendarProvider = (provider: CalendarProviderId) =>
  apiJson<{ disconnected: boolean }>(`/api/calendar-sync/${provider}`, { method: 'DELETE' });

export const fetchExternalCalendarEvents = (from?: string, to?: string) => {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const q = qs.toString();
  return apiJson<{ events: ExternalCalendarEvent[] }>(`/api/calendar-sync/events${q ? `?${q}` : ''}`);
};

let calendarOAuthResult: { connected?: string; error?: string } | null = null;

/** Reads and strips ?calendar_connected / ?calendar_error from the URL. The result is cached so every view can show it. */
export function consumeCalendarOAuthResult(): { connected?: string; error?: string } | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const connected = url.searchParams.get('calendar_connected') || undefined;
  const error = url.searchParams.get('calendar_error') || undefined;
  if (!connected && !error) return calendarOAuthResult;
  calendarOAuthResult = { connected, error };
  url.searchParams.delete('calendar_connected');
  url.searchParams.delete('calendar_error');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  return calendarOAuthResult;
}

export function describeCalendarOAuthResult(r: { connected?: string; error?: string } | null): { severity: 'success' | 'error'; message: string } | null {
  if (!r) return null;
  if (r.connected) {
    const label = CALENDAR_PROVIDER_LABELS[r.connected as CalendarProviderId] || 'Calendar';
    return { severity: 'success', message: `${label} connected. Your events will appear on the calendar after syncing.` };
  }
  return { severity: 'error', message: CALENDAR_ERROR_MESSAGES[r.error || ''] || 'Could not connect the calendar.' };
}

export const CALENDAR_PROVIDER_LABELS: Record<CalendarProviderId, string> = {
  google: 'Google Calendar',
  microsoft: 'Outlook Calendar',
};

export const CALENDAR_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Calendar access was declined.',
  invalid_state: 'The connection link expired. Please try again.',
  exchange_failed: 'Could not finish connecting the calendar. Please try again.',
  not_configured: 'This calendar provider is not configured yet.',
  missing_code: 'The calendar provider did not return an authorization code.',
  provider_error: 'The calendar provider reported an error.',
};

// --- Smart search status, notes import, note version checks ---

export interface RagStatus {
  semantic_enabled: boolean;
  storage: 'vector' | 'array' | 'none';
  model: string | null;
  indexed_chunks: number;
}

export const fetchRagStatus = () => apiJson<RagStatus>('/api/rag/status');

export const rebuildRagIndex = () =>
  apiJson<{ started: boolean; reason?: string }>('/api/rag/reindex', { method: 'POST', body: '{}' });

export interface NotesImportResult {
  imported: number;
  skipped: number;
  notes: any[];
}

/** Uploads an export file (.md, .txt, .html, .zip, .enex) and reports upload progress (0-100). */
export function importNotesFile(file: File, onProgress?: (pct: number) => void): Promise<NotesImportResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/import/notes');
    const headers = getHeaders();
    delete headers['Content-Type'];
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: any = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as NotesImportResult);
      else reject(new Error(data.error || data.detail || `Import failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading.'));
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

export type NoteVersionCheck =
  | { status: 'ok'; note: any }
  | { status: 'conflict'; note: any }
  | { status: 'unavailable' };

/** Asks the server whether a note still has the given updated_at. Never writes anything. */
export async function checkNoteVersion(noteId: string, expectedUpdatedAt: string): Promise<NoteVersionCheck> {
  try {
    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ expected_updated_at: expectedUpdatedAt }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data?.note) return { status: 'conflict', note: data.note };
    if (res.ok && data?.id) return { status: 'ok', note: data };
  } catch {}
  return { status: 'unavailable' };
}
