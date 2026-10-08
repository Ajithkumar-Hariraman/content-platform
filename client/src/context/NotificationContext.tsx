import { createContext, useContext, useState, type ReactNode } from 'react';
export type NotificationVariant = 'success' | 'error' | 'info';
interface Notification {
  id: string;
  variant: NotificationVariant;
  message: string;
}
interface Notifications {
  notify: (variant: NotificationVariant, message: string) => void;
}
const NotificationContext = createContext<Notifications | null>(null);
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  function notify(variant: NotificationVariant, message: string) {
    setNotifications((previous) => [
      ...previous.slice(-4),
      { id: crypto.randomUUID(), variant, message },
    ]);
  }
  return (
    <NotificationContext.Provider value={{ notify }}>
      <aside aria-label="Notifications">
        {notifications.map((item) => (
          <div
            key={item.id}
            role={item.variant === 'error' ? 'alert' : 'status'}
            className={
              item.variant === 'error'
                ? 'failure'
                : item.variant === 'success'
                  ? 'success'
                  : ''
            }
          >
            {item.message}{' '}
            <button
              type="button"
              className="secondary"
              aria-label="Dismiss notification"
              onClick={() =>
                setNotifications((previous) =>
                  previous.filter((n) => n.id !== item.id),
                )
              }
            >
              Dismiss
            </button>
          </div>
        ))}
      </aside>
      {children}
    </NotificationContext.Provider>
  );
}
export function useNotifications(): Notifications {
  const context = useContext(NotificationContext);
  if (!context)
    throw new Error('useNotifications requires NotificationProvider');
  return context;
}
