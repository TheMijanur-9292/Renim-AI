import React, { useEffect, useState } from 'react';
import {
  fetchSuperAdminOverview,
  fetchSuperAdminUsers,
  fetchSuperAdminUserDetails,
  createSuperAdminUser,
  updateSuperAdminUser,
  assignSuperAdminUserPlan,
  resetSuperAdminUserPassword,
  deleteSuperAdminUser,
  type SuperAdminOverview,
  type SuperAdminUserItem,
  type SuperAdminUserDetails,
} from '../../services/superadmin';

interface SuperAdminViewProps {
  adminEmail: string;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ adminEmail, showToast }) => {
  const [overview, setOverview] = useState<SuperAdminOverview | null>(null);
  const [users, setUsers] = useState<SuperAdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create User Form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin' | 'superadmin'>('user');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [creating, setCreating] = useState(false);

  // User Profile Details Inspector
  const [selectedDetails, setSelectedDetails] = useState<SuperAdminUserDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Password Reset inline state
  const [resetTarget, setResetTarget] = useState<{ id: string; email: string } | null>(null);
  const [resetPassValue, setResetPassValue] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ov, us] = await Promise.all([
        fetchSuperAdminOverview(adminEmail),
        fetchSuperAdminUsers(adminEmail, searchQ, roleFilter, statusFilter),
      ]);
      setOverview(ov);
      setUsers(us);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load Super Admin console', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [adminEmail, roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadAll();
  };

  const handleOpenDetails = async (userId: string) => {
    setLoadingDetails(true);
    try {
      const details = await fetchSuperAdminUserDetails(adminEmail, userId);
      setSelectedDetails(details);
    } catch (err: any) {
      showToast(err?.message || 'Could not load user profile details', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createSuperAdminUser(adminEmail, {
        email: newEmail,
        full_name: newName,
        password: newPassword,
        role: newRole,
        job_title: newJobTitle,
        department: newDepartment,
      });
      showToast(`User ${newEmail} created!`, 'success');
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewJobTitle('');
      setNewDepartment('');
      setNewRole('user');
      setShowCreateForm(false);
      loadAll();
    } catch (err: any) {
      showToast(err?.message || 'Failed to create user', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (u: SuperAdminUserItem) => {
    try {
      await updateSuperAdminUser(adminEmail, u.id, { is_active: !u.is_active });
      showToast(`${u.email} ${!u.is_active ? 'activated' : 'suspended'}.`, 'success');
      loadAll();
      if (selectedDetails?.profile.id === u.id) {
        handleOpenDetails(u.id);
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not update status', 'error');
    }
  };

  const handleChangeRole = async (u: SuperAdminUserItem, role: string) => {
    try {
      await updateSuperAdminUser(adminEmail, u.id, { role });
      showToast(`Updated ${u.email} role to ${role}.`, 'success');
      loadAll();
      if (selectedDetails?.profile.id === u.id) {
        handleOpenDetails(u.id);
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not update role', 'error');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      await resetSuperAdminUserPassword(adminEmail, resetTarget.id, resetPassValue);
      showToast(`Password reset for ${resetTarget.email}`, 'success');
      setResetTarget(null);
      setResetPassValue('');
    } catch (err: any) {
      showToast(err?.message || 'Password reset failed', 'error');
    }
  };

  const handleDeleteUser = async (u: SuperAdminUserItem) => {
    if (!confirm(`Delete user ${u.email}? This action cannot be undone.`)) return;
    try {
      await deleteSuperAdminUser(adminEmail, u.id);
      showToast(`Deleted user ${u.email}`, 'info');
      if (selectedDetails?.profile.id === u.id) setSelectedDetails(null);
      loadAll();
    } catch (err: any) {
      showToast(err?.message || 'Could not delete user', 'error');
    }
  };

  // Detailed User Profile Page View
  if (selectedDetails) {
    const p = selectedDetails.profile;
    const s = selectedDetails.stats;
    const isImg = p.avatar_url.startsWith('http') || p.avatar_url.startsWith('data:image');

    return (
      <div id="view-superadmin" className="view-container active">
        <div style={{ maxWidth: '1160px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              className="mui-btn mui-btn-outlined mui-btn-sm"
              onClick={() => setSelectedDetails(null)}
            >
              <span className="material-symbols-rounded icon-sm">arrow_back</span>
              <span>Back to All Users</span>
            </button>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="mui-btn mui-btn-outlined mui-btn-sm"
                onClick={() => setResetTarget({ id: p.id, email: p.email })}
              >
                <span className="material-symbols-rounded icon-sm">key</span>
                <span>Reset Password</span>
              </button>
              {p.email !== adminEmail && (
                <button
                  type="button"
                  className="mui-btn mui-btn-sm"
                  style={{
                    background: p.is_active ? 'rgba(239, 68, 68, 0.16)' : 'rgba(16, 185, 129, 0.18)',
                    color: p.is_active ? '#f87171' : '#34d399',
                    border: '1px solid currentColor',
                  }}
                  onClick={() =>
                    handleToggleStatus({
                      id: p.id,
                      email: p.email,
                      is_active: p.is_active,
                    } as SuperAdminUserItem)
                  }
                >
                  {p.is_active ? 'Suspend Account' : 'Activate Account'}
                </button>
              )}
            </div>
          </div>

          {/* User Profile Hero */}
          <div
            className="mui-card"
            style={{
              background: 'linear-gradient(135deg, rgba(6,182,212,0.12), rgba(99,102,241,0.12))',
              borderColor: 'rgba(6, 182, 212, 0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: isImg ? '0px' : '28px',
                  fontWeight: 800,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {isImg ? (
                  <img src={p.avatar_url} alt={p.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  p.avatar_url || p.full_name.charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '21px' }}>{p.full_name}</h2>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: p.is_superadmin ? 'rgba(245, 158, 11, 0.2)' : 'rgba(6, 182, 212, 0.18)',
                      color: p.is_superadmin ? '#fbbf24' : '#22d3ee',
                      textTransform: 'uppercase',
                    }}
                  >
                    {p.role}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: p.is_active ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                      color: p.is_active ? '#34d399' : '#f87171',
                    }}
                  >
                    {p.is_active ? 'Active' : 'Suspended'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>
                  {p.email} {p.job_title ? `• ${p.job_title}` : ''} {p.department ? `• ${p.department}` : ''}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                  {p.location ? `📍 ${p.location} • ` : ''}
                  {p.phone ? `📞 ${p.phone} • ` : ''}
                  🕒 {p.timezone} ({p.working_hours}) • 🤖 {p.ai_persona_preference}
                </div>
                {p.bio && <p style={{ fontSize: '13px', marginTop: '8px', marginBottom: 0, opacity: 0.9 }}>{p.bio}</p>}
              </div>
            </div>
          </div>

          {/* User Stats Grid */}
          <div className="mui-grid-3" style={{ gap: '14px' }}>
            <div className="mui-card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>Notes & Docs</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#22d3ee' }}>
                {s.notes_count} Notes • {s.documents_count} Docs
              </div>
            </div>
            <div className="mui-card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>Tasks & Meetings</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399' }}>
                {s.tasks_completed}/{s.tasks_total} Tasks • {s.meetings_count} Meetings
              </div>
            </div>
            <div className="mui-card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>Plan & AI Credits</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#a78bfa' }}>
                {s.plan_id.toUpperCase()} ({s.ai_credits_used}/{s.ai_credits_limit})
              </div>
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  aria-label="Assign Plan"
                  value={s.plan_id}
                  onChange={async (e) => {
                    const nextPlan = e.target.value as 'starter' | 'pro' | 'team' | 'enterprise';
                    try {
                      await assignSuperAdminUserPlan(adminEmail, p.id, nextPlan);
                      showToast(`Plan updated to ${nextPlan.toUpperCase()} for ${p.email}`, 'success');
                      const updated = await fetchSuperAdminUserDetails(adminEmail, p.id);
                      setSelectedDetails(updated);
                    } catch (err: any) {
                      showToast(err.message || 'Failed to update plan', 'error');
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--mui-border)',
                    background: 'var(--mui-surface)',
                    color: 'inherit',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="team">Team</option>
                  <option value="enterprise">Enterprise</option>
                </select>
                <span style={{ fontSize: '11px', opacity: 0.7 }}>Manual Override</span>
              </div>
            </div>
          </div>

          <div className="mui-grid-2" style={{ gap: '16px', alignItems: 'start' }}>
            {/* Orgs & Recent Notes/Tasks */}
            <div className="mui-card">
              <h3 className="mui-card-title" style={{ marginBottom: '12px' }}>
                <span className="material-symbols-rounded">corporate_fare</span>
                <span>Organizations ({selectedDetails.memberships.length})</span>
              </h3>
              {selectedDetails.memberships.length === 0 ? (
                <p style={{ fontSize: '13px', opacity: 0.7 }}>Personal workspace only.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDetails.memberships.map((m) => (
                    <div
                      key={m.org_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--mui-border)',
                      }}
                    >
                      <span>{m.org_name}</span>
                      <strong style={{ color: '#22d3ee', textTransform: 'uppercase', fontSize: '11.5px' }}>{m.role}</strong>
                    </div>
                  ))}
                </div>
              )}

              <h4 style={{ marginTop: '18px', marginBottom: '8px' }}>Recent Notes</h4>
              {selectedDetails.recent_notes.length === 0 ? (
                <p style={{ fontSize: '12.5px', opacity: 0.65 }}>No notes yet.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                  {selectedDetails.recent_notes.map((n) => (
                    <li key={n.id} style={{ marginBottom: '4px' }}>{n.title}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recent Audit Logs */}
            <div className="mui-card">
              <h3 className="mui-card-title" style={{ marginBottom: '12px' }}>
                <span className="material-symbols-rounded">history</span>
                <span>Recent Audit Activity</span>
              </h3>
              {selectedDetails.recent_audit_logs.length === 0 ? (
                <p style={{ fontSize: '13px', opacity: 0.7 }}>No recent audit events recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDetails.recent_audit_logs.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--mui-border)',
                        fontSize: '12.5px',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{a.action}</div>
                      <div style={{ opacity: 0.7, fontSize: '11px' }}>
                        {a.resource_type} • {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="view-superadmin" className="view-container active">
      <div style={{ maxWidth: '1220px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Header Banner */}
        <div
          className="mui-card"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(6, 182, 212, 0.12))',
            borderColor: 'rgba(245, 158, 11, 0.35)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-rounded" style={{ color: '#fbbf24' }}>admin_panel_settings</span>
                <span>Super Admin Control Center</span>
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.8 }}>
                Platform-wide user management, role governance, account status control &amp; detailed user profile inspection.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="mui-btn mui-btn-outlined mui-btn-sm"
                onClick={loadAll}
              >
                <span className="material-symbols-rounded icon-sm">refresh</span>
                <span>Refresh</span>
              </button>
              <button
                type="button"
                className="mui-btn mui-btn-primary mui-btn-sm"
                onClick={() => setShowCreateForm((v) => !v)}
              >
                <span className="material-symbols-rounded icon-sm">person_add</span>
                <span>{showCreateForm ? 'Close Form' : 'Create User'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Platform KPIs */}
        {overview && (
          <div className="mui-grid-3" style={{ gap: '14px' }}>
            <div className="mui-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>Platform Users</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#22d3ee' }}>{overview.total_users}</div>
              <div style={{ fontSize: '12px', opacity: 0.75 }}>
                {overview.active_users} Active • {overview.suspended_users} Suspended • {overview.superadmin_count} SuperAdmin
              </div>
            </div>
            <div className="mui-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>Workspaces &amp; Content</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#34d399' }}>
                {overview.total_orgs} Orgs
              </div>
              <div style={{ fontSize: '12px', opacity: 0.75 }}>
                {overview.total_notes} Notes • {overview.total_tasks} Tasks • {overview.total_meetings} Meetings
              </div>
            </div>
            <div className="mui-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>Knowledge &amp; AI Usage</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#a78bfa' }}>
                {overview.total_ai_credits} Credits
              </div>
              <div style={{ fontSize: '12px', opacity: 0.75 }}>
                {overview.total_documents} Knowledge Docs indexed
              </div>
            </div>
          </div>
        )}

        {/* Create New User Form */}
        {showCreateForm && (
          <form className="mui-card" onSubmit={handleCreateUser}>
            <h3 className="mui-card-title" style={{ marginBottom: '12px' }}>
              <span className="material-symbols-rounded">person_add</span>
              <span>Create New Platform User</span>
            </h3>
            <div className="mui-grid-3" style={{ gap: '12px' }}>
              <div className="mui-input-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  className="mui-input"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@company.com"
                />
              </div>
              <div className="mui-input-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="mui-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full Name"
                />
              </div>
              <div className="mui-input-group">
                <label>Initial Password *</label>
                <input
                  type="password"
                  className="mui-input"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
              </div>
              <div className="mui-input-group">
                <label>System Role</label>
                <select
                  className="mui-input"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                >
                  <option value="user">Standard User</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <div className="mui-input-group">
                <label>Job Title</label>
                <input
                  type="text"
                  className="mui-input"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="e.g. Engineer"
                />
              </div>
              <div className="mui-input-group">
                <label>Department</label>
                <input
                  type="text"
                  className="mui-input"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="e.g. Product"
                />
              </div>
            </div>
            <button type="submit" className="mui-btn mui-btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create User Account'}
            </button>
          </form>
        )}

        {/* Password Reset Inline Card */}
        {resetTarget && (
          <form className="mui-card" onSubmit={handleResetPasswordSubmit} style={{ borderColor: '#f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong>Reset Password for {resetTarget.email}</strong>
              <button type="button" className="mui-btn-icon" onClick={() => setResetTarget(null)}>
                <span className="material-symbols-rounded icon-sm">close</span>
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="password"
                className="mui-input"
                required
                minLength={6}
                placeholder="Enter new password (min 6 chars)"
                value={resetPassValue}
                onChange={(e) => setResetPassValue(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <button type="submit" className="mui-btn mui-btn-primary mui-btn-sm">
                Update Password
              </button>
            </div>
          </form>
        )}

        {/* User Management Directory */}
        <div className="mui-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <h3 className="mui-card-title" style={{ margin: 0 }}>
              <span className="material-symbols-rounded">group</span>
              <span>All Platform Users ({users.length})</span>
            </h3>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                className="mui-input"
                placeholder="Search name, email, dept..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                style={{ width: '210px', height: '34px', padding: '0 10px' }}
              />
              <select
                className="mui-input"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ width: '130px', height: '34px', padding: '0 8px' }}
              >
                <option value="all">All Roles</option>
                <option value="superadmin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
              <select
                className="mui-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '130px', height: '34px', padding: '0 8px' }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <button type="submit" className="mui-btn mui-btn-outlined mui-btn-sm">
                Search
              </button>
            </form>
          </div>

          {loading || loadingDetails ? (
            <p style={{ opacity: 0.7 }}>Loading users...</p>
          ) : users.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No users matched your filter.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {users.map((u) => {
                const isImg = u.avatar_url.startsWith('http') || u.avatar_url.startsWith('data:image');
                return (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--mui-border)',
                      background: 'var(--mui-bg-paper)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', flex: 1 }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
                          color: '#fff',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {isImg ? (
                          <img src={u.avatar_url} alt={u.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          u.avatar_url || u.full_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '14.5px' }}>{u.full_name}</strong>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: u.is_active ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.16)',
                              color: u.is_active ? '#34d399' : '#f87171',
                            }}
                          >
                            {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12.5px', opacity: 0.78 }}>{u.email}</div>
                        <div style={{ fontSize: '11.5px', opacity: 0.65 }}>
                          {u.stats.notes_count} Notes • {u.stats.tasks_count} Tasks • {u.stats.meetings_count} Meetings • {u.stats.orgs_count} Orgs
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        className="mui-input"
                        value={u.role}
                        disabled={u.email === adminEmail}
                        onChange={(e) => handleChangeRole(u, e.target.value)}
                        style={{ height: '32px', padding: '0 8px', fontSize: '12px', width: '125px' }}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="superadmin">Super Admin</option>
                      </select>

                      <button
                        type="button"
                        className="mui-btn mui-btn-primary mui-btn-sm"
                        onClick={() => handleOpenDetails(u.id)}
                      >
                        <span className="material-symbols-rounded icon-sm">visibility</span>
                        <span>View Profile</span>
                      </button>

                      <button
                        type="button"
                        className="mui-btn mui-btn-outlined mui-btn-sm"
                        onClick={() => setResetTarget({ id: u.id, email: u.email })}
                        title="Reset Password"
                      >
                        <span className="material-symbols-rounded icon-sm">key</span>
                      </button>

                      {u.email !== adminEmail && (
                        <>
                          <button
                            type="button"
                            className="mui-btn mui-btn-outlined mui-btn-sm"
                            onClick={() => handleToggleStatus(u)}
                            title={u.is_active ? 'Suspend User' : 'Activate User'}
                          >
                            <span className="material-symbols-rounded icon-sm">
                              {u.is_active ? 'block' : 'check_circle'}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="mui-btn mui-btn-outlined mui-btn-sm"
                            style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.4)' }}
                            onClick={() => handleDeleteUser(u)}
                            title="Delete User"
                          >
                            <span className="material-symbols-rounded icon-sm">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
