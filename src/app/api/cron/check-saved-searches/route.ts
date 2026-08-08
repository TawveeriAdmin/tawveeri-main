import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { createNotification, sendSavedSearchResultsEmail } from '@/lib/auth/notifications';
import { createAuditLog } from '@/lib/auth/audit';
import { searchAllStores } from '@/lib/scraping/search/search-orchestrator';

import { DEFAULT_SEARCH_STORES } from '@/lib/scraping/search/store-registry';

/**
 * POST /api/cron/check-saved-searches
 * Checks saved searches for new results and notifies users
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Fetch saved searches with notifications enabled
    const { data: savedSearches, error: searchesError } = await supabase
      .from('saved_searches')
      .select('*, users:user_id (email, preferred_language)')
      .eq('notify_on_new_results', true);

    if (searchesError) throw searchesError;
    if (!savedSearches?.length) {
      return NextResponse.json({ success: true, notifications_sent: 0 });
    }

    let notificationsSent = 0;

    for (const search of savedSearches) {
      try {
        if (!search.search_query) continue;

        const filters = (search.filters || {}) as Record<string, any>;
        const category = filters.category || undefined;

        // Run lightweight search (1 page only)
        const result = await searchAllStores(
          search.search_query,
          [...DEFAULT_SEARCH_STORES],
          1,
          'relevance',
          category,
        );
        const newCount = result.count;
        const previousCount = search.last_result_count || 0;

        // Update tracking fields
        await supabase
          .from('saved_searches')
          .update({
            last_result_count: newCount,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', search.id);

        // Notify only if there are genuinely new results
        if (newCount > previousCount && previousCount > 0) {
          const newResultsDelta = newCount - previousCount;
          const user = (search as any).users;
          const locale = (user?.preferred_language || 'ar') as 'ar' | 'en';
          const searchLink = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/search?q=${encodeURIComponent(search.search_query)}`;

          // In-app notification
          await createNotification({
            user_id: search.user_id,
            type: 'system',
            title_ar: `نتائج جديدة: ${search.name}`,
            title_en: `New Results: ${search.name}`,
            message_ar: `تم العثور على ${newResultsDelta} نتيجة جديدة لبحثك "${search.name}"`,
            message_en: `Found ${newResultsDelta} new results for your search "${search.name}"`,
          });

          // Email notification
          if (user?.email) {
            sendSavedSearchResultsEmail(
              user.email,
              { search_name: search.name, new_count: newResultsDelta, search_link: searchLink },
              locale,
            ).catch((err) => console.error('Failed to send saved search email:', err));
          }

          // Audit log
          createAuditLog({
            user_id: search.user_id,
            action: 'saved_search_results',
            entity_type: 'saved_search',
            entity_id: search.id,
            details: { search_name: search.name, previous_count: previousCount, new_count: newCount },
          }).catch(() => {});

          notificationsSent++;
        }
      } catch (err) {
        console.error(`Error checking saved search ${search.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, notifications_sent: notificationsSent, checked: savedSearches.length });
  } catch (error) {
    console.error('Error in saved searches checker:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Saved searches checker endpoint' });
}
