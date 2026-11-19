import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, Chip, FormControlLabel, IconButton, Stack, Switch, TextField, Tooltip, Typography
} from '@mui/material';
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
import { Icon, IconTile, PageContainer, PageHeader, SectionCard, EmptyState, riseSx } from '../ui';
import type { Accent } from '../../theme/renimTheme';

interface IntegrationsViewProps {
  userEmail: string;
  showToast: (msg: string) => void;
}

const PROVIDERS = [
  { id: 'slack', name: 'Slack', icon: 'tag', desc: 'Post meeting summaries and action items to a Slack channel.' },
  { id: 'teams', name: 'Microsoft Teams', icon: 'groups', desc: 'Send daily briefings and urgent alerts to Teams.' },
  { id: 'jira', name: 'Jira / Linear', icon: 'view_kanban', desc: 'Keep tasks and action items in sync with your project boards.' },
  { id: 'github', name: 'GitHub Issues', icon: 'code', desc: 'Turn notes and meeting tasks into GitHub issues.' },
  { id: 'webhook', name: 'Custom webhook', icon: 'webhook', desc: 'A webhook is a web address we notify whenever something happens in your workspace.' }
];

const PROVIDER_ACCENT: Record<string, Accent> = {
  slack: 'violet', teams: 'indigo', jira: 'cyan', github: 'slate', webhook: 'amber'
};

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
      showToast(`${provider.toUpperCase()} connection saved!`);
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleTest = async (provider: string) => {
    const url = configs[provider]?.webhook_url;
    if (!url) return showToast('Enter a webhook URL first');
    try {
      const res = await testIntegrationWebhook(provider, url, userEmail);
      showToast(res.delivered ? `Test message delivered (HTTP ${res.status_code})` : `Failed (HTTP ${res.status_code})`);
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleCreateKey = async () => {
    try {
      const res = await createApiKey(newKeyName.trim() || 'API Key', userEmail);
      setNewKeyName('');
      setNewlyCreatedSecret(res.api_key.secret_key || null);
      showToast('API key created. Copy it now — it will not be shown again.');
      await loadAll();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await revokeApiKey(id, userEmail);
      showToast('API key revoked');
      await loadAll();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  return (
    <Box component="section" className="workspace-view active" id="view-integrations">
      <PageContainer>
        <PageHeader
          overline="Integrations"
          title="Integrations"
          description="Connect the tools your team already uses so updates reach them automatically."
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          {PROVIDERS.map((p, i) => {
            const cfg = configs[p.id] || {
              provider: p.id,
              webhook_url: '',
              channel_or_project: '',
              is_enabled: false,
              events: []
            };
            return (
              <Card
                key={p.id}
                sx={{
                  p: 2.5, display: 'flex', flexDirection: 'column', gap: 2,
                  ...(riseSx(i + 1) as object),
                  transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
                  borderColor: cfg.is_enabled ? 'secondary.main' : 'divider',
                  '&:hover': { transform: 'translateY(-3px)', boxShadow: 4 },
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none', transition: 'none', '&:hover': { transform: 'none' } },
                }}
              >
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  <IconTile icon={p.icon} accent={PROVIDER_ACCENT[p.id] || 'cyan'} size={44} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>{p.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{p.desc}</Typography>
                  </Box>
                  <FormControlLabel
                    sx={{ m: 0, flex: 'none' }}
                    labelPlacement="start"
                    control={
                      <Switch
                        color="secondary"
                        checked={cfg.is_enabled}
                        onChange={(e) => updateField(p.id, { is_enabled: e.target.checked })}
                        inputProps={{ 'aria-label': `Turn ${p.name} on or off` }}
                      />
                    }
                    label={<Typography variant="caption" sx={{ fontWeight: 700 }}>{cfg.is_enabled ? 'On' : 'Off'}</Typography>}
                  />
                </Stack>
                <Stack spacing={1.5} sx={{ mt: 'auto' }}>
                  <TextField
                    size="small"
                    label="Webhook URL"
                    placeholder="https://hooks.example.com/..."
                    value={cfg.webhook_url}
                    onChange={(e) => updateField(p.id, { webhook_url: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Channel or project"
                    placeholder="e.g. #general or OPS"
                    value={cfg.channel_or_project}
                    onChange={(e) => updateField(p.id, { channel_or_project: e.target.value })}
                    fullWidth
                  />
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" color="primary" onClick={() => handleSave(p.id)} sx={{ minHeight: 44, flex: 1 }}>
                      Save
                    </Button>
                    <Button variant="outlined" color="inherit" onClick={() => handleTest(p.id)} startIcon={<Icon name="send" size={18} />} sx={{ minHeight: 44, flex: 1 }}>
                      Send test
                    </Button>
                  </Stack>
                </Stack>
              </Card>
            );
          })}
        </Box>

        <SectionCard
          index={7}
          icon="vpn_key"
          accent="indigo"
          title="API keys"
          subtitle="Private keys (sk_renim_...) that let your own apps and automations connect to this workspace."
        >
          {newlyCreatedSecret && (
            <Alert
              severity="success"
              icon={<Icon name="key" size={20} />}
              sx={{ mb: 2, borderRadius: 3, alignItems: 'center', '& .MuiAlert-message': { minWidth: 0, flex: 1 } }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<Icon name="content_copy" size={16} />}
                  sx={{ minHeight: 40 }}
                  onClick={() => {
                    navigator.clipboard.writeText(newlyCreatedSecret);
                    showToast('API key copied!');
                  }}
                >
                  Copy
                </Button>
              }
            >
              <Typography variant="caption" component="div" sx={{ fontWeight: 700 }}>Copy this key now. It won't be shown again.</Typography>
              <Box component="code" sx={{ fontSize: 13, wordBreak: 'break-all', fontFamily: 'monospace' }}>{newlyCreatedSecret}</Box>
            </Alert>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              size="small"
              label="Key name"
              placeholder="e.g. Zapier production"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              sx={{ flex: 1 }}
            />
            <Button variant="contained" color="primary" onClick={handleCreateKey} startIcon={<Icon name="add" size={18} />} sx={{ minHeight: 44, whiteSpace: 'nowrap' }}>
              Create key
            </Button>
          </Stack>

          {apiKeys.length === 0 ? (
            <EmptyState icon="key_off" title="No API keys yet" description="Create a key to connect your own tools." />
          ) : (
            <Stack spacing={1}>
              {apiKeys.map((k, i) => (
                <Stack
                  key={k.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{ p: 1.5, borderRadius: 3, border: 1, borderColor: 'divider', ...(riseSx(i + 2) as object), transition: 'background-color .2s', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <IconTile icon="key" accent="slate" size={36} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{k.name}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip size="small" variant="outlined" label={k.key_prefix} sx={{ fontFamily: 'monospace' }} />
                      <Typography variant="caption" color="text.secondary">Created {new Date(k.created_at).toLocaleDateString()}</Typography>
                    </Stack>
                  </Box>
                  <Tooltip title="Revoke key">
                    <IconButton color="error" aria-label={`Revoke ${k.name}`} onClick={() => handleRevokeKey(k.id)} sx={{ width: 44, height: 44 }}>
                      <Icon name="delete" size={20} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          )}
        </SectionCard>
      </PageContainer>
    </Box>
  );
};
