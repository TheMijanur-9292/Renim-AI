import React from 'react';
import type { ViewId } from './Sidebar';

export const VIEW_META: Record<ViewId, { title: string; icon: string }> = {
  'view-today': { title: 'Today', icon: 'wb_sunny' },
  'view-meetings': { title: 'Meetings & Audio Hub', icon: 'mic' },
  'view-notes': { title: 'Smart Notes & Second Brain', icon: 'edit_note' },
  'view-calendar': { title: 'Calendar & Reminders', icon: 'calendar_month' },
  'view-tasks': { title: 'Tasks & Action Items', icon: 'task_alt' },
  'view-growth': { title: 'Habits, Goals, Journal & AI Tools', icon: 'local_fire_department' },
  'view-docs': { title: 'Knowledge Hub & Doc AI', icon: 'description' },
  'view-rag': { title: 'Enterprise RAG Search', icon: 'neurology' },
  'view-chat': { title: 'Ask Workspace Copilot', icon: 'smart_toy' },
  'view-team': { title: 'Organizations & Team RBAC', icon: 'corporate_fare' },
  'view-analytics': { title: 'Executive Analytics & BI', icon: 'analytics' },
  'view-integrations': { title: 'Integrations, Webhooks & API', icon: 'hub' },
  'view-billing': { title: 'Subscription Billing & Quotas', icon: 'payments' },
  'view-security': { title: 'Security, SSO & Audit Trail', icon: 'verified_user' },
  'view-settings': { title: 'Settings & Cloud Config', icon: 'tune' },
  'view-profile': { title: 'My Profile & Account', icon: 'account_circle' },
  'view-superadmin': { title: 'Super Admin Control & User Management', icon: 'admin_panel_settings' }
};

