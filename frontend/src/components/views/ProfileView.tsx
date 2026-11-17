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

  return (
    <div id="view-profile" className="view-container active">
      <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Hero Profile Banner */}
        <div
          className="mui-card"
          style={{
            background:
              'linear-gradient(135deg, rgba(6, 182, 212, 0.14) 0%, rgba(99, 102, 241, 0.12) 100%)',
            borderColor: 'rgba(6, 182, 212, 0.35)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div
                onClick={() => avatarFileInputRef.current?.click()}
                title="Click to upload profile photo"
                style={{
                  width: '78px',
                  height: '78px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isImageAvatar ? '0px' : profile.avatar_url ? '34px' : '30px',
                  fontWeight: 800,
                  color: '#ffffff',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  border: '3px solid rgba(255,255,255,0.25)',
                  flexShrink: 0,
                  boxShadow: '0 8px 24px rgba(6, 182, 212, 0.25)',
                }}
              >
                {isImageAvatar ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  profile.avatar_url || initialLetter
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
                    {profile.full_name || 'Renim AI User'}
                  </h2>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: 'rgba(6, 182, 212, 0.18)',
                      color: '#22d3ee',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {stats.plan_id} Plan
                  </span>
                  {activeOrgName && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: 'rgba(99, 102, 241, 0.18)',
                        color: '#a5b4fc',
                      }}
                    >
                      {activeOrgName}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '13px', opacity: 0.85 }}>
                  {profile.job_title ? `${profile.job_title}` : 'Workspace Member'}
                  {profile.department ? ` • ${profile.department}` : ''}
                  {' • '}
                  <span style={{ opacity: 0.75 }}>{profile.email}</span>
                </div>

                {profile.created_at && (
                  <div style={{ fontSize: '11.5px', opacity: 0.65 }}>
                    Member since {new Date(profile.created_at).toLocaleDateString()}
                    {profile.location ? ` • ${profile.location}` : ''}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="mui-btn mui-btn-outlined mui-btn-sm"
                onClick={() => avatarFileInputRef.current?.click()}
              >
                <span className="material-symbols-rounded icon-sm">photo_camera</span>
                <span>Upload Photo</span>
              </button>
              <button
                type="button"
                className="mui-btn mui-btn-primary mui-btn-sm"
                onClick={() => handleSaveProfile()}
                disabled={saving}
              >
                <span className="material-symbols-rounded icon-sm">save</span>
                <span>{saving ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </div>

          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Live Productivity Stats */}
        <div className="mui-grid-3" style={{ gap: '14px' }}>
          <div className="mui-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>Smart Notes & Docs</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#22d3ee' }}>
              {loading ? '...' : `${stats.notes_count} Notes`}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '4px' }}>
              {stats.documents_count} Knowledge Docs indexed
            </div>
          </div>

          <div className="mui-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>Tasks & Execution</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#34d399' }}>
              {loading ? '...' : `${stats.tasks_completed} / ${stats.tasks_total}`}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '4px' }}>
              {completionPct}% completion • {stats.meetings_count} Meetings
            </div>
          </div>

          <div className="mui-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>Growth & AI Credits</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#a78bfa' }}>
              {loading ? '...' : `${stats.ai_credits_used} / ${stats.ai_credits_limit}`}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '4px' }}>
              {stats.habits_count} Habits • {stats.goals_count} Goals
            </div>
          </div>
        </div>

        {/* Main 2-Column Layout: Edit Profile + Security & Orgs */}
        <div className="mui-grid-2" style={{ gap: '18px', alignItems: 'start' }}>
          {/* Left: Edit Personal & Work Profile */}
          <form className="mui-card" onSubmit={handleSaveProfile}>
            <h3 className="mui-card-title" style={{ marginBottom: '14px' }}>
              <span className="material-symbols-rounded">badge</span>
              <span>Personal & Workspace Identity</span>
            </h3>

            {/* Avatar Presets */}
            <div className="mui-input-group">
              <label>Quick Avatar Icon</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {AVATAR_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, avatar_url: emoji }))}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      border:
                        profile.avatar_url === emoji
                          ? '2px solid #06b6d4'
                          : '1px solid var(--mui-border)',
                      background: 'rgba(255,255,255,0.04)',
                      fontSize: '18px',
                      cursor: 'pointer',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
                {profile.avatar_url && (
                  <button
                    type="button"
                    className="mui-btn mui-btn-outlined mui-btn-sm"
                    onClick={() => setProfile((p) => ({ ...p, avatar_url: '' }))}
                  >
                    Reset Initials
                  </button>
                )}
              </div>
            </div>

            <div className="mui-grid-2" style={{ gap: '12px' }}>
              <div className="mui-input-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="mui-input"
                  value={profile.full_name}
                  onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Your full name"
                />
              </div>

              <div className="mui-input-group">
                <label>Email Address</label>
                <input type="email" className="mui-input" value={profile.email} readOnly />
              </div>
            </div>

            <div className="mui-grid-2" style={{ gap: '12px' }}>
              <div className="mui-input-group">
                <label>Job Title / Role</label>
                <input
                  type="text"
                  className="mui-input"
                  value={profile.job_title}
                  onChange={(e) => setProfile((p) => ({ ...p, job_title: e.target.value }))}
                  placeholder="e.g. Product Manager, Tech Lead"
                />
              </div>

              <div className="mui-input-group">
                <label>Department / Team</label>
                <input
                  type="text"
                  className="mui-input"
                  value={profile.department}
                  onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))}
                  placeholder="e.g. Engineering, Operations"
                />
              </div>
            </div>

            <div className="mui-grid-2" style={{ gap: '12px' }}>
              <div className="mui-input-group">
                <label>Phone</label>
                <input
                  type="text"
                  className="mui-input"
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="mui-input-group">
                <label>Location / City</label>
                <input
                  type="text"
                  className="mui-input"
                  value={profile.location}
                  onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Kolkata, India"
                />
              </div>
            </div>

            <div className="mui-grid-2" style={{ gap: '12px' }}>
              <div className="mui-input-group">
                <label>Timezone</label>
                <select
                  className="mui-input"
                  value={profile.timezone}
                  onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mui-input-group">
                <label>Working Hours</label>
                <input
                  type="text"
                  className="mui-input"
                  value={profile.working_hours}
                  onChange={(e) => setProfile((p) => ({ ...p, working_hours: e.target.value }))}
                  placeholder="09:00 - 18:00"
                />
              </div>
            </div>

            <div className="mui-input-group">
              <label>Default AI Copilot Persona</label>
              <select
                className="mui-input"
                value={profile.ai_persona_preference}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, ai_persona_preference: e.target.value }))
                }
              >
                {AI_PERSONAS.map((persona) => (
                  <option key={persona} value={persona}>
                    {persona}
                  </option>
                ))}
              </select>
            </div>

            <div className="mui-input-group">
              <label>Bio / About Me</label>
              <textarea
                className="mui-input"
                rows={3}
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Tell your team or AI Copilot about your focus areas and goals..."
              />
            </div>

            <button
              type="submit"
              className="mui-btn mui-btn-primary"
              disabled={saving}
              style={{ width: '100%' }}
            >
              <span className="material-symbols-rounded icon-sm">check_circle</span>
              <span>{saving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
          </form>

          {/* Right: Organizations & Account Security */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Organizations */}
            <div className="mui-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  gap: '10px',
                }}
              >
                <h3 className="mui-card-title" style={{ margin: 0 }}>
                  <span className="material-symbols-rounded">corporate_fare</span>
                  <span>Organizations & Roles ({memberships.length})</span>
                </h3>
                <button
                  type="button"
                  className="mui-btn mui-btn-outlined mui-btn-sm"
                  onClick={() => onNavigateView('view-team')}
                >
                  Manage Teams
                </button>
              </div>

              {memberships.length === 0 ? (
                <p style={{ fontSize: '13px', opacity: 0.7, margin: 0 }}>
                  You are currently using your Personal Workspace. Create or join an Organization in{' '}
                  <strong>Team &amp; Orgs</strong> for multi-tenant collaboration.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {memberships.map((m) => (
                    <div
                      key={m.org_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--mui-border)',
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{m.org_name}</div>
                        <div style={{ fontSize: '11.5px', opacity: 0.7 }}>
                          Plan: {m.plan} • Status: {m.status}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '999px',
                          background: 'rgba(6, 182, 212, 0.16)',
                          color: '#22d3ee',
                          textTransform: 'uppercase',
                        }}
                      >
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Account Security */}
            <div className="mui-card">
              <h3 className="mui-card-title" style={{ marginBottom: '12px' }}>
                <span className="material-symbols-rounded">lock</span>
                <span>Account Security &amp; Session</span>
              </h3>

              {userEmail === 'guest@renimai.com' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p style={{ fontSize: '13px', opacity: 0.78, margin: 0 }}>
                    You are currently browsing as a Guest (`guest@renimai.com`). Sign in or create a
                    personal account to protect your workspace with a password.
                  </p>
                  <button
                    type="button"
                    className="mui-btn mui-btn-primary"
                    onClick={onAuthTrigger}
                  >
                    <span className="material-symbols-rounded icon-sm">login</span>
                    <span>Sign In / Create Account</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleChangePassword}>
                  {profile.has_password && (
                    <div className="mui-input-group">
                      <label>Current Password</label>
                      <input
                        type="password"
                        className="mui-input"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                      />
                    </div>
                  )}
                  <div className="mui-input-group">
                    <label>New Password (min 6 characters)</label>
                    <input
                      type="password"
                      className="mui-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="mui-input-group">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      className="mui-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="submit"
                      className="mui-btn mui-btn-primary"
                      disabled={changingPass}
                      style={{ flex: 1 }}
                    >
                      <span className="material-symbols-rounded icon-sm">key</span>
                      <span>{changingPass ? 'Updating...' : 'Update Password'}</span>
                    </button>
                    <button
                      type="button"
                      className="mui-btn mui-btn-outlined"
                      onClick={onAuthTrigger}
                    >
                      <span className="material-symbols-rounded icon-sm">
                        {isAuthenticated ? 'logout' : 'login'}
                      </span>
                      <span>{isAuthenticated ? 'Sign Out' : 'Sign In'}</span>
                    </button>
                  </div>
                </form>
              )}

              {userEmail !== 'guest@renimai.com' && (
                <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--mui-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong style={{ fontSize: '14px' }}>Two-Factor Authentication (TOTP 2FA)</strong>
                    <span
                      className="cmd-badge"
                      style={{ color: totpEnabled ? '#10b981' : '#f59e0b' }}
                    >
                      {totpEnabled ? 'ENABLED' : 'OFF'}
                    </span>
                  </div>

                  {!totpEnabled && !totpSecret && (
                    <button
                      type="button"
                      className="mui-btn mui-btn-outlined mui-btn-sm"
                      disabled={totpBusy}
                      onClick={handleSetup2FA}
                    >
                      <span className="material-symbols-rounded icon-sm">verified_user</span>
                      <span>{totpBusy ? 'Generating...' : 'Enable 2FA Authenticator'}</span>
                    </button>
                  )}

                  {!totpEnabled && totpSecret && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.85 }}>
                        Add this secret key to Google Authenticator / Authy:
                      </div>
                      <code
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'rgba(6, 182, 212, 0.1)',
                          fontSize: '12.5px',
                          letterSpacing: '1px',
                          wordBreak: 'break-all',
                        }}
                      >
                        {totpSecret}
                      </code>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="mui-input"
                          placeholder="6-digit code"
                          maxLength={6}
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="mui-btn mui-btn-primary mui-btn-sm"
                          disabled={totpBusy}
                          onClick={handleVerify2FA}
                        >
                          Verify &amp; Enable
                        </button>
                      </div>
                    </div>
                  )}

                  {totpEnabled && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="mui-input"
                        placeholder="Enter 6-digit code to disable"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="mui-btn mui-btn-outlined mui-btn-sm"
                        disabled={totpBusy}
                        onClick={handleDisable2FA}
                      >
                        Disable 2FA
                      </button>
                    </div>
                  )}

                  {/* GDPR Privacy & Session Revocation */}
                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--mui-border)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      type="button"
                      className="mui-btn mui-btn-outlined mui-btn-sm"
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
                      <span className="material-symbols-rounded icon-sm">devices</span>
                      <span>Sign Out All Devices</span>
                    </button>

                    <button
                      type="button"
                      className="mui-btn mui-btn-outlined mui-btn-sm"
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
                          showToast('GDPR personal data exported', 'success');
                        } catch (e: any) {
                          showToast(e.message || 'Export failed', 'error');
                        }
                      }}
                    >
                      <span className="material-symbols-rounded icon-sm">download</span>
                      <span>Export My Data (GDPR)</span>
                    </button>

                    <button
                      type="button"
                      className="mui-btn mui-btn-outlined mui-btn-sm"
                      style={{ color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.35)' }}
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
                      <span className="material-symbols-rounded icon-sm">delete_forever</span>
                      <span>Delete Account</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
