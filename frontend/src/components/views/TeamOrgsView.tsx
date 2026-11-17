import React, { useEffect, useState } from 'react';
import {
  fetchOrganizations,
  createOrganization,
  fetchOrgMembers,
  inviteOrgMember,
  updateOrgMemberRole,
  removeOrgMember,
  type Organization,
  type OrgMember
} from '../../services/enterprise';
import {
  getTenantContext,
  acceptOrgInvite,
  updateTenantBranding,
  getTeamSharedFeed,
  type TenantOrg
} from '../../services/tenant';

interface TeamOrgsViewProps {
  userEmail: string;
  activeOrgId: string;
  onSelectOrg: (org: Organization) => void;
  showToast: (msg: string) => void;
}

export const TeamOrgsView: React.FC<TeamOrgsViewProps> = ({
  userEmail,
  activeOrgId,
  onSelectOrg,
  showToast
}) => {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [myRole, setMyRole] = useState<string>('owner');
  const [loading, setLoading] = useState(true);

  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState('pro');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [pendingInvites, setPendingInvites] = useState<TenantOrg[]>([]);
  const [brandColor, setBrandColor] = useState('#0891b2');
  const [brandName, setBrandName] = useState('');
  const [sharedFeed, setSharedFeed] = useState<{ notes: any[]; tasks: any[]; meetings: any[] }>({ notes: [], tasks: [], meetings: [] });

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const res = await fetchOrganizations(userEmail);
      setOrgs(res.organizations);
      const current = res.organizations.find((o) => o.id === activeOrgId) || res.organizations[0];
      if (current) {
        if (!activeOrgId) onSelectOrg(current);
        const memRes = await fetchOrgMembers(current.id, userEmail);
        setMembers(memRes.members);
        setMyRole(memRes.my_role);
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
    getTenantContext(userEmail)
      .then((ctx) => {
        setPendingInvites(ctx.pending_invites || []);
        const active = (ctx.organizations || []).find((o) => o.id === activeOrgId);
        if (active) {
          setBrandColor(active.brand_color || '#0891b2');
          setBrandName(active.name || '');
        }
      })
      .catch(() => {});
    if (activeOrgId) {
      getTeamSharedFeed(activeOrgId, userEmail)
        .then((f) => {
          if (!f.error) setSharedFeed({ notes: f.notes || [], tasks: f.tasks || [], meetings: f.meetings || [] });
        })
        .catch(() => {});
    }
  }, [userEmail, activeOrgId]);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return showToast('Enter a workspace name');
    try {
      const res = await createOrganization(newOrgName.trim(), newOrgPlan, userEmail);
      setNewOrgName('');
      onSelectOrg(res.organization);
      showToast(`Workspace "${res.organization.name}" created!`);
      await loadOrgs();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleInvite = async () => {
    if (!activeOrgId) return;
    if (!inviteEmail.includes('@')) return showToast('Enter a valid teammate email');
    try {
      await inviteOrgMember(activeOrgId, inviteEmail.trim(), inviteName.trim(), inviteRole, userEmail);
      setInviteEmail('');
      setInviteName('');
      showToast('Team member invited & added to workspace!');
      await loadOrgs();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleRoleChange = async (memberEmail: string, role: string) => {
    try {
      await updateOrgMemberRole(activeOrgId, memberEmail, role, userEmail);
      showToast(`Updated ${memberEmail} role to ${role.toUpperCase()}`);
      await loadOrgs();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleRemove = async (memberEmail: string) => {
    try {
      await removeOrgMember(activeOrgId, memberEmail, userEmail);
      showToast(`Removed ${memberEmail}`);
      await loadOrgs();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const canManage = myRole === 'owner' || myRole === 'admin';

  return (
    <section className="workspace-view active" id="view-team">
      <div className="mui-card" style={{ marginBottom: '20px' }}>
        <div className="card-header-flex">
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
              Organizations & Multi-Tenant Workspaces
            </h2>
            <p className="muted-sm" style={{ marginTop: '4px' }}>
              Switch between personal and company workspaces, or create a new isolated tenant with RBAC.
            </p>
          </div>
          <span className="status-pill">Your Role: {myRole.toUpperCase()}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', marginTop: '14px' }}>
          {orgs.map((org) => {
            const isSelected = org.id === activeOrgId;
            return (
              <div
                key={org.id}
                onClick={() => onSelectOrg(org)}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #06b6d4' : '1px solid var(--mui-border)',
                  background: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'var(--mui-bg-paper)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '15px' }}>{org.name}</strong>
                  <span className="cmd-badge">{org.plan.toUpperCase()}</span>
                </div>
                <div className="muted-sm" style={{ marginTop: '6px' }}>
                  {org.member_count} member(s) • Role: {org.my_role}
                </div>
                {isSelected && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#06b6d4', fontWeight: 700 }}>
                    ● Active Workspace
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="mui-input"
            placeholder="New Organization Name (e.g. Acme Engineering)"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            style={{ flex: 1, minWidth: '220px' }}
          />
          <select className="mui-input" value={newOrgPlan} onChange={(e) => setNewOrgPlan(e.target.value)} style={{ width: '140px' }}>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="team">Team</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button className="mui-btn mui-btn-primary" onClick={handleCreateOrg}>
            <span className="material-symbols-rounded icon-sm">add_business</span>
            <span>Create Workspace</span>
          </button>
        </div>
      </div>

      <div className="mui-card">
        <div className="card-header-flex">
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Team Members & RBAC Permissions</h3>
            <p className="muted-sm" style={{ marginTop: '4px' }}>
              Roles: Owner (Full), Admin (Manage Team & Billing), Editor (Create/Edit), Member, Viewer (Read-only).
            </p>
          </div>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <input
              type="email"
              className="mui-input"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{ flex: 1, minWidth: '200px' }}
            />
            <input
              type="text"
              className="mui-input"
              placeholder="Full Name (optional)"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              style={{ width: '180px' }}
            />
            <select className="mui-input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ width: '130px' }}>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="mui-btn mui-btn-primary" onClick={handleInvite}>
              <span className="material-symbols-rounded icon-sm">person_add</span>
              <span>Invite Member</span>
            </button>
          </div>
        )}

        {loading ? (
          <p className="muted-sm">Loading members...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--mui-border)',
                  background: 'var(--mui-bg-paper)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{m.full_name || m.user_email}</div>
                  <div className="muted-sm">{m.user_email} • Status: {m.status}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {canManage && m.user_email !== userEmail ? (
                    <>
                      <select
                        className="mui-input"
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user_email, e.target.value)}
                        style={{ width: '120px', padding: '6px 8px' }}
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        className="mui-btn mui-btn-outlined mui-btn-sm"
                        style={{ color: '#ef4444', borderColor: '#ef4444' }}
                        onClick={() => handleRemove(m.user_email)}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="cmd-badge">{m.role.toUpperCase()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="mui-card" style={{ marginTop: '18px', borderColor: '#06b6d4' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700 }}>Pending Organization Invites</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingInvites.map((inv) => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--mui-border)' }}>
                <div>
                  <strong>{inv.name}</strong> <span className="cmd-badge">{inv.role.toUpperCase()}</span>
                </div>
                <button
                  className="mui-btn mui-btn-primary mui-btn-sm"
                  onClick={async () => {
                    const res = await acceptOrgInvite(inv.id, userEmail);
                    if (res.member) {
                      showToast(`Joined ${inv.name}!`);
                      setPendingInvites((prev) => prev.filter((x) => x.id !== inv.id));
                      loadOrgs();
                    }
                  }}
                >
                  Accept Invite
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* White-Label Tenant Branding & Shared Team Feed */}
      {activeOrgId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px', marginTop: '18px' }}>
          <div className="mui-card">
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>White-Label Tenant Branding</h3>
            <p className="muted-sm" style={{ marginBottom: '12px' }}>Customize organization name & primary accent color (Admin/Owner only).</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                className="mui-input"
                placeholder="Workspace Display Name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '13px' }}>Brand Accent:</label>
                <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} style={{ width: '44px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer' }} />
                <span className="muted-sm">{brandColor}</span>
              </div>
              <button
                className="mui-btn mui-btn-primary mui-btn-sm"
                onClick={async () => {
                  const res = await updateTenantBranding({
                    org_id: activeOrgId,
                    name: brandName || undefined,
                    brand_color: brandColor,
                    user_email: userEmail
                  });
                  if (res.error) showToast(res.error);
                  else {
                    showToast('Tenant branding updated!');
                    loadOrgs();
                  }
                }}
              >
                Save Branding
              </button>
            </div>
          </div>

          <div className="mui-card">
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>Team Shared Workspace Feed</h3>
            <p className="muted-sm" style={{ marginBottom: '12px' }}>
              Notes, Tasks & Meetings shared with this organization ({sharedFeed.notes.length} notes · {sharedFeed.tasks.length} tasks).
            </p>
            {sharedFeed.notes.length === 0 && sharedFeed.tasks.length === 0 ? (
              <p className="muted-sm">No items shared to this team yet. Open Smart Notes and click "Share to Team Feed".</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                {sharedFeed.notes.map((n) => (
                  <div key={n.id} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--mui-border)', fontSize: '12.5px' }}>
                    <strong>Note:</strong> {n.title || 'Untitled'} <span className="muted-sm">by {n.user_email}</span>
                  </div>
                ))}
                {sharedFeed.tasks.map((t) => (
                  <div key={t.id} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--mui-border)', fontSize: '12.5px' }}>
                    <strong>Task:</strong> {t.title} <span className="muted-sm">({t.priority})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
