import React from 'react';

export interface ToastItem {
  id: number | string;
  message: string;
  type: 'success' | 'info' | 'error';
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss?: (id: number | string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="toast-container-fixed"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '360px',
      }}
    >
      {toasts.map((t) => {
        const bg =
          t.type === 'error'
            ? '#ef4444'
            : t.type === 'info'
            ? '#0891b2'
            : '#10b981';
        const icon =
          t.type === 'error'
            ? 'error'
            : t.type === 'info'
            ? 'info'
            : 'check_circle';
        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--mui-surface)',
              border: `1px solid ${bg}`,
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              color: 'var(--mui-text-primary)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <span className="material-symbols-rounded" style={{ color: bg, fontSize: '18px' }}>
              {icon}
            </span>
            <span style={{ flex: 1 }}>{t.message}</span>
            {onDismiss && (
              <button
                onClick={() => onDismiss(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--mui-text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>close</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
