'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { History, Clock1, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useAuth } from '@/lib/auth/auth-context';
import type { Database } from '@/lib/database/types';

type SearchHistoryRow = Database['public']['Tables']['search_history']['Row'];

interface SearchHistoryProps {
  limit?: number;
  onSelectQuery?: (query: string) => void;
}

export function SearchHistory({ limit = 10, onSelectQuery }: SearchHistoryProps) {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const supabase = getSupabaseBrowserClient();

  const [history, setHistory] = useState<SearchHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedHistory = useMemo(() => {
    return history.map((entry) => ({
      ...entry,
      relativeTime: entry.created_at
        ? formatRelativeTime(entry.created_at, locale)
        : '',
    }));
  }, [history, locale]);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from('search_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)
        .returns<SearchHistoryRow[]>();

      if (queryError) {
        console.error('Failed to load search history', queryError);
        setError(t('search.history.loadError') || 'Failed to load search history.');
        setHistory([]);
      } else {
        setHistory(data || []);
      }
      setLoading(false);
    };

    loadHistory();
  }, [user, limit, t]);

  const handleClearHistory = async () => {
    if (!user) return;
    const previous = history;
    setHistory([]);

    const { error: deleteError } = await supabase
      .from('search_history')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Failed to clear search history', deleteError);
      setHistory(previous);
    }
  };

  const handleSelect = (query: string) => {
    onSelectQuery?.(query);
    router.push(`/${locale}/search?query=${encodeURIComponent(query)}`);
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-on-surface-variant">
        <History className="w-4 h-4 animate-spin" />
        {t('search.history.loading') || 'Loading history...'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 text-sm text-error">
        <History className="w-4 h-4" />
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center gap-3 text-sm text-on-surface-variant">
        <History className="w-4 h-4" />
        {t('search.history.empty') || 'No recent searches yet.'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
          <History className="w-4 h-4" />
          {t('search.history.title') || 'Recent Searches'}
        </div>
        <Button variant="ghost" size="sm" onClick={handleClearHistory}>
          <Trash2 className="w-4 h-4 mr-2" />
          {t('search.history.clear') || 'Clear'}
        </Button>
      </div>

      <ul className="space-y-2">
        {formattedHistory.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2"
          >
            <button
              type="button"
              className="flex items-center gap-3 text-left text-sm text-on-surface-variant hover:text-primary transition-colors"
              onClick={() => handleSelect(item.search_query)}
            >
              <Clock1 className="w-4 h-4 text-outline" />
              <span>{item.search_query}</span>
            </button>
            <span className="text-xs text-outline">{item.relativeTime}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatRelativeTime(dateString: string, locale: string) {
  const date = new Date(dateString);
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) {
    return locale === 'ar' ? 'الآن' : 'Just now';
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
}

