import React, { useEffect, useState } from 'react';
import {
  fetchHabits,
  createHabit,
  toggleHabitToday,
  deleteHabit,
  fetchGoals,
  createGoal,
  updateGoalProgress,
  deleteGoal,
  fetchJournals,
  createJournal,
  generateWeeklyWinReport,
  summarizeWebUrl,
  generateFlashcardsApi,
  type HabitItem,
  type GoalItem,
  type JournalItem,
  type FlashcardItem
} from '../../services/powerups';
import { renderMarkdownToHtml } from '../../utils/markdown';
import type { Note } from '../../services/workspace';
import {
  generateMindMap,
  generateMeetingFollowup,
  type MindMapResult
} from '../../services/tenant';
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  MenuItem,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import { EmptyState, Icon, IconTile, PageContainer, PageHeader, SectionCard, riseSx } from '../ui';

const popIn = keyframes`
  from { opacity: 0; transform: scale(.4); }
  to   { opacity: 1; transform: none; }
`;

const MOOD_ICONS: Record<string, { icon: string; label: string }> = {
  '🚀': { icon: 'rocket_launch', label: 'Great' },
  '😊': { icon: 'sentiment_satisfied', label: 'Good' },
  '😐': { icon: 'sentiment_neutral', label: 'Okay' },
  '😓': { icon: 'sentiment_stressed', label: 'Tough' },
  '🔥': { icon: 'local_fire_department', label: 'On fire' }
};

const hoverLift = {
  transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
  '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } }
} as const;

const markdownSx = {
  fontSize: 14,
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
  '& h1, & h2, & h3': { fontSize: 16, fontWeight: 700, mt: 1.5, mb: 0.75 },
  '& p': { my: 0.75 },
  '& ul, & ol': { pl: 2.5, my: 0.75 }
} as const;


interface GrowthHubViewProps {
  userEmail: string;
  notes: Note[];
  onSaveUrlAsNote: (title: string, content: string) => Promise<void>;
  showToast: (msg: string) => void;
}

type HubTab = 'habits' | 'goals' | 'journal' | 'url' | 'flashcards' | 'mindmap';

