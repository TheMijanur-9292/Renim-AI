import React from 'react';

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
  return (
    <div id="view-calendar" className={`view-container ${isActive ? 'active' : ''}`}>
      <div className="calendar-layout">
        {/* Left: Main Calendar Grid */}
        <div className="mui-card">
          <div id="calendar-grid-mount">
            <div className="cal-header">
              <div className="cal-title-wrap">
                <h2 className="cal-month-title">
                  {monthNames[calMonth]} {calYear}
                </h2>
                <span className="cal-events-count">{events.length} Events</span>
              </div>
              <div className="cal-nav-buttons">
                <button
                  className="mui-btn-icon"
                  title="Previous Month"
                  onClick={() => setCalMonthDate(new Date(calYear, calMonth - 1, 1))}
                >
                  <span className="material-symbols-rounded">chevron_left</span>
                </button>
                <button
                  className="mui-btn mui-btn-outlined mui-btn-sm"
                  onClick={() => {
                    const now = new Date();
                    setCalMonthDate(now);
                    setCalSelectedDateStr(now.toISOString().slice(0, 10));
                  }}
                >
                  Today
                </button>
                <button
                  className="mui-btn-icon"
                  title="Next Month"
                  onClick={() => setCalMonthDate(new Date(calYear, calMonth + 1, 1))}
                >
                  <span className="material-symbols-rounded">chevron_right</span>
                </button>
              </div>
            </div>

            <div className="cal-weekdays-grid">
              <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>

            <div className="cal-days-grid">
              {/* Previous month trailing days */}
              {Array.from({ length: firstDayIndex }).map((_, idx) => {
                const dayNum = prevMonthDays - (firstDayIndex - 1 - idx);
                return (
                  <div key={`prev-${idx}`} className="cal-day cal-day-inactive">
                    <span className="day-number">{dayNum}</span>
                  </div>
                );
              })}

              {/* Current month days */}
              {Array.from({ length: totalDays }).map((_, idx) => {
                const day = idx + 1;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvents = events.filter(e => e.event_date === dateStr);
                const isToday = isCurrentMonth && nowDate.getDate() === day;
                const isSelected = calSelectedDateStr === dateStr;

                return (
                  <div
                    key={dateStr}
                    className={`cal-day ${isToday ? 'cal-today' : ''} ${isSelected ? 'cal-selected' : ''} ${dayEvents.length > 0 ? 'has-events' : ''}`}
                    onClick={() => setCalSelectedDateStr(dateStr)}
                  >
                    <div className="day-header">
                      <span className="day-number">{day}</span>
                      {dayEvents.length > 0 && (
                        <span className="event-pill-count">{dayEvents.length}</span>
                      )}
                    </div>
                    <div className="day-events-list">
                      {dayEvents.slice(0, 2).map(e => (
                        <div
                          key={e.id}
                          className={`cal-event-chip chip-${(e.category || 'Work').toLowerCase()}`}
                          title={e.title}
                        >
                          <span className="chip-time">{e.start_time.slice(0, 5)}</span>
                          <span className="chip-title">{e.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="cal-more-chip">+{dayEvents.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Next month leading days */}
              {Array.from({ length: nextTrailingDays }).map((_, idx) => (
                <div key={`next-${idx}`} className="cal-day cal-day-inactive">
                  <span className="day-number">{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Selected Date Agenda & Reminders */}
        <div className="mui-card">
          <div className="mui-card-header">
            <h3 className="mui-card-title">
              <span className="material-symbols-rounded">event</span>
              <span id="cal-selected-date-title">Agenda: {calSelectedDateStr}</span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="mui-btn mui-btn-outlined mui-btn-sm"
                title="Export all events as Google Calendar / Apple iCal (.ics)"
                onClick={handleExportCalendarICS}
              >
                <span className="material-symbols-rounded icon-sm">download</span>
                <span>Export .ics</span>
              </button>
              <button
                className="mui-btn mui-btn-outlined mui-btn-sm"
                title="Import .ics file from Google Calendar or Outlook"
                onClick={() => icsFileInputRef.current?.click()}
              >
                <span className="material-symbols-rounded icon-sm">upload_file</span>
                <span>Import .ics</span>
              </button>
              <button
                className="mui-btn mui-btn-primary mui-btn-sm"
                id="btn-cal-add-event"
                onClick={() => setShowEventModal(true)}
              >
                <span className="material-symbols-rounded icon-sm">add</span>
                <span>Event</span>
              </button>
            </div>
          </div>
          <div id="cal-selected-events-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedDayEvents.length === 0 ? (
              <p className="user-status">No events on this date.</p>
            ) : (
              selectedDayEvents.map(e => (
                <div
                  key={e.id}
                  style={{
                    padding: '10px',
                    background: 'var(--mui-surface)',
                    border: '1px solid var(--mui-border)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong>{e.title}</strong>
                    <div className="user-status">
                      {e.start_time.slice(0, 5)} • {e.category}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <a
                      href={getGoogleCalendarUrl(e)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mui-btn-icon"
                      title="Open & Sync with Google Calendar"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <span className="material-symbols-rounded icon-sm" style={{ color: '#06b6d4' }}>calendar_add_on</span>
                    </a>
                    <button
                      className="mui-btn-icon"
                      onClick={() => handleSendEmailReminder(e)}
                      title="Send Real-time Email Reminder (Resend API)"
                    >
                      <span className="material-symbols-rounded icon-sm" style={{ color: '#38bdf8' }}>forward_to_inbox</span>
                    </button>
                    <button className="mui-btn-icon" onClick={() => handleDeleteEvent(e.id)} title="Delete Event">
                      <span className="material-symbols-rounded icon-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
