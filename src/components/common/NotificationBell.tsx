import React, { useEffect, useRef } from 'react';
import {
  Bell,
  BookOpen,
  CalendarClock,
  Check,
  CheckCheck,
  Clock3,
  CreditCard,
  GraduationCap,
  Link as LinkIcon,
  RefreshCcw,
  Settings,
  XCircle,
} from 'lucide-react';
import { AppNotification } from '../../types';

type NotificationBellProps = {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  onToggle: () => void;
  onClose: () => void;
  onRefresh: () => void;
  onNotificationClick: (notification: AppNotification) => void;
  onMarkAsRead: (notification: AppNotification) => void;
  onMarkAllAsRead: () => void;
  onViewAll: () => void;
};

const formatRelativeTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 0) {
    return 'Just now';
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return 'Just now';
  }

  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute);
    return `${minutes}m ago`;
  }

  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `${hours}h ago`;
  }

  if (diffMs < day * 7) {
    const days = Math.floor(diffMs / day);
    return `${days}d ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
};

const getNotificationVisual = (type: string) => {
  const normalized = String(type || '').trim().toLowerCase();

  if (normalized.includes('meeting_link')) {
    return { Icon: LinkIcon, iconClassName: 'text-violet-600', iconBgClassName: 'bg-violet-100' };
  }

  if (normalized.includes('cancel')) {
    return { Icon: XCircle, iconClassName: 'text-rose-600', iconBgClassName: 'bg-rose-100' };
  }

  if (normalized.includes('course')) {
    return { Icon: BookOpen, iconClassName: 'text-emerald-600', iconBgClassName: 'bg-emerald-100' };
  }

  if (normalized.includes('payment')) {
    return { Icon: CreditCard, iconClassName: 'text-amber-600', iconBgClassName: 'bg-amber-100' };
  }

  if (normalized.includes('profile')) {
    return { Icon: Settings, iconClassName: 'text-cyan-600', iconBgClassName: 'bg-cyan-100' };
  }

  if (normalized.includes('complete')) {
    return { Icon: GraduationCap, iconClassName: 'text-emerald-600', iconBgClassName: 'bg-emerald-100' };
  }

  return { Icon: CalendarClock, iconClassName: 'text-indigo-600', iconBgClassName: 'bg-indigo-100' };
};

const LoadingState: React.FC = () => {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="h-3.5 w-3/4 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-1/2 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  );
};

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  unreadCount,
  isOpen,
  isLoading,
  error,
  onToggle,
  onClose,
  onRefresh,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewAll,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previewNotifications = notifications.slice(0, 7);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }

      if (!rootRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="relative h-9 w-9 text-slate-600 hover:text-indigo-600 transition-colors flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-[min(92vw,25rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 z-[90]">
          <div className="px-4 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black tracking-wide text-slate-900">Notifications</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onRefresh}
                  className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors flex items-center justify-center"
                  title="Refresh notifications"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  disabled={unreadCount === 0 || isLoading}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Read all
                </button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <div className="p-5 text-center">
              <p className="text-sm font-semibold text-rose-600 mb-3">{error}</p>
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          ) : previewNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-3 h-11 w-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <Clock3 className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No notifications yet</p>
              <p className="text-xs text-slate-500 mt-1">Important updates will appear here.</p>
            </div>
          ) : (
            <div className="max-h-[26rem] overflow-y-auto custom-scrollbar p-3 space-y-2">
              {previewNotifications.map((notification) => {
                const { Icon, iconClassName, iconBgClassName } = getNotificationVisual(notification.type);
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => onNotificationClick(notification)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${notification.isRead
                      ? 'border-slate-100 bg-white hover:bg-slate-50'
                      : 'border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50'
                      }`}
                  >
                    <div className="flex gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconBgClassName}`}>
                        <Icon className={`w-4 h-4 ${iconClassName}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[13px] font-bold text-slate-900 leading-tight line-clamp-1">{notification.title}</p>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">{notification.message}</p>
                          </div>

                          {!notification.isRead && (
                            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold text-slate-400">{formatRelativeTime(notification.createdAt)}</span>

                          {!notification.isRead && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onMarkAsRead(notification);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="px-4 py-3 border-t border-slate-100 bg-white">
            <button
              type="button"
              onClick={onViewAll}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
