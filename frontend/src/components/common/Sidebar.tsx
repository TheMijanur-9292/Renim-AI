import React from 'react';

export type ViewId =
  | 'view-today'
  | 'view-meetings'
  | 'view-notes'
  | 'view-calendar'
  | 'view-tasks'
  | 'view-growth'
  | 'view-docs'
  | 'view-rag'
  | 'view-chat'
  | 'view-team'
  | 'view-analytics'
  | 'view-integrations'
  | 'view-billing'
  | 'view-security'
  | 'view-settings'
  | 'view-profile'
  | 'view-superadmin';

interface SidebarProps {
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
  counts: {
    meetings: number;
    notes: number;
    tasks: number;
    events: number;
    documents: number;
  };
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  isSuperAdmin?: boolean;
  activeOrgName?: string;
  isAuthenticated: boolean;
  onAuthTrigger: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  counts,
  userName,
  userEmail,
  userAvatarUrl = '',
  isSuperAdmin = false,
  activeOrgName,
  isAuthenticated,
  onAuthTrigger,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile
}) => {
  const handleSelect = (view: ViewId) => {
    setActiveView(view);
    onCloseMobile?.();
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-wrapper">
          <div className="brand-logo-icon">
            <img src="/icon.svg" alt="Renim AI" />
          </div>
          {!collapsed && (
            <div>
              <span className="brand-title">Renim AI</span>
              <span className="brand-version">CLOUD</span>
            </div>
          )}
        </div>
        {onToggleCollapse && (
          <button
            className="mui-btn-icon"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{ padding: '4px' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
          <span className="nav-section-title">Workspace</span>

          <a
            className={`nav-item ${activeView === 'view-today' ? 'active' : ''}`}
            onClick={() => handleSelect('view-today')}
          >
            <span className="material-symbols-rounded">wb_sunny</span>
            <span>Today</span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-meetings' ? 'active' : ''}`}
            onClick={() => handleSelect('view-meetings')}
          >
            <span className="material-symbols-rounded">mic</span>
            <span>Meetings Hub</span>
            <span className="nav-badge" id="badge-meetings-count">{counts.meetings}</span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-notes' ? 'active' : ''}`}
            onClick={() => handleSelect('view-notes')}
          >
            <span className="material-symbols-rounded">edit_note</span>
            <span>Smart Notes</span>
            <span className="nav-badge" id="badge-notes-count">{counts.notes}</span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-calendar' ? 'active' : ''}`}
            onClick={() => handleSelect('view-calendar')}
          >
            <span className="material-symbols-rounded">calendar_month</span>
            <span>Calendar & Alerts</span>
            <span className="nav-badge" id="badge-events-count">{counts.events}</span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-tasks' ? 'active' : ''}`}
            onClick={() => handleSelect('view-tasks')}
          >
            <span className="material-symbols-rounded">task_alt</span>
            <span>Tasks & To-Do</span>
            <span className="nav-badge" id="badge-tasks-count">{counts.tasks}</span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-growth' ? 'active' : ''}`}
            onClick={() => handleSelect('view-growth')}
          >
            <span className="material-symbols-rounded">local_fire_department</span>
            <span>Habits, Goals & Tools</span>
          </a>

          <span className="nav-section-title">Intelligence</span>

          <a
            className={`nav-item ${activeView === 'view-docs' ? 'active' : ''}`}
            onClick={() => handleSelect('view-docs')}
          >
            <span className="material-symbols-rounded">description</span>
            <span>Docs & Knowledge AI</span>
            <span className="nav-badge" id="badge-docs-count">{counts.documents}</span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-rag' ? 'active' : ''}`}
            onClick={() => handleSelect('view-rag')}
          >
            <span className="material-symbols-rounded">neurology</span>
            <span>Enterprise RAG</span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-chat' ? 'active' : ''}`}
            onClick={() => handleSelect('view-chat')}
          >
            <span className="material-symbols-rounded">smart_toy</span>
            <span>Ask Copilot</span>
          </a>

          <span className="nav-section-title">Enterprise SaaS</span>

          <a
            className={`nav-item ${activeView === 'view-team' ? 'active' : ''}`}
            onClick={() => handleSelect('view-team')}
          >
            <span className="material-symbols-rounded">corporate_fare</span>
            <span>
              {activeOrgName && activeOrgName !== 'Personal' && activeOrgName !== 'Personal Workspace'
                ? `Team (${activeOrgName.slice(0, 14)})`
                : 'Team Workspace'}
            </span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-analytics' ? 'active' : ''}`}
            onClick={() => handleSelect('view-analytics')}
          >
            <span className="material-symbols-rounded">analytics</span>
            <span>Analytics & BI</span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-integrations' ? 'active' : ''}`}
            onClick={() => handleSelect('view-integrations')}
          >
            <span className="material-symbols-rounded">hub</span>
            <span>Integrations & API</span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-billing' ? 'active' : ''}`}
            onClick={() => handleSelect('view-billing')}
          >
            <span className="material-symbols-rounded">payments</span>
            <span>Billing & Quotas</span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-security' ? 'active' : ''}`}
            onClick={() => handleSelect('view-security')}
          >
            <span className="material-symbols-rounded">verified_user</span>
            <span>Security & Audit</span>
          </a>

          {isSuperAdmin && (
            <a
              className={`nav-item ${activeView === 'view-superadmin' ? 'active' : ''}`}
              onClick={() => handleSelect('view-superadmin')}
              style={{
                borderLeft: activeView === 'view-superadmin' ? '3px solid #fbbf24' : undefined,
              }}
            >
              <span className="material-symbols-rounded" style={{ color: '#fbbf24' }}>admin_panel_settings</span>
              <span>Super Admin Control</span>
            </a>
          )}

          <a
            className={`nav-item ${activeView === 'view-profile' ? 'active' : ''}`}
            onClick={() => handleSelect('view-profile')}
          >
            <span className="material-symbols-rounded">account_circle</span>
            <span>My Profile</span>
          </a>

          <a
            className={`nav-item ${activeView === 'view-settings' ? 'active' : ''}`}
            onClick={() => handleSelect('view-settings')}
          >
            <span className="material-symbols-rounded">tune</span>
            <span>Settings & Cloud</span>
          </a>
      </nav>

      <div className="sidebar-footer">
        <div
          className="user-card"
          id="sidebar-user-card"
          onClick={() => handleSelect('view-profile')}
          style={{ cursor: 'pointer' }}
          title="Open My Profile"
        >
          <div className="user-details">
            <div className="user-avatar" id="user-avatar-initials" style={{ overflow: 'hidden' }}>
              {userAvatarUrl.startsWith('http') || userAvatarUrl.startsWith('data:image') ? (
                <img
                  src={userAvatarUrl}
                  alt={userName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                userAvatarUrl || (userName ? userName.charAt(0).toUpperCase() : 'U')
              )}
            </div>
            <div className="user-meta">
              <span className="user-name" id="user-display-name">{userName}</span>
              <span className="user-status" id="user-display-email">{userEmail}</span>
            </div>
          </div>
          <button
            className="mui-btn-icon"
            id="btn-auth-trigger"
            title={isAuthenticated ? 'Sign Out' : 'Sign In / Sign Up'}
            onClick={(e) => {
              e.stopPropagation();
              onAuthTrigger();
            }}
          >
            <span className="material-symbols-rounded" id="icon-auth-action">
              {isAuthenticated ? 'logout' : 'login'}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};
