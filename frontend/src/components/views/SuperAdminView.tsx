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
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { EmptyState, Icon, PageContainer, PageHeader, SectionCard, StatCard, riseSx } from '../ui';

const ROLE_LABEL: Record<string, string> = { user: 'User', admin: 'Admin', superadmin: 'Super Admin' };

const StatusChip: React.FC<{ active: boolean }> = ({ active }) => (
  <Chip
    size="small"
    label={active ? 'Active' : 'Suspended'}
    color={active ? 'success' : 'error'}
    variant="outlined"
    icon={<Icon name={active ? 'check_circle' : 'block'} size={14} />}
    sx={{ fontWeight: 700 }}
  />
);

const UserAvatar: React.FC<{ url: string; name: string; size: number }> = ({ url, name, size }) => {
  const isImg = url.startsWith('http') || url.startsWith('data:image');
  return (
    <Avatar
      src={isImg ? url : undefined}
      alt={name}
      sx={{ width: size, height: size, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 800, fontSize: size * 0.4 }}
    >
      {isImg ? null : url || name.charAt(0).toUpperCase()}
    </Avatar>
  );
};


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

    const metaItems: { icon: string; text: string }[] = [
      ...(p.location ? [{ icon: 'location_on', text: p.location }] : []),
      ...(p.phone ? [{ icon: 'call', text: p.phone }] : []),
      { icon: 'schedule', text: `${p.timezone} (${p.working_hours})` },
      { icon: 'smart_toy', text: p.ai_persona_preference },
    ];

    return (
      <div id="view-superadmin" className="view-container active">
        <PageContainer>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1.5} sx={{ mb: 3, ...riseSx(0) }}>
            <Button variant="text" startIcon={<Icon name="arrow_back" />} onClick={() => setSelectedDetails(null)}>
              All users
            </Button>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" startIcon={<Icon name="key" />} onClick={() => setResetTarget({ id: p.id, email: p.email })}>
                Reset password
              </Button>
              {p.email !== adminEmail && (
                <Button
                  variant="outlined"
                  color={p.is_active ? 'error' : 'success'}
                  startIcon={<Icon name={p.is_active ? 'block' : 'check_circle'} />}
                  onClick={() =>
                    handleToggleStatus({
                      id: p.id,
                      email: p.email,
                      is_active: p.is_active,
                    } as SuperAdminUserItem)
                  }
                >
                  {p.is_active ? 'Suspend account' : 'Activate account'}
                </Button>
              )}
            </Stack>
          </Stack>

          {/* User Profile Hero */}
          <Card sx={{ p: { xs: 2.5, sm: 3 }, mb: 2.5, ...riseSx(1) }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <UserAvatar url={p.avatar_url} name={p.full_name} size={72} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h5" component="h1" sx={{ fontWeight: 800 }}>{p.full_name}</Typography>
                  <Chip size="small" label={ROLE_LABEL[p.role] || p.role} color={p.is_superadmin ? 'warning' : 'secondary'} sx={{ fontWeight: 700 }} />
                  <StatusChip active={p.is_active} />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                  {p.email} {p.job_title ? `· ${p.job_title}` : ''} {p.department ? `· ${p.department}` : ''}
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1, color: 'text.secondary' }}>
                  {metaItems.map((m) => (
                    <Stack key={m.icon} direction="row" spacing={0.5} alignItems="center">
                      <Icon name={m.icon} size={16} />
                      <Typography variant="caption">{m.text}</Typography>
                    </Stack>
                  ))}
                </Stack>
                {p.bio && <Typography variant="body2" sx={{ mt: 1.25 }}>{p.bio}</Typography>}
              </Box>
            </Stack>
          </Card>

          {/* User Stats Grid */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, mb: 2.5 }}>
            <StatCard index={2} icon="description" accent="cyan" label="Notes & documents" value={`${s.notes_count} · ${s.documents_count}`} hint={`${s.notes_count} notes, ${s.documents_count} docs`} />
            <StatCard index={3} icon="task_alt" accent="green" label="Tasks & meetings" value={`${s.tasks_completed}/${s.tasks_total}`} hint={`tasks done, ${s.meetings_count} meetings`} />
            <Card sx={{ p: 2.25, ...riseSx(4), gridColumn: { sm: '1 / -1', md: 'auto' } }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Plan & AI credits</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, mb: 1.5 }}>
                {s.plan_id.toUpperCase()} <Typography component="span" variant="body2" color="text.secondary">({s.ai_credits_used}/{s.ai_credits_limit})</Typography>
              </Typography>
              <TextField
                select
                size="small"
                label="Change plan"
                value={s.plan_id}
                fullWidth
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
              >
                <MenuItem value="starter">Starter</MenuItem>
                <MenuItem value="pro">Pro</MenuItem>
                <MenuItem value="team">Team</MenuItem>
                <MenuItem value="enterprise">Enterprise</MenuItem>
              </TextField>
            </Card>
          </Box>

          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
            <SectionCard index={5} icon="corporate_fare" accent="indigo" title={`Organizations (${selectedDetails.memberships.length})`}>
              {selectedDetails.memberships.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Personal workspace only.</Typography>
              ) : (
                <Stack spacing={1}>
                  {selectedDetails.memberships.map((m) => (
                    <Stack
                      key={m.org_id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      spacing={1}
                      sx={{ px: 1.75, py: 1.25, borderRadius: 3, border: 1, borderColor: 'divider' }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>{m.org_name}</Typography>
                      <Chip size="small" label={m.role} variant="outlined" color="secondary" />
                    </Stack>
                  ))}
                </Stack>
              )}

              <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 1 }}>Recent notes</Typography>
              {selectedDetails.recent_notes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No notes yet.</Typography>
              ) : (
                <Stack spacing={0.75}>
                  {selectedDetails.recent_notes.map((n) => (
                    <Stack key={n.id} direction="row" spacing={1} alignItems="center">
                      <Icon name="description" size={16} sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2" noWrap>{n.title}</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </SectionCard>

            <SectionCard index={6} icon="history" accent="slate" title="Recent activity">
              {selectedDetails.recent_audit_logs.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No recent activity.</Typography>
              ) : (
                <Stack spacing={1}>
                  {selectedDetails.recent_audit_logs.map((a) => (
                    <Box key={a.id} sx={{ px: 1.75, py: 1.25, borderRadius: 3, border: 1, borderColor: 'divider' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.action}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {a.resource_type} · {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </SectionCard>
          </Box>
        </PageContainer>
      </div>
    );
  }

  return (
    <div id="view-superadmin" className="view-container active">
      <PageContainer>
        <PageHeader
          overline="Administration"
          title="Super Admin"
          description="Manage every user: roles, plans, account status and passwords."
          actions={
            <>
              <Button variant="outlined" startIcon={<Icon name="refresh" />} onClick={loadAll}>
                Refresh
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Icon name={showCreateForm ? 'close' : 'person_add'} />}
                onClick={() => setShowCreateForm((v) => !v)}
              >
                {showCreateForm ? 'Close form' : 'New user'}
              </Button>
            </>
          }
        />

        {/* Platform KPIs */}
        {overview && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, mb: 2.5 }}>
            <StatCard
              index={1}
              icon="group"
              accent="cyan"
              label="Users"
              value={overview.total_users}
              hint={`${overview.active_users} active · ${overview.suspended_users} suspended · ${overview.superadmin_count} super admin`}
            />
            <StatCard
              index={2}
              icon="corporate_fare"
              accent="green"
              label="Organizations"
              value={overview.total_orgs}
              hint={`${overview.total_notes} notes · ${overview.total_tasks} tasks · ${overview.total_meetings} meetings`}
            />
            <StatCard
              index={3}
              icon="auto_awesome"
              accent="violet"
              label="AI credits used"
              value={overview.total_ai_credits}
              hint={`${overview.total_documents} documents in knowledge base`}
            />
          </Box>
        )}

        {/* Create New User Form */}
        {showCreateForm && (
          <Card component="form" onSubmit={handleCreateUser} sx={{ p: { xs: 2.25, sm: 3 }, mb: 2.5, ...riseSx(1) }}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>New user</Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, mb: 2.5 }}>
              <TextField type="email" label="Email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@company.com" fullWidth />
              <TextField label="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} fullWidth />
              <TextField
                type="password"
                label="Password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText="At least 6 characters"
                slotProps={{ htmlInput: { minLength: 6 } }}
                fullWidth
              />
              <TextField select label="Role" value={newRole} onChange={(e) => setNewRole(e.target.value as any)} fullWidth>
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="superadmin">Super Admin</MenuItem>
              </TextField>
              <TextField label="Job title" value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} placeholder="e.g. Manager" fullWidth />
              <TextField label="Department" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} placeholder="e.g. Operations" fullWidth />
            </Box>
            <Button type="submit" variant="contained" color="primary" disabled={creating} startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <Icon name="person_add" />}>
              {creating ? 'Creating...' : 'Create user'}
            </Button>
          </Card>
        )}

        {/* Password Reset Inline Card */}
        {resetTarget && (
          <Card component="form" onSubmit={handleResetPasswordSubmit} sx={{ p: { xs: 2.25, sm: 3 }, mb: 2.5, borderColor: 'warning.main', ...riseSx(1) }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>
                Reset password for {resetTarget.email}
              </Typography>
              <IconButton aria-label="Close password reset" onClick={() => setResetTarget(null)} sx={{ width: 44, height: 44 }}>
                <Icon name="close" />
              </IconButton>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                type="password"
                label="New password"
                required
                placeholder="At least 6 characters"
                value={resetPassValue}
                onChange={(e) => setResetPassValue(e.target.value)}
                slotProps={{ htmlInput: { minLength: 6 } }}
                fullWidth
              />
              <Button type="submit" variant="contained" color="primary" sx={{ minHeight: 56, flex: 'none' }}>
                Update password
              </Button>
            </Stack>
          </Card>
        )}

        {/* User Management Directory */}
        <SectionCard index={4} icon="group" accent="cyan" title={`All users (${users.length})`} sx={{ overflow: 'hidden' }}>
          <Box
            component="form"
            onSubmit={handleSearchSubmit}
            sx={{
              pb: 2,
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '2fr 1fr 1fr auto' },
            }}
          >
            <TextField
              size="small"
              label="Search"
              placeholder="Name, email or department"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              sx={{ gridColumn: { sm: '1 / -1', md: 'auto' } }}
              fullWidth
            />
            <TextField select size="small" label="Role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} fullWidth>
              <MenuItem value="all">All roles</MenuItem>
              <MenuItem value="superadmin">Super Admin</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="user">User</MenuItem>
            </TextField>
            <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} fullWidth>
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
            </TextField>
            <Button type="submit" variant="outlined" startIcon={<Icon name="search" />} sx={{ minHeight: 44, gridColumn: { sm: '1 / -1', md: 'auto' } }}>
              Search
            </Button>
          </Box>

          {loading || loadingDetails ? (
            <Stack alignItems="center" spacing={1.5} sx={{ py: 6, mx: -2.5, borderTop: 1, borderColor: 'divider' }}>
              <CircularProgress size={28} color="secondary" />
              <Typography variant="body2" color="text.secondary">Loading users...</Typography>
            </Stack>
          ) : users.length === 0 ? (
            <Box sx={{ mx: -2.5, mb: -2.5, borderTop: 1, borderColor: 'divider' }}>
              <EmptyState icon="person_search" title="No users found" description="Try a different search or filter." />
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto', mx: -2.5, mb: -2.5, borderTop: 1, borderColor: 'divider' }}>
              <Table sx={{ minWidth: 820 }} aria-label="Users">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Activity</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u, i) => (
                    <TableRow key={u.id} hover sx={{ ...riseSx(Math.min(i, 8) + 5), '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                          <UserAvatar url={u.avatar_url} name={u.full_name} size={40} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{u.full_name}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap component="div">{u.email}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell><StatusChip active={u.is_active} /></TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {u.stats.notes_count} notes · {u.stats.tasks_count} tasks · {u.stats.meetings_count} meetings · {u.stats.orgs_count} orgs
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={u.role}
                          disabled={u.email === adminEmail}
                          onChange={(e) => handleChangeRole(u, e.target.value)}
                          slotProps={{ htmlInput: { 'aria-label': `Role for ${u.email}` } }}
                          sx={{ minWidth: 140 }}
                        >
                          <MenuItem value="user">User</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                          <MenuItem value="superadmin">Super Admin</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                          <Button size="small" variant="contained" color="primary" startIcon={<Icon name="visibility" size={18} />} onClick={() => handleOpenDetails(u.id)} sx={{ minHeight: 40, whiteSpace: 'nowrap' }}>
                            View
                          </Button>
                          <Tooltip title="Reset password">
                            <IconButton aria-label={`Reset password for ${u.email}`} onClick={() => setResetTarget({ id: u.id, email: u.email })} sx={{ width: 44, height: 44 }}>
                              <Icon name="key" />
                            </IconButton>
                          </Tooltip>
                          {u.email !== adminEmail && (
                            <>
                              <Tooltip title={u.is_active ? 'Suspend user' : 'Activate user'}>
                                <IconButton
                                  aria-label={`${u.is_active ? 'Suspend' : 'Activate'} ${u.email}`}
                                  onClick={() => handleToggleStatus(u)}
                                  sx={{ width: 44, height: 44 }}
                                >
                                  <Icon name={u.is_active ? 'block' : 'check_circle'} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete user">
                                <IconButton
                                  aria-label={`Delete ${u.email}`}
                                  color="error"
                                  onClick={() => handleDeleteUser(u)}
                                  sx={{ width: 44, height: 44, border: 1, borderColor: 'error.main' }}
                                >
                                  <Icon name="delete" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </SectionCard>
      </PageContainer>
    </div>
  );
};
