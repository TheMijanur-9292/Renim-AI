import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Grid2 as Grid, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { EmptyState, Icon, PageContainer, PageHeader, SectionCard } from '../ui';
import {
  fetchCalendarProviders,
  fetchExternalCalendarEvents,
  syncCalendarProvider,
  consumeCalendarOAuthResult,
  describeCalendarOAuthResult,
  CALENDAR_PROVIDER_LABELS,
  type CalendarProviderId,
  type CalendarProviderStatus,
  type ExternalCalendarEvent,
} from '../../services/enterprise';

export interface CalendarViewProps {
  isActive: boolean;
  events: any[];
  monthNames: string[];
  calMonth: number;
  calYear: number;
  setCalMonthDate: (d: Date) => void;
  setCalSelectedDateStr: (s: string) => void;
  calSelectedDateStr: string;
  firstDayIndex: number;
  prevMonthDays: number;
  totalDays: number;
  isCurrentMonth: boolean;
  nowDate: Date;
  nextTrailingDays: number;
  handleExportCalendarICS: () => void;
  icsFileInputRef: React.RefObject<HTMLInputElement>;
  setShowEventModal: (show: boolean) => void;
  selectedDayEvents: any[];
  getGoogleCalendarUrl: (e: any) => string;
  handleSendEmailReminder: (e: any) => void;
  handleDeleteEvent: (id: string) => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Maps a synced external event into the shape the month grid and agenda already render. */
function toDisplayEvent(e: ExternalCalendarEvent) {
  const d = new Date(e.start_at);
  // All-day events are stored at UTC midnight: keep the calendar date, not the local shift.
  const event_date = e.all_day
    ? e.start_at.slice(0, 10)
    : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return {
    id: `ext-${e.provider}-${e.external_id}`,
    title: e.title,
    description: e.description,
    event_date,
    start_time: e.all_day ? '00:00' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    all_day: e.all_day,
    external: true as const,
    provider: e.provider,
    html_link: e.html_link,
    location: e.location,
  };
}

const PROVIDER_ICON: Record<CalendarProviderId, string> = { google: 'calendar_month', microsoft: 'event_note' };
const PROVIDER_SHORT: Record<CalendarProviderId, string> = { google: 'Google', microsoft: 'Outlook' };

let autoSyncedFromOAuth = false;

const dayCellSx = {
  minHeight: { xs: 48, sm: 76, lg: 104 },
  p: { xs: 0.5, sm: 0.75 },
  borderRadius: { xs: 2, sm: 3 },
  border: 1,
  borderColor: 'divider',
  display: 'flex',
  flexDirection: 'column',
  gap: 0.5,
  minWidth: 0,
  overflow: 'hidden',
} as const;

export const CalendarView: React.FC<CalendarViewProps> = ({
  isActive,
  events,
  monthNames,
  calMonth,
  calYear,
  setCalMonthDate,
  setCalSelectedDateStr,
  calSelectedDateStr,
  firstDayIndex,
  prevMonthDays,
  totalDays,
  isCurrentMonth,
  nowDate,
  nextTrailingDays,
  handleExportCalendarICS,
  icsFileInputRef,
  setShowEventModal,
  selectedDayEvents,
  getGoogleCalendarUrl,
  handleSendEmailReminder,
  handleDeleteEvent,
}) => {
  const [providers, setProviders] = useState<CalendarProviderStatus[]>([]);
  const [externalEvents, setExternalEvents] = useState<ExternalCalendarEvent[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{ severity: 'success' | 'error' | 'info'; message: string } | null>(null);

  const connected = useMemo(() => providers.filter(p => p.configured && p.connected), [providers]);

  const loadExternal = useCallback(async () => {
    try {
      const res = await fetchCalendarProviders();
      setProviders(res.providers);
      if (!res.providers.some(p => p.connected)) {
        setExternalEvents([]);
        return;
      }
      // Pad the range a week either side so leading/trailing days and time zones are covered.
      const from = new Date(calYear, calMonth, 1 - 7);
      const to = new Date(calYear, calMonth + 1, 7);
      const fmt = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      const ev = await fetchExternalCalendarEvents(fmt(from), fmt(to));
      setExternalEvents(ev.events);
    } catch {
      // Calendar sync is optional; never block the calendar on it.
    }
  }, [calYear, calMonth]);

  const syncAll = useCallback(async (only?: CalendarProviderId[]) => {
    const targets = only ?? connected.map(p => p.provider);
    if (!targets.length) return;
    setSyncing(true);
    try {
      const results = await Promise.allSettled(targets.map(p => syncCalendarProvider(p)));
      const failed = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed) setNotice({ severity: 'error', message: failed.reason?.message || 'Sync failed' });
      await loadExternal();
    } finally {
      setSyncing(false);
    }
  }, [connected, loadExternal]);

  useEffect(() => {
    const result = consumeCalendarOAuthResult();
    const desc = describeCalendarOAuthResult(result);
    if (desc) setNotice(desc);
    const p = result?.connected;
    if ((p === 'google' || p === 'microsoft') && !autoSyncedFromOAuth) {
      autoSyncedFromOAuth = true;
      syncAll([p]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isActive) loadExternal();
  }, [isActive, loadExternal]);

  const externalDisplay = useMemo(() => externalEvents.map(toDisplayEvent), [externalEvents]);
  const allEvents: any[] = useMemo(() => [...events, ...externalDisplay], [events, externalDisplay]);
  const monthPrefix = `${calYear}-${pad2(calMonth + 1)}-`;
  const monthEventCount = useMemo(
    () => allEvents.filter(e => String(e.event_date || '').startsWith(monthPrefix)).length,
    [allEvents, monthPrefix],
  );
  const agendaEvents: any[] = useMemo(
    () => [...selectedDayEvents, ...externalDisplay.filter(e => e.event_date === calSelectedDateStr)]
      .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || ''))),
    [selectedDayEvents, externalDisplay, calSelectedDateStr],
  );

  return (
    <div id="view-calendar" className={`view-container ${isActive ? 'active' : ''}`}>
      <PageContainer>
        <PageHeader
          overline="Workspace"
          title="Calendar"
          description="See your month at a glance and manage events for any day."
          actions={
            <>
              {connected.length > 0 && (
                <Tooltip title={`Sync ${connected.map(p => CALENDAR_PROVIDER_LABELS[p.provider]).join(' and ')}`}>
                  <span>
                    <IconButton aria-label="Sync connected calendars" onClick={() => syncAll()} disabled={syncing} sx={{ width: 44, height: 44, border: 1, borderColor: 'divider' }}>
                      {syncing ? <CircularProgress size={18} color="secondary" /> : <Icon name="sync" size={20} />}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              <Button variant="outlined" onClick={handleExportCalendarICS} startIcon={<Icon name="download" size={18} />} sx={{ minHeight: 44 }}>
                Export
              </Button>
              <Button variant="outlined" onClick={() => icsFileInputRef.current?.click()} startIcon={<Icon name="upload_file" size={18} />} sx={{ minHeight: 44 }}>
                Import
              </Button>
              <Button
                variant="contained"
                color="primary"
                id="btn-cal-add-event"
                onClick={() => setShowEventModal(true)}
                startIcon={<Icon name="add" size={18} />}
                sx={{ minHeight: 44 }}
              >
                New event
              </Button>
            </>
          }
        />

        {notice && (
          <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 2, borderRadius: 3 }}>
            {notice.message}
          </Alert>
        )}

        <Grid container spacing={2.5}>
          {/* Month grid */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <SectionCard index={1} padding={2}>
              <Box id="calendar-grid-mount">
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h5" component="h2">{monthNames[calMonth]} {calYear}</Typography>
                    <Typography variant="caption" color="text.secondary">{monthEventCount} {monthEventCount === 1 ? 'event' : 'events'}</Typography>
                  </Box>
                  <IconButton aria-label="Previous month" onClick={() => setCalMonthDate(new Date(calYear, calMonth - 1, 1))} sx={{ width: 44, height: 44 }}>
                    <Icon name="chevron_left" size={22} />
                  </IconButton>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ minHeight: 40 }}
                    onClick={() => {
                      const now = new Date();
                      setCalMonthDate(now);
                      setCalSelectedDateStr(now.toISOString().slice(0, 10));
                    }}
                  >
                    Today
                  </Button>
                  <IconButton aria-label="Next month" onClick={() => setCalMonthDate(new Date(calYear, calMonth + 1, 1))} sx={{ width: 44, height: 44 }}>
                    <Icon name="chevron_right" size={22} />
                  </IconButton>
                </Stack>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: 0.5, sm: 0.75 }, mb: 0.75 }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <Typography key={d} variant="caption" sx={{ textAlign: 'center', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {d}
                    </Typography>
                  ))}
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: 0.5, sm: 0.75 } }}>
                  {/* Previous month trailing days */}
                  {Array.from({ length: firstDayIndex }).map((_, idx) => {
                    const dayNum = prevMonthDays - (firstDayIndex - 1 - idx);
                    return (
                      <Box key={`prev-${idx}`} sx={{ ...dayCellSx, opacity: 0.4, borderStyle: 'dashed' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>{dayNum}</Typography>
                      </Box>
                    );
                  })}

                  {/* Current month days */}
                  {Array.from({ length: totalDays }).map((_, idx) => {
                    const day = idx + 1;
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayEvents = allEvents.filter(e => e.event_date === dateStr);
                    const isToday = isCurrentMonth && nowDate.getDate() === day;
                    const isSelected = calSelectedDateStr === dateStr;

                    return (
                      <Box
                        key={dateStr}
                        component="button"
                        type="button"
                        aria-label={`${monthNames[calMonth]} ${day}${dayEvents.length ? `, ${dayEvents.length} events` : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => setCalSelectedDateStr(dateStr)}
                        sx={{
                          ...dayCellSx,
                          font: 'inherit', color: 'text.primary', textAlign: 'left', cursor: 'pointer',
                          bgcolor: isSelected ? 'action.selected' : 'background.paper',
                          borderColor: isSelected ? 'secondary.main' : 'divider',
                          transition: 'background-color .2s ease, border-color .2s ease, transform .2s ease',
                          '&:hover': { bgcolor: 'action.hover', borderColor: 'secondary.light' },
                          '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 1 },
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                          <Box
                            component="span"
                            sx={{
                              width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: isToday ? 800 : 600,
                              bgcolor: isToday ? 'primary.main' : 'transparent',
                              color: isToday ? 'primary.contrastText' : 'inherit',
                            }}
                          >
                            {day}
                          </Box>
                          {dayEvents.length > 0 && (
                            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, fontSize: 11, fontWeight: 700, color: 'secondary.main' }}>
                              {dayEvents.length}
                            </Box>
                          )}
                        </Stack>
                        {/* Phone: dot indicator */}
                        {dayEvents.length > 0 && (
                          <Box sx={{ display: { xs: 'block', sm: 'none' }, width: 6, height: 6, borderRadius: '50%', bgcolor: 'secondary.main', mx: 'auto' }} />
                        )}
                        <Stack spacing={0.5} sx={{ display: { xs: 'none', sm: 'flex' }, width: '100%', minWidth: 0 }}>
                          {dayEvents.slice(0, 2).map(e => (
                            <Box
                              key={e.id}
                              title={e.title}
                              sx={{
                                px: 0.75, py: 0.25, borderRadius: 1.5, fontSize: 11, lineHeight: 1.5,
                                bgcolor: 'action.hover', borderLeft: 3, borderColor: e.external ? 'text.disabled' : 'secondary.main',
                                borderLeftStyle: e.external ? 'dashed' : 'solid',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}
                            >
                              {e.external && <Icon name={PROVIDER_ICON[e.provider as CalendarProviderId]} size={11} sx={{ mr: 0.25, verticalAlign: '-1px', color: 'text.secondary' }} />}
                              <Box component="span" sx={{ fontWeight: 700, mr: 0.5, display: { sm: 'none', lg: 'inline' } }}>{e.all_day ? '' : String(e.start_time || '').slice(0, 5)}</Box>
                              {e.title}
                            </Box>
                          ))}
                          {dayEvents.length > 2 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>+{dayEvents.length - 2} more</Typography>
                          )}
                        </Stack>
                      </Box>
                    );
                  })}

                  {/* Next month leading days */}
                  {Array.from({ length: nextTrailingDays }).map((_, idx) => (
                    <Box key={`next-${idx}`} sx={{ ...dayCellSx, opacity: 0.4, borderStyle: 'dashed' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>{idx + 1}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </SectionCard>
          </Grid>

          {/* Selected day agenda */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <SectionCard
              index={2}
              icon="event"
              title={<span id="cal-selected-date-title">Agenda: {calSelectedDateStr}</span>}
              subtitle={`${agendaEvents.length} ${agendaEvents.length === 1 ? 'event' : 'events'}`}
              sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}
            >
              <Stack id="cal-selected-events-list" spacing={1}>
                {agendaEvents.length === 0 ? (
                  <EmptyState icon="event_available" title="No events" description="Nothing planned for this day." />
                ) : (
                  agendaEvents.map((e: any) => e.external ? (
                    <Stack
                      key={e.id}
                      direction="row"
                      alignItems="center"
                      spacing={1.5}
                      sx={{ p: 1.5, borderRadius: 3, border: 1, borderStyle: 'dashed', borderColor: 'divider' }}
                    >
                      <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, bgcolor: 'text.disabled', flex: 'none' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{e.title}</Typography>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{e.all_day ? 'All day' : e.start_time}</Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={<Icon name={PROVIDER_ICON[e.provider as CalendarProviderId]} size={14} />}
                            label={`${PROVIDER_SHORT[e.provider as CalendarProviderId]} · read-only`}
                            sx={{ height: 20, fontSize: 11 }}
                          />
                        </Stack>
                        {e.location && (
                          <Typography variant="caption" color="text.secondary" component="div" sx={{ overflowWrap: 'anywhere' }}>{e.location}</Typography>
                        )}
                      </Box>
                      {e.html_link && (
                        <Tooltip title={`Open in ${PROVIDER_SHORT[e.provider as CalendarProviderId]}`}>
                          <IconButton component="a" href={e.html_link} target="_blank" rel="noopener noreferrer" aria-label="Open in original calendar" sx={{ width: 40, height: 40 }}>
                            <Icon name="open_in_new" size={20} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  ) : (
                    <Stack
                      key={e.id}
                      direction="row"
                      alignItems="center"
                      spacing={1.5}
                      sx={{ p: 1.5, borderRadius: 3, bgcolor: 'action.hover', transition: 'transform .2s ease', '&:hover': { transform: 'translateX(2px)' } }}
                    >
                      <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, bgcolor: 'secondary.main', flex: 'none' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{e.title}</Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{e.start_time.slice(0, 5)}</Typography>
                          {e.category && <Chip size="small" label={e.category} sx={{ height: 20, fontSize: 11 }} />}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.25}>
                        <Tooltip title="Add to Google Calendar">
                          <IconButton
                            component="a"
                            href={getGoogleCalendarUrl(e)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Add to Google Calendar"
                            sx={{ width: 40, height: 40, color: 'secondary.main' }}
                          >
                            <Icon name="calendar_add_on" size={20} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Email me a reminder">
                          <IconButton aria-label="Email me a reminder" onClick={() => handleSendEmailReminder(e)} sx={{ width: 40, height: 40 }}>
                            <Icon name="forward_to_inbox" size={20} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete event">
                          <IconButton aria-label="Delete event" onClick={() => handleDeleteEvent(e.id)} sx={{ width: 40, height: 40 }}>
                            <Icon name="delete" size={20} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  ))
                )}
              </Stack>
            </SectionCard>
          </Grid>
        </Grid>
      </PageContainer>
    </div>
  );
};
