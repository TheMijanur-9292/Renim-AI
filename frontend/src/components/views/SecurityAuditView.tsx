import React, { useEffect, useState } from 'react';
import {
  fetchAuditLogs,
  fetchSecuritySettings,
  saveSecuritySettings,
  getStoredJwtToken,
  type AuditLogItem,
} from '../../services/enterprise';

interface SecurityAuditViewProps {
  userEmail: string;
  showToast: (msg: string) => void;
}

export const SecurityAuditView: React.FC<SecurityAuditViewProps> = ({ userEmail, showToast }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [filter, setFilter] = useState('');
  const [retentionDays, setRetentionDays] = useState('365');
  const [ssoDomain, setSsoDomain] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(true);

  const loadLogs = async () => {
    try {
      const res = await fetchAuditLogs(userEmail, filter);
      setLogs(res.logs);
    } catch (e: any) {
      showToast(e.message || 'Failed to load audit logs');
    }
  };

  const loadSettings = async () => {
    try {
      const s = await fetchSecuritySettings(userEmail);
      if (s) {
        setSsoDomain(s.sso_domain || '');
        setMfaEnabled(Boolean(s.mfa_enforced));
        setRetentionDays(s.retention_days || '365');
      }
    } catch (e: any) {
      console.warn('Security settings load fallback:', e);
    }
  };

  useEffect(() => {
    loadLogs();
    loadSettings();
  }, [userEmail]);

  const handleSaveSettings = async (msg: string) => {
    try {
      await saveSecuritySettings({
        user_email: userEmail,
        sso_domain: ssoDomain,
        mfa_enforced: mfaEnabled,
        retention_days: retentionDays,
      });
      showToast(msg);
    } catch (e: any) {
      showToast(e.message || 'Failed to save security settings');
    }
  };

  const handleExportCsv = async () => {
    try {
      const token = getStoredJwtToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/audit/export?user_email=${encodeURIComponent(userEmail)}`, { headers });
      if (!res.ok) throw new Error('Failed to export audit logs');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'renim-ai-audit-logs.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Exported SOC2 Audit Logs CSV');
    } catch (e: any) {
      showToast(e.message || 'Export failed');
    }
  };

  const hasJwt = typeof window !== 'undefined' && Boolean(getStoredJwtToken());

  return (
    <section className="workspace-view active" id="view-security">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className="mui-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '15px' }}>JWT Session & Encryption</strong>
            <span className="cmd-badge" style={{ color: '#10b981' }}>{hasJwt ? 'HS256 SIGNED' : 'LOCAL MODE'}</span>
          </div>
          <p className="muted-sm" style={{ marginTop: '8px' }}>
            API requests are authenticated with HMAC-SHA256 signed JWT bearer tokens and TLS-encrypted Neon PostgreSQL pooling.
          </p>
        </div>

        <div className="mui-card">
          <strong style={{ fontSize: '15px' }}>SAML 2.0 SSO & 2FA Policy</strong>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <input
              type="text"
              className="mui-input"
              placeholder="Enterprise SSO Domain (e.g. acme.com)"
              value={ssoDomain}
              onChange={(e) => setSsoDomain(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="mui-btn mui-btn-outlined mui-btn-sm" onClick={() => handleSaveSettings(`SSO Domain ${ssoDomain || 'config'} saved`)}>
              Save
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={mfaEnabled}
              onChange={(e) => {
                const next = e.target.checked;
                setMfaEnabled(next);
                saveSecuritySettings({
                  user_email: userEmail,
                  sso_domain: ssoDomain,
                  mfa_enforced: next,
                  retention_days: retentionDays,
                }).catch(() => {});
              }}
            />
            <span>Enforce 2FA / Passkey for Admin & Owner roles</span>
          </label>
        </div>

        <div className="mui-card">
          <strong style={{ fontSize: '15px' }}>Data Retention & GDPR</strong>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <select className="mui-input" value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} style={{ flex: 1 }}>
              <option value="90">90 Days Retention</option>
              <option value="180">180 Days Retention</option>
              <option value="365">365 Days (SOC2 Standard)</option>
              <option value="3650">Unlimited Archive (10 Years)</option>
            </select>
            <button className="mui-btn mui-btn-outlined mui-btn-sm" onClick={() => handleSaveSettings(`Retention set to ${retentionDays} days`)}>
              Apply
            </button>
          </div>
        </div>
      </div>

      <div className="mui-card">
        <div className="card-header-flex" style={{ marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Immutable Enterprise Audit Trail</h2>
            <p className="muted-sm" style={{ marginTop: '4px' }}>
              Every login, role change, API key generation, billing upgrade, and RAG query is logged.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="mui-input"
              placeholder="Filter action (e.g. auth, org, billing)"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: '210px' }}
            />
            <button className="mui-btn mui-btn-outlined mui-btn-sm" onClick={loadLogs}>
              Filter
            </button>
            <button className="mui-btn mui-btn-primary mui-btn-sm" onClick={handleExportCsv}>
              <span className="material-symbols-rounded icon-sm">download</span>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="muted-sm">No audit events matched.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--mui-border)', opacity: 0.75 }}>
                  <th style={{ padding: '8px' }}>Timestamp</th>
                  <th style={{ padding: '8px' }}>Action</th>
                  <th style={{ padding: '8px' }}>Actor</th>
                  <th style={{ padding: '8px' }}>Resource</th>
                  <th style={{ padding: '8px' }}>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--mui-border)' }}>
                    <td style={{ padding: '8px' }}>{new Date(l.created_at).toLocaleString()}</td>
                    <td style={{ padding: '8px' }}><span className="cmd-badge">{l.action}</span></td>
                    <td style={{ padding: '8px' }}>{l.user_email}</td>
                    <td style={{ padding: '8px' }}>{l.resource_type} {l.resource_id ? `(${l.resource_id.slice(0, 10)})` : ''}</td>
                    <td style={{ padding: '8px' }}>{l.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
