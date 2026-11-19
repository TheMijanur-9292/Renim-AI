import React from 'react';
import {
  Box, Button, Card, Checkbox, Chip, Grid2 as Grid, IconButton, LinearProgress, MenuItem, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import { EmptyState, Icon, PageContainer, PageHeader, SectionCard, StatCard, riseSx } from '../ui';

export interface TasksViewProps {
  isActive: boolean;
  setShowFocusModal: (show: boolean) => void;
  taskViewMode: 'kanban' | 'checklist';
  setTaskViewMode: (mode: 'kanban' | 'checklist') => void;
  setShowTaskModal: (show: boolean) => void;
  sprintCompletionPercent: number;
  completedTasksCount: number;
  totalTasksCount: number;
  inProgressTasksCount: number;
  highPriorityCount: number;
  filteredTasks: any[];
  dragOverCol: string | null;
  setDragOverCol: (col: string | null) => void;
  handleDragOverColumn: (e: React.DragEvent, colKey: string) => void;
  handleDropToColumn: (e: React.DragEvent, colKey: string) => void;
  draggedTaskId: string | null;
  handleDragStart: (e: React.DragEvent, taskId: string) => void;
  handleDragEnd: () => void;
  handleDeleteTask: (id: string) => void;
  breakingDownTaskId: string | null;
  handleBreakdownTask: (id: string) => void;
  handleToggleSubtask: (taskId: string, subtaskIdx: number) => void;
  handleUpdateTaskStatus: (taskId: string, status: string) => void;
  handleToggleTask: (taskId: string, currentStatus: string) => void;
}

const priorityColor = (p?: string): 'error' | 'warning' | 'default' => {
  const v = (p || 'medium').toLowerCase();
  return v === 'high' || v === 'urgent' ? 'error' : v === 'medium' ? 'warning' : 'default';
};

const SubtaskList: React.FC<{ task: any; label: string; onToggle: (idx: number) => void }> = ({ task, label, onToggle }) => (
  <Box sx={{ p: 1.25, borderRadius: 3, bgcolor: 'action.hover' }}>
    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 700 }} color="text.secondary">{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 700 }} color="text.secondary">
        {task.subtasks.filter((s: any) => s.done).length}/{task.subtasks.length}
      </Typography>
    </Stack>
    {task.subtasks.map((st: any, sIdx: number) => (
      <Stack key={sIdx} component="label" direction="row" alignItems="center" spacing={0.5} sx={{ cursor: 'pointer', minHeight: 36 }}>
        <Checkbox size="small" color="secondary" checked={st.done} onChange={() => onToggle(sIdx)} sx={{ p: 0.75 }} />
        <Typography
          variant="body2"
          sx={{ fontSize: 13, textDecoration: st.done ? 'line-through' : 'none', color: st.done ? 'text.secondary' : 'text.primary', overflowWrap: 'anywhere' }}
        >
          {st.title}
        </Typography>
      </Stack>
    ))}
  </Box>
);

