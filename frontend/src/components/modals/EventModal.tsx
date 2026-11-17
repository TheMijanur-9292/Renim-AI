import React from 'react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  calSelectedDateStr: string;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  calSelectedDateStr
}) => {
  if (!isOpen) return null;

  return (
    <div id="modal-event" className="modal-backdrop">
      <div className="modal-dialog">
        <div className="mui-card-header">
          <h3 className="mui-card-title">
            <span className="material-symbols-rounded">event</span>
            <span>New Calendar Event & Reminder</span>
          </h3>
          <button className="mui-btn-icon modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form id="form-create-event" onSubmit={onSubmit}>
          <div className="mui-input-group">
            <label>Event Title</label>
            <input
              type="text"
              name="title"
              className="mui-input"
              required
              placeholder="e.g. Sprint Planning Call"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="mui-input-group">
              <label>Date</label>
              <input
                type="date"
                name="event_date"
                className="mui-input"
                required
                defaultValue={calSelectedDateStr}
              />
            </div>
            <div className="mui-input-group">
              <label>Time</label>
              <input
                type="time"
                name="start_time"
                className="mui-input"
                required
                defaultValue="10:00"
              />
            </div>
          </div>
          <div className="mui-input-group">
            <label>Category</label>
            <select name="category" className="mui-input" defaultValue="Work">
              <option value="Work">Work</option>
              <option value="Meeting">Meeting</option>
              <option value="Deadline">Deadline</option>
              <option value="Personal">Personal</option>
            </select>
          </div>
          <div className="mui-input-group">
            <label>Reminder Alert</label>
            <select name="reminder_minutes" className="mui-input" defaultValue="15">
              <option value="5">5 minutes before</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
            </select>
          </div>
          <button
            type="submit"
            className="mui-btn mui-btn-primary mui-btn-block"
            style={{ width: '100%', marginTop: '12px' }}
          >
            Create Event
          </button>
        </form>
      </div>
    </div>
  );
};
