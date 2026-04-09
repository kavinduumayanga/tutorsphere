import React, { useMemo } from 'react';
import {
  Bell,
  BookOpen,
  CalendarClock,
  Check,
  CreditCard,
  GraduationCap,
  Link as LinkIcon,
  RefreshCcw,
  Settings,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AppNotification } from '../../types';

type NotificationFilter = 'all' | 'unread' | 'read';

export interface NotificationsPageProps {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  filter: NotificationFilter;
  onFilterChange: (next: NotificationFilter) => void;
  onRefresh: () => void;
  onNotificationClick: (notification: AppNotification) => void;
  onMarkAsRead: (notification: AppNotification) => void;
  onMarkAllAsRead: () => void;
}

const formatRelativeTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = minute * 60;
  const day = hour * 24;

  if (diffMs < minute) {
    return 'Just now';
  }

  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}m ago`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h ago`;
  }

  if (diffMs < day * 7) {
    return `${Math.floor(diffMs / day)}d ago`;
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

const NotificationSkeleton: React.FC = () => (
  <div className="space-y-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="animate-pulse rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="h-4 w-1/3 rounded bg-slate-200 mb-2" />
        <div className="h-3.5 w-3/4 rounded bg-slate-200 mb-2" />
        <div className="h-3 w-1/4 rounded bg-slate-200" />
      </div>
    ))}
  </div>
);

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  notifications,
  unreadCount,
  isLoading,
  error,
  filter,
  onFilterChange,
  onRefresh,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((notification) => !notification.isRead);
    }

    if (filter === 'read') {
      return notifications.filter((notification) => notification.isRead);
    }

    return notifications;
  }, [notifications, filter]);

  return (
    <div className="max-w-5xl mx-auto py-6 md:py-10 px-4 md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white p-5 md:p-8 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">Notifications</h1>
              <p className="text-sm md:text-base text-slate-500 font-medium">Stay updated on sessions, payments, courses, and platform changes.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={onMarkAllAsRead}
              disabled={unreadCount === 0 || isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-4 h-4" />
              Mark all read
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(['all', 'unread', 'read'] as NotificationFilter[]).map((value) => {
            const isActive = filter === value;
            const label = value === 'all' ? 'All' : value === 'unread' ? 'Unread' : 'Read';
            return (
              <button
                key={value}
                type="button"
                onClick={() => onFilterChange(value)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${isActive
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-5 md:mt-6"
      >
        {isLoading ? (
          <NotificationSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-center">
            <p className="text-sm font-bold text-rose-700">{error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Try again
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <p className="text-base font-bold text-slate-700">No notifications in this view</p>
            <p className="text-sm text-slate-500 mt-1">New session and course updates will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const { Icon, iconClassName, iconBgClassName } = getNotificationVisual(notification.type);
              return (
                <motion.button
                  key={notification.id}
                  layout
                  type="button"
                  onClick={() => onNotificationClick(notification)}
                  className={`w-full text-left rounded-2xl border p-4 md:p-5 transition-all ${notification.isRead
                    ? 'bg-white border-slate-200 hover:bg-slate-50'
                    : 'bg-indigo-50/40 border-indigo-100 hover:bg-indigo-50'
                    }`}
                >
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBgClassName}`}>
                      <Icon className={`w-4 h-4 ${iconClassName}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm md:text-base font-black text-slate-900 leading-tight">{notification.title}</p>
                          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{notification.message}</p>
                        </div>
                        {!notification.isRead && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-400">{formatRelativeTime(notification.createdAt)}</p>

                        {!notification.isRead && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onMarkAsRead(notification);
                            }}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};