export const TasksView: React.FC<TasksViewProps> = ({
  isActive,
  setShowFocusModal,
  taskViewMode,
  setTaskViewMode,
  setShowTaskModal,
  sprintCompletionPercent,
  completedTasksCount,
  totalTasksCount,
  inProgressTasksCount,
  highPriorityCount,
  filteredTasks,
  dragOverCol,
  setDragOverCol,
  handleDragOverColumn,
  handleDropToColumn,
  draggedTaskId,
  handleDragStart,
  handleDragEnd,
  handleDeleteTask,
  breakingDownTaskId,
  handleBreakdownTask,
  handleToggleSubtask,
  handleUpdateTaskStatus,
  handleToggleTask,
}) => {
  return (
    <div id="view-tasks" className={`view-container ${isActive ? 'active' : ''}`}>
      <PageContainer>
        <PageHeader
          overline="Workspace"
          title="Tasks"
          description="Plan your work, track progress and break big tasks into steps."
          actions={
            <>
              <Button variant="outlined" onClick={() => setShowFocusModal(true)} startIcon={<Icon name="timer" size={18} />} sx={{ minHeight: 44 }}>
                Focus session
              </Button>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={taskViewMode}
                onChange={(_, v) => { if (v) setTaskViewMode(v); }}
                aria-label="Task view"
              >
                <ToggleButton value="kanban" sx={{ px: 1.5, gap: 0.75, minHeight: 44 }}>
                  <Icon name="view_kanban" size={18} />Board
                </ToggleButton>
                <ToggleButton value="checklist" sx={{ px: 1.5, gap: 0.75, minHeight: 44 }}>
                  <Icon name="checklist" size={18} />List
                </ToggleButton>
              </ToggleButtonGroup>
              <Button
                variant="contained"
                color="primary"
                id="btn-add-task-dialog"
                onClick={() => setShowTaskModal(true)}
                startIcon={<Icon name="add" size={18} />}
                sx={{ minHeight: 44 }}
              >
                New task
              </Button>
            </>
          }
        />

        {/* Progress */}
        <SectionCard
          index={1}
          icon="speed"
          title="Progress"
          subtitle={`${completedTasksCount} of ${totalTasksCount} done`}
          action={<Typography sx={{ fontWeight: 800, fontSize: 20, color: 'secondary.main' }}>{sprintCompletionPercent}%</Typography>}
          sx={{ mb: 2.5 }}
        >
          <LinearProgress
            variant="determinate"
            color="secondary"
            value={sprintCompletionPercent}
            sx={{ height: 8, borderRadius: 4, mb: 2.5, '& .MuiLinearProgress-bar': { borderRadius: 4, transition: 'transform .6s ease' } }}
          />
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6, md: 3 }}><StatCard index={2} icon="inventory_2" accent="slate" label="Total" value={totalTasksCount} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatCard index={3} icon="task_alt" accent="green" label="Completed" value={completedTasksCount} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatCard index={4} icon="pending" accent="cyan" label="In progress" value={inProgressTasksCount} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatCard index={5} icon="flag" accent={highPriorityCount > 0 ? 'red' : 'slate'} label="High priority" value={highPriorityCount} /></Grid>
          </Grid>
        </SectionCard>

        {taskViewMode === 'kanban' ? (
          /* Board with native drag and drop */
          <Box sx={{ overflowX: 'auto', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, pb: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(4, minmax(260px, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
              {[
                { key: 'todo', label: 'To do', icon: 'radio_button_unchecked', count: filteredTasks.filter(t => !t.status || t.status === 'todo').length },
                { key: 'in_progress', label: 'In progress', icon: 'pending', count: filteredTasks.filter(t => t.status === 'in_progress').length },
                { key: 'review', label: 'In review', icon: 'rate_review', count: filteredTasks.filter(t => t.status === 'review').length },
                { key: 'done', label: 'Done', icon: 'check_circle', count: filteredTasks.filter(t => t.status === 'done').length }
              ].map((col, ci) => {
                const colTasks = filteredTasks.filter(t => (t.status || 'todo') === col.key);
                const over = dragOverCol === col.key;
                return (
                  <Box
                    key={col.key}
                    onDragOver={e => handleDragOverColumn(e, col.key)}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={e => handleDropToColumn(e, col.key)}
                    sx={{
                      p: 1.5, borderRadius: '20px', border: 1, display: 'flex', flexDirection: 'column', gap: 1.25,
                      borderColor: over ? 'secondary.main' : 'divider',
                      bgcolor: over ? 'action.selected' : 'action.hover',
                      transition: 'background-color .2s ease, border-color .2s ease',
                      ...riseSx(6 + ci),
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 0.5, py: 0.5 }}>
                      <Icon name={col.icon} size={18} sx={{ color: 'secondary.main' }} />
                      <Typography variant="subtitle2" sx={{ flex: 1 }}>{col.label}</Typography>
                      <Chip size="small" label={col.count} />
                    </Stack>

                    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 120 }}>
                      {colTasks.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 3.5, px: 1, border: '1px dashed', borderColor: 'divider', borderRadius: 3, color: 'text.secondary' }}>
                          <Typography variant="caption">Drop tasks here</Typography>
                        </Box>
                      ) : (
                        colTasks.map(t => (
                          <Card
                            key={t.id}
                            draggable={true}
                            onDragStart={e => handleDragStart(e, t.id)}
                            onDragEnd={handleDragEnd}
                            sx={{
                              p: 1.5, display: 'flex', flexDirection: 'column', gap: 1, cursor: 'grab',
                              borderRadius: 4, opacity: draggedTaskId === t.id ? 0.45 : 1,
                              transition: 'transform .2s ease, box-shadow .2s ease, opacity .2s ease',
                              '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                              '@media (prefers-reduced-motion: reduce)': { '&:hover': { transform: 'none' } },
                            }}
                          >
                            <Stack direction="row" alignItems="flex-start" spacing={1}>
                              <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0, overflowWrap: 'anywhere', pt: 0.5 }}>
                                {t.title}
                              </Typography>
                              <IconButton size="small" aria-label="Delete task" onClick={() => handleDeleteTask(t.id)} sx={{ width: 36, height: 36, mt: -0.5, mr: -0.5 }}>
                                <Icon name="delete" size={18} />
                              </IconButton>
                            </Stack>

                            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                              {t.priority && <Chip size="small" variant="outlined" color={priorityColor(t.priority)} label={t.priority} />}
                              {t.due_date && (
                                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'text.secondary' }}>
                                  <Icon name="event" size={14} />
                                  <Typography variant="caption">{new Date(t.due_date).toLocaleDateString()}</Typography>
                                </Stack>
                              )}
                            </Stack>

                            {t.subtasks && t.subtasks.length > 0 && (
                              <SubtaskList task={t} label="Steps" onToggle={idx => handleToggleSubtask(t.id, idx)} />
                            )}

                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
                              <Button
                                size="small"
                                variant="text"
                                color="secondary"
                                disabled={breakingDownTaskId === t.id}
                                onClick={() => handleBreakdownTask(t.id)}
                                startIcon={<Icon name={breakingDownTaskId === t.id ? 'sync' : 'auto_awesome'} size={16} />}
                                sx={{ minHeight: 36, whiteSpace: 'nowrap' }}
                              >
                                {breakingDownTaskId === t.id ? 'Thinking...' : 'Split into steps'}
                              </Button>
                              <TextField
                                select
                                size="small"
                                value={t.status || 'todo'}
                                onChange={e => handleUpdateTaskStatus(t.id, e.target.value)}
                                slotProps={{ htmlInput: { 'aria-label': 'Status' } }}
                                sx={{ minWidth: 118, '& .MuiSelect-select': { py: 0.75, fontSize: 13 } }}
                              >
                                <MenuItem value="todo">To do</MenuItem>
                                <MenuItem value="in_progress">In progress</MenuItem>
                                <MenuItem value="review">In review</MenuItem>
                                <MenuItem value="done">Done</MenuItem>
                              </TextField>
                            </Stack>
                          </Card>
                        ))
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : (
          /* List view */
          <SectionCard index={6} padding={1.5}>
            <Box id="tasks-list-mount">
              {filteredTasks.length === 0 ? (
                <EmptyState icon="checklist" title="No tasks yet" description="Select New task to add your first one." />
              ) : (
                <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
                  {filteredTasks.map(t => (
                    <Stack key={t.id} data-task-id={t.id} spacing={1} sx={{ py: 1, px: 0.5, borderRadius: 3, transition: 'background-color .2s ease', '&:hover': { bgcolor: 'action.hover' } }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1}>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                          <Checkbox
                            color="secondary"
                            checked={t.status === 'done'}
                            onChange={() => handleToggleTask(t.id, t.status)}
                            inputProps={{ 'aria-label': `Mark ${t.title} as done` }}
                          />
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500, overflowWrap: 'anywhere',
                              textDecoration: t.status === 'done' ? 'line-through' : 'none',
                              color: t.status === 'done' ? 'text.secondary' : 'text.primary',
                            }}
                          >
                            {t.title}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ pl: { xs: 5.5, sm: 0 } }}>
                          {t.due_date && (
                            <Typography variant="caption" color="text.secondary">{new Date(t.due_date).toLocaleDateString()}</Typography>
                          )}
                          {t.priority && <Chip size="small" variant="outlined" color={priorityColor(t.priority)} label={t.priority} />}
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={breakingDownTaskId === t.id}
                            onClick={() => handleBreakdownTask(t.id)}
                            startIcon={<Icon name="auto_awesome" size={16} />}
                            sx={{ minHeight: 36 }}
                          >
                            {breakingDownTaskId === t.id ? 'Splitting...' : 'Split into steps'}
                          </Button>
                          <Tooltip title="Delete task">
                            <IconButton className="btn-delete-task" aria-label="Delete task" onClick={() => handleDeleteTask(t.id)} sx={{ width: 40, height: 40 }}>
                              <Icon name="delete" size={20} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>

                      {t.subtasks && t.subtasks.length > 0 && (
                        <Box sx={{ ml: { xs: 0, sm: 5.5 } }}>
                          <SubtaskList task={t} label="Steps" onToggle={idx => handleToggleSubtask(t.id, idx)} />
                        </Box>
                      )}
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          </SectionCard>
        )}
      </PageContainer>
    </div>
  );
};
