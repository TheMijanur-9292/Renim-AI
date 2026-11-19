import React from 'react';
import { Box, Button, Divider, IconButton, InputAdornment, MenuItem, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Icon, PageContainer, PageHeader, SectionCard, riseSx } from '../ui';
import { AI_LANG_OPTIONS, SPEECH_LANG_OPTIONS, getLangPrefs, setLangPrefs, type AiLang, type LangPrefs, type SpeechLang } from '../../services/workspace';

const LanguageSettingsCard: React.FC<{ showToast: SettingsViewProps['showToast'] }> = ({ showToast }) => {
  const [prefs, setPrefs] = React.useState<LangPrefs>(() => getLangPrefs());
  const update = (patch: Partial<LangPrefs>) => {
    setPrefs(setLangPrefs(patch));
    showToast('Language preference saved', 'success');
  };
  return (
    <SectionCard index={2} icon="translate" accent="cyan" title="Language" subtitle="Choose the language you speak in and the language AI replies in.">
      <Stack spacing={2.25} direction={{ xs: 'column', sm: 'row' }}>
        <TextField
          select
          label="Speech language"
          value={prefs.speechLang}
          onChange={(e) => update({ speechLang: e.target.value as SpeechLang })}
          helperText="Used for live meeting capture, voice memos and dictation."
          fullWidth
        >
          {SPEECH_LANG_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="AI response language"
          value={prefs.aiLang}
          onChange={(e) => update({ aiLang: e.target.value as AiLang })}
          helperText="Summaries, briefings, chat and note actions."
          fullWidth
        >
          {AI_LANG_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
      </Stack>
    </SectionCard>
  );
};


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
  const [tab, setTab] = React.useState(0);
  const [showKey, setShowKey] = React.useState(false);

  const handlePreset = (val: string) => {
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
  };
  const presetValues = ['qwen2.5', 'deepseek-chat', 'deepseek-reasoner', 'gpt-4o', 'claude-3-5-sonnet-20241022', 'custom'];

  const tabs = [
    { label: 'AI assistant', icon: 'auto_awesome' },
    { label: 'Notifications', icon: 'notifications' },
    { label: 'Backup & export', icon: 'cloud_download' },
    { label: 'Data & plan', icon: 'database' },
    { label: 'Language', icon: 'translate' },
  ];

  return (
    <div id="view-settings" className={`view-container ${isActive ? 'active' : ''}`}>
      <PageContainer>
        <PageHeader overline="Workspace" title="Settings" description="Choose your AI assistant, language, alerts and backups." />

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, ...riseSx(1) }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Settings sections"
          >
            {tabs.map((t) => (
              <Tab key={t.label} icon={<Icon name={t.icon} size={18} />} iconPosition="start" label={t.label} sx={{ minHeight: 48 }} />
            ))}
          </Tabs>
        </Box>

        {tab === 4 && <LanguageSettingsCard showToast={showToast} />}

        {tab === 0 && (
          <SectionCard index={2} icon="auto_awesome" accent="violet" title="AI assistant" subtitle="Pick a preset or connect your own provider.">
            <Stack spacing={2.25}>
              <TextField
                select
                label="Preset"
                value={presetValues.includes(cfgAiModel) ? cfgAiModel : 'custom'}
                onChange={(e) => handlePreset(e.target.value)}
                helperText="Use the built-in assistant, or bring your own key."
                fullWidth
              >
                <MenuItem value="qwen2.5">Built-in assistant (default)</MenuItem>
                <MenuItem value="deepseek-chat">DeepSeek V3 (fast)</MenuItem>
                <MenuItem value="deepseek-reasoner">DeepSeek R1 (deep reasoning)</MenuItem>
                <MenuItem value="gpt-4o">OpenAI GPT-4o</MenuItem>
                <MenuItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</MenuItem>
                <MenuItem value="custom">Custom provider</MenuItem>
              </TextField>
              <Box sx={{ display: 'grid', gap: 2.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <TextField
                  id="cfg-ai-url"
                  type="url"
                  label="AI provider URL"
                  placeholder="https://api.example.com/v1"
                  value={cfgAiUrl}
                  onChange={(e) => setCfgAiUrl(e.target.value)}
                  fullWidth
                />
                <TextField
                  id="cfg-ai-model"
                  label="Model"
                  placeholder="Model name"
                  value={cfgAiModel}
                  onChange={(e) => setCfgAiModel(e.target.value)}
                  fullWidth
                />
              </Box>
              <TextField
                id="cfg-ai-key"
                type={showKey ? 'text' : 'password'}
                label="API key"
                placeholder="Paste your key"
                value={cfgAiKey}
                onChange={(e) => setCfgAiKey(e.target.value)}
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton aria-label={showKey ? 'Hide API key' : 'Show API key'} onClick={() => setShowKey((v) => !v)} edge="end">
                          <Icon name={showKey ? 'visibility_off' : 'visibility'} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Box>
                <Button id="btn-save-settings" variant="contained" color="primary" size="large" onClick={handleSaveSettings} startIcon={<Icon name="save" />}>
                  Save
                </Button>
              </Box>
            </Stack>
          </SectionCard>
        )}

        {tab === 1 && (
          <SectionCard index={2} icon="notifications_active" accent="amber" title="Alerts & reminders" subtitle="Get notified 15 minutes before events.">
            <Stack spacing={2.5}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2">Browser notifications</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isPushEnabled ? 'On. You will get a pop-up before each event.' : 'Off. Turn on to get event pop-ups.'}
                  </Typography>
                </Box>
                <Switch
                  checked={isPushEnabled}
                  onChange={handleTogglePushNotifications}
                  color="secondary"
                  slotProps={{ input: { 'aria-label': 'Browser notifications' } }}
                />
              </Stack>

              {isPWAInstallable && (
                <Box>
                  <Button variant="outlined" onClick={handleInstallPWA} startIcon={<Icon name="install_mobile" />}>
                    Install app
                  </Button>
                </Box>
              )}

              <Divider />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Email reminders (optional)</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
                  <TextField
                    id="cfg-resend-key"
                    type="password"
                    label="Email service key (Resend)"
                    placeholder="re_xxxxxxxxxxxx"
                    value={resendApiKey}
                    onChange={(e) => setResendApiKey(e.target.value)}
                    helperText="Leave empty to preview reminders without sending email."
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    sx={{ minHeight: 56, flex: 'none' }}
                    onClick={() => {
                      localStorage.setItem('renim_resend_api_key', resendApiKey);
                      showToast('Email key saved on this device.', 'success');
                    }}
                  >
                    Save key
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </SectionCard>
        )}

        {tab === 2 && (
          <SectionCard index={2} icon="cloud_download" accent="green" title="Backup & export" subtitle="Download a copy of everything in your workspace.">
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, mb: 2.5 }}>
              {[
                { label: 'Notes', value: notesCount, icon: 'description' },
                { label: 'Tasks', value: tasksCount, icon: 'task_alt' },
                { label: 'Events', value: eventsCount, icon: 'event' },
                { label: 'Meetings', value: meetingsCount, icon: 'groups' },
              ].map((s, i) => (
                <Box key={s.label} sx={{ p: 1.75, borderRadius: 3, border: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.25, ...riseSx(i + 3) }}>
                  <Icon name={s.icon} sx={{ color: 'text.secondary' }} />
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.1 }}>{s.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
              <Button variant="contained" color="primary" onClick={handleExportFullJsonArchive} startIcon={<Icon name="data_object" />} title="Download a complete JSON backup">
                Full backup (JSON)
              </Button>
              <Button variant="outlined" onClick={handleExportMarkdownArchive} startIcon={<Icon name="article" />} title="Download notes as Markdown">
                Markdown export
              </Button>
              <Button variant="outlined" onClick={() => window.print()} startIcon={<Icon name="print" />} title="Print or save as PDF">
                Print / PDF
              </Button>
            </Stack>
          </SectionCard>
        )}

        {tab === 3 && (
          <Stack spacing={2.5}>
            <SectionCard index={2} icon="database" accent="indigo" title="Data storage" subtitle="Where your workspace is saved. Read only.">
              <Box sx={{ display: 'grid', gap: 2.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <TextField id="cfg-sb-url" label="Storage address" value={cfgSbUrl} fullWidth slotProps={{ input: { readOnly: true } }} />
                <TextField id="cfg-sb-anon" label="Status" value={cfgSbAnon} fullWidth slotProps={{ input: { readOnly: true } }} />
              </Box>
            </SectionCard>
            <SectionCard index={3} icon="storefront" accent="cyan" title="Plans & pricing" subtitle="See plans, pricing and what is coming next.">
              <Button component="a" href="/" variant="outlined" startIcon={<Icon name="open_in_new" />}>
                Open homepage
              </Button>
            </SectionCard>
          </Stack>
        )}
      </PageContainer>
    </div>
  );
};
