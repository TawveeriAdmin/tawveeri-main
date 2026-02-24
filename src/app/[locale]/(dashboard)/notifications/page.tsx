'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import {
 Bell,
 PackageSearch,
 Trash2,
 Check,
 X,
 ExternalLink,
} from 'lucide-react';
import type { Database, NotificationType } from '@/lib/database/types';
import { GuestPrompt } from '@/components/auth/guest-prompt';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];
type ProductSummary = Pick<
 Database['public']['Tables']['products']['Row'],
 'id' | 'name_ar' | 'name_en' | 'slug' | 'image_urls'
>;

interface NotificationRecord extends NotificationRow {
 products: ProductSummary | null;
}

type FilterKey =
 | 'all'
 | 'unread'
 | 'price_drop'
 | 'back_in_stock'
 | 'deal_alert'
 | 'system'
 | 'account';

const PAGE_SIZE = 20;

const filterOrder: FilterKey[] = [
 'all',
 'unread',
 'price_drop',
 'back_in_stock',
 'deal_alert',
 'system',
 'account',
];

export default function NotificationsPage() {
 const supabase = useMemo(
 () => (typeof window !== 'undefined' ? getSupabaseBrowserClient() : null),
 []
 );
 const { user, loading: authLoading } = useAuth();
 const params = useParams();
 const router = useRouter();
 const locale = (params?.locale as string) || 'ar';
 const t = useTranslations();
 const tn = (key: string) => t(`notifications.notifications.${key}`);
 const { toast } = useToast();

 const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [filter, setFilter] = useState<FilterKey>('all');
 const [page, setPage] = useState(0);
 const [hasMore, setHasMore] = useState(true);
 const [markingAll, setMarkingAll] = useState(false);

 useEffect(() => {
 if (authLoading || !supabase) return;
 if (!user) {
 router.push(`/${locale}/auth/login?redirect=/notifications`);
 return;
 }

 const loadNotifications = async () => {
 setLoading(true);
 setError(null);

 const from = page * PAGE_SIZE;
 const to = from + PAGE_SIZE - 1;

 const { data, error: queryError } = await supabase
 .from('notifications')
 .select(
 `
 *,
 products (
 id,
 name_ar,
 name_en,
 slug,
 image_urls
 )
 `
 )
 .eq('user_id', user.id)
 .order('created_at', { ascending: false })
 .range(from, to)
 .returns<NotificationRecord[]>();

 if (queryError) {
 console.error('Failed to load notifications', queryError);
 setError(tn('loadError'));
 setLoading(false);
 return;
 }

 if (page === 0) {
 setNotifications(data || []);
 } else {
 setNotifications((prev) => [...prev, ...(data || [])]);
 }

 setHasMore((data || []).length === PAGE_SIZE);
 setLoading(false);
 };

 loadNotifications();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [authLoading, user, page]);

 const filteredNotifications = useMemo(() => {
 if (filter === 'all') return notifications;
 if (filter === 'unread') return notifications.filter((n) => !n.is_read);
 return notifications.filter((n) => n.type === filter);
 }, [notifications, filter]);

 const formatRelativeTime = (dateString: string | null) => {
 if (!dateString) return '';
 const date = new Date(dateString);
 const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
 if (diffSeconds < 60) {
 return tn('timeNow');
 }
 const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { numeric: 'auto' });
 const minutes = Math.floor(diffSeconds / 60);
 if (minutes < 60) {
 return rtf.format(-minutes, 'minute');
 }
 const hours = Math.floor(minutes / 60);
 if (hours < 24) {
 return rtf.format(-hours, 'hour');
 }
 const days = Math.floor(hours / 24);
 return rtf.format(-days, 'day');
 };

 const getNotificationTitle = (notification: NotificationRecord) => {
 return locale === 'ar' ? notification.title_ar : notification.title_en;
 };

 const getNotificationMessage = (notification: NotificationRecord) => {
 const message = locale === 'ar' ? notification.message_ar : notification.message_en;
 if (message) return message;
 if (notification.type === 'price_drop' && notification.products) {
 return locale === 'ar'
 ? `انخفض سعر ${notification.products.name_ar}`
 : `The price of ${notification.products.name_en} dropped`;
 }
 if (notification.type === 'back_in_stock' && notification.products) {
 return locale === 'ar'
 ? `${notification.products.name_ar} أصبح متوفراً مرة أخرى`
 : `${notification.products.name_en} is back in stock`;
 }
 return '';
 };

 const updateNotificationInState = (id: string, changes: Partial<NotificationRecord>) => {
 setNotifications((prev) => prev.map((notification) => (notification.id === id ? { ...notification, ...changes } : notification)));
 };

 const handleMarkAsRead = async (notification: NotificationRecord, isRead: boolean) => {
 if (!supabase) return;
 const optimistic = { ...notification, is_read: isRead };
 updateNotificationInState(notification.id, optimistic);

 const { error: updateError } = await supabase
 .from('notifications')
 .update({ is_read: isRead })
 .eq('id', notification.id);

 if (updateError) {
 console.error('Failed to update notification state', updateError);
 updateNotificationInState(notification.id, { is_read: notification.is_read });
 toast({
 title: tn('markReadError'),
 variant: 'destructive',
 });
 }
 };

 const handleDelete = async (notificationId: string) => {
 if (!supabase) return;
 const backup = notifications;
 setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

 const { error: deleteError } = await supabase
 .from('notifications')
 .delete()
 .eq('id', notificationId);

 if (deleteError) {
 console.error('Failed to delete notification', deleteError);
 setNotifications(backup);
 toast({
 title: tn('deleteError'),
 variant: 'destructive',
 });
 } else {
 toast({
 title: tn('deleted'),
 variant: 'default',
 });
 }
 };

 const handleMarkAll = async () => {
 if (!user || !supabase) return;
 setMarkingAll(true);

 const previous = notifications;
 setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

 const { error: updateError } = await supabase
 .from('notifications')
 .update({ is_read: true })
 .eq('user_id', user.id)
 .eq('is_read', false);

 setMarkingAll(false);

 if (updateError) {
 console.error('Failed to mark all notifications', updateError);
 setNotifications(previous);
 toast({
 title: tn('markAllError'),
 variant: 'destructive',
 });
 }
 };

 const handleLoadMore = () => {
 if (hasMore) {
 setPage((prev) => prev + 1);
 }
 };

 const renderFilterButton = (key: FilterKey) => (
 <Button
 key={key}
 variant={filter === key ? 'default' : 'outline'}
 onClick={() => setFilter(key)}
 className="whitespace-nowrap"
 >
 {tn(`filters.${key}`)}
 {key === 'unread' && (
 <Badge variant="secondary" className="ml-2">
 {notifications.filter((n) => !n.is_read).length}
 </Badge>
 )}
 </Button>
 );

 if (authLoading || !supabase || loading) {
 return (
 <div className="space-y-6">
 <Skeleton className="h-8 w-48" />
 <div className="space-y-4">
 {Array.from({ length: 4 }).map((_, index) => (
 <Skeleton key={index} className="h-28 w-full rounded-xl" />
 ))}
 </div>
 </div>
 );
 }

 if (!user) {
 return (
 <GuestPrompt
 locale={locale}
 title={tn('guestTitle') || 'Sign in to view your alerts'}
 description={tn('guestDescription') || 'Track price drops, restocks, and deal alerts by creating a free account.'}
 ctaLabel={t('auth.signIn') || 'Sign in'}
 />
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
 {tn('title')}
 </h1>
 <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
 {tn('subtitle')}
 </p>
 </div>
 <Button onClick={handleMarkAll} disabled={markingAll || notifications.length === 0}>
 {markingAll ? tn('marking') : tn('markAllRead')}
 </Button>
 </div>

 <div className="flex flex-wrap gap-2">
 {filterOrder.map(renderFilterButton)}
 </div>

 {error && (
 <Alert variant="destructive" className="mb-6">
 <AlertDescription>{error}</AlertDescription>
 </Alert>
 )}

 {filteredNotifications.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-outline-variant rounded-xl bg-surface">
 <Bell className="w-12 h-12 text-primary mb-4" />
 <h2 className="text-title-lg text-on-surface mb-2">
 {tn('empty')}
 </h2>
 <p className="text-on-surface-variant max-w-md">
 {tn('emptyDescription')}
 </p>
 </div>
 ) : (
 <ScrollArea className="max-h-[70vh] pr-3">
 <div className="space-y-4">
 {filteredNotifications.map((notification) => {
 const title = getNotificationTitle(notification);
 const message = getNotificationMessage(notification);
 const relativeTime = formatRelativeTime(notification.created_at);

 const productLink = notification.products
 ? `/${locale}/products/${notification.products.slug}`
 : null;

 const primaryLink = notification.link || productLink;

 return (
 <Card key={notification.id} className={notification.is_read ? '' : 'border-primary-200'}>
 <CardContent className="p-5">
 <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
 <div className="flex gap-4">
 {notification.products?.image_urls?.[0] ? (
 <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-surface-container-highest border border-outline-variant">
 <Image
 src={notification.products.image_urls[0]}
 alt={locale === 'ar' ? notification.products.name_ar : notification.products.name_en}
 fill
 sizes="64px"
 className="object-cover"
 />
 </div>
 ) : (
 <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-container-highest border border-dashed border-outline-variant">
 <PackageSearch className="h-7 w-7 text-outline" />
 </div>
 )}

 <div className="space-y-2">
 <div className="flex flex-wrap items-center gap-2">
 <Badge variant={notification.is_read ? 'secondary' : 'success'}>
 {tn(`filters.${notification.type as NotificationType}`)}
 </Badge>
 {!notification.is_read && (
 <span className="text-xs font-semibold uppercase tracking-wide text-primary">
 {tn('filters.unread')}
 </span>
 )}
 </div>
 <div className="space-y-1">
 <h3 className="text-title-lg text-on-surface">
 {title}
 </h3>
 {message && (
 <p className="text-sm text-on-surface-variant">
 {message}
 </p>
 )}
 </div>
 <p className="text-body-sm text-on-surface-variant">
 {relativeTime}
 </p>
 </div>
 </div>

 <div className="flex flex-col gap-2 md:items-end md:text-right">
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => handleMarkAsRead(notification, !notification.is_read)}
 >
 {notification.is_read ? (
 <>
 <X className="w-4 h-4 mr-2" />
 {tn('actions.markUnread')}
 </>
 ) : (
 <>
 <Check className="w-4 h-4 mr-2" />
 {tn('actions.markRead')}
 </>
 )}
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={() => handleDelete(notification.id)}
 >
 <Trash2 className="w-4 h-4 mr-2" />
 {tn('actions.delete')}
 </Button>
 </div>
 {primaryLink && (
 <Button asChild size="sm" className="mt-2">
 <Link href={primaryLink}>
 <ExternalLink className="w-4 h-4 mr-2" />
 {notification.products
 ? tn('viewProduct')
 : tn('viewStore')}
 </Link>
 </Button>
 )}
 </div>
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 </ScrollArea>
 )}

 {hasMore && filteredNotifications.length > 0 && (
 <div className="flex justify-center mt-6">
 <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
 {loading ? tn('loading') : tn('loadMore')}
 </Button>
 </div>
 )}

 {!hasMore && page > 0 && (
 <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
 {tn('noMore')}
 </p>
 )}
 </div>
 );
}
