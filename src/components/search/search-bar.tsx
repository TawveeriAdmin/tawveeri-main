'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Search, X, Clock, Mic, QrCode } from 'lucide-react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useToast } from '@/components/ui/use-toast';
import { BarcodeScanner } from '@/components/search/barcode-scanner';
import type { ProductCategory } from '@/lib/database/types';

type SpeechRecognitionResultEvent = Event & {
  results: ArrayLike<{
    0?: {
      transcript: string;
    };
  }>;
};

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface SearchBarProps {
  initialQuery?: string;
  placeholder?: string;
  onSearch?: (query: string, category?: ProductCategory | 'all') => void;
  showSuggestions?: boolean;
  showCategory?: boolean;
  className?: string;
}

interface SearchSuggestion {
  name_ar: string;
  name_en: string;
  slug: string;
  category: ProductCategory;
  brand: string;
}

interface RecentSearch {
  id: string;
  search_query: string;
  category: ProductCategory | null;
  created_at: string;
}

export function SearchBar({
  initialQuery = '',
  placeholder,
  onSearch,
  showSuggestions = true,
  showCategory = true,
  className = '',
}: SearchBarProps) {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { user } = useAuth();
  const { toast } = useToast();

  // Lazy initialize Supabase client only in browser
  const supabaseRef = useRef<ReturnType<typeof getSupabaseBrowserClient> | null>(null);
  const getSupabase = () => {
    if (typeof window === 'undefined') {
      return null;
    }
    if (!supabaseRef.current) {
      supabaseRef.current = getSupabaseBrowserClient();
    }
    return supabaseRef.current;
  };

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showSuggestionsPopup, setShowSuggestionsPopup] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Debounce query for suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Fetch suggestions
  useEffect(() => {
    async function fetchSuggestions() {
      if (!debouncedQuery.trim() || !showSuggestions) {
        setSuggestions([]);
        return;
      }

      const client = getSupabase();
      if (!client) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        let queryBuilder = client
          .from('products')
          .select('name_ar, name_en, slug, category, brand')
          .eq('is_active', true)
          .limit(10);

        // Use ILIKE for simple search (full-text search requires special setup)
        queryBuilder = queryBuilder.or(
          `name_ar.ilike.%${debouncedQuery}%,name_en.ilike.%${debouncedQuery}%,brand.ilike.%${debouncedQuery}%`
        );

        const { data } = await queryBuilder;

        setSuggestions((data || []) as SearchSuggestion[]);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSuggestions();
  }, [debouncedQuery, showSuggestions]);

  // Fetch recent searches
  useEffect(() => {
    async function fetchRecentSearches() {
      if (!user || !showSuggestions) return;

      const client = getSupabase();
      if (!client) return;

      try {
        const { data } = await client
          .from('search_history')
          .select('id, search_query, category, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentSearches((data || []) as RecentSearch[]);
      } catch (error) {
        console.error('Error fetching recent searches:', error);
      }
    }

    fetchRecentSearches();
  }, [user, showSuggestions]);

  // Setup voice recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionConstructor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setVoiceSupported(false);
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = locale === 'ar' ? 'ar-SA' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setQuery(transcript);
        handleSearch(transcript, selectedCategory);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast({
        title: t('search.voice.noSupport'),
        variant: 'destructive',
      });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setVoiceSupported(true);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      recognitionRef.current = null;
    };
  }, [locale, selectedCategory, t, toast]);

  const handleSearch = (searchQuery?: string, category?: ProductCategory | 'all') => {
    const q = searchQuery || query;
    const cat = category || selectedCategory;

    if (!q.trim()) {
      setShowSuggestionsPopup(false);
      return;
    }

    if (onSearch) {
      onSearch(q, cat);
    } else {
      const url = `/${locale}/search?q=${encodeURIComponent(q)}${cat !== 'all' ? `&category=${cat}` : ''}`;
      router.push(url);
    }

    setShowSuggestionsPopup(false);

    if (user) {
      void saveSearchHistory(q, cat);
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    const productName = locale === 'ar' ? suggestion.name_ar : suggestion.name_en;
    setQuery(productName);
    handleSearch(productName, suggestion.category);
  };

  const handleRecentSearchClick = (recentSearch: RecentSearch) => {
    setQuery(recentSearch.search_query);
    handleSearch(recentSearch.search_query, recentSearch.category || 'all');
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const saveSearchHistory = async (searchTerm: string, categoryValue: ProductCategory | 'all') => {
    if (!user || !searchTerm.trim()) return;
    const client = getSupabase();
    if (!client) return;
    
    const entry = {
      user_id: user.id,
      search_query: searchTerm.trim(),
      category: categoryValue === 'all' ? null : categoryValue,
    };
    try {
      await client.from('search_history').insert(entry);
      setRecentSearches((prev) => {
        const filtered = prev.filter((item) => item.search_query !== entry.search_query);
        const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
        return [
          {
            id,
            search_query: entry.search_query,
            category: entry.category,
            created_at: new Date().toISOString(),
          },
          ...filtered,
        ].slice(0, 5);
      });
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  const toggleVoiceSearch = () => {
    if (!voiceSupported || !recognitionRef.current) {
      toast({
        title: t('search.voice.noSupport'),
        variant: 'destructive',
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        setIsListening(true);
        setShowSuggestionsPopup(false);
        recognitionRef.current.start();
      } catch (error) {
        setIsListening(false);
        console.error('Voice search error:', error);
        toast({
          title: t('search.voice.noSupport'),
          variant: 'destructive',
        });
      }
    }
  };

  const handleBarcodeDetected = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    handleSearch(trimmed);
    setScannerOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestionsPopup(false);
    }
  };

  const hasContent = query.trim().length > 0 || suggestions.length > 0 || recentSearches.length > 0;

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-outline w-5 h-5" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder || t('search.searchPlaceholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestionsPopup(true);
            }}
            onFocus={() => setShowSuggestionsPopup(true)}
            onKeyDown={handleKeyDown}
            className="ps-10 pe-10"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute end-3 top-1/2 transform -translate-y-1/2 text-outline hover:text-on-surface"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showCategory && (
            <Select
              value={selectedCategory}
              onValueChange={(value) => setSelectedCategory(value as ProductCategory | 'all')}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('products.allCategories')}</SelectItem>
                <SelectItem value="tv">{t('products.categories.tv')}</SelectItem>
                <SelectItem value="laptop">{t('products.categories.laptop')}</SelectItem>
                <SelectItem value="smartphone">{t('products.categories.smartphone')}</SelectItem>
                <SelectItem value="tablet">{t('products.categories.tablet')}</SelectItem>
                <SelectItem value="audio">{t('products.categories.audio')}</SelectItem>
                <SelectItem value="gaming">{t('products.categories.gaming')}</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button
            type="button"
            variant={isListening ? 'default' : 'outline'}
            onClick={toggleVoiceSearch}
            aria-pressed={isListening}
          >
            <Mic className="w-4 h-4 me-2" />
            <span className="whitespace-nowrap">
              {isListening ? t('search.voice.stop') : t('search.voice.start')}
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setScannerOpen(true)}
          >
            <QrCode className="w-4 h-4 mr-2" />
            <span className="whitespace-nowrap">{t('search.barcode.start')}</span>
          </Button>

          <Button onClick={() => handleSearch()}>{t('search.title')}</Button>
        </div>
      </div>

      {/* Suggestions Popover */}
      {showSuggestions && showSuggestionsPopup && hasContent && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto"
        >
          {/* Recent Searches */}
          {recentSearches.length > 0 && !query.trim() && (
            <div className="p-4 border-b border-outline-variant">
              <h4 className="text-sm font-semibold text-on-surface-variant mb-2">
                {t('search.recentSearches')}
              </h4>
              <div className="space-y-1">
                {recentSearches.map((recent) => (
                  <button
                    key={recent.id}
                    onClick={() => handleRecentSearchClick(recent)}
                    className="w-full text-left px-3 py-2 hover:bg-on-surface/8 rounded flex items-center gap-2 text-sm"
                  >
                    <Clock className="w-4 h-4 text-outline" />
                    <span>{recent.search_query}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && query.trim() && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-on-surface-variant mb-2">
                {t('search.suggestions')}
              </h4>
              <div className="space-y-1">
                {suggestions.map((suggestion, idx) => {
                  const name = locale === 'ar' ? suggestion.name_ar : suggestion.name_en;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left px-3 py-2 hover:bg-on-surface/8 rounded flex items-center gap-2 text-sm"
                    >
                      <Search className="w-4 h-4 text-outline" />
                      <div className="flex-1">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-on-surface-variant">
                          {suggestion.brand} • {suggestion.category}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Results */}
          {query.trim() && suggestions.length === 0 && !loading && (
            <div className="p-4 text-sm text-on-surface-variant text-center">
              {t('search.noSuggestions')}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="p-4 text-sm text-on-surface-variant text-center">
              {t('search.searching')}
            </div>
          )}
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcodeDetected}
      />
    </div>
  );
}

