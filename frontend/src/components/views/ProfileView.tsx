import React, { useEffect, useRef, useState } from 'react';
import {
  fetchUserProfile,
  updateUserProfile,
  changeUserPassword,
  type UserProfile,
  type ProfileStats,
  type ProfileMembership,
} from '../../services/profile';
import type { ViewId } from '../common/Sidebar';
import { getStoredJwtToken } from '../../services/enterprise';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { EmptyState, Icon, PageContainer, SectionCard, StatCard, riseSx } from '../ui';

/** Icon shown for each quick-avatar preset (stored values stay unchanged). */
const AVATAR_ICONS: Record<string, { icon: string; label: string }> = {
  '🚀': { icon: 'rocket_launch', label: 'Rocket' },
  '🧠': { icon: 'psychology', label: 'Brain' },
  '⚡': { icon: 'bolt', label: 'Bolt' },
  '🎯': { icon: 'target', label: 'Target' },
  '🛡️': { icon: 'shield', label: 'Shield' },
  '👨‍💻': { icon: 'laptop_mac', label: 'Laptop' },
};


interface ProfileViewProps {
  userEmail: string;
  userName: string;
  activeOrgName?: string;
  isAuthenticated: boolean;
  onAuthTrigger: () => void;
  onProfileUpdated: (newName: string, newAvatarUrl: string) => void;
  onNavigateView: (view: ViewId) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const AVATAR_PRESETS = ['🚀', '🧠', '⚡', '🎯', '🛡️', '👨‍💻'];

const TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const AI_PERSONAS = [
  'Workspace Copilot',
  'Executive Coach',
  'Senior Architect',
  'Marketing Copywriter',
  'Contract Analyst',
  'Bengali-English Tutor',
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  userEmail,
  userName,
  activeOrgName,
  isAuthenticated,
  onAuthTrigger,
  onProfileUpdated,
  onNavigateView,
  showToast,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);

  const load2FAStatus = async () => {
    const token = getStoredJwtToken();
    if (!token) return;
    try {
      const r = await fetch('/api/auth/2fa/status', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d = await r.json();
        setTotpEnabled(Boolean(d.totp_enabled));
      }
    } catch {}
  };

  useEffect(() => {
    load2FAStatus();
  }, [userEmail]);

