'use client';

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchAutocompleteProps {
  locale: string;
  compact?: boolean;
  initialQuery?: string;
  onQuery?: (q: string) => void;
  className?: string;
  placeholder?: string;
}

export function SearchAutocomplete({
  locale,
  compact = false,
  initialQuery = '',
  onQuery,
  className,
  placeholder,
}: SearchAutocompleteProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRTL = locale === 'ar';

  // Sync when initialQuery changes externally
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const defaultPlaceholder = isRTL
    ? 'ابحث عن منتج، موديل، أو علامة تجارية...'
    : 'Search for a product, model, or brand...';

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (onQuery) {
      onQuery(trimmed);
    } else {
      router.push(
        trimmed
          ? `/${locale}/search?q=${encodeURIComponent(trimmed)}`
          : `/${locale}/search`
      );
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn(
        'relative flex items-stretch overflow-hidden rounded-full border border-outline-variant bg-surface-container-lowest transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15',
        compact ? 'h-10' : 'h-12',
        className
      )}
    >
      {/* Search icon */}
      <span
        aria-hidden
        className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
      >
        <Search className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} strokeWidth={2} />
      </span>

      {/* Input */}
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? defaultPlaceholder}
        aria-label={placeholder ?? defaultPlaceholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant/60 outline-none',
          compact ? 'ps-9 pe-2 text-[13px]' : 'ps-10 pe-3 text-sm'
        )}
      />

      {/* Clear button */}
      {query.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={isRTL ? 'مسح البحث' : 'Clear search'}
          className="flex shrink-0 items-center justify-center px-2 text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Submit button */}
      <button
        type="submit"
        aria-label={isRTL ? 'بحث' : 'Search'}
        className={cn(
          'm-1 inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-600',
          compact ? 'h-8 w-8' : 'h-10 w-10'
        )}
      >
        <Search className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} strokeWidth={2.25} />
      </button>
    </form>
  );
}

export default SearchAutocomplete;
