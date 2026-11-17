import { getStoredJwtToken } from './enterprise';

export interface UserProfile {
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
  has_password?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProfileStats {
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
}

export interface ProfileMembership {
  org_id: string;
  org_name: string;
  plan: string;
  role: string;
  status: string;
}

export interface ProfileResponse {
  profile: UserProfile;
  stats: ProfileStats;
  memberships: ProfileMembership[];
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredJwtToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function fetchUserProfile(userEmail: string): Promise<ProfileResponse> {
  const res = await fetch(`/api/profile?user_email=${encodeURIComponent(userEmail)}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load profile');
  return data;
}

export async function updateUserProfile(
  payload: Partial<UserProfile> & { user_email: string }
): Promise<UserProfile> {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update profile');
  return data.profile;
}

export async function changeUserPassword(payload: {
  user_email: string;
  current_password: string;
  new_password: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/profile/change-password', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to change password');
  return data;
}
