import React, { useState } from 'react';
import { renderMarkdownToHtml } from '../../utils/markdown';

export interface TodayViewProps {
  isActive: boolean;
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

export const TodayView: React.FC<TodayViewProps> = ({
  isActive,
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

  return (
    <div id="view-today" className={`view-container ${isActive ? 'active' : ''}`}>
      {!checklistDismissed && (
        <div
          className="mui-card"
          style={{
            marginBottom: '14px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className="cmd-badge" style={{ color: '#22d3ee' }}>QUICK START</span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              Press <kbd style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--mui-border-strong)', fontSize: '11px' }}>Ctrl+K</kbd> to jump anywhere
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="mui-btn mui-btn-outlined mui-btn-sm" onClick={() => onNavigateView && onNavigateView('view-notes')}>
                1. Write a Note
              </button>
              <button className="mui-btn mui-btn-outlined mui-btn-sm" onClick={() => onNavigateView && onNavigateView('view-chat')}>
                2. Ask Copilot
              </button>
              <button className="mui-btn mui-btn-outlined mui-btn-sm" onClick={() => onNavigateView && onNavigateView('view-profile')}>
                3. Enable 2FA
              </button>
            </div>
          </div>
          <button className="mui-btn-icon" onClick={dismissChecklist} title="Dismiss">
            <span className="material-symbols-rounded icon-sm">close</span>
          </button>
        </div>
      )}
      {/* Voice Memo Bar */}
      <div className="voice-memo-bar">
        <div className="voice-memo-left">
          <button
            className={`btn-mic-pulse ${isVoiceMemoActive ? 'recording' : ''}`}
            id="btn-voice-memo"
            title="Click & Speak Voice Memo"
            onClick={handleVoiceMemoToggle}
          >
            <span className="material-symbols-rounded icon-md">mic</span>
          </button>
          <div>
            <strong>Quick AI Voice Memo</strong>
            <p className="user-status" id="voice-memo-status">{voiceMemoStatus}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onOpenFocusModal && (
            <button
              className="mui-btn mui-btn-primary mui-btn-sm"
              id="btn-today-deep-work"
              onClick={onOpenFocusModal}
              title="Launch Pomodoro Deep Work Focus Studio"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="material-symbols-rounded icon-sm">timer</span>
              <span>Deep Work Studio</span>
            </button>
          )}
          <button
            className="mui-btn mui-btn-outlined mui-btn-sm"
            id="btn-refresh-briefing"
            onClick={() => generateMorningBriefing()}
          >
            <span className="material-symbols-rounded icon-sm">sync</span>
            <span>Refresh Briefing</span>
          </button>
        </div>
      </div>

      {/* Quick Launchpad to New Features & Modules */}
      {onNavigateView && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div
            onClick={() => onNavigateView('view-calendar')}
            style={{
              padding: '12px 14px',
              background: 'var(--mui-paper)',
              border: '1px solid var(--mui-border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease'
            }}
            title="Google Calendar 1-Click Sync & iCal Integration"
          >
            <span className="material-symbols-rounded" style={{ color: '#06b6d4', fontSize: '24px' }}>calendar_month</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>Google Calendar Sync</div>
              <div className="user-status" style={{ fontSize: '11px' }}>1-Click Sync & iCal (.ics)</div>
            </div>
          </div>

          <div
            onClick={() => onOpenFocusModal?.()}
            style={{
              padding: '12px 14px',
              background: 'var(--mui-paper)',
              border: '1px solid var(--mui-border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease'
            }}
            title="Pomodoro Deep Work & Procedural Ambient Sounds"
          >
            <span className="material-symbols-rounded" style={{ color: '#10b981', fontSize: '24px' }}>timer</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>AI Deep Work Focus</div>
              <div className="user-status" style={{ fontSize: '11px' }}>25m/50m + Ambient Sounds</div>
            </div>
          </div>

          <div
            onClick={() => onNavigateView('view-tasks')}
            style={{
              padding: '12px 14px',
              background: 'var(--mui-paper)',
              border: '1px solid var(--mui-border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease'
            }}
            title="Kanban Board with Drag & Drop & Sprint Velocity"
          >
            <span className="material-symbols-rounded" style={{ color: '#818cf8', fontSize: '24px' }}>view_kanban</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>Kanban Sprint Board</div>
              <div className="user-status" style={{ fontSize: '11px' }}>Drag & Drop + AI Subtasks</div>
            </div>
          </div>

          <div
            onClick={() => onNavigateView('view-settings')}
            style={{
              padding: '12px 14px',
              background: 'var(--mui-paper)',
              border: '1px solid var(--mui-border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease'
            }}
            title="Web Push Notifications & Resend Email Alerts"
          >
            <span className="material-symbols-rounded" style={{ color: '#f59e0b', fontSize: '24px' }}>notifications_active</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>Push & Email Alerts</div>
              <div className="user-status" style={{ fontSize: '11px' }}>Web Push + Resend Delivery</div>
            </div>
          </div>
        </div>
      )}

      {/* AI Morning Briefing Card */}
      <div className="briefing-banner">
        <div className="briefing-header">
          <div className="briefing-title">
            <span className="material-symbols-rounded">auto_awesome</span>
            <span>AI Executive Morning Briefing</span>
          </div>
          <span className="brand-version" id="today-date-badge">{todayDateBadge}</span>
        </div>
        <div className="briefing-content" id="daily-briefing-text">
          {isBriefingLoading ? (
            <div className="ai-thinking-row">
              <div className="ai-msg-avatar thinking-spin" style={{ width: '24px', height: '24px' }}>
                <img src="/icon.svg" alt="Renim AI" />
              </div>
              <span className="ai-thinking-status">{aiThinkingSteps[thinkingStepIndex]}</span>
              <div className="ai-typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          ) : (
            <div
              className="ai-markdown-body"
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(briefingText) }}
            />
          )}
        </div>
      </div>

      {/* Today's 2-Column Grid */}
      <div className="today-grid">
        {/* Column 1: Today's High Priority Tasks */}
        <div className="mui-card">
          <div className="mui-card-header">
            <h3 className="mui-card-title">
              <span className="material-symbols-rounded">priority_high</span>
              <span>Priority Focus Tasks</span>
            </h3>
            <button
              className="mui-btn mui-btn-outlined mui-btn-sm"
              id="btn-today-add-task"
              onClick={() => setShowTaskModal(true)}
            >
              <span className="material-symbols-rounded icon-sm">add</span>
              <span>Add Task</span>
            </button>
          </div>
          <div id="today-tasks-list">
            {pendingTasks.length === 0 ? (
              <p className="user-status">All caught up! No urgent tasks.</p>
            ) : (
              pendingTasks.slice(0, 5).map(t => (
                <div key={t.id} className="task-item-row" data-task-id={t.id}>
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
                  <span className={`priority-badge priority-${(t.priority || 'medium').toLowerCase()}`}>
                    {t.priority}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Today's Schedule */}
        <div className="mui-card">
          <div className="mui-card-header">
            <h3 className="mui-card-title">
              <span className="material-symbols-rounded">schedule</span>
              <span>Today's Schedule</span>
            </h3>
            <button
              className="mui-btn mui-btn-outlined mui-btn-sm"
              id="btn-today-add-event"
              onClick={() => setShowEventModal(true)}
            >
              <span className="material-symbols-rounded icon-sm">add</span>
            </button>
          </div>
          <div id="today-schedule-list">
            {todayEvents.length === 0 ? (
              <p className="user-status">No events scheduled for today.</p>
            ) : (
              todayEvents.map(e => (
                <div
                  key={e.id}
                  style={{
                    padding: '8px',
                    background: 'var(--mui-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--mui-border)',
                    marginBottom: '6px',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <strong>{e.title}</strong>
                    <div className="user-status">
                      {e.start_time.slice(0, 5)} • {e.category}
                    </div>
                  </div>
                  <span className={`cal-event-chip chip-${(e.category || 'work').toLowerCase()}`}>
                    {e.category}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
