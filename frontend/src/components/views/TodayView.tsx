import React, { useState } from 'react';
import { Box, Button, Card, Checkbox, Chip, Grid2 as Grid, IconButton, Stack, Typography } from '@mui/material';
import { renderMarkdownToHtml } from '../../utils/markdown';
import { EmptyState, Icon, IconTile, PageContainer, PageHeader, SectionCard, StatCard, riseSx } from '../ui';
import type { Accent } from '../../theme/renimTheme';

export interface TodayViewProps {
  isActive: boolean;
  userName?: string;
  isVoiceMemoActive: boolean;
  handleVoiceMemoToggle: () => void;
  voiceMemoStatus: string;
  generateMorningBriefing: () => void;
  todayDateBadge: string;
  isBriefingLoading: boolean;
  thinkingStepIndex: number;
  aiThinkingSteps: string[];
  briefingText: string;
  setShowTaskModal: (show: boolean) => void;
  pendingTasks: any[];
  handleToggleTask: (id: string, currentStatus: string) => void;
  setShowEventModal: (show: boolean) => void;
  todayEvents: any[];
  onOpenFocusModal?: () => void;
  onNavigateView?: (view: any) => void;
}

const priorityColor = (p?: string): 'error' | 'warning' | 'default' => {
  const v = (p || 'medium').toLowerCase();
  return v === 'high' || v === 'urgent' ? 'error' : v === 'medium' ? 'warning' : 'default';
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const hoverCard = {
  cursor: 'pointer',
  transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
  '&:hover': { transform: 'translateY(-3px)', boxShadow: 4, borderColor: 'secondary.main' },
  '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
};

export const TodayView: React.FC<TodayViewProps> = ({
  isActive,
  userName,
  isVoiceMemoActive,
  handleVoiceMemoToggle,
  voiceMemoStatus,
  generateMorningBriefing,
  todayDateBadge,
  isBriefingLoading,
  thinkingStepIndex,
  aiThinkingSteps,
  briefingText,
  setShowTaskModal,
  pendingTasks,
  handleToggleTask,
  setShowEventModal,
  todayEvents,
  onOpenFocusModal,
  onNavigateView
}) => {
  const [checklistDismissed, setChecklistDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('renim_onboarding_dismissed') === '1';
    } catch {
      return false;
    }
  });

  const dismissChecklist = () => {
    setChecklistDismissed(true);
    try {
      localStorage.setItem('renim_onboarding_dismissed', '1');
    } catch {}
  };

  const quickActions: { icon: string; accent: Accent; title: string; hint: string; onClick: () => void }[] = onNavigateView
    ? [
        { icon: 'calendar_month', accent: 'cyan', title: 'Calendar', hint: 'Sync and import events', onClick: () => onNavigateView('view-calendar') },
        { icon: 'timer', accent: 'green', title: 'Focus session', hint: 'Timed work with ambient sound', onClick: () => onOpenFocusModal?.() },
        { icon: 'view_kanban', accent: 'indigo', title: 'Task board', hint: 'Drag tasks between stages', onClick: () => onNavigateView('view-tasks') },
        { icon: 'notifications_active', accent: 'amber', title: 'Notifications', hint: 'Browser and email alerts', onClick: () => onNavigateView('view-settings') },
      ]
    : [];

  return (
    <div id="view-today" className={`view-container ${isActive ? 'active' : ''}`}>
      <PageContainer>
        <PageHeader
          overline="Today"
          title={userName ? `${greeting()}, ${userName.split(' ')[0]}` : greeting()}
          description="Here is what matters today."
          actions={
            <>
              {onOpenFocusModal && (
                <Button
                  variant="contained"
                  color="primary"
                  id="btn-today-deep-work"
                  onClick={onOpenFocusModal}
                  startIcon={<Icon name="timer" size={18} />}
                  sx={{ minHeight: 44 }}
                >
                  Start focus session
                </Button>
              )}
              <Button
                variant="outlined"
                id="btn-refresh-briefing"
                onClick={() => generateMorningBriefing()}
                startIcon={<Icon name="sync" size={18} />}
                sx={{ minHeight: 44 }}
              >
                Refresh briefing
              </Button>
            </>
          }
        />

        {!checklistDismissed && (
          <Card sx={{ p: 2, mb: 2.5, ...riseSx(1) }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                <IconTile icon="rocket_launch" accent="cyan" size={36} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2">Get started</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Press{' '}
                    <Box component="kbd" sx={{ px: 0.75, py: 0.25, borderRadius: 1, border: 1, borderColor: 'divider', fontSize: 12, fontFamily: 'inherit' }}>Ctrl+K</Box>{' '}
                    to jump anywhere
                  </Typography>
                </Box>
                <IconButton aria-label="Dismiss" onClick={dismissChecklist} sx={{ display: { md: 'none' }, width: 44, height: 44 }}>
                  <Icon name="close" size={20} />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button size="small" variant="outlined" sx={{ minHeight: 40 }} onClick={() => onNavigateView && onNavigateView('view-notes')}>1. Write a note</Button>
                <Button size="small" variant="outlined" sx={{ minHeight: 40 }} onClick={() => onNavigateView && onNavigateView('view-chat')}>2. Ask the assistant</Button>
                <Button size="small" variant="outlined" sx={{ minHeight: 40 }} onClick={() => onNavigateView && onNavigateView('view-profile')}>3. Turn on 2-step sign-in</Button>
              </Stack>
              <IconButton aria-label="Dismiss" onClick={dismissChecklist} sx={{ display: { xs: 'none', md: 'inline-flex' }, width: 44, height: 44 }}>
                <Icon name="close" size={20} />
              </IconButton>
            </Stack>
          </Card>
        )}

        <Grid container spacing={2.5}>
          {/* Briefing */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <SectionCard
              index={2}
              icon="auto_awesome"
              title="Your daily briefing"
              subtitle={<span id="today-date-badge">{todayDateBadge}</span>}
              sx={{ height: '100%' }}
            >
              <Box id="daily-briefing-text" className="briefing-content" sx={{ color: 'text.primary', fontSize: 15, lineHeight: 1.7 }}>
                {isBriefingLoading ? (
                  <Stack direction="row" spacing={1.5} alignItems="center" className="ai-thinking-row">
                    <Box className="ai-msg-avatar thinking-spin" sx={{ width: 24, height: 24 }}>
                      <img src="/icon.svg" alt="Renim AI" />
                    </Box>
                    <Typography variant="body2" color="text.secondary" className="ai-thinking-status">{aiThinkingSteps[thinkingStepIndex]}</Typography>
                    <div className="ai-typing-dots"><span></span><span></span><span></span></div>
                  </Stack>
                ) : (
                  <div className="ai-markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(briefingText) }} />
                )}
              </Box>
            </SectionCard>
          </Grid>

          {/* Voice memo */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <SectionCard index={3} icon="mic" accent="violet" title="Voice memo" subtitle="Speak a quick note" sx={{ height: '100%' }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  component="button"
                  type="button"
                  id="btn-voice-memo"
                  aria-label={isVoiceMemoActive ? 'Stop voice memo' : 'Start voice memo'}
                  aria-pressed={isVoiceMemoActive}
                  className={`btn-mic-pulse ${isVoiceMemoActive ? 'recording' : ''}`}
                  onClick={handleVoiceMemoToggle}
                  sx={{
                    width: 56, height: 56, borderRadius: '50%', border: 0, cursor: 'pointer', flex: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: isVoiceMemoActive ? 'error.main' : 'primary.main',
                    color: isVoiceMemoActive ? 'error.contrastText' : 'primary.contrastText',
                    transition: 'background-color .25s ease, transform .2s ease',
                    '&:hover': { transform: 'scale(1.05)' },
                  }}
                >
                  <Icon name={isVoiceMemoActive ? 'stop' : 'mic'} size={26} />
                </Box>
                <Typography variant="body2" color="text.secondary" id="voice-memo-status" className="user-status" sx={{ minWidth: 0 }}>
                  {voiceMemoStatus}
                </Typography>
              </Stack>
            </SectionCard>
          </Grid>

          {/* Stats */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <StatCard index={4} icon="task_alt" accent="indigo" label="Open tasks" value={pendingTasks.length} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <StatCard index={5} icon="event" accent="cyan" label="Events today" value={todayEvents.length} />
          </Grid>

          {/* Priority tasks */}
          <Grid size={{ xs: 12, md: 6 }}>
            <SectionCard
              index={6}
              icon="flag"
              accent="red"
              title="Priority tasks"
              subtitle={pendingTasks.length > 5 ? `Top 5 of ${pendingTasks.length}` : undefined}
              sx={{ height: '100%' }}
              action={
                <Button size="small" variant="outlined" id="btn-today-add-task" onClick={() => setShowTaskModal(true)} startIcon={<Icon name="add" size={18} />} sx={{ minHeight: 40 }}>
                  Add
                </Button>
              }
            >
              <Box id="today-tasks-list">
                {pendingTasks.length === 0 ? (
                  <EmptyState icon="celebration" title="All caught up" description="No urgent tasks right now." />
                ) : (
                  <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
                    {pendingTasks.slice(0, 5).map(t => (
                      <Stack key={t.id} direction="row" alignItems="center" spacing={1} data-task-id={t.id} sx={{ py: 0.5, minHeight: 48 }}>
                        <Checkbox
                          checked={t.status === 'done'}
                          onChange={() => handleToggleTask(t.id, t.status)}
                          inputProps={{ 'aria-label': `Mark ${t.title} as done` }}
                          color="secondary"
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            flex: 1, minWidth: 0, fontWeight: 500, overflowWrap: 'anywhere',
                            textDecoration: t.status === 'done' ? 'line-through' : 'none',
                            color: t.status === 'done' ? 'text.secondary' : 'text.primary',
                            transition: 'color .2s ease',
                          }}
                        >
                          {t.title}
                        </Typography>
                        {t.priority && <Chip size="small" label={t.priority} color={priorityColor(t.priority)} variant="outlined" />}
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>
            </SectionCard>
          </Grid>

          {/* Schedule */}
          <Grid size={{ xs: 12, md: 6 }}>
            <SectionCard
              index={7}
              icon="schedule"
              accent="cyan"
              title="Today's schedule"
              sx={{ height: '100%' }}
              action={
                <IconButton id="btn-today-add-event" aria-label="Add event" onClick={() => setShowEventModal(true)} sx={{ width: 44, height: 44, border: 1, borderColor: 'divider' }}>
                  <Icon name="add" size={20} />
                </IconButton>
              }
            >
              <Box id="today-schedule-list">
                {todayEvents.length === 0 ? (
                  <EmptyState icon="event_available" title="Nothing scheduled" description="Your day is open." />
                ) : (
                  <Stack spacing={1}>
                    {todayEvents.map(e => (
                      <Stack key={e.id} direction="row" spacing={2} alignItems="center" sx={{ p: 1.5, borderRadius: 3, bgcolor: 'action.hover' }}>
                        <Typography sx={{ width: 52, flex: 'none', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                          {e.start_time.slice(0, 5)}
                        </Typography>
                        <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, bgcolor: 'secondary.main', flex: 'none' }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{e.title}</Typography>
                          <Typography variant="caption" color="text.secondary">{e.category}</Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>
            </SectionCard>
          </Grid>

          {/* Quick actions */}
          {quickActions.map((q, i) => (
            <Grid key={q.title} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card
                component="button"
                type="button"
                onClick={q.onClick}
                sx={{ width: '100%', p: 2, display: 'flex', alignItems: 'center', gap: 1.5, textAlign: 'left', font: 'inherit', color: 'inherit', bgcolor: 'background.paper', ...hoverCard, ...riseSx(8 + i) }}
              >
                <IconTile icon={q.icon} accent={q.accent} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2">{q.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{q.hint}</Typography>
                </Box>
                <Icon name="arrow_forward" size={18} sx={{ opacity: 0.5 }} />
              </Card>
            </Grid>
          ))}
        </Grid>
      </PageContainer>
    </div>
  );
};
