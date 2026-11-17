import React from 'react';

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
      <div className="tasks-container">
        <div className="mui-card-header" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="cal-month-title">Tasks & Action Sprint</h2>
            <span className="user-status">Manage deliverables, sprint phases, and AI subtasks</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="mui-btn mui-btn-outlined"
              onClick={() => setShowFocusModal(true)}
              title="Launch Pomodoro Deep Work Focus Mode with Ambient Audio"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="material-symbols-rounded icon-sm" style={{ color: '#06b6d4' }}>timer</span>
              <span>Deep Work (Pomodoro)</span>
            </button>

            <div className="task-view-toggle">
              <button
                type="button"
                className={`task-view-btn ${taskViewMode === 'kanban' ? 'active' : ''}`}
                onClick={() => setTaskViewMode('kanban')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>view_kanban</span>
                <span>Kanban</span>
              </button>
              <button
                type="button"
                className={`task-view-btn ${taskViewMode === 'checklist' ? 'active' : ''}`}
                onClick={() => setTaskViewMode('checklist')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>checklist</span>
                <span>List</span>
              </button>
            </div>

            <button
              className="mui-btn mui-btn-primary"
              id="btn-add-task-dialog"
              onClick={() => setShowTaskModal(true)}
            >
              <span className="material-symbols-rounded icon-sm">add</span>
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Sprint Productivity & Velocity Analytics Dashboard Card */}
        <div className="sprint-analytics-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-rounded" style={{ color: '#06b6d4' }}>speed</span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--mui-text-primary)' }}>Sprint Velocity & Completion Meter</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#06b6d4' }}>{sprintCompletionPercent}% Complete</span>
              <span className="user-status" style={{ fontSize: '11px' }}>({completedTasksCount}/{totalTasksCount} Delivered)</span>
            </div>
          </div>

          <div className="sprint-progress-track">
            <div className="sprint-progress-bar" style={{ width: `${sprintCompletionPercent}%` }} />
          </div>

          <div className="sprint-metrics-grid">
            <div className="sprint-metric-box">
              <span className="sprint-metric-label">Total Backlog</span>
              <span className="sprint-metric-val">{totalTasksCount}</span>
            </div>
            <div className="sprint-metric-box">
              <span className="sprint-metric-label">Completed</span>
              <span className="sprint-metric-val" style={{ color: '#10b981' }}>{completedTasksCount}</span>
            </div>
            <div className="sprint-metric-box">
              <span className="sprint-metric-label">In-Flight</span>
              <span className="sprint-metric-val" style={{ color: '#06b6d4' }}>{inProgressTasksCount}</span>
            </div>
            <div className="sprint-metric-box">
              <span className="sprint-metric-label">High Priority</span>
              <span className="sprint-metric-val" style={{ color: highPriorityCount > 0 ? '#ef4444' : 'var(--mui-text-primary)' }}>
                {highPriorityCount}
              </span>
            </div>
          </div>
        </div>

        {taskViewMode === 'kanban' ? (
          /* KANBAN SPRINT BOARD WITH NATIVE DRAG & DROP */
          <div className="kanban-board">
            {[
              { key: 'todo', label: 'To Do', icon: 'radio_button_unchecked', count: filteredTasks.filter(t => !t.status || t.status === 'todo').length },
              { key: 'in_progress', label: 'In Progress', icon: 'pending', count: filteredTasks.filter(t => t.status === 'in_progress').length },
              { key: 'review', label: 'In Review', icon: 'rate_review', count: filteredTasks.filter(t => t.status === 'review').length },
              { key: 'done', label: 'Done', icon: 'check_circle', count: filteredTasks.filter(t => t.status === 'done').length }
            ].map(col => {
              const colTasks = filteredTasks.filter(t => (t.status || 'todo') === col.key);
              return (
                <div
                  key={col.key}
                  className={`kanban-column ${dragOverCol === col.key ? 'kanban-drag-over' : ''}`}
                  onDragOver={e => handleDragOverColumn(e, col.key)}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={e => handleDropToColumn(e, col.key)}
                >
                  <div className="kanban-col-header">
                    <div className="kanban-col-title">
                      <span className="material-symbols-rounded" style={{ fontSize: '16px', color: '#06b6d4' }}>{col.icon}</span>
                      <span>{col.label}</span>
                    </div>
                    <span className="kanban-col-count">{col.count}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: '120px' }}>
                    {colTasks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '28px 10px', opacity: 0.5, border: '1px dashed var(--mui-border)', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '12px' }}>Drag cards here</span>
                      </div>
                    ) : (
                      colTasks.map(t => (
                        <div
                          key={t.id}
                          className={`kanban-card ${draggedTaskId === t.id ? 'is-dragging' : ''}`}
                          draggable={true}
                          onDragStart={e => handleDragStart(e, t.id)}
                          onDragEnd={handleDragEnd}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mui-text-primary)' }}>
                              {t.title}
                            </span>
                            <button
                              className="mui-btn-icon"
                              style={{ padding: '2px' }}
                              title="Delete task"
                              onClick={() => handleDeleteTask(t.id)}
                            >
                              <span className="material-symbols-rounded icon-sm">delete</span>
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className={`priority-badge priority-${(t.priority || 'medium').toLowerCase()}`}>
                              {t.priority}
                            </span>
                            {t.due_date && (
                              <span className="user-status" style={{ fontSize: '11px' }}>
                                {new Date(t.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* AI Subtasks list */}
                          {t.subtasks && t.subtasks.length > 0 && (
                            <div className="subtask-box">
                              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--mui-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Subtasks</span>
                                <span>{t.subtasks.filter((s: any) => s.done).length}/{t.subtasks.length}</span>
                              </div>
                              {t.subtasks.map((st: any, sIdx: number) => (
                                <label key={sIdx} className={`subtask-item ${st.done ? 'done' : ''}`}>
                                  <input
                                    type="checkbox"
                                    className="mui-checkbox"
                                    checked={st.done}
                                    onChange={() => handleToggleSubtask(t.id, sIdx)}
                                  />
                                  <span>{st.title}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {/* Card Action footer */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--mui-border)' }}>
                            <button
                              type="button"
                              className="mui-btn mui-btn-outlined mui-btn-sm"
                              style={{ fontSize: '10.5px', padding: '3px 6px', gap: '4px', height: 'auto' }}
                              disabled={breakingDownTaskId === t.id}
                              onClick={() => handleBreakdownTask(t.id)}
                              title="AI Auto-Breakdown into subtasks"
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: '13px' }}>
                                {breakingDownTaskId === t.id ? 'sync' : 'auto_awesome'}
                              </span>
                              <span>{breakingDownTaskId === t.id ? 'Thinking...' : 'AI Breakdown'}</span>
                            </button>

                            <select
                              className="rte-select"
                              style={{ fontSize: '10.5px', padding: '2px 4px', height: '24px' }}
                              value={t.status || 'todo'}
                              onChange={e => handleUpdateTaskStatus(t.id, e.target.value)}
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="review">Review</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* CHECKLIST VIEW */
          <div id="tasks-list-mount">
            {filteredTasks.length === 0 ? (
              <p className="user-status">No tasks created yet. Click New Task to add one.</p>
            ) : (
              filteredTasks.map(t => (
                <div key={t.id} className="task-item-row" data-task-id={t.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="task-left">
                      <input
                        type="checkbox"
                        className="mui-checkbox task-check"
                        checked={t.status === 'done'}
                        onChange={() => handleToggleTask(t.id, t.status)}
                      />
                      <span className={`task-title ${t.status === 'done' ? 'done' : ''}`}>
                        {t.title}
                      </span>
                    </div>
                    <div className="task-meta">
                      {t.due_date && (
                        <span className="user-status">
                          {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <span className={`priority-badge priority-${(t.priority || 'medium').toLowerCase()}`}>
                        {t.priority}
                      </span>
                      <button
                        className="mui-btn mui-btn-outlined mui-btn-sm"
                        style={{ fontSize: '11px', padding: '3px 6px', gap: '4px' }}
                        disabled={breakingDownTaskId === t.id}
                        onClick={() => handleBreakdownTask(t.id)}
                        title="AI Auto-Breakdown into subtasks"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>auto_awesome</span>
                        <span>{breakingDownTaskId === t.id ? 'Breaking down...' : 'AI Breakdown'}</span>
                      </button>
                      <button
                        className="mui-btn-icon btn-delete-task"
                        title="Delete task"
                        onClick={() => handleDeleteTask(t.id)}
                      >
                        <span className="material-symbols-rounded icon-sm">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Subtasks inside checklist */}
                  {t.subtasks && t.subtasks.length > 0 && (
                    <div className="subtask-box" style={{ marginLeft: '32px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mui-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Actionable Steps ({t.subtasks.filter((s: any) => s.done).length}/{t.subtasks.length})</span>
                      </div>
                      {t.subtasks.map((st: any, sIdx: number) => (
                        <label key={sIdx} className={`subtask-item ${st.done ? 'done' : ''}`}>
                          <input
                            type="checkbox"
                            className="mui-checkbox"
                            checked={st.done}
                            onChange={() => handleToggleSubtask(t.id, sIdx)}
                          />
                          <span>{st.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
