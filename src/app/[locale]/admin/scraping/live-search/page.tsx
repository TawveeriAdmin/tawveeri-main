'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Search, Download } from 'lucide-react';

const ALL_STORES = [
  'amazon', 'noon', 'jarir', 'extra', 'almanea', 'shaker', 'samsung_ksa', 'swsg',
];

const CATEGORIES = [
  'smartphone', 'laptop', 'tv', 'tablet', 'audio', 'gaming', 'camera', 'accessories',
  'monitor', 'printer', 'networking', 'smart_home', 'wearable',
  'appliance', 'kitchen', 'personal_care',
];

export default function LiveSearchPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('smartphone');
  const [stores, setStores] = useState<string[]>(['jarir', 'amazon', 'noon', 'extra', 'almanea']);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleStore = (s: string) =>
    setStores((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const runSearch = async () => {
    if (!query.trim()) {
      toast({ title: 'Query is required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setResults([]);
    setSelected(new Set());
    try {
      const res = await fetch('/api/admin/scraping/live-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search',
          query,
          category,
          stores,
          pages,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Search failed');
      }
      const json = await res.json();
      setResults(json.products ?? []);
      toast({ title: `Found ${json.count} products in ${json.searchTime?.toFixed?.(1) ?? '?'}s` });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Search failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const ingest = async () => {
    const toIngest: any[] = [];
    results.forEach((g, i) => {
      const key = `${i}`;
      if (!selected.has(key)) return;
      // Grouped search result has multiple store entries — flatten into separate scraped products.
      for (const s of g.stores || []) {
        toIngest.push({ ...s, store_slug: s.store });
      }
    });
    if (toIngest.length === 0) {
      toast({ title: 'Select at least one product', variant: 'destructive' });
      return;
    }
    setIngesting(true);
    try {
      const res = await fetch('/api/admin/scraping/live-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ingest', products: toIngest }),
      });
      if (!res.ok) throw new Error('Ingest failed');
      const json = await res.json();
      toast({ title: `Ingested: ${json.created} new, ${json.linked} linked, ${json.skipped} skipped` });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Ingest failed', variant: 'destructive' });
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Live search</h1>
        <p className="text-sm text-muted-foreground">
          Run the legacy live scrape against selected stores and optionally ingest
          results into the catalog. Admin only — end users never see this path.
        </p>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search query (e.g., iPhone 15 Pro)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            className="flex-1"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="number"
            className="w-20"
            value={pages}
            onChange={(e) => setPages(parseInt(e.target.value) || 1)}
            min={1}
            max={5}
          />
          <Button onClick={runSearch} disabled={loading}>
            <Search size={14} /> {loading ? 'Searching…' : 'Search'}
          </Button>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Stores ({stores.length} selected)</p>
          <div className="flex flex-wrap gap-2">
            {ALL_STORES.map((s) => (
              <label key={s} className="flex items-center gap-1 text-sm cursor-pointer">
                <Checkbox checked={stores.includes(s)} onCheckedChange={() => toggleStore(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {results.length} grouped results — {selected.size} selected for ingest
            </p>
            <Button onClick={ingest} disabled={ingesting || selected.size === 0}>
              <Download size={14} /> {ingesting ? 'Ingesting…' : `Ingest ${selected.size}`}
            </Button>
          </div>
          <div className="border rounded-lg divide-y">
            {results.map((g, i) => {
              const key = `${i}`;
              return (
                <label key={key} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selected.has(key)} onCheckedChange={() => toggleSelect(key)} />
                  {g.image_urls?.[0] && (
                    <img
                      src={g.image_urls[0]}
                      alt=""
                      className="w-12 h-12 object-contain"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.name_en || g.name_ar}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.brand} · {g.store_count} {g.store_count === 1 ? 'store' : 'stores'} · {g.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{g.best_price?.toLocaleString()} SAR</p>
                    <p className="text-xs text-muted-foreground">
                      {g.stores?.map((s: any) => s.store).join(', ')}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
