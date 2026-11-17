import { getStoredJwtToken } from './enterprise';

export interface SuperAdminOverview {
  total_users: number;
  active_users: number;
  suspended_users: number;
  superadmin_count: number;
  total_orgs: number;
  total_notes: number;
  total_tasks: number;
  total_meetings: number;
  total_documents: number;
  total_ai_credits: number;
}

export interface SuperAdminUserItem {
  id: string;
  email: string;
  full_name: string;
  job_title: string;
  department: string;
  location: string;
  avatar_url: string;
  role: 'user' | 'admin' | 'superadmin';
  is_superadmin: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  stats: {
    notes_count: number;
    tasks_count: number;
    meetings_count: number;
    docs_count: number;
    orgs_count: number;
  };
}

export interface SuperAdminUserDetails {
  profile: {
    id: string;
    email: string;
    full_name: string;
    job_title: string;
    department: string;
    bio: string;
    phone: string;
    location: string;
    timezone: string;
    avatar_url: string;
    ai_persona_preference: string;
    working_hours: string;
    role: string;
    is_superadmin: boolean;
    is_active: boolean;
    created_at: string | null;
    updated_at: string | null;
  };
  stats: {
    notes_count: number;
    tasks_total: number;
    tasks_completed: number;
    meetings_count: number;
    documents_count: number;
    habits_count: number;
    goals_count: number;
    orgs_count: number;
    ai_credits_used: number;
    ai_credits_limit: number;
    plan_id: string;
  };
  memberships: Array<{
    org_id: string;
    org_name: string;
    plan: string;
    role: string;
    status: string;
  }>;
  recent_notes: Array<{ id: string; title: string; created_at: string | null }>;
  recent_tasks: Array<{ id: string; title: string; status: string; priority: string; completed: boolean }>;
  recent_audit_logs: Array<{
    id: string;
    action: string;
    resource_type: string;
    ip_address: string;
    created_at: string | null;
  }>;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredJwtToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function fetchSuperAdminOverview(adminEmail: string): Promise<SuperAdminOverview> {
  const res = await fetch(`/api/superadmin/overview?user_email=${encodeURIComponent(adminEmail)}`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load overview');
  return data.overview;
}

export async function fetchSuperAdminUsers(
  adminEmail: string,
  q = '',
  role = 'all',
  status = 'all'
): Promise<SuperAdminUserItem[]> {
  const params = new URLSearchParams({ user_email: adminEmail, q, role, status });
  const res = await fetch(`/api/superadmin/users?${params.toString()}`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load users');
  return data.users || [];
}

export async function fetchSuperAdminUserDetails(
  adminEmail: string,
  userId: string
): Promise<SuperAdminUserDetails> {
  const res = await fetch(
    `/api/superadmin/users/${encodeURIComponent(userId)}?user_email=${encodeURIComponent(adminEmail)}`,
    { headers: getHeaders() }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load user details');
  return data;
}

export async function createSuperAdminUser(
  adminEmail: string,
  payload: {
    email: string;
    full_name: string;
    password: string;
    role: string;
    job_title?: string;
    department?: string;
  }
) {
  const res = await fetch(`/api/superadmin/users?user_email=${encodeURIComponent(adminEmail)}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create user');
  return data.user;
}

export async function updateSuperAdminUser(
  adminEmail: string,
  userId: string,
  payload: { role?: string; is_active?: boolean; full_name?: string; job_title?: string; department?: string }
) {
  const res = await fetch(
    `/api/superadmin/users/${encodeURIComponent(userId)}?user_email=${encodeURIComponent(adminEmail)}`,
    {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update user');
  return data.user;
}

export async function resetSuperAdminUserPassword(
  adminEmail: string,
  userId: string,
  newPassword: string
) {
  const res = await fetch(
    `/api/superadmin/users/${encodeURIComponent(userId)}/reset-password?user_email=${encodeURIComponent(adminEmail)}`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ new_password: newPassword }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reset password');
  return data;
}

export async function deleteSuperAdminUser(adminEmail: string, userId: string) {
  const res = await fetch(
    `/api/superadmin/users/${encodeURIComponent(userId)}?user_email=${encodeURIComponent(adminEmail)}`,
    {
      method: 'DELETE',
      headers: getHeaders(),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete user');
  return data;
}

export async function assignSuperAdminUserPlan(
  adminEmail: string,
  userId: string,
  planId: 'starter' | 'pro' | 'team' | 'enterprise'
) {
  const res = await fetch(
    `/api/superadmin/users/${encodeURIComponent(userId)}/plan?user_email=${encodeURIComponent(adminEmail)}`,
    {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ plan_id: planId, billing_cycle: 'monthly' }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to assign plan');
  return data;
}