interface HeaderProps {
  activeView: ViewId;
  themeMode: 'dark' | 'light';
  toggleThemeMode: () => void;
  isAuthenticated: boolean;
  isOffline: boolean;
  isPWAInstallable: boolean;
  isPushEnabled: boolean;
  onInstallPWA: () => void;
  onTogglePushNotifications: () => void;
  onOpenCommandPalette: () => void;
  onOpenCreateDialog: () => void;
  onOpenFocusModal?: () => void;
  onOpenScratchpad?: () => void;
  orgs?: Array<{ id: string; name: string; role?: string }>;
  activeOrgId?: string;
  onSelectOrg?: (orgId: string) => void;
  onToggleMobileMenu?: () => void;
  userName?: string;
  userAvatarUrl?: string;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  themeMode,
  toggleThemeMode,
  isAuthenticated,
  isOffline,
  isPWAInstallable,
  isPushEnabled,
  onInstallPWA,
  onTogglePushNotifications,
  onOpenCommandPalette,
  onOpenCreateDialog,
  onOpenFocusModal,
  onOpenScratchpad,
  orgs = [],
  activeOrgId = '',
  onSelectOrg,
  onToggleMobileMenu,
  userName = 'User',
  userAvatarUrl = '',
  onOpenProfile
}) => {
  return (
    <header className="app-header">
      <div className="header-left">
        {onToggleMobileMenu && (
          <button
            type="button"
            className="mui-btn-icon mobile-menu-btn"
            onClick={onToggleMobileMenu}
            title="Open Navigation Menu"
          >
            <span className="material-symbols-rounded">menu</span>
          </button>
        )}
        <div className="view-title-wrap">
          <span className="material-symbols-rounded icon-md" id="header-view-icon">
            {VIEW_META[activeView].icon}
          </span>
          <h1 className="current-view-title" id="header-view-title">
            {VIEW_META[activeView].title}
          </h1>
        </div>
        <div
          className="header-search"
          onClick={onOpenCommandPalette}
          style={{ cursor: 'pointer' }}
        >
          <span className="material-symbols-rounded icon-sm">search</span>
          <input
            type="text"
            id="global-search-input"
            placeholder="Search workspace (Ctrl + K)..."
            readOnly
            onClick={onOpenCommandPalette}
            style={{ cursor: 'pointer' }}
          />
          <span className="cmd-badge" style={{ fontSize: '10px', opacity: 0.8, marginLeft: 'auto' }}>Ctrl+K</span>
        </div>
      </div>

      <div className="header-right">
        {isOffline && (
          <div className="status-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b' }}>
            <span className="status-dot-active" style={{ background: '#f59e0b' }}></span>
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>Offline Mode</span>
          </div>
        )}
        {isPWAInstallable && (
          <button
            className="mui-btn mui-btn-outlined mui-btn-sm"
            onClick={onInstallPWA}
            title="Install Renim AI App to Desktop/Mobile Homescreen"
            style={{ borderColor: '#06b6d4', color: '#06b6d4' }}
          >
            <span className="material-symbols-rounded icon-sm">install_mobile</span>
            <span>Install App</span>
          </button>
        )}
        <button
          className="mui-btn-icon"
          onClick={onTogglePushNotifications}
          title={isPushEnabled ? 'Push Notifications: Active (Click to Turn Off)' : 'Push Notifications: Off (Click to Enable)'}
        >
          <span
            className="material-symbols-rounded icon-sm"
            style={{ color: isPushEnabled ? '#06b6d4' : 'var(--mui-text-secondary)' }}
          >
            {isPushEnabled ? 'notifications_active' : 'notifications_off'}
          </span>
        </button>
        <div className="status-pill">
          <span className="status-dot-active"></span>
          <span id="cloud-sync-status">
            {isAuthenticated ? 'Neon DB + Qwen Active' : 'Local Mode'}
          </span>
        </div>
        <button
          className="theme-toggle-btn"
          id="btn-theme-toggle"
          onClick={toggleThemeMode}
          title={`Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          <span className="material-symbols-rounded icon-sm">
            {themeMode === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
          <span>{themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        {onSelectOrg && orgs.length > 0 && (
          <select
            className="mui-select"
            value={activeOrgId}
            onChange={(e) => onSelectOrg(e.target.value)}
            title="Switch Active Tenant Workspace"
            style={{
              height: '32px',
              padding: '0 10px',
              fontSize: '12px',
              fontWeight: 600,
              maxWidth: '170px',
              borderRadius: '8px',
            }}
          >
            <option value="">Personal Workspace</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                🏢 {o.name}{o.role ? ` (${o.role})` : ''}
              </option>
            ))}
          </select>
        )}
        {onOpenScratchpad && (
          <button
            className="mui-btn mui-btn-outlined mui-btn-sm"
            id="btn-header-scratchpad"
            onClick={onOpenScratchpad}
            title="Open Quick Scratchpad Drawer"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <span className="material-symbols-rounded icon-sm">sticky_note_2</span>
            <span>Scratchpad</span>
          </button>
        )}
        {onOpenFocusModal && (
          <button
            className="mui-btn mui-btn-outlined mui-btn-sm"
            id="btn-header-deep-work"
            onClick={onOpenFocusModal}
            title="Launch Pomodoro Deep Work Focus Studio (Ambient Sounds & Timer)"
            style={{ borderColor: '#06b6d4', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span className="material-symbols-rounded icon-sm">timer</span>
            <span>Deep Work</span>
          </button>
        )}
        <button
          className="mui-btn mui-btn-primary mui-btn-sm"
          id="btn-quick-new"
          onClick={onOpenCreateDialog}
        >
          <span className="material-symbols-rounded icon-sm">add</span>
          <span>Create</span>
        </button>
        {onOpenProfile && (
          <button
            type="button"
            id="btn-header-profile"
            onClick={onOpenProfile}
            title={`${userName} — Open My Profile`}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              padding: 0,
              border:
                activeView === 'view-profile'
                  ? '2px solid #06b6d4'
                  : '1.5px solid rgba(6, 182, 212, 0.5)',
              background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize:
                userAvatarUrl && !userAvatarUrl.startsWith('http') && !userAvatarUrl.startsWith('data:image')
                  ? '17px'
                  : '13px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 2px 10px rgba(6, 182, 212, 0.25)',
            }}
          >
            {userAvatarUrl.startsWith('http') || userAvatarUrl.startsWith('data:image') ? (
              <img
                src={userAvatarUrl}
                alt={userName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              userAvatarUrl || (userName ? userName.charAt(0).toUpperCase() : 'U')
            )}
          </button>
        )}
      </div>
    </header>
  );
};
