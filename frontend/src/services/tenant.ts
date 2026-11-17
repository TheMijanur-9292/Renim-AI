export interface TenantOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  brand_color?: string;
  logo_url?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: string;
}

export interface MindMapResult {
  root: string;
  branches: Array<{ title: string; nodes: string[] }>;
  mermaid?: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('renim_jwt') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function getTenantContext(userEmail: string): Promise<{
  organizations: TenantOrg[];
  pending_invites: TenantOrg[];
}> {
  const res = await fetch(`/api/tenant/context?user_email=${encodeURIComponent(userEmail)}`, {
    headers: getAuthHeaders(),
  });
  return res.json();
}

export async function updateTenantBranding(payload: {
  org_id: string;
  name?: string;
  brand_color?: string;
  logo_url?: string;
  user_email: string;
}) {
  const res = await fetch('/api/tenant/branding', {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function acceptOrgInvite(orgId: string, userEmail: string) {
  const res = await fetch('/api/tenant/invites/accept', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ org_id: orgId, user_email: userEmail }),
  });
  return res.json();
}

export async function getTeamSharedFeed(orgId: string, userEmail: string) {
  const res = await fetch(
    `/api/tenant/feed?org_id=${encodeURIComponent(orgId)}&user_email=${encodeURIComponent(userEmail)}`,
    { headers: getAuthHeaders() }
  );
  return res.json();
}

export async function setResourceVisibility(payload: {
  resource_type: 'note' | 'task' | 'meeting';
  resource_id: string;
  org_id: string;
  visibility: 'private' | 'team';
  user_email: string;
}) {
  const res = await fetch('/api/tenant/visibility', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function createPublicShareLink(payload: {
  resource_type: 'note' | 'meeting';
  resource_id: string;
  title: string;
  content: string;
  org_id?: string;
  user_email: string;
}) {
  const res = await fetch('/api/tenant/share', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function generateMindMap(payload: {
  title: string;
  content: string;
  user_email: string;
}): Promise<{ mindmap?: MindMapResult; error?: string }> {
  const res = await fetch('/api/tenant/mindmap', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function generateMeetingFollowup(payload: {
  title: string;
  transcript: string;
  attendees?: string;
  user_email: string;
}): Promise<{ subject?: string; email_body?: string; action_items?: string[]; error?: string }> {
  const res = await fetch('/api/tenant/meeting-followup', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}
