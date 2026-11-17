import React from 'react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  return (
    <div id="modal-task" className="modal-backdrop">
      <div className="modal-dialog">
        <div className="mui-card-header">
          <h3 className="mui-card-title">
            <span className="material-symbols-rounded">task</span>
            <span>Create New Task</span>
          </h3>
          <button className="mui-btn-icon modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form id="form-create-task" onSubmit={onSubmit}>
          <div className="mui-input-group">
            <label>Task Title</label>
            <input
              type="text"
              name="title"
              className="mui-input"
              required
              placeholder="e.g. Review database schema"
            />
          </div>
          <div className="mui-input-group">
            <label>Priority</label>
            <select name="priority" className="mui-input" defaultValue="Medium">
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>
          <div className="mui-input-group">
            <label>Due Date (Optional)</label>
            <input type="date" name="due_date" className="mui-input" />
          </div>
          <button
            type="submit"
            className="mui-btn mui-btn-primary mui-btn-block"
            style={{ width: '100%', marginTop: '12px' }}
          >
            Add Task
          </button>
        </form>
      </div>
    </div>
  );
};
