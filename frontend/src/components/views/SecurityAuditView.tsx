import React, { useEffect, useState } from 'react';
import {
  Box, Button, Chip, FormControlLabel, InputAdornment, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import {
  fetchAuditLogs,
  fetchSecuritySettings,
  saveSecuritySettings,
  getStoredJwtToken,
  type AuditLogItem,
} from '../../services/enterprise';
import { Icon, PageContainer, PageHeader, SectionCard, EmptyState, riseSx } from '../ui';

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
      showToast(e.message || 'Failed to load activity log');
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetchSecuritySettings(userEmail);
      const s = res?.settings;
      if (s) {
        setSsoDomain(s.sso_domain || '');
        setMfaEnabled(Boolean(s.mfa_enforced));
        setRetentionDays(String(s.retention_days || '365'));
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
        retention_days: Number(retentionDays),
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
      if (!res.ok) throw new Error('Failed to export activity log');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'renim-ai-audit-logs.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Activity log exported as CSV');
    } catch (e: any) {
      showToast(e.message || 'Export failed');
    }
  };

  const hasJwt = typeof window !== 'undefined' && Boolean(getStoredJwtToken());

  return (
    <Box component="section" className="workspace-view active" id="view-security">
      <PageContainer>
        <PageHeader
          overline="Security"
          title="Security"
          description="Control sign-in rules and data retention, and review everything that happens in your workspace."
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          <SectionCard
            index={1}
            icon="lock"
            accent="green"
            title="Secure sessions"
            action={<Chip size="small" color={hasJwt ? 'success' : 'default'} variant="outlined" label={hasJwt ? 'Signed in securely' : 'Local mode'} />}
          >
            <Typography variant="body2" color="text.secondary">
              Every request is verified with a signed sign-in token, and data is encrypted in transit.
            </Typography>
          </SectionCard>

          <SectionCard index={2} icon="key" accent="indigo" title="Single sign-on & 2-step verification">
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  size="small"
                  label="Company sign-in domain"
                  placeholder="e.g. acme.com"
                  value={ssoDomain}
                  onChange={(e) => setSsoDomain(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button variant="outlined" color="inherit" onClick={() => handleSaveSettings(`Sign-in domain ${ssoDomain || 'config'} saved`)} sx={{ minHeight: 44 }}>
                  Save
                </Button>
              </Stack>
              <FormControlLabel
                sx={{ ml: 0, alignItems: 'center', gap: 1 }}
                control={
                  <Switch
                    color="secondary"
                    checked={mfaEnabled}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setMfaEnabled(next);
                      saveSecuritySettings({
                        user_email: userEmail,
                        sso_domain: ssoDomain,
                        mfa_enforced: next,
                        retention_days: Number(retentionDays),
                      }).catch(() => {});
                    }}
                  />
                }
                label={<Typography variant="body2">Require 2-step verification or passkey for admins and owners</Typography>}
              />
            </Stack>
          </SectionCard>

          <SectionCard index={3} icon="history" accent="amber" title="Data retention" subtitle="How long activity records are kept">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select size="small" label="Keep records for" value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} sx={{ flex: 1 }}>
                <MenuItem value="90">90 days</MenuItem>
                <MenuItem value="180">180 days</MenuItem>
                <MenuItem value="365">365 days (recommended)</MenuItem>
                <MenuItem value="3650">10 years</MenuItem>
              </TextField>
              <Button variant="outlined" color="inherit" onClick={() => handleSaveSettings(`Retention set to ${retentionDays} days`)} sx={{ minHeight: 44 }}>
                Apply
              </Button>
            </Stack>
          </SectionCard>
        </Box>

        <SectionCard
          index={4}
          icon="receipt_long"
          accent="cyan"
          title="Activity log"
          subtitle="Sign-ins, role changes, API keys, plan changes and searches are all recorded."
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
            <TextField
              size="small"
              label="Filter by action"
              placeholder="e.g. auth, org, billing"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              sx={{ flex: 1, maxWidth: { sm: 360 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="search" size={18} /></InputAdornment> }}
            />
            <Button variant="outlined" color="inherit" onClick={loadLogs} startIcon={<Icon name="filter_list" size={18} />} sx={{ minHeight: 44 }}>
              Filter
            </Button>
            <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
            <Button variant="contained" color="primary" onClick={handleExportCsv} startIcon={<Icon name="download" size={18} />} sx={{ minHeight: 44 }}>
              Export CSV
            </Button>
          </Stack>

          {logs.length === 0 ? (
            <EmptyState icon="manage_search" title="No matching activity" description="Try a different filter." />
          ) : (
            <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 3 }}>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Person</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell>IP address</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((l, i) => (
                    <TableRow key={l.id} hover sx={{ ...(riseSx(Math.min(i, 8)) as object), '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell><Chip size="small" label={l.action} sx={{ fontFamily: 'monospace', fontSize: 12 }} /></TableCell>
                      <TableCell>{l.user_email}</TableCell>
                      <TableCell>{l.resource_type} {l.resource_id ? `(${l.resource_id.slice(0, 10)})` : ''}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>{l.ip_address}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </SectionCard>
      </PageContainer>
    </Box>
  );
};
