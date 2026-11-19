import React, { useEffect, useState } from 'react';
import { Box, Button, Card, Chip, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { fetchAnalyticsOverview } from '../../services/enterprise';
import { Icon, IconTile, PageContainer, PageHeader, SectionCard, StatCard, EmptyState } from '../ui';

interface AnalyticsViewProps {
  userEmail: string;
  showToast: (msg: string) => void;
}

const grow = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`;

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ userEmail, showToast }) => {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAnalyticsOverview>> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchAnalyticsOverview(userEmail);
      setData(res);
    } catch (e: any) {
      showToast(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userEmail]);

  const kpis = data?.kpis;
  const tasks = data?.task_breakdown;
  const totalTasks = Math.max(tasks?.tasks_total || 1, 1);

  return (
    <Box component="section" className="workspace-view active" id="view-analytics">
      <PageContainer>
        <PageHeader
          overline="Insights"
          title="Insights"
          description="See how your workspace is doing: time saved, work completed and what your team uses most."
          actions={
            <Button variant="outlined" color="inherit" onClick={load} startIcon={<Icon name="refresh" size={18} />} sx={{ minHeight: 44 }}>
              Refresh
            </Button>
          }
        />

        {loading || !data ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} sx={{ p: 2.25 }}>
                <Skeleton variant="rounded" width={44} height={44} sx={{ mb: 1.5 }} />
                <Skeleton width="50%" height={30} />
                <Skeleton width="70%" />
              </Card>
            ))}
            <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1' }}>Loading your insights...</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
              <StatCard index={1} icon="schedule" accent="cyan" label="Time saved with AI" value={`${kpis?.ai_hours_saved ?? 0} hrs`} hint={`${kpis?.total_ai_calls ?? 0} AI requests`} />
              <StatCard index={2} icon="task_alt" accent="green" label="Tasks completed" value={`${kpis?.completion_rate ?? 0}%`} hint={`${tasks?.tasks_done ?? 0} of ${tasks?.tasks_total ?? 0} tasks done`} />
              <StatCard index={3} icon="folder_open" accent="indigo" label="Documents & notes" value={(kpis?.docs_count ?? 0) + (kpis?.notes_count ?? 0)} hint={`${kpis?.docs_count ?? 0} docs (${kpis?.docs_storage_mb ?? 0} MB) · ${kpis?.notes_count ?? 0} notes`} />
              <StatCard index={4} icon="groups" accent="violet" label="Meetings captured" value={kpis?.meetings_count ?? 0} hint={`Urgent open tasks: ${tasks?.urgent_open ?? 0}`} />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
              <SectionCard index={5} icon="donut_large" accent="green" title="Task progress" subtitle="Where your work stands right now">
                <Stack spacing={2.25}>
                  {[
                    { label: 'Done', val: tasks?.tasks_done || 0, color: 'success' as const },
                    { label: 'In progress', val: tasks?.tasks_in_progress || 0, color: 'secondary' as const },
                    { label: 'To do', val: tasks?.tasks_todo || 0, color: 'warning' as const }
                  ].map((row, i) => {
                    const pct = Math.round((row.val / totalTasks) * 100);
                    return (
                      <Box key={row.label}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.label}</Typography>
                          <Typography variant="body2" color="text.secondary"><Box component="strong" sx={{ color: 'text.primary' }}>{row.val}</Box> · {pct}%</Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          color={row.color}
                          aria-label={`${row.label}: ${pct}%`}
                          sx={{
                            height: 10, borderRadius: 999,
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 999,
                              transformOrigin: 'left',
                            },
                            '&': { animation: `${grow} .9s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${200 + i * 120}ms`, transformOrigin: 'left' },
                            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                          }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              </SectionCard>

              <SectionCard index={6} icon="auto_awesome" accent="cyan" title="AI usage by feature" subtitle="Requests and credits used">
                {data.ai_usage.length === 0 ? (
                  <EmptyState icon="insights" title="No AI usage yet" description="Try Ask Copilot or document search to see usage here." />
                ) : (
                  <Stack spacing={1}>
                    {data.ai_usage.map((u) => (
                      <Stack
                        key={u.feature}
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        sx={{
                          p: 1.25, borderRadius: 2.5, border: 1, borderColor: 'divider',
                          transition: 'background-color .2s, transform .2s',
                          '&:hover': { bgcolor: 'action.hover', transform: 'translateX(2px)' },
                        }}
                      >
                        <IconTile icon="bolt" accent="cyan" size={32} />
                        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{u.feature}</Typography>
                        <Chip size="small" label={`${u.calls} requests · ${u.credits} credits`} />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </SectionCard>
            </Box>
          </>
        )}
      </PageContainer>
    </Box>
  );
};
