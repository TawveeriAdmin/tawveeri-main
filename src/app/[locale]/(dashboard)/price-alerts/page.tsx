'use client';

import { useCallback, useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PriceAlertCard } from '@/components/products/price-alert-card';
import { PriceAlertDialog } from '@/components/products/price-alert-dialog';
import { GuestPrompt } from '@/components/auth/guest-prompt';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, BellOff, CheckCircle2, Clock3, Plus, Target, TrendingDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { createNotification } from '@/lib/auth/notifications';
import type { Database } from '@/lib/database/types';
import Link from 'next/link';


type PriceAlertRow = Database['public']['Tables']['price_alerts']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];

interface PriceAlertWithProduct extends PriceAlertRow {
 products?: ProductRow & {
 product_stores?: Array<{
 current_price: number;
 }>;
 };
}

export default function PriceAlertsPage() {
 const params = useParams();
 const locale = (params?.locale as string) || 'ar';
 const t = useTranslations();
 const { user, loading: authLoading } = useAuth();
 const { toast } = useToast();
 const isRTL = locale === 'ar';
 const supabase = useMemo(
 () => (typeof window !== 'undefined' ? getSupabaseBrowserClient() : null),
 []
 );

 const [alerts, setAlerts] = useState<PriceAlertWithProduct[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
 const [alertDialogOpen, setAlertDialogOpen] = useState(false);
 const [editingAlert, setEditingAlert] = useState<PriceAlertRow | null>(null);

 const loadAlerts = useCallback(async () => {
 if (!user || !supabase) return;

 try {
 setLoading(true);
 const { data, error } = await supabase
 .from('price_alerts')
 .select(
 `
 *,
 products (
 id,
 name_ar,
 name_en,
 image_urls,
 product_stores (
 current_price
 )
 )
 `
 )
 .eq('user_id', user.id)
 .order('created_at', { ascending: false });

 if (error) throw error;

 setAlerts((data as unknown as PriceAlertWithProduct[]) || []);
 } catch (error) {
 console.error('Error loading price alerts:', error);
 toast({
 title: t('common.error'),
 description: t('priceAlerts.loadError'),
 variant: 'destructive',
 });
 } finally {
 setLoading(false);
 }
 }, [supabase, t, toast, user]);

 useEffect(() => {
 if (user) {
 loadAlerts();
 } else {
 setLoading(false);
 }
 }, [user, loadAlerts]);

 const handleDelete = async (alertId: string) => {
 if (!user || !supabase) return;

 if (!confirm(t('priceAlerts.deleteConfirm'))) {
 return;
 }

 try {
 const { error } = await supabase
 .from('price_alerts')
 .delete()
 .eq('id', alertId)
 .eq('user_id', user.id);

 if (error) throw error;

 // In-app notification
 if (user) {
 createNotification({
 user_id: user.id,
 type: 'system',
 title_ar: 'تم حذف تنبيه السعر',
 title_en: 'Price Alert Deleted',
 message_ar: 'تم حذف تنبيه السعر بنجاح',
 message_en: 'Price alert has been deleted successfully',
 }).catch(() => {});
 }

 // Audit log (fire-and-forget)
 fetch('/api/audit', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 action: 'price_alert_deleted',
 entity_type: 'price_alert',
 entity_id: alertId,
 }),
 }).catch(() => {});

 toast({
 title: t('priceAlerts.deleted'),
 description: t('priceAlerts.deleteSuccess'),
 });

 loadAlerts();
 } catch (error) {
 console.error('Error deleting alert:', error);
 toast({
 title: t('common.error'),
 description: t('priceAlerts.deleteError'),
 variant: 'destructive',
 });
 }
 };

 const handleToggle = async (alertId: string, isActive: boolean) => {
 if (!user || !supabase) return;

 try {
 const { error } = await supabase
 .from('price_alerts')
 .update({ is_active: isActive })
 .eq('id', alertId)
 .eq('user_id', user.id);

 if (error) throw error;

 // In-app notification
 if (user) {
 createNotification({
 user_id: user.id,
 type: 'system',
 title_ar: isActive ? 'تم تفعيل تنبيه السعر' : 'تم إيقاف تنبيه السعر',
 title_en: isActive ? 'Price Alert Activated' : 'Price Alert Deactivated',
 message_ar: isActive ? 'تم تفعيل تنبيه السعر بنجاح' : 'تم إيقاف تنبيه السعر',
 message_en: isActive ? 'Price alert has been activated' : 'Price alert has been deactivated',
 }).catch(() => {});
 }

 // Audit log (fire-and-forget)
 fetch('/api/audit', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 action: 'price_alert_toggled',
 entity_type: 'price_alert',
 entity_id: alertId,
 details: { is_active: isActive },
 }),
 }).catch(() => {});

 toast({
 title: t('priceAlerts.updated'),
 description: isActive ? t('priceAlerts.activateSuccess') : t('priceAlerts.deactivateSuccess'),
 });

 loadAlerts();
 } catch (error) {
 console.error('Error toggling alert:', error);
 toast({
 title: t('common.error'),
 description: t('priceAlerts.updateError'),
 variant: 'destructive',
 });
 }
 };

 const handleEdit = (alert: PriceAlertRow) => {
 setEditingAlert(alert);
 setAlertDialogOpen(true);
 };

 const getCurrentPrice = (alert: PriceAlertWithProduct): number => {
 const stores = alert.products?.product_stores || [];
 if (stores.length === 0) return 0;
 return Math.min(...stores.map((ps) => ps.current_price));
 };

 const activeAlerts = alerts.filter((alert) => alert.is_active);
 const inactiveAlerts = alerts.filter((alert) => !alert.is_active);
 const visibleAlerts = activeTab === 'active' ? activeAlerts : inactiveAlerts;
 const reachedAlertsCount = activeAlerts.filter((alert) => {
 const currentPrice = getCurrentPrice(alert);
 return currentPrice > 0 && currentPrice <= alert.target_price;
 }).length;
 const lowestGapAlert = activeAlerts
 .map((alert) => {
 const currentPrice = getCurrentPrice(alert);
 return {
 alert,
 currentPrice,
 gap: currentPrice > 0 ? currentPrice - alert.target_price : Number.POSITIVE_INFINITY,
 };
 })
 .filter((item) => Number.isFinite(item.gap))
 .sort((a, b) => a.gap - b.gap)[0];
 const stats = [
 {
 label: t('priceAlerts.active'),
 value: activeAlerts.length,
 icon: Bell,
 className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
 },
 {
 label: t('priceAlerts.inactive'),
 value: inactiveAlerts.length,
 icon: BellOff,
 className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
 },
 {
 label: isRTL ? 'وصلت للهدف' : 'Target reached',
 value: reachedAlertsCount,
 icon: CheckCircle2,
 className: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
 },
 ];

 if (authLoading) {
 return (
 <div className="mx-auto w-full max-w-[1600px] space-y-6">
 <Skeleton className="h-48 rounded-[2rem]" />
 <div className="grid gap-3 md:grid-cols-3">
 {[...Array(3)].map((_, i) => (
 <Skeleton key={i} className="h-28 rounded-2xl" />
 ))}
 </div>
 <div className="grid gap-4">
 {[...Array(3)].map((_, i) => (
 <Skeleton key={i} className="h-36 rounded-2xl" />
 ))}
 </div>
 </div>
 );
 }

 if (!user) {
 return (
 <GuestPrompt
 title={t('priceAlerts.guestTitle')}
 description={t('priceAlerts.guestDescription')}
 locale={locale}
 />
 );
 }

 return (
 <div className="mx-auto w-full max-w-[1600px] space-y-6">
 <section className="overflow-hidden rounded-[2rem] border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
 <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,rgba(45,178,139,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,1),rgba(244,249,247,1))] p-5 dark:bg-[radial-gradient(circle_at_top_left,rgba(45,178,139,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,1),rgba(3,7,18,1))] md:p-7 xl:grid-cols-[minmax(0,1fr)_440px]">
 <div className="min-w-0">
 <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[var(--brand-green-dark)] shadow-sm dark:bg-gray-900/80 dark:text-emerald-300">
 <Target className="h-3.5 w-3.5" />
 {isRTL ? 'متابعة ذكية للأسعار' : 'Smart price tracking'}
 </div>
 <h1 className="max-w-3xl text-3xl font-bold tracking-normal text-gray-950 dark:text-white md:text-4xl">
 {t('priceAlerts.title')}
 </h1>
 <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
 {t('priceAlerts.description')}
 </p>
 <div className="mt-6 flex flex-wrap gap-2">
 <Button onClick={() => setAlertDialogOpen(true)} className="h-11 rounded-2xl px-5">
 <Plus className="me-2 h-4 w-4" />
 {t('priceAlerts.addAlert')}
 </Button>
 <Link
 href={`/${locale}/products`}
 className="inline-flex h-11 items-center justify-center rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-800 transition hover:border-[var(--brand-green)] hover:text-[var(--brand-green-dark)] dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
 >
 {isRTL ? 'استعراض المنتجات' : 'Browse products'}
 </Link>
 </div>
 </div>

 <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
 {stats.map(({ label, value, icon: Icon, className }) => (
 <div key={label} className="flex items-center justify-between gap-4 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
 <div>
 <p className="text-2xl font-bold tabular-nums text-gray-950 dark:text-white">{value}</p>
 <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
 </div>
 <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${className}`}>
 <Icon className="h-5 w-5" />
 </span>
 </div>
 ))}
 </div>
 </div>
 </section>

 <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
 <div className="rounded-[1.75rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950 md:p-5">
 <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'inactive')}>
 <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <TabsList className="h-12 w-full rounded-2xl bg-gray-100 p-1 dark:bg-gray-900 sm:w-auto">
 <TabsTrigger value="active" className="h-10 rounded-xl px-5">
 {t('priceAlerts.active')} ({activeAlerts.length})
 </TabsTrigger>
 <TabsTrigger value="inactive" className="h-10 rounded-xl px-5">
 {t('priceAlerts.inactive')} ({inactiveAlerts.length})
 </TabsTrigger>
 </TabsList>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 {activeTab === 'active'
 ? (isRTL ? 'التنبيهات التي تعمل حالياً وترسل إشعارات عند وصول السعر.' : 'Alerts currently watching prices and sending notifications.')
 : (isRTL ? 'التنبيهات المتوقفة مؤقتاً ويمكن تفعيلها لاحقاً.' : 'Paused alerts you can reactivate later.')}
 </p>
 </div>

 <TabsContent value="active" className="mt-0 space-y-4">
 {loading ? (
 <div className="grid gap-4">
 {[...Array(3)].map((_, i) => (
 <Skeleton key={i} className="h-36 rounded-2xl" />
 ))}
 </div>
 ) : visibleAlerts.length === 0 ? (
 <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-5 py-14 text-center dark:border-gray-800 dark:bg-gray-900/40">
 <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
 <Bell className="h-6 w-6" />
 </div>
 <p className="text-lg font-bold text-gray-950 dark:text-white">{t('priceAlerts.noAlerts')}</p>
 <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{t('priceAlerts.noAlertsDescription')}</p>
 <Button onClick={() => setAlertDialogOpen(true)} className="mt-5 rounded-2xl">
 <Plus className="me-2 h-4 w-4" />
 {t('priceAlerts.addAlert')}
 </Button>
 </div>
 ) : (
 <div className="grid gap-4">
 {visibleAlerts.map((alert) => (
 <PriceAlertCard
 key={alert.id}
 alert={alert}
 currentPrice={getCurrentPrice(alert)}
 locale={locale}
 onEdit={handleEdit}
 onDelete={handleDelete}
 onToggle={handleToggle}
 />
 ))}
 </div>
 )}
 </TabsContent>

 <TabsContent value="inactive" className="mt-0 space-y-4">
 {loading ? (
 <div className="grid gap-4">
 {[...Array(3)].map((_, i) => (
 <Skeleton key={i} className="h-36 rounded-2xl" />
 ))}
 </div>
 ) : visibleAlerts.length === 0 ? (
 <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-5 py-14 text-center dark:border-gray-800 dark:bg-gray-900/40">
 <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
 <BellOff className="h-6 w-6" />
 </div>
 <p className="text-lg font-bold text-gray-950 dark:text-white">{t('priceAlerts.noAlerts')}</p>
 <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
 {isRTL ? 'لا توجد تنبيهات متوقفة حالياً.' : 'There are no paused alerts right now.'}
 </p>
 </div>
 ) : (
 <div className="grid gap-4">
 {visibleAlerts.map((alert) => (
 <PriceAlertCard
 key={alert.id}
 alert={alert}
 currentPrice={getCurrentPrice(alert)}
 locale={locale}
 onEdit={handleEdit}
 onDelete={handleDelete}
 onToggle={handleToggle}
 />
 ))}
 </div>
 )}
 </TabsContent>
 </Tabs>
 </div>

 <aside className="space-y-4">
 <div className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
 <div className="mb-4 flex items-center gap-3">
 <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
 <TrendingDown className="h-5 w-5" />
 </span>
 <div>
 <h2 className="font-bold text-gray-950 dark:text-white">{isRTL ? 'أقرب فرصة' : 'Closest opportunity'}</h2>
 <p className="text-xs text-gray-500 dark:text-gray-400">{isRTL ? 'أقرب تنبيه للوصول للسعر المستهدف' : 'Nearest alert to its target price'}</p>
 </div>
 </div>
 {lowestGapAlert ? (
 <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/70">
 <p className="line-clamp-2 text-sm font-semibold text-gray-950 dark:text-white">
 {locale === 'ar'
 ? lowestGapAlert.alert.products?.name_ar
 : lowestGapAlert.alert.products?.name_en}
 </p>
 <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
 <div>
 <p className="text-gray-500 dark:text-gray-400">{isRTL ? 'آخر سعر رصدناه' : 'Last observed'}</p>
 <p className="mt-1 font-bold text-gray-950 dark:text-white">{lowestGapAlert.currentPrice.toFixed(2)}</p>
 </div>
 <div>
 <p className="text-gray-500 dark:text-gray-400">{isRTL ? 'الهدف' : 'Target'}</p>
 <p className="mt-1 font-bold text-[var(--brand-green-dark)]">{lowestGapAlert.alert.target_price.toFixed(2)}</p>
 </div>
 </div>
 </div>
 ) : (
 <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-900/70 dark:text-gray-400">
 {isRTL ? 'أضف تنبيهاً نشطاً لعرض أقرب فرصة.' : 'Add an active alert to see your closest opportunity.'}
 </p>
 )}
 </div>

 <div className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
 <div className="mb-4 flex items-center gap-3">
 <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
 <Clock3 className="h-5 w-5" />
 </span>
 <div>
 <h2 className="font-bold text-gray-950 dark:text-white">{isRTL ? 'طريقة العمل' : 'How it works'}</h2>
 <p className="text-xs text-gray-500 dark:text-gray-400">{isRTL ? 'تنبيهات تلقائية عند انخفاض السعر' : 'Automatic alerts when prices drop'}</p>
 </div>
 </div>
 <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
 <p className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-900/70">
 {isRTL ? 'حدد السعر المستهدف لكل منتج تريد متابعته.' : 'Set a target price for each product you want to track.'}
 </p>
 <p className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-900/70">
 {isRTL ? 'سنقارن آخر سعر رصدناه مع هدفك ونرسل تنبيهاً عند الوصول.' : 'We compare the last price we observed with your target and notify you when it is reached.'}
 </p>
 </div>
 </div>
 </aside>
 </section>

 <PriceAlertDialog
 open={alertDialogOpen}
 onOpenChange={(next) => {
 setAlertDialogOpen(next);
 if (!next) setEditingAlert(null);
 }}
 productId={editingAlert?.product_id ?? undefined}
 productName={
 editingAlert
 ? (locale === 'ar'
 ? (editingAlert as PriceAlertWithProduct).products?.name_ar
 : (editingAlert as PriceAlertWithProduct).products?.name_en) || ''
 : undefined
 }
 currentPrice={
 editingAlert
 ? (editingAlert as PriceAlertWithProduct).products?.product_stores?.[0]?.current_price ?? null
 : null
 }
 locale={locale}
 onSaved={loadAlerts}
 />
 </div>
 );
}
