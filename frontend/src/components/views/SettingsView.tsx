import React from 'react';

export interface SettingsViewProps {
  isActive: boolean;
  cfgSbUrl: string;
  cfgSbAnon: string;
  cfgAiModel: string;
  setCfgAiModel: (m: string) => void;
  cfgAiUrl: string;
  setCfgAiUrl: (u: string) => void;
  cfgAiKey: string;
  setCfgAiKey: (k: string) => void;
  handleSaveSettings: () => void;
  isPushEnabled: boolean;
  handleTogglePushNotifications: () => void;
  isPWAInstallable: boolean;
  handleInstallPWA: () => void;
  resendApiKey: string;
  setResendApiKey: (k: string) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  handleExportFullJsonArchive: () => void;
  handleExportMarkdownArchive: () => void;
  notesCount: number;
  tasksCount: number;
  eventsCount: number;
  meetingsCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  isActive,
  cfgSbUrl,
  cfgSbAnon,
  cfgAiModel,
  setCfgAiModel,
  cfgAiUrl,
  setCfgAiUrl,
  cfgAiKey,
  setCfgAiKey,
  handleSaveSettings,
  isPushEnabled,
  handleTogglePushNotifications,
  isPWAInstallable,
  handleInstallPWA,
  resendApiKey,
  setResendApiKey,
  showToast,
  handleExportFullJsonArchive,
  handleExportMarkdownArchive,
  notesCount,
  tasksCount,
  eventsCount,
  meetingsCount,
}) => {
  return (
    <div id="view-settings" className={`view-container ${isActive ? 'active' : ''}`}>
      <div className="tasks-container">
        <div className="mui-card" style={{ marginBottom: '20px' }}>
          <h3 className="mui-card-title" style={{ marginBottom: '16px' }}>
            <span className="material-symbols-rounded">database</span>
            <span>Neon Cloud PostgreSQL Database (FastAPI Async Pool)</span>
          </h3>
          <div className="mui-input-group">
            <label htmlFor="cfg-sb-url">Neon Database Connection Endpoint</label>
            <input
              type="text"
              id="cfg-sb-url"
              className="mui-input"
              readOnly
              value={cfgSbUrl}
            />
          </div>
          <div className="mui-input-group">
            <label htmlFor="cfg-sb-anon">Database Status</label>
            <input
              type="text"
              id="cfg-sb-anon"
              className="mui-input"
              readOnly
              value={cfgSbAnon}
            />
          </div>
        </div>

        <div className="mui-card" style={{ marginBottom: '20px' }}>
          <h3 className="mui-card-title" style={{ marginBottom: '16px' }}>
            <span className="material-symbols-rounded">bolt</span>
            <span>AI Engine & BYOK (Bring Your Own Key)</span>
          </h3>

          <div className="mui-input-group">
            <label>Select AI Engine Preset</label>
            <select
              className="mui-input"
              value={cfgAiModel}
              onChange={e => {
                const val = e.target.value;
                setCfgAiModel(val);
                if (val === 'qwen2.5') {
                  setCfgAiUrl('https://2c-aim-api.2coms.com/v1');
                } else if (val === 'deepseek-chat') {
                  setCfgAiUrl('https://api.deepseek.com/v1');
                } else if (val === 'deepseek-reasoner') {
                  setCfgAiUrl('https://api.deepseek.com/v1');
                } else if (val === 'claude-3-5-sonnet-20241022') {
                  setCfgAiUrl('https://api.anthropic.com/v1');
                } else if (val === 'gpt-4o') {
                  setCfgAiUrl('https://api.openai.com/v1');
                }
              }}
            >
              <option value="qwen2.5">Qwen 2.5 72B (2Coms AIM - Active Default)</option>
              <option value="deepseek-chat">DeepSeek V3 (Reasoning & Speed)</option>
              <option value="deepseek-reasoner">DeepSeek R1 (Deep CoT Thinking)</option>
              <option value="gpt-4o">OpenAI GPT-4o (Omni Multimodal)</option>
              <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Anthropic)</option>
              <option value="custom">Custom AI Endpoint</option>
            </select>
            <span className="user-status" style={{ fontSize: '11px', marginTop: '4px', display: 'block' }}>
              Switch between 2Coms internal cluster or bring your own API key for DeepSeek, OpenAI, or Claude.
            </span>
          </div>

          <div className="mui-input-group">
            <label htmlFor="cfg-ai-url">AI Gateway Base URL</label>
            <input
              type="url"
              id="cfg-ai-url"
              className="mui-input"
              placeholder="https://2c-aim-api.2coms.com/v1"
              value={cfgAiUrl}
              onChange={e => setCfgAiUrl(e.target.value)}
            />
          </div>
          <div className="mui-input-group">
            <label htmlFor="cfg-ai-key">AI Gateway API Key</label>
            <input
              type="password"
              id="cfg-ai-key"
              className="mui-input"
              placeholder="twocoms_dev_z0_q6r3"
              value={cfgAiKey}
              onChange={e => setCfgAiKey(e.target.value)}
            />
          </div>
          <div className="mui-input-group">
            <label htmlFor="cfg-ai-model">Model Identifier</label>
            <input
              type="text"
              id="cfg-ai-model"
              className="mui-input"
              placeholder="qwen2.5"
              value={cfgAiModel}
              onChange={e => setCfgAiModel(e.target.value)}
            />
          </div>
          <button
            className="mui-btn mui-btn-primary"
            id="btn-save-settings"
            style={{ marginTop: '10px' }}
            onClick={handleSaveSettings}
          >
            Save Configuration
          </button>
        </div>

        {/* Real-time Push & Resend Email Notifications Card */}
        <div className="mui-card" style={{ marginBottom: '20px' }}>
          <div className="mui-card-header" style={{ marginBottom: '12px' }}>
            <h3 className="mui-card-title">
              <span className="material-symbols-rounded">notifications_active</span>
              <span>Alerts & Notifications (Web Push + Resend Email)</span>
            </h3>
          </div>
          <p className="user-status" style={{ marginBottom: '14px' }}>
            Enable desktop Web Push notifications for 15-minute event countdown alerts, and connect Resend API for instant email reminders to your inbox.
          </p>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`mui-btn ${isPushEnabled ? 'mui-btn-primary' : 'mui-btn-outlined'}`}
              onClick={handleTogglePushNotifications}
            >
              <span className="material-symbols-rounded icon-sm">
                {isPushEnabled ? 'notifications_active' : 'notifications_off'}
              </span>
              <span>
                {isPushEnabled ? 'Browser Push: Enabled (Click to Turn Off)' : 'Browser Push: Disabled (Click to Enable)'}
              </span>
            </button>
            {isPWAInstallable && (
              <button
                type="button"
                className="mui-btn mui-btn-outlined"
                onClick={handleInstallPWA}
              >
                <span className="material-symbols-rounded icon-sm">install_mobile</span>
                <span>Install PWA App</span>
              </button>
            )}
          </div>
          <span className="user-status" style={{ fontSize: '11px', marginBottom: '16px', display: 'block' }}>
            System Status: {isPushEnabled ? 'Alerts are ACTIVE. Desktop pop-ups will fire 15 mins before events.' : 'Alerts are MUTED. Click above to reactivate.'}
          </span>

          <div className="mui-input-group">
            <label htmlFor="cfg-resend-key">Resend API Key (Optional for Real Email Delivery)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                id="cfg-resend-key"
                className="mui-input"
                placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                value={resendApiKey}
                onChange={e => setResendApiKey(e.target.value)}
              />
              <button
                type="button"
                className="mui-btn mui-btn-primary"
                onClick={() => {
                  localStorage.setItem('renim_resend_api_key', resendApiKey);
                  showToast('Resend API Key saved locally!', 'success');
                }}
              >
                Save Key
              </button>
            </div>
            <span className="user-status" style={{ fontSize: '11px', marginTop: '4px', display: 'block' }}>
              If empty, Renim AI will still record and preview email alerts smoothly. Get your free key at resend.com.
            </span>
          </div>
        </div>

        {/* Second Brain Data Backup & Full Export Card */}
        <div className="mui-card" style={{ marginBottom: '20px' }}>
          <div className="mui-card-header" style={{ marginBottom: '12px' }}>
            <h3 className="mui-card-title">
              <span className="material-symbols-rounded">cloud_download</span>
              <span>Second Brain Data Backup & Export (Offline Archive)</span>
            </h3>
          </div>
          <p className="user-status" style={{ marginBottom: '14px' }}>
            Download comprehensive, 100% portable backups of your entire workspace (Smart Notes, Sprint Tasks, Calendar Agenda, and Meeting Intelligence).
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="mui-btn mui-btn-primary"
              onClick={handleExportFullJsonArchive}
              title="Download complete JSON archive for offline storage or migration"
            >
              <span className="material-symbols-rounded icon-sm">data_object</span>
              <span>Full JSON Backup</span>
            </button>

            <button
              type="button"
              className="mui-btn mui-btn-outlined"
              onClick={handleExportMarkdownArchive}
              title="Download consolidated Markdown archive of all notes & deliverables"
            >
              <span className="material-symbols-rounded icon-sm">markdown</span>
              <span>Structured Markdown Archive</span>
            </button>

            <button
              type="button"
              className="mui-btn mui-btn-outlined"
              onClick={() => window.print()}
              title="Print or Save Workspace Overview as PDF"
            >
              <span className="material-symbols-rounded icon-sm">print</span>
              <span>Executive Print / PDF</span>
            </button>
          </div>
          <span className="user-status" style={{ fontSize: '11px', marginTop: '10px', display: 'block' }}>
            Archive includes {notesCount} notes, {tasksCount} tasks, {eventsCount} events, and {meetingsCount} meeting logs.
          </span>
        </div>

        <div className="mui-card" style={{ marginBottom: '20px' }}>
          <h3 className="mui-card-title" style={{ marginBottom: '12px' }}>
            <span className="material-symbols-rounded">storefront</span>
            <span>Product & Pricing Overview</span>
          </h3>
          <p className="user-status" style={{ marginBottom: '14px' }}>
            View the official Renim AI SaaS landing page, pricing plans, and public feature roadmap.
          </p>
          <a
            href="/"
            className="mui-btn mui-btn-outlined"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
          >
            <span className="material-symbols-rounded icon-sm">open_in_new</span>
            <span>Open Product Homepage & Pricing</span>
          </a>
        </div>
      </div>
    </div>
  );
};