function getLast28Days(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function calcStreak(dates: string[]): number {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  while (true) {
    const s = d.toISOString().slice(0, 10);
    if (set.has(s)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (streak === 0) {
      // allow checking yesterday if today not checked yet
      d.setDate(d.getDate() - 1);
      const y = d.toISOString().slice(0, 10);
      if (set.has(y)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return streak;
}

export const GrowthHubView: React.FC<GrowthHubViewProps> = ({
  userEmail,
  notes,
  onSaveUrlAsNote,
  showToast
}) => {
  const [tab, setTab] = useState<HubTab>('habits');
  const todayStr = new Date().toISOString().slice(0, 10);
  const last28 = getLast28Days();

  // Habits
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [habitTitle, setHabitTitle] = useState('');

  // Goals
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState('Work');
  const [goalDate, setGoalDate] = useState('');

  // Journal
  const [journals, setJournals] = useState<JournalItem[]>([]);
  const [mood, setMood] = useState('🚀');
  const [winText, setWinText] = useState('');
  const [blockerText, setBlockerText] = useState('');
  const [weeklyReport, setWeeklyReport] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  // URL Summarizer
  const [urlInput, setUrlInput] = useState('');
  const [urlResult, setUrlResult] = useState<{ title: string; url: string; summary: string } | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  // Flashcards
  const [fcTitle, setFcTitle] = useState('');
  const [fcContent, setFcContent] = useState('');
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [flippedIdx, setFlippedIdx] = useState<Record<number, boolean>>({});
  const [fcLoading, setFcLoading] = useState(false);

  // Mind-Map & Meeting Follow-Up
  const [mmTitle, setMmTitle] = useState('');
  const [mmContent, setMmContent] = useState('');
  const [mindMap, setMindMap] = useState<MindMapResult | null>(null);
  const [mmLoading, setMmLoading] = useState(false);
  const [followupResult, setFollowupResult] = useState<{ subject?: string; email_body?: string; action_items?: string[] } | null>(null);

  const getAiCfg = () =>
    typeof window !== 'undefined'
      ? {
          api_key: localStorage.getItem('renim_ai_api_key') || undefined,
          model: localStorage.getItem('renim_ai_model') || undefined,
          base_url: localStorage.getItem('renim_ai_base_url') || undefined
        }
      : undefined;

  const loadData = async () => {
    try {
      const [h, g, j] = await Promise.all([
        fetchHabits(userEmail),
        fetchGoals(userEmail),
        fetchJournals(userEmail)
      ]);
      setHabits(h.habits);
      setGoals(g.goals);
      setJournals(j.journals);
    } catch (e: any) {
      showToast(e.message || 'Failed to load growth data');
    }
  };

  useEffect(() => {
    loadData();
  }, [userEmail]);

  const totalCompletedToday = habits.filter((h) => (h.completed_dates || []).includes(todayStr)).length;

  const hubTabs: { id: HubTab; label: string; icon: string }[] = [
    { id: 'habits', label: 'Habits', icon: 'local_fire_department' },
    { id: 'goals', label: 'Goals', icon: 'flag' },
    { id: 'journal', label: 'Journal', icon: 'menu_book' },
    { id: 'url', label: 'Summarize link', icon: 'link' },
    { id: 'flashcards', label: 'Flashcards', icon: 'style' },
    { id: 'mindmap', label: 'Mind map', icon: 'account_tree' }
  ];
  const todayPct = habits.length ? Math.round((totalCompletedToday / habits.length) * 100) : 0;

  return (
    <section className="workspace-view active" id="view-growth">
      <PageContainer>
        <PageHeader
          overline="Personal growth"
          title="Habits & Goals"
          description="Build streaks, track goals, reflect daily and learn faster."
        />

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, ...riseSx(1) }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v as HubTab)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Habits and goals sections"
          >
            {hubTabs.map((t) => (
              <Tab key={t.id} value={t.id} icon={<Icon name={t.icon} size={18} />} iconPosition="start" label={t.label} sx={{ minHeight: 48 }} />
            ))}
          </Tabs>
        </Box>

        {/* TAB 1: HABITS & HEATMAP */}
        {tab === 'habits' && (
          <Stack spacing={2.5}>
            <SectionCard
              index={2}
              icon="local_fire_department"
              accent="amber"
              title="Daily habits"
              subtitle={`Done today: ${totalCompletedToday} of ${habits.length}`}
            >
              <LinearProgress
                variant="determinate"
                value={todayPct}
                color="secondary"
                aria-label="Habits completed today"
                sx={{ height: 8, borderRadius: 4, mb: 2.5, '& .MuiLinearProgress-bar': { borderRadius: 4, transition: 'transform .8s cubic-bezier(.2,.7,.2,1)' } }}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  label="New habit"
                  placeholder="e.g. Read 20 pages, Walk 30 min"
                  value={habitTitle}
                  onChange={(e) => setHabitTitle(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && habitTitle.trim()) {
                      await createHabit(habitTitle.trim(), 5, userEmail);
                      setHabitTitle('');
                      loadData();
                    }
                  }}
                  fullWidth
                />
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Icon name="add" />}
                  sx={{ minHeight: 56, flex: 'none' }}
                  onClick={async () => {
                    if (!habitTitle.trim()) return showToast('Enter a habit name');
                    await createHabit(habitTitle.trim(), 5, userEmail);
                    setHabitTitle('');
                    showToast('Habit added!');
                    loadData();
                  }}
                >
                  Add habit
                </Button>
              </Stack>
            </SectionCard>

            {habits.length === 0 ? (
              <Card sx={riseSx(3)}>
                <EmptyState icon="local_fire_department" title="No habits yet" description="Add your first daily habit above to start a streak." />
              </Card>
            ) : (
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
                {habits.map((h, hi) => {
                  const dates = h.completed_dates || [];
                  const doneToday = dates.includes(todayStr);
                  const streak = calcStreak(dates);
                  return (
                    <Card key={h.id} sx={{ p: 2.25, ...riseSx(hi + 3), ...hoverLift }}>
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                        <IconButton
                          aria-label={doneToday ? `Mark ${h.title} as not done` : `Check in ${h.title}`}
                          onClick={async () => {
                            await toggleHabitToday(h.id, todayStr, userEmail);
                            loadData();
                          }}
                          sx={{
                            width: 44,
                            height: 44,
                            border: 1,
                            borderColor: doneToday ? 'success.main' : 'divider',
                            color: doneToday ? 'success.main' : 'text.secondary',
                            bgcolor: (t) => (doneToday ? alpha(t.palette.success.main, 0.12) : 'transparent')
                          }}
                        >
                          <Icon name={doneToday ? 'check_circle' : 'radio_button_unchecked'} fill={doneToday} size={24} />
                        </IconButton>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>{h.title}</Typography>
                          <Typography variant="caption" color="text.secondary">{doneToday ? 'Done today' : 'Not checked in yet'}</Typography>
                        </Box>
                        <Chip
                          size="small"
                          icon={<Icon name="local_fire_department" size={16} fill />}
                          label={`${streak} day${streak === 1 ? '' : 's'}`}
                          sx={{ fontWeight: 700, color: 'warning.main', bgcolor: (t) => alpha(t.palette.warning.main, 0.12), '& .MuiChip-icon': { color: 'warning.main' } }}
                        />
                        <Tooltip title="Delete habit">
                          <IconButton
                            aria-label={`Delete habit ${h.title}`}
                            sx={{ width: 44, height: 44 }}
                            onClick={async () => {
                              await deleteHabit(h.id, userEmail);
                              loadData();
                            }}
                          >
                            <Icon name="delete" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>Last 28 days</Typography>
                      <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(28, minmax(8px, 1fr))', gap: '4px', minWidth: 280 }}>
                          {last28.map((d, di) => {
                            const hit = dates.includes(d);
                            return (
                              <Box
                                key={d}
                                title={`${d}: ${hit ? 'Completed' : 'Missed'}`}
                                sx={{
                                  height: 14,
                                  borderRadius: '4px',
                                  bgcolor: hit ? 'success.main' : 'divider',
                                  opacity: hit ? 1 : 0.6,
                                  animation: `${popIn} .35s ease both`,
                                  animationDelay: `${di * 15}ms`,
                                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
                                }}
                              />
                            );
                          })}
                        </Box>
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            )}
          </Stack>
        )}

        {/* TAB 2: GOALS */}
        {tab === 'goals' && (
          <Stack spacing={2.5}>
            <SectionCard index={2} icon="flag" accent="indigo" title="Goals" subtitle="Track milestones and move progress as you go.">
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '2fr 1fr 1fr auto' } }}>
                <TextField
                  label="Goal"
                  placeholder="e.g. Finish the quarterly plan"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  fullWidth
                  sx={{ gridColumn: { sm: '1 / -1', md: 'auto' } }}
                />
                <TextField select label="Category" value={goalCategory} onChange={(e) => setGoalCategory(e.target.value)} fullWidth>
                  <MenuItem value="Work">Work</MenuItem>
                  <MenuItem value="Learning">Learning</MenuItem>
                  <MenuItem value="Health">Health</MenuItem>
                  <MenuItem value="Finance">Finance</MenuItem>
                </TextField>
                <TextField
                  type="date"
                  label="Target date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Icon name="add" />}
                  sx={{ minHeight: 56 }}
                  onClick={async () => {
                    if (!goalTitle.trim()) return showToast('Enter a goal title');
                    await createGoal(goalTitle.trim(), goalCategory, goalDate, userEmail);
                    setGoalTitle('');
                    showToast('Goal created!');
                    loadData();
                  }}
                >
                  Add goal
                </Button>
              </Box>
            </SectionCard>

            {goals.length === 0 ? (
              <Card sx={riseSx(3)}>
                <EmptyState icon="flag" title="No goals yet" description="Add a goal above and track its progress here." />
              </Card>
            ) : (
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' } }}>
                {goals.map((g, gi) => (
                  <Card key={g.id} sx={{ p: 2.25, ...riseSx(gi + 3), ...hoverLift }}>
                    <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ mb: 1.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{g.title}</Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={g.category} variant="outlined" />
                          {g.target_date && (
                            <Typography variant="caption" color="text.secondary">Target: {g.target_date}</Typography>
                          )}
                        </Stack>
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: 20, color: 'secondary.main' }}>{g.progress}%</Typography>
                      <IconButton
                        aria-label={`Delete goal ${g.title}`}
                        sx={{ width: 44, height: 44, mt: -0.5 }}
                        onClick={async () => {
                          await deleteGoal(g.id, userEmail);
                          loadData();
                        }}
                      >
                        <Icon name="delete" />
                      </IconButton>
                    </Stack>
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={g.progress}
                      color="secondary"
                      aria-label={`Progress for ${g.title}`}
                      onChange={async (_e, v) => {
                        const val = Number(v);
                        setGoals((prev) => prev.map((item) => (item.id === g.id ? { ...item, progress: val } : item)));
                        await updateGoalProgress(g.id, val, userEmail);
                      }}
                    />
                  </Card>
                ))}
              </Box>
            )}
          </Stack>
        )}

        {/* TAB 3: DAILY JOURNAL & WEEKLY REPORT */}
        {tab === 'journal' && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
            <SectionCard index={2} icon="edit_note" accent="green" title="Daily check-in" subtitle="How did today go?">
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Mood</Typography>
              <ToggleButtonGroup
                exclusive
                value={mood}
                onChange={(_, v) => { if (v) setMood(v); }}
                aria-label="Mood"
                sx={{ mb: 2, flexWrap: 'wrap' }}
              >
                {['🚀', '😊', '😐', '😓', '🔥'].map((m) => (
                  <ToggleButton key={m} value={m} aria-label={MOOD_ICONS[m].label} sx={{ width: 48, height: 48 }}>
                    <Tooltip title={MOOD_ICONS[m].label}>
                      <Box component="span" sx={{ display: 'flex' }}>
                        <Icon name={MOOD_ICONS[m].icon} size={22} fill={mood === m} />
                      </Box>
                    </Tooltip>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Stack spacing={1.75}>
                <TextField
                  label="Today's biggest win"
                  value={winText}
                  onChange={(e) => setWinText(e.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                />
                <TextField
                  label="Blocker or tomorrow's priority"
                  value={blockerText}
                  onChange={(e) => setBlockerText(e.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Icon name="check" />}
                    onClick={async () => {
                      if (!winText.trim()) return showToast('Write at least one win for today!');
                      await createJournal(mood, winText.trim(), blockerText.trim(), userEmail);
                      setWinText('');
                      setBlockerText('');
                      showToast('Daily reflection saved!');
                      loadData();
                    }}
                  >
                    Save check-in
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={reportLoading}
                    startIcon={reportLoading ? <CircularProgress size={16} color="inherit" /> : <Icon name="auto_awesome" />}
                    onClick={async () => {
                      setReportLoading(true);
                      try {
                        const res = await generateWeeklyWinReport(userEmail, getAiCfg());
                        setWeeklyReport(res.report);
                      } catch (e: any) {
                        showToast(e.message);
                      } finally {
                        setReportLoading(false);
                      }
                    }}
                  >
                    {reportLoading ? 'Writing report...' : 'Weekly wins report'}
                  </Button>
                </Stack>
              </Stack>
            </SectionCard>

            <SectionCard
              index={3}
              icon={weeklyReport ? 'auto_awesome' : 'history'}
              accent="violet"
              title={weeklyReport ? 'Weekly wins report' : 'Recent reflections'}
            >
              {weeklyReport ? (
                <Box className="markdown-body" sx={markdownSx} dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(weeklyReport) }} />
              ) : journals.length === 0 ? (
                <EmptyState icon="menu_book" title="No entries yet" description="Your daily check-ins will appear here." />
              ) : (
                <Stack spacing={1.25}>
                  {journals.map((j, ji) => {
                    const mi = MOOD_ICONS[j.mood];
                    return (
                      <Box key={j.id} sx={{ p: 1.75, borderRadius: 3, border: 1, borderColor: 'divider', ...riseSx(ji + 4) }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                          {mi ? <Icon name={mi.icon} size={18} sx={{ color: 'secondary.main' }} /> : null}
                          <Typography variant="subtitle2">{j.entry_date}</Typography>
                          {mi && <Typography variant="caption" color="text.secondary">{mi.label}</Typography>}
                        </Stack>
                        <Typography variant="body2"><strong>Win:</strong> {j.win_text}</Typography>
                        {j.blocker_text && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}><strong>Next:</strong> {j.blocker_text}</Typography>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </SectionCard>
          </Box>
        )}

        {/* TAB 4: LINK SUMMARIZER */}
        {tab === 'url' && (
          <Stack spacing={2.5}>
            <SectionCard index={2} icon="link" accent="cyan" title="Summarize a link" subtitle="Paste any article or page link to get a short summary you can save as a note.">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  type="url"
                  label="Link"
                  placeholder="https://example.com/article"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  fullWidth
                />
                <Button
                  variant="contained"
                  color="primary"
                  disabled={urlLoading}
                  startIcon={urlLoading ? <CircularProgress size={16} color="inherit" /> : <Icon name="summarize" />}
                  sx={{ minHeight: 56, flex: 'none' }}
                  onClick={async () => {
                    if (!urlInput.trim()) return showToast('Paste a valid URL');
                    setUrlLoading(true);
                    try {
                      const res = await summarizeWebUrl(urlInput.trim(), userEmail, getAiCfg());
                      setUrlResult(res);
                    } catch (e: any) {
                      showToast(e.message);
                    } finally {
                      setUrlLoading(false);
                    }
                  }}
                >
                  {urlLoading ? 'Reading...' : 'Summarize'}
                </Button>
              </Stack>
            </SectionCard>

            {urlResult && (
              <SectionCard
                index={3}
                icon="article"
                accent="green"
                title={urlResult.title}
                action={
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Icon name="note_add" size={18} />}
                    sx={{ minHeight: 40, flex: 'none' }}
                    onClick={async () => {
                      await onSaveUrlAsNote(urlResult.title, `${urlResult.summary}\n\nSource: ${urlResult.url}`);
                      showToast('Summary saved to notes!');
                    }}
                  >
                    Save to notes
                  </Button>
                }
              >
                <Box className="markdown-body" sx={markdownSx} dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(urlResult.summary) }} />
              </SectionCard>
            )}
          </Stack>
        )}

        {/* TAB 5: FLASHCARDS */}
        {tab === 'flashcards' && (
          <Stack spacing={2.5}>
            <SectionCard index={2} icon="style" accent="violet" title="Flashcards" subtitle="Pick a note or paste any text to create flip cards.">
              {notes.length > 0 && (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
                  {notes.slice(0, 5).map((n) => (
                    <Chip
                      key={n.id}
                      icon={<Icon name="description" size={16} />}
                      label={n.title.slice(0, 22)}
                      variant="outlined"
                      clickable
                      onClick={() => {
                        setFcTitle(n.title);
                        setFcContent((n.content || '').replace(/<[^>]+>/g, ' '));
                      }}
                    />
                  ))}
                </Stack>
              )}
              <Stack spacing={1.75}>
                <TextField label="Topic" value={fcTitle} onChange={(e) => setFcTitle(e.target.value)} fullWidth />
                <TextField
                  label="Text to learn from"
                  placeholder="Paste notes, an article or meeting highlights..."
                  value={fcContent}
                  onChange={(e) => setFcContent(e.target.value)}
                  multiline
                  minRows={4}
                  fullWidth
                />
                <Box>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={fcLoading}
                    startIcon={fcLoading ? <CircularProgress size={16} color="inherit" /> : <Icon name="auto_awesome" />}
                    onClick={async () => {
                      if (fcContent.trim().length < 20) return showToast('Paste at least a few sentences');
                      setFcLoading(true);
                      try {
                        const res = await generateFlashcardsApi(fcTitle || 'Study Topic', fcContent, userEmail, getAiCfg());
                        setFlashcards(res.flashcards);
                        setFlippedIdx({});
                      } catch (e: any) {
                        showToast(e.message);
                      } finally {
                        setFcLoading(false);
                      }
                    }}
                  >
                    {fcLoading ? 'Creating cards...' : 'Create 6 flashcards'}
                  </Button>
                </Box>
              </Stack>
            </SectionCard>

            {flashcards.length > 0 && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
                {flashcards.map((card, i) => {
                  const flipped = !!flippedIdx[i];
                  return (
                    <Card
                      key={i}
                      component="button"
                      type="button"
                      aria-pressed={flipped}
                      onClick={() => setFlippedIdx((prev) => ({ ...prev, [i]: !prev[i] }))}
                      sx={{
                        p: 2.25,
                        minHeight: 160,
                        textAlign: 'left',
                        cursor: 'pointer',
                        font: 'inherit',
                        color: 'text.primary',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        borderColor: flipped ? 'success.main' : 'divider',
                        bgcolor: (t) => (flipped ? alpha(t.palette.success.main, 0.06) : t.palette.background.paper),
                        ...riseSx(i + 3),
                        ...hoverLift
                      }}
                    >
                      <Chip
                        size="small"
                        label={flipped ? `Answer ${i + 1}` : `Question ${i + 1}`}
                        color={flipped ? 'success' : 'secondary'}
                        variant="outlined"
                      />
                      <Typography sx={{ fontSize: 15, fontWeight: flipped ? 500 : 700, my: 1.5 }}>
                        {flipped ? card.a : card.q}
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
                        <Icon name="flip" size={16} />
                        <Typography variant="caption">Tap to flip</Typography>
                      </Stack>
                    </Card>
                  );
                })}
              </Box>
            )}
          </Stack>
        )}

        {/* TAB 6: MIND MAP & FOLLOW-UP */}
        {tab === 'mindmap' && (
          <Stack spacing={2.5}>
            <SectionCard index={2} icon="account_tree" accent="cyan" title="Mind map & follow-up" subtitle="Turn notes into a mind map, or draft a follow-up email with action items.">
              {notes.length > 0 && (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">Load a note:</Typography>
                  {notes.slice(0, 4).map((n) => (
                    <Chip
                      key={n.id}
                      icon={<Icon name="description" size={16} />}
                      label={(n.title || 'Untitled').slice(0, 22)}
                      variant="outlined"
                      clickable
                      onClick={() => {
                        setMmTitle(n.title || 'Note');
                        setMmContent(n.content || '');
                      }}
                    />
                  ))}
                </Stack>
              )}
              <Stack spacing={1.75}>
                <TextField label="Topic or meeting title" value={mmTitle} onChange={(e) => setMmTitle(e.target.value)} fullWidth />
                <TextField
                  label="Notes or transcript"
                  placeholder="Paste notes, ideas or a meeting transcript..."
                  value={mmContent}
                  onChange={(e) => setMmContent(e.target.value)}
                  multiline
                  minRows={4}
                  fullWidth
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={mmLoading}
                    startIcon={mmLoading ? <CircularProgress size={16} color="inherit" /> : <Icon name="account_tree" />}
                    onClick={async () => {
                      if (!mmContent.trim()) return showToast('Enter content first');
                      setMmLoading(true);
                      try {
                        const res = await generateMindMap({ title: mmTitle || 'Mind Map', content: mmContent, user_email: userEmail });
                        if (res.mindmap) setMindMap(res.mindmap);
                        else showToast(res.error || 'Failed');
                      } finally {
                        setMmLoading(false);
                      }
                    }}
                  >
                    {mmLoading ? 'Working...' : 'Create mind map'}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={mmLoading}
                    startIcon={<Icon name="mail" />}
                    onClick={async () => {
                      if (!mmContent.trim()) return showToast('Enter meeting notes first');
                      setMmLoading(true);
                      try {
                        const res = await generateMeetingFollowup({ title: mmTitle || 'Team Sync', transcript: mmContent, user_email: userEmail });
                        setFollowupResult(res);
                      } finally {
                        setMmLoading(false);
                      }
                    }}
                  >
                    Draft follow-up email
                  </Button>
                </Stack>
              </Stack>
            </SectionCard>

            {mindMap && (
              <Card sx={{ p: { xs: 2, sm: 3 }, ...riseSx(3) }}>
                <Box sx={{ textAlign: 'center', mb: 2.5 }}>
                  <Box
                    component="span"
                    sx={{ display: 'inline-block', px: 2.5, py: 1, borderRadius: 999, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 700, fontSize: 15 }}
                  >
                    {mindMap.root}
                  </Box>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                  {mindMap.branches.map((b, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        p: 1.75,
                        borderRadius: 3,
                        border: 1,
                        borderColor: (t) => alpha(t.palette.secondary.main, 0.4),
                        bgcolor: (t) => alpha(t.palette.secondary.main, 0.06),
                        ...riseSx(idx + 4)
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ color: 'secondary.main', mb: 0.75 }}>{b.title}</Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2.25, fontSize: 13.5 }}>
                        {b.nodes.map((node, ni) => (
                          <Box component="li" key={ni} sx={{ mb: 0.4 }}>{node}</Box>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Card>
            )}

            {followupResult && (
              <SectionCard index={4} icon="mail" accent="indigo" title={`Subject: ${followupResult.subject ?? ''}`}>
                <Typography component="pre" variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', m: 0, mb: 2 }}>
                  {followupResult.email_body}
                </Typography>
                {followupResult.action_items && followupResult.action_items.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Action items</Typography>
                    <Stack spacing={0.75}>
                      {followupResult.action_items.map((a, idx) => (
                        <Stack key={idx} direction="row" spacing={1} alignItems="flex-start">
                          <Icon name="check_circle" size={18} sx={{ color: 'success.main', mt: '2px' }} />
                          <Typography variant="body2">{a}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </SectionCard>
            )}
          </Stack>
        )}
      </PageContainer>
    </section>
  );
};