  const handleSetup2FA = async () => {
    const token = getStoredJwtToken();
    if (!token) return showToast('Please sign in first', 'error');
    try {
      setTotpBusy(true);
      const r = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '2FA setup failed');
      setTotpSecret(d.secret || '');
      setTotpUri(d.otpauth_uri || '');
      showToast('Scan/enter the secret in Google Authenticator or Authy', 'info');
    } catch (e: any) {
      showToast(e.message || '2FA setup failed', 'error');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleVerify2FA = async () => {
    const token = getStoredJwtToken();
    if (!token) return;
    try {
      setTotpBusy(true);
      const r = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: totpCode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Verification failed');
      setTotpEnabled(true);
      setTotpSecret('');
      setTotpUri('');
      setTotpCode('');
      showToast('Two-Factor Authentication enabled!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Invalid 2FA code', 'error');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleDisable2FA = async () => {
    const token = getStoredJwtToken();
    if (!token) return;
    try {
      setTotpBusy(true);
      const r = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: totpCode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Disable failed');
      setTotpEnabled(false);
      setTotpCode('');
      showToast('Two-Factor Authentication disabled', 'info');
    } catch (e: any) {
      showToast(e.message || 'Failed to disable 2FA', 'error');
    } finally {
      setTotpBusy(false);
    }
  };

  const [profile, setProfile] = useState<UserProfile>({
    id: '',
    email: userEmail,
    full_name: userName,
    job_title: '',
    department: '',
    bio: '',
    phone: '',
    location: '',
    timezone: 'Asia/Kolkata',
    avatar_url: '',
    ai_persona_preference: 'Workspace Copilot',
    working_hours: '09:00 - 18:00',
  });

  const [stats, setStats] = useState<ProfileStats>({
    notes_count: 0,
    tasks_total: 0,
    tasks_completed: 0,
    meetings_count: 0,
    documents_count: 0,
    habits_count: 0,
    goals_count: 0,
    orgs_count: 0,
    ai_credits_used: 0,
    ai_credits_limit: 500,
    plan_id: 'starter',
  });

  const [memberships, setMemberships] = useState<ProfileMembership[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await fetchUserProfile(userEmail);
      setProfile(data.profile);
      setStats(data.stats);
      setMemberships(data.memberships || []);
    } catch (err: any) {
      showToast(err?.message || 'Could not load profile details', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [userEmail]);

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateUserProfile({
        user_email: userEmail,
        full_name: profile.full_name,
        job_title: profile.job_title,
        department: profile.department,
        bio: profile.bio,
        phone: profile.phone,
        location: profile.location,
        timezone: profile.timezone,
        avatar_url: profile.avatar_url,
        ai_persona_preference: profile.ai_persona_preference,
        working_hours: profile.working_hours,
      });
      setProfile((prev) => ({ ...prev, ...updated }));
      onProfileUpdated(updated.full_name, updated.avatar_url || '');
      showToast('Profile saved to cloud!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setProfile((p) => ({ ...p, avatar_url: dataUrl }));
        showToast('Avatar ready — click Save Profile to persist.', 'info');
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'warning');
      return;
    }
    setChangingPass(true);
    try {
      const res = await changeUserPassword({
        user_email: userEmail,
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast(res.message || 'Password updated!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Password update failed', 'error');
    } finally {
      setChangingPass(false);
    }
  };

  const isImageAvatar =
    profile.avatar_url.startsWith('http') || profile.avatar_url.startsWith('data:image');
  const initialLetter = (profile.full_name || userEmail || 'U').charAt(0).toUpperCase();
  const completionPct =
    stats.tasks_total > 0 ? Math.round((stats.tasks_completed / stats.tasks_total) * 100) : 0;

  const [tab, setTab] = useState(0);
  const presetIcon = AVATAR_ICONS[profile.avatar_url];
  const isGuest = userEmail === 'guest@renimai.com';
  const creditPct =
    stats.ai_credits_limit > 0 ? Math.min(100, Math.round((stats.ai_credits_used / stats.ai_credits_limit) * 100)) : 0;
  const twoCol = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } } as const;

  return (
    <div id="view-profile" className="view-container active">
      <PageContainer>
        {/* Hero Profile Banner */}
        <Card sx={{ p: { xs: 2.5, sm: 3 }, mb: 2.5, ...riseSx(0) }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.25} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ minWidth: 0 }}>
              <Tooltip title="Upload photo">
                <Box
                  component="button"
                  type="button"
                  aria-label="Upload profile photo"
                  onClick={() => avatarFileInputRef.current?.click()}
                  sx={{
                    p: 0,
                    border: 0,
                    bgcolor: 'transparent',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    position: 'relative',
                    flex: 'none',
                    '&:hover .avatar-overlay, &:focus-visible .avatar-overlay': { opacity: 1 },
                  }}
                >
                  <Avatar
                    src={isImageAvatar ? profile.avatar_url : undefined}
                    alt={profile.full_name}
                    sx={{
                      width: 80,
                      height: 80,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      fontSize: 32,
                      fontWeight: 800,
                      boxShadow: (t) => `0 0 0 4px ${alpha(t.palette.secondary.main, 0.2)}`,
                    }}
                  >
                    {isImageAvatar ? null : presetIcon ? <Icon name={presetIcon.icon} size={36} /> : profile.avatar_url || initialLetter}
                  </Avatar>
                  <Box
                    className="avatar-overlay"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      bgcolor: 'rgba(15,23,42,.55)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity .2s',
                    }}
                  >
                    <Icon name="photo_camera" size={24} />
                  </Box>
                </Box>
              </Tooltip>

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="overline" color="text.secondary">My profile</Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
                    {profile.full_name || 'Renim AI User'}
                  </Typography>
                  <Chip size="small" color="secondary" label={`${stats.plan_id} plan`} sx={{ fontWeight: 700, textTransform: 'capitalize' }} />
                  {activeOrgName && <Chip size="small" variant="outlined" icon={<Icon name="corporate_fare" size={14} />} label={activeOrgName} />}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                  {profile.job_title ? `${profile.job_title}` : 'Workspace member'}
                  {profile.department ? ` · ${profile.department}` : ''}
                  {' · '}
                  {profile.email}
                </Typography>
                {profile.created_at && (
                  <Typography variant="caption" color="text.secondary">
                    Member since {new Date(profile.created_at).toLocaleDateString()}
                    {profile.location ? ` · ${profile.location}` : ''}
                  </Typography>
                )}
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flex: 'none' }}>
              <Button variant="outlined" startIcon={<Icon name="photo_camera" />} onClick={() => avatarFileInputRef.current?.click()}>
                Upload photo
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Icon name="save" />}
                onClick={() => handleSaveProfile()}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </Stack>
          </Stack>

          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarUpload}
          />
        </Card>

        {/* Live Productivity Stats */}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, mb: 3 }}>
          <StatCard
            index={1}
            icon="description"
            accent="cyan"
            label="Notes"
            value={loading ? '...' : stats.notes_count}
            hint={`${stats.documents_count} documents in knowledge base`}
          />
          <StatCard
            index={2}
            icon="task_alt"
            accent="green"
            label="Tasks done"
            value={loading ? '...' : `${stats.tasks_completed} / ${stats.tasks_total}`}
            hint={`${completionPct}% complete · ${stats.meetings_count} meetings`}
          />
          <Card sx={{ p: 2.25, ...riseSx(3), gridColumn: { sm: '1 / -1', md: 'auto' } }}>
            <Stack direction="row" alignItems="center" spacing={1.75}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                  {loading ? '...' : `${stats.ai_credits_used} / ${stats.ai_credits_limit}`}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>AI credits used</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">{stats.habits_count} habits · {stats.goals_count} goals</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={loading ? 0 : creditPct}
              color="secondary"
              aria-label="AI credits used"
              sx={{ mt: 1.5, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { borderRadius: 3, transition: 'transform .8s cubic-bezier(.2,.7,.2,1)' } }}
            />
          </Card>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, ...riseSx(4) }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Profile sections"
          >
            <Tab icon={<Icon name="badge" size={18} />} iconPosition="start" label="Details" sx={{ minHeight: 48 }} />
            <Tab icon={<Icon name="corporate_fare" size={18} />} iconPosition="start" label={`Organizations (${memberships.length})`} sx={{ minHeight: 48 }} />
            <Tab icon={<Icon name="lock" size={18} />} iconPosition="start" label="Security" sx={{ minHeight: 48 }} />
          </Tabs>
        </Box>

        {/* Tab: Personal details */}
        {tab === 0 && (
          <Card component="form" onSubmit={handleSaveProfile} sx={{ p: { xs: 2.25, sm: 3 }, ...riseSx(5) }}>
            <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>Personal details</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>How you appear to your team and your AI assistant.</Typography>

            {/* Avatar Presets */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Quick avatar</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 3 }}>
              {AVATAR_PRESETS.map((emoji) => {
                const meta = AVATAR_ICONS[emoji];
                const selected = profile.avatar_url === emoji;
                return (
                  <Box
                    key={emoji}
                    component="button"
                    type="button"
                    aria-label={`Use ${meta?.label || 'preset'} avatar`}
                    aria-pressed={selected}
                    onClick={() => setProfile((p) => ({ ...p, avatar_url: emoji }))}
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '12px',
                      border: selected ? 2 : 1,
                      borderColor: selected ? 'secondary.main' : 'divider',
                      bgcolor: (t) => (selected ? alpha(t.palette.secondary.main, 0.1) : 'transparent'),
                      color: selected ? 'secondary.main' : 'text.secondary',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'transform .15s ease',
                      '&:hover': { transform: 'translateY(-2px)' },
                      '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
                    }}
                  >
                    {meta ? <Icon name={meta.icon} size={22} fill={selected} /> : emoji}
                  </Box>
                );
              })}
              {profile.avatar_url && (
                <Button variant="text" startIcon={<Icon name="restart_alt" />} onClick={() => setProfile((p) => ({ ...p, avatar_url: '' }))}>
                  Use initials
                </Button>
              )}
            </Stack>

            <Stack spacing={2}>
              <Box sx={twoCol}>
                <TextField
                  label="Full name"
                  value={profile.full_name}
                  onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Your full name"
                  fullWidth
                />
                <TextField type="email" label="Email" value={profile.email} slotProps={{ input: { readOnly: true } }} fullWidth />
              </Box>
              <Box sx={twoCol}>
                <TextField
                  label="Job title"
                  value={profile.job_title}
                  onChange={(e) => setProfile((p) => ({ ...p, job_title: e.target.value }))}
                  placeholder="e.g. Manager, Designer"
                  fullWidth
                />
                <TextField
                  label="Team or department"
                  value={profile.department}
                  onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))}
                  placeholder="e.g. Operations, Sales"
                  fullWidth
                />
              </Box>
              <Box sx={twoCol}>
                <TextField
                  label="Phone"
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  fullWidth
                />
                <TextField
                  label="City"
                  value={profile.location}
                  onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Kolkata, India"
                  fullWidth
                />
              </Box>
              <Box sx={twoCol}>
                <TextField
                  select
                  label="Time zone"
                  value={profile.timezone}
                  onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}
                  fullWidth
                >
                  {TIMEZONES.map((tz) => (
                    <MenuItem key={tz} value={tz}>
                      {tz}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Working hours"
                  value={profile.working_hours}
                  onChange={(e) => setProfile((p) => ({ ...p, working_hours: e.target.value }))}
                  placeholder="09:00 - 18:00"
                  fullWidth
                />
              </Box>
              <TextField
                select
                label="AI assistant style"
                value={profile.ai_persona_preference}
                onChange={(e) => setProfile((p) => ({ ...p, ai_persona_preference: e.target.value }))}
                fullWidth
              >
                {AI_PERSONAS.map((persona) => (
                  <MenuItem key={persona} value={persona}>
                    {persona}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="About me"
                multiline
                minRows={3}
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Your focus areas and goals..."
                fullWidth
              />
              <Box>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={saving}
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Icon name="check_circle" />}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
              </Box>
            </Stack>
          </Card>
        )}

        {/* Tab: Organizations */}
        {tab === 1 && (
          <SectionCard
            index={5}
            icon="corporate_fare"
            accent="indigo"
            title="Organizations & roles"
            subtitle="Teams you belong to."
            action={
              <Button variant="outlined" size="small" sx={{ minHeight: 40, flex: 'none' }} onClick={() => onNavigateView('view-team')}>
                Manage teams
              </Button>
            }
          >
            {memberships.length === 0 ? (
              <EmptyState
                icon="groups"
                title="Personal workspace"
                description="Create or join an organization in Teams to work together."
              />
            ) : (
              <Stack spacing={1.25}>
                {memberships.map((m, i) => (
                  <Stack
                    key={m.org_id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1.5}
                    sx={{
                      px: 2,
                      py: 1.5,
                      borderRadius: 3,
                      border: 1,
                      borderColor: 'divider',
                      ...riseSx(i + 6),
                      transition: 'border-color .2s',
                      '&:hover': { borderColor: 'secondary.main' },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>{m.org_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Plan: {m.plan} · Status: {m.status}
                      </Typography>
                    </Box>
                    <Chip size="small" label={m.role} color="secondary" variant="outlined" sx={{ fontWeight: 700, textTransform: 'capitalize' }} />
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        )}

        {/* Tab: Account Security */}
        {tab === 2 && (
          <Stack spacing={2.5}>
            <SectionCard index={5} icon="lock" accent="slate" title="Password & sign-in">
              {isGuest ? (
                <Stack spacing={2} alignItems="flex-start">
                  <Typography variant="body2" color="text.secondary">
                    You are browsing as a guest. Sign in or create an account to protect your workspace with a password.
                  </Typography>
                  <Button variant="contained" color="primary" startIcon={<Icon name="login" />} onClick={onAuthTrigger}>
                    Sign in / Create account
                  </Button>
                </Stack>
              ) : (
                <Box component="form" onSubmit={handleChangePassword}>
                  <Stack spacing={2}>
                    {profile.has_password && (
                      <TextField
                        type="password"
                        label="Current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                        fullWidth
                      />
                    )}
                    <Box sx={twoCol}>
                      <TextField
                        type="password"
                        label="New password"
                        helperText="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        fullWidth
                      />
                      <TextField
                        type="password"
                        label="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        fullWidth
                      />
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={changingPass}
                        startIcon={changingPass ? <CircularProgress size={16} color="inherit" /> : <Icon name="key" />}
                      >
                        {changingPass ? 'Updating...' : 'Update password'}
                      </Button>
                      <Button variant="outlined" startIcon={<Icon name={isAuthenticated ? 'logout' : 'login'} />} onClick={onAuthTrigger}>
                        {isAuthenticated ? 'Sign out' : 'Sign in'}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              )}
            </SectionCard>

            {!isGuest && (
              <SectionCard
                index={6}
                icon="verified_user"
                accent="green"
                title="Two-step verification"
                subtitle="Use an authenticator app for an extra code at sign-in."
                action={
                  <Chip
                    size="small"
                    label={totpEnabled ? 'On' : 'Off'}
                    color={totpEnabled ? 'success' : 'warning'}
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                }
              >
                {!totpEnabled && !totpSecret && (
                  <Button
                    variant="outlined"
                    disabled={totpBusy}
                    startIcon={totpBusy ? <CircularProgress size={16} color="inherit" /> : <Icon name="verified_user" />}
                    onClick={handleSetup2FA}
                  >
                    {totpBusy ? 'Generating...' : 'Turn on'}
                  </Button>
                )}

                {!totpEnabled && totpSecret && (
                  <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                      Add this key to your authenticator app (e.g. Google Authenticator or Authy):
                    </Typography>
                    <Box
                      component="code"
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: (t) => alpha(t.palette.secondary.main, 0.1),
                        fontSize: 13,
                        letterSpacing: '1px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {totpSecret}
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <TextField
                        label="6-digit code"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                        slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }}
                        fullWidth
                      />
                      <Button variant="contained" color="primary" disabled={totpBusy} onClick={handleVerify2FA} sx={{ minHeight: 56, flex: 'none' }}>
                        Verify & turn on
                      </Button>
                    </Stack>
                  </Stack>
                )}

                {totpEnabled && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      label="6-digit code to turn off"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }}
                      fullWidth
                    />
                    <Button variant="outlined" color="error" disabled={totpBusy} onClick={handleDisable2FA} sx={{ minHeight: 56, flex: 'none' }}>
                      Turn off
                    </Button>
                  </Stack>
                )}
              </SectionCard>
            )}

            {/* Privacy & Session Revocation */}
            {!isGuest && (
              <SectionCard index={7} icon="shield_person" accent="red" title="Privacy & account" subtitle="Sessions, your data and account removal.">
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
                  <Button
                    variant="outlined"
                    startIcon={<Icon name="devices" />}
                    onClick={async () => {
                      const token = getStoredJwtToken();
                      if (!token) return;
                      try {
                        const r = await fetch('/api/auth/logout-all', {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        const d = await r.json();
                        if (!r.ok) throw new Error(d.error || 'Failed');
                        showToast('All active sessions revoked. Signing out...', 'info');
                        setTimeout(() => onAuthTrigger(), 900);
                      } catch (e: any) {
                        showToast(e.message || 'Failed to revoke sessions', 'error');
                      }
                    }}
                  >
                    Sign out all devices
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<Icon name="download" />}
                    onClick={async () => {
                      const token = getStoredJwtToken();
                      if (!token) return;
                      try {
                        const r = await fetch('/api/profile/export-data', {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (!r.ok) throw new Error('Export failed');
                        const blob = await r.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'renim-ai-gdpr-export.json';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        showToast('Your data has been exported', 'success');
                      } catch (e: any) {
                        showToast(e.message || 'Export failed', 'error');
                      }
                    }}
                  >
                    Export my data
                  </Button>
                </Stack>

                <Divider sx={{ my: 2.5 }} />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
                  <Box>
                    <Typography variant="subtitle2" color="error.main">Delete account</Typography>
                    <Typography variant="body2" color="text.secondary">Permanently remove your account and personal data.</Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Icon name="delete_forever" />}
                    sx={{ flex: 'none' }}
                    onClick={async () => {
                      if (!confirm('Permanently delete your account and all personal workspace data? This cannot be undone.')) return;
                      const token = getStoredJwtToken();
                      if (!token) return;
                      try {
                        const r = await fetch('/api/profile/account', {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        const d = await r.json();
                        if (!r.ok) throw new Error(d.error || 'Deletion failed');
                        localStorage.removeItem('sb_session');
                        showToast('Account permanently deleted', 'info');
                        window.location.href = '/signin';
                      } catch (e: any) {
                        showToast(e.message || 'Account deletion failed', 'error');
                      }
                    }}
                  >
                    Delete account
                  </Button>
                </Stack>
              </SectionCard>
            )}
          </Stack>
        )}
      </PageContainer>
    </div>
  );
};
