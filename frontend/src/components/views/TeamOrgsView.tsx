import React, { useEffect, useState } from 'react';
import {
  Avatar, Box, Button, Card, CardActionArea, Chip, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Icon, IconTile, PageContainer, PageHeader, SectionCard, EmptyState, riseSx } from '../ui';
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
  const roleColor = (r: string): 'primary' | 'secondary' | 'default' =>
    r === 'owner' ? 'primary' : r === 'admin' ? 'secondary' : 'default';

  const cardHover = {
    transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
    '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
  };

  return (
    <Box component="section" className="workspace-view active" id="view-team">
      <PageContainer>
        <PageHeader
          overline="Team"
          title="Team"
          description="Switch between workspaces, invite people and choose what each person can do."
          actions={<Chip icon={<Icon name="badge" size={18} />} label={`Your role: ${myRole.charAt(0).toUpperCase()}${myRole.slice(1)}`} variant="outlined" sx={{ height: 36, fontWeight: 600 }} />}
        />

        <Stack spacing={2.5}>
          {/* Workspaces */}
          <SectionCard index={1} icon="apartment" accent="indigo" title="Workspaces" subtitle="Each workspace keeps its own people and content separate">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1.5 }}>
              {orgs.map((org, i) => {
                const isSelected = org.id === activeOrgId;
                return (
                  <Card
                    key={org.id}
                    variant="outlined"
                    sx={(t) => ({
                      ...(riseSx(i + 2) as object),
                      ...cardHover,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? t.palette.secondary.main : t.palette.divider,
                      bgcolor: isSelected ? alpha(t.palette.secondary.main, 0.06) : t.palette.background.paper,
                    })}
                  >
                    <CardActionArea onClick={() => onSelectOrg(org)} sx={{ p: 2, minHeight: 44 }} aria-pressed={isSelected}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar variant="rounded" sx={{ bgcolor: isSelected ? 'secondary.main' : 'primary.main', color: isSelected ? '#fff' : 'primary.contrastText', width: 40, height: 40, fontWeight: 700, borderRadius: '12px' }}>
                          {org.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle1" noWrap>{org.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {org.member_count} member(s) · {org.my_role}
                          </Typography>
                        </Box>
                        <Chip size="small" label={org.plan.toUpperCase()} />
                      </Stack>
                      {isSelected && (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1.25, color: 'secondary.main' }}>
                          <Icon name="check_circle" size={16} fill />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'inherit' }}>Active workspace</Typography>
                        </Stack>
                      )}
                    </CardActionArea>
                  </Card>
                );
              })}
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }} alignItems={{ sm: 'center' }}>
              <TextField
                label="New workspace name"
                placeholder="e.g. Acme Marketing"
                size="small"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField select label="Plan" size="small" value={newOrgPlan} onChange={(e) => setNewOrgPlan(e.target.value)} sx={{ minWidth: { sm: 150 } }}>
                <MenuItem value="starter">Starter</MenuItem>
                <MenuItem value="pro">Pro</MenuItem>
                <MenuItem value="team">Team</MenuItem>
                <MenuItem value="enterprise">Enterprise</MenuItem>
              </TextField>
              <Button variant="contained" color="primary" onClick={handleCreateOrg} startIcon={<Icon name="add_business" size={18} />} sx={{ minHeight: 44, whiteSpace: 'nowrap' }}>
                Create workspace
              </Button>
            </Stack>
          </SectionCard>

          {/* Members */}
          <SectionCard
            index={3}
            icon="group"
            accent="cyan"
            title="Members & roles"
            subtitle="Owner: full access · Admin: manage team and billing · Editor: create and edit · Member · Viewer: read only"
          >
            {canManage && (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
                <TextField type="email" label="Email" placeholder="teammate@company.com" size="small" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} sx={{ flex: 1.4 }} />
                <TextField label="Full name (optional)" size="small" value={inviteName} onChange={(e) => setInviteName(e.target.value)} sx={{ flex: 1 }} />
                <TextField select label="Role" size="small" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} sx={{ minWidth: { md: 140 } }}>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="editor">Editor</MenuItem>
                  <MenuItem value="member">Member</MenuItem>
                  <MenuItem value="viewer">Viewer</MenuItem>
                </TextField>
                <Button variant="contained" color="primary" onClick={handleInvite} startIcon={<Icon name="person_add" size={18} />} sx={{ minHeight: 44, whiteSpace: 'nowrap' }}>
                  Invite
                </Button>
              </Stack>
            )}

            {loading ? (
              <Stack spacing={1}>
                {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={52} />)}
                <Typography variant="body2" color="text.secondary">Loading members...</Typography>
              </Stack>
            ) : (
              <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 3 }}>
                <Table size="small" sx={{ minWidth: 560 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Person</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Role</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {members.map((m, i) => (
                      <TableRow key={m.id} hover sx={{ ...(riseSx(i + 3) as object), '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ width: 34, height: 34, fontSize: 14, bgcolor: 'action.selected', color: 'text.primary' }}>
                              {(m.full_name || m.user_email).charAt(0).toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{m.full_name || m.user_email}</Typography>
                              <Typography variant="caption" color="text.secondary" noWrap component="div">{m.user_email}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" variant="outlined" color={m.status === 'active' ? 'success' : 'default'} label={m.status} />
                        </TableCell>
                        <TableCell align="right">
                          {canManage && m.user_email !== userEmail ? (
                            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                              <TextField
                                select
                                size="small"
                                label="Role"
                                value={m.role}
                                onChange={(e) => handleRoleChange(m.user_email, e.target.value)}
                                sx={{ minWidth: 120 }}
                              >
                                <MenuItem value="owner">Owner</MenuItem>
                                <MenuItem value="admin">Admin</MenuItem>
                                <MenuItem value="editor">Editor</MenuItem>
                                <MenuItem value="member">Member</MenuItem>
                                <MenuItem value="viewer">Viewer</MenuItem>
                              </TextField>
                              <Button variant="outlined" color="error" size="small" onClick={() => handleRemove(m.user_email)} sx={{ minHeight: 40 }}>
                                Remove
                              </Button>
                            </Stack>
                          ) : (
                            <Chip size="small" color={roleColor(m.role)} label={m.role.toUpperCase()} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </SectionCard>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <SectionCard index={4} icon="mail" accent="amber" title="Invitations for you" subtitle="Join a workspace you were invited to" sx={{ borderColor: 'secondary.main' }}>
              <Stack spacing={1}>
                {pendingInvites.map((inv) => (
                  <Stack
                    key={inv.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    sx={{ p: 1.5, borderRadius: 3, border: 1, borderColor: 'divider' }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" noWrap>{inv.name}</Typography>
                      <Chip size="small" label={inv.role.toUpperCase()} />
                    </Stack>
                    <Button
                      variant="contained"
                      color="primary"
                      sx={{ minHeight: 44 }}
                      onClick={async () => {
                        const res = await acceptOrgInvite(inv.id, userEmail);
                        if (res.member) {
                          showToast(`Joined ${inv.name}!`);
                          setPendingInvites((prev) => prev.filter((x) => x.id !== inv.id));
                          loadOrgs();
                        }
                      }}
                    >
                      Accept invite
                    </Button>
                  </Stack>
                ))}
              </Stack>
            </SectionCard>
          )}

          {/* Branding & Shared Feed */}
          {activeOrgId && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2.5 }}>
              <SectionCard index={5} icon="palette" accent="violet" title="Branding" subtitle="Workspace name and accent color (admins and owners only)">
                <Stack spacing={2}>
                  <TextField label="Workspace display name" size="small" value={brandName} onChange={(e) => setBrandName(e.target.value)} fullWidth />
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      component="label"
                      sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: brandColor, border: 1, borderColor: 'divider', cursor: 'pointer', position: 'relative', overflow: 'hidden', flex: 'none' }}
                    >
                      <Box
                        component="input"
                        type="color"
                        aria-label="Accent color"
                        value={brandColor}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBrandColor(e.target.value)}
                        sx={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', border: 0, p: 0 }}
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Accent color</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{brandColor}</Typography>
                    </Box>
                  </Stack>
                  <Button
                    variant="contained"
                    color="primary"
                    sx={{ minHeight: 44, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
                    onClick={async () => {
                      const res = await updateTenantBranding({
                        org_id: activeOrgId,
                        name: brandName || undefined,
                        brand_color: brandColor,
                        user_email: userEmail
                      });
                      if (res.error) showToast(res.error);
                      else {
                        showToast('Branding updated!');
                        loadOrgs();
                      }
                    }}
                  >
                    Save branding
                  </Button>
                </Stack>
              </SectionCard>

              <SectionCard
                index={6}
                icon="dynamic_feed"
                accent="green"
                title="Shared with the team"
                subtitle={`${sharedFeed.notes.length} notes · ${sharedFeed.tasks.length} tasks shared with this workspace`}
              >
                {sharedFeed.notes.length === 0 && sharedFeed.tasks.length === 0 ? (
                  <EmptyState icon="share" title="Nothing shared yet" description="Open Smart Notes and choose Share to Team Feed." />
                ) : (
                  <Stack spacing={1} sx={{ maxHeight: 260, overflowY: 'auto', pr: 0.5 }}>
                    {sharedFeed.notes.map((n) => (
                      <Stack key={n.id} direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.25, borderRadius: 2.5, border: 1, borderColor: 'divider' }}>
                        <IconTile icon="description" accent="indigo" size={30} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{n.title || 'Untitled'}</Typography>
                          <Typography variant="caption" color="text.secondary">Note · by {n.user_email}</Typography>
                        </Box>
                      </Stack>
                    ))}
                    {sharedFeed.tasks.map((t) => (
                      <Stack key={t.id} direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.25, borderRadius: 2.5, border: 1, borderColor: 'divider' }}>
                        <IconTile icon="task_alt" accent="green" size={30} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{t.title}</Typography>
                          <Typography variant="caption" color="text.secondary">Task · {t.priority}</Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </SectionCard>
            </Box>
          )}
        </Stack>
      </PageContainer>
    </Box>
  );
};
