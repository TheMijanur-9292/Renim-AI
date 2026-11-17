import React, { useEffect, useState } from 'react';
import {
  fetchIntegrations,
  saveIntegrationConfig,
  testIntegrationWebhook,
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  type IntegrationConfig,
  type ApiKeyItem
} from '../../services/enterprise';

interface IntegrationsViewProps {
  userEmail: string;
  showToast: (msg: string) => void;
}

const PROVIDERS = [
  { id: 'slack', name: 'Slack Workspace', icon: 'tag', desc: 'Auto-post Meeting Summaries & Action Items to Slack channels.' },
  { id: 'teams', name: 'Microsoft Teams', icon: 'groups', desc: 'Push daily AI briefings and urgent alerts to MS Teams.' },
  { id: 'jira', name: 'Jira / Linear Sync', icon: 'view_kanban', desc: 'Sync Kanban tasks & meeting action items to engineering boards.' },
  { id: 'github', name: 'GitHub Issues', icon: 'code', desc: 'Convert bug notes and meeting tasks into GitHub Issues.' },
  { id: 'webhook', name: 'Custom Webhook', icon: 'webhook', desc: 'Send real-time JSON payloads on workspace events.' }
];

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({ userEmail, showToast }) => {
  const [configs, setConfigs] = useState<Record<string, IntegrationConfig>>({});
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      const [intRes, keyRes] = await Promise.all([
        fetchIntegrations(userEmail),
        fetchApiKeys(userEmail)
      ]);
      const map: Record<string, IntegrationConfig> = {};
      for (const p of PROVIDERS) {
        map[p.id] = {
          provider: p.id,
          webhook_url: '',
          channel_or_project: '',
          is_enabled: false,
          events: ['meeting.summarized', 'task.created']
        };
      }
      for (const item of intRes.integrations) {
        map[item.provider] = item;
      }
      setConfigs(map);
      setApiKeys(keyRes.api_keys);
    } catch (e: any) {
      showToast(e.message || 'Failed to load integrations');
    }
  };

  useEffect(() => {
    loadAll();
  }, [userEmail]);

  const updateField = (provider: string, patch: Partial<IntegrationConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], ...patch }
    }));
  };

  const handleSave = async (provider: string) => {
    try {
      await saveIntegrationConfig({ ...configs[provider], user_email: userEmail });
      showToast(`${provider.toUpperCase()} connector saved!`);
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleTest = async (provider: string) => {
    const url = configs[provider]?.webhook_url;
    if (!url) return showToast('Enter a Webhook URL first');
    try {
      const res = await testIntegrationWebhook(provider, url, userEmail);
      showToast(res.delivered ? `Webhook delivered (HTTP ${res.status_code})` : `Failed (HTTP ${res.status_code})`);
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleCreateKey = async () => {
    try {
      const res = await createApiKey(newKeyName.trim() || 'Enterprise API Key', userEmail);
      setNewKeyName('');
      setNewlyCreatedSecret(res.api_key.secret_key || null);
      showToast('API Key generated! Copy it now — it will not be shown again.');
      await loadAll();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await revokeApiKey(id, userEmail);
      showToast('API Key revoked');
      await loadAll();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  return (
    <section className="workspace-view active" id="view-integrations">
      <div className="mui-card" style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Workflow Connectors & Webhooks</h2>
        <p className="muted-sm" style={{ marginTop: '4px', marginBottom: '16px' }}>
          Connect Renim AI with Slack, Microsoft Teams, Jira, GitHub, or custom automation webhooks.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '14px' }}>
          {PROVIDERS.map((p) => {
            const cfg = configs[p.id] || {
              provider: p.id,
              webhook_url: '',
              channel_or_project: '',
              is_enabled: false,
              events: []
            };
            return (
              <div
                key={p.id}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid var(--mui-border)',
                  background: 'var(--mui-bg-paper)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <span className="material-symbols-rounded icon-sm" style={{ color: '#06b6d4' }}>{p.icon}</span>
                    <span>{p.name}</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={cfg.is_enabled}
                      onChange={(e) => updateField(p.id, { is_enabled: e.target.checked })}
                    />
                    <span>{cfg.is_enabled ? 'Active' : 'Off'}</span>
                  </label>
                </div>
                <p className="muted-sm" style={{ marginBottom: '10px' }}>{p.desc}</p>
                <input
                  type="text"
                  className="mui-input"
                  placeholder="Webhook URL (https://hooks.slack.com/...)"
                  value={cfg.webhook_url}
                  onChange={(e) => updateField(p.id, { webhook_url: e.target.value })}
                  style={{ width: '100%', marginBottom: '8px' }}
                />
                <input
                  type="text"
                  className="mui-input"
                  placeholder="Channel / Project Key (e.g. #general or ENG)"
                  value={cfg.channel_or_project}
                  onChange={(e) => updateField(p.id, { channel_or_project: e.target.value })}
                  style={{ width: '100%', marginBottom: '10px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="mui-btn mui-btn-primary mui-btn-sm" onClick={() => handleSave(p.id)}>
                    Save
                  </button>
                  <button className="mui-btn mui-btn-outlined mui-btn-sm" onClick={() => handleTest(p.id)}>
                    Test Webhook
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mui-card">
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Developer API Keys (REST & Automation)</h3>
        <p className="muted-sm" style={{ marginTop: '4px', marginBottom: '14px' }}>
          Generate scoped secret keys (`sk_renim_...`) to authenticate external scripts and CI/CD pipelines.
        </p>

        {newlyCreatedSecret && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid #10b981',
              marginBottom: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <code style={{ fontSize: '13px', wordBreak: 'break-all' }}>{newlyCreatedSecret}</code>
            <button
              className="mui-btn mui-btn-outlined mui-btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(newlyCreatedSecret);
                showToast('Copied secret API key!');
              }}
            >
              Copy
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <input
            type="text"
            className="mui-input"
            placeholder="Key label (e.g. Zapier Production)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="mui-btn mui-btn-primary" onClick={handleCreateKey}>
            <span className="material-symbols-rounded icon-sm">vpn_key</span>
            <span>Generate Key</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {apiKeys.length === 0 ? (
            <p className="muted-sm">No API keys created yet.</p>
          ) : (
            apiKeys.map((k) => (
              <div
                key={k.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--mui-border)'
                }}
              >
                <div>
                  <strong>{k.name}</strong>
                  <div className="muted-sm">{k.key_prefix} • Created {new Date(k.created_at).toLocaleDateString()}</div>
                </div>
                <button
                  className="mui-btn mui-btn-outlined mui-btn-sm"
                  style={{ color: '#ef4444', borderColor: '#ef4444' }}
                  onClick={() => handleRevokeKey(k.id)}
                >
                  Revoke
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
