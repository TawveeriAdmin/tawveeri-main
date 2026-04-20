'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Eye } from 'lucide-react';

interface RunRow {
  id: string;
  store_id: string;
  job_type: 'discovery' | 'price_update';
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  products_discovered: number;
  products_updated: number;
  price_changes_detected: number;
  errors_count: number;
  error_summary: unknown;
  triggered_by: 'schedule' | 'manual' | 'api';
  created_at: string;
  stores: { slug: string; name_ar: string; name_en: string };
}

const STATUS_VARIANTS: Record<RunRow['status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  success: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
};

function fmtDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 6) / 10;
  return `${m}m`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function ScrapingRunsPage() {
  const searchParams = useSearchParams();
  const storeIdFilter = searchParams?.get('store_id') || null;
  const [rows, setRows] = useState<RunRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [jobType, setJobType] = useState<string>('all');
  const [selected, setSelected] = useState<RunRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (jobType !== 'all') params.set('job_type', jobType);
      if (storeIdFilter) params.set('store_id', storeIdFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/admin/scraping/runs?${params}`);
      const json = await res.json();
      setRows(json.runs ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [status, jobType, storeIdFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scraping runs</h1>
          <p className="text-sm text-muted-foreground">
            Execution history for all scrapers. {total} total.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={jobType} onValueChange={setJobType}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              <SelectItem value="discovery">Discovery</SelectItem>
              <SelectItem value="price_update">Price update</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-container-low hover:bg-surface-container-low">
                <TableHead className="font-semibold">Store</TableHead>
                <TableHead className="font-semibold">Job</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Started</TableHead>
                <TableHead className="font-semibold">Duration</TableHead>
                <TableHead className="font-semibold">Discovered</TableHead>
                <TableHead className="font-semibold">Updated</TableHead>
                <TableHead className="font-semibold">Price changes</TableHead>
                <TableHead className="font-semibold">Errors</TableHead>
                <TableHead className="font-semibold">Trigger</TableHead>
                <TableHead className="font-semibold">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.stores?.name_en || r.stores?.slug}</TableCell>
                  <TableCell className="text-xs">{r.job_type}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_VARIANTS[r.status]}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtTime(r.started_at || r.created_at)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">{fmtDuration(r.duration_ms)}</TableCell>
                  <TableCell className="tabular-nums">{r.products_discovered}</TableCell>
                  <TableCell className="tabular-nums">{r.products_updated}</TableCell>
                  <TableCell className="tabular-nums">{r.price_changes_detected}</TableCell>
                  <TableCell className="tabular-nums">{r.errors_count}</TableCell>
                  <TableCell className="text-xs">{r.triggered_by}</TableCell>
                  <TableCell>
                    {Boolean(r.error_summary) && (
                      <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                        <Eye size={14} />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-background rounded-lg max-w-2xl w-full p-4 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold">
              {selected.stores?.name_en} — {selected.job_type} — {selected.status}
            </h2>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
              {String(JSON.stringify(selected.error_summary, null, 2) ?? '')}
            </pre>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
