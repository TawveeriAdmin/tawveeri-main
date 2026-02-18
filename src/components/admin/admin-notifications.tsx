'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, AlertCircle, TrendingDown, Package, Tag, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Notification {
  id: string;
  type: string;
  title_ar: string;
  title_en: string;
  message_ar: string | null;
  message_en: string | null;
  is_read: boolean;
  created_at: string;
  link: string | null;
}

interface AdminNotificationsProps {
  locale: string;
}

const typeIcons: Record<string, typeof Bell> = {
  price_drop: TrendingDown,
  back_in_stock: Package,
  deal: Tag,
  system: AlertCircle,
  account: UserCircle,
};

function timeAgo(dateStr: string, locale: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return locale === 'ar' ? 'الآن' : 'Just now';
  if (minutes < 60) return locale === 'ar' ? `${minutes} د` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === 'ar' ? `${hours} س` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return locale === 'ar' ? `${days} ي` : `${days}d`;
}

export function AdminNotifications({ locale }: AdminNotificationsProps) {
  const t = useTranslations();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title_ar, title_en, message_ar, message_en, is_read, created_at, link')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Initial unread count fetch
  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(({ count }) => {
        setUnreadCount(count || 0);
      });
  }, [user?.id]);

  const markAsRead = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    const was = notifications.find((n) => n.id === id);
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (was && !was.is_read) setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const isRTL = locale === 'ar';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container dark:bg-surface-container-high transition-all duration-200 hover:bg-surface-container-high dark:hover:bg-surface-container-highest"
          aria-label={t('notifications.notifications.title')}
        >
          <Bell className="h-4 w-4 text-primary" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isRTL ? 'start' : 'end'}
        className="w-[380px] p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
          <h3 className="text-sm font-semibold text-on-surface">
            {t('notifications.notifications.title')}
            {unreadCount > 0 && (
              <span className="ms-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t('notifications.notifications.markAllRead')}
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-on-surface-variant">
              {t('notifications.notifications.loading')}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bell className="mb-2 h-8 w-8 text-on-surface-variant/40" />
              <p className="text-sm font-medium text-on-surface-variant">
                {t('notifications.notifications.empty')}
              </p>
              <p className="mt-1 px-6 text-xs text-on-surface-variant/70">
                {t('notifications.notifications.emptyDescription')}
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const Icon = typeIcons[notif.type] || Bell;
              const title = locale === 'ar' ? notif.title_ar : notif.title_en;
              const message = locale === 'ar' ? notif.message_ar : notif.message_en;

              return (
                <div
                  key={notif.id}
                  className={cn(
                    'group relative flex gap-3 border-b border-outline-variant/50 px-4 py-3 transition-colors hover:bg-surface-container-low',
                    !notif.is_read && 'bg-primary/5'
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    !notif.is_read
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        'text-sm leading-snug text-on-surface',
                        !notif.is_read && 'font-medium'
                      )}>
                        {title}
                      </p>
                      <span className="shrink-0 text-[10px] text-on-surface-variant">
                        {timeAgo(notif.created_at, locale)}
                      </span>
                    </div>
                    {message && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-on-surface-variant">
                        {message}
                      </p>
                    )}
                  </div>

                  {/* Actions (show on hover) */}
                  <div className="absolute end-2 top-2 hidden items-center gap-0.5 group-hover:flex">
                    {!notif.is_read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                        className="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-primary"
                        title={t('notifications.notifications.actions.markRead')}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                      className="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
                      title={t('notifications.notifications.actions.delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
