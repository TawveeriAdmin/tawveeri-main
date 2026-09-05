'use client';

// Phase 2 — minimal founder admin for the Affiliate Campaign Revenue Layer V1.
// Deliberately NOT a CMS: create / list / edit / pause / preview / delete, plus a
// read-only kill-switch status panel (the real toggle is a Railway env var, see
// src/app/api/admin/campaigns/kill-switch/route.ts). Modeled on /admin/coupons but
// intentionally leaner — no column customization, no bulk actions, no creative studio.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Megaphone, Plus, Trash2, Pause, Play, ExternalLink } from 'lucide-react';
import type { AffiliateCampaign, CampaignMerchant, CampaignPlacement } from '@/lib/campaigns/types';
import { deriveCampaignStatus } from '@/lib/campaigns/types';

const EMPTY_FORM = {
  merchant: 'amazon' as CampaignMerchant,
  title_ar: '',
  title_en: '',
  destination_url: '',
  tracking_id: '',
  categories: '',
  placement: 'both' as CampaignPlacement,
  start_at: '',
  end_at: '',
  source: '',
  is_test: true,
};

const STATUS_STYLE: Record<string, string> = {
  live: 'bg-success-50 text-success-700',
  scheduled: 'bg-primary-50 text-primary-700',
  expired: 'bg-gray-100 text-gray-500',
  paused: 'bg-warning-50 text-warning-700',
};

export default function AdminCampaignsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<AffiliateCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [killSwitch, setKillSwitch] = useState<{ globallyEnabled: boolean; allowedMerchants: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignsRes, killSwitchRes] = await Promise.all([
        fetch('/api/admin/campaigns'),
        fetch('/api/admin/campaigns/kill-switch'),
      ]);
      const campaignsData = await campaignsRes.json();
      const killSwitchData = await killSwitchRes.json();
      setCampaigns(campaignsData.campaigns || []);
      setKillSwitch(killSwitchData);
    } catch {
      toast({ title: 'Failed to load campaigns', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(
    () => campaigns.map((c) => ({ ...c, status: deriveCampaignStatus(c, new Date()) })),
    [campaigns],
  );

  async function createCampaign() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        categories: form.categories.split(',').map((s) => s.trim()).filter(Boolean),
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      };
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create campaign');
      }
      toast({ title: 'Campaign created (paused — enable it when ready)' });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to create campaign', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(c: AffiliateCampaign) {
    const res = await fetch(`/api/admin/campaigns/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !c.enabled }),
    });
    if (!res.ok) { toast({ title: 'Failed to update campaign', variant: 'destructive' }); return; }
    load();
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast({ title: 'Failed to delete campaign', variant: 'destructive' }); return; }
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          <h1 className="text-xl font-bold">Affiliate Campaigns</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="revenue-proof">Revenue Proof</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="commerce">Amazon × Noon</a>
          </Button>
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-4 w-4 me-1" /> New campaign
          </Button>
        </div>
      </div>

      {/* Kill switch status — READ-ONLY. The real toggle is a Railway env var. */}
      <div className="rounded-lg border p-4 text-sm">
        <div className="font-semibold mb-1">Global kill switch</div>
        {killSwitch ? (
          <>
            <p>
              <code>AFFILIATE_CAMPAIGNS_ENABLED</code> is currently{' '}
              <b className={killSwitch.globallyEnabled ? 'text-success-700' : 'text-error-700'}>
                {killSwitch.globallyEnabled ? 'ON — campaigns can render' : 'OFF — the entire layer is hidden everywhere'}
              </b>
              . Allowed merchants: <b>{killSwitch.allowedMerchants.join(', ') || 'none'}</b>.
            </p>
            <p className="text-on-surface-variant mt-2">
              To turn the WHOLE feature off instantly: in Railway → this service → Variables, set{' '}
              <code>AFFILIATE_CAMPAIGNS_ENABLED=0</code> (Railway restarts the service automatically — no code
              change, no git push, no Claude Code needed). To disable only Noon while keeping Amazon live, set{' '}
              <code>AFFILIATE_CAMPAIGNS_MERCHANTS=amazon</code>.
            </p>
          </>
        ) : (
          <p>Loading…</p>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Merchant</Label>
              <Select value={form.merchant} onValueChange={(v) => setForm((f) => ({ ...f, merchant: v as CampaignMerchant }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="amazon">Amazon</SelectItem>
                  <SelectItem value="noon">Noon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Placement</Label>
              <Select value={form.placement} onValueChange={(v) => setForm((f) => ({ ...f, placement: v as CampaignPlacement }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="homepage">Homepage</SelectItem>
                  <SelectItem value="post_search">Post-search</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title (Arabic)</Label>
              <Input value={form.title_ar} onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))} />
            </div>
            <div>
              <Label>Title (English)</Label>
              <Input value={form.title_en} onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Destination URL (must be an approved {form.merchant} host)</Label>
              <Input value={form.destination_url} onChange={(e) => setForm((f) => ({ ...f, destination_url: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>
                Campaign-level Amazon Tracking ID (Amazon only — Noon has no per-campaign
                equivalent today, see §M of the closure report; leave empty to use the shared
                default tag; never a per-user/session value)
              </Label>
              <Input
                value={form.tracking_id}
                onChange={(e) => setForm((f) => ({ ...f, tracking_id: e.target.value }))}
                placeholder="e.g. tawveeri0f-tablet-21"
                disabled={form.merchant !== 'amazon'}
              />
            </div>
            <div>
              <Label>Categories (comma-separated; empty = any)</Label>
              <Input value={form.categories} onChange={(e) => setForm((f) => ({ ...f, categories: e.target.value }))} placeholder="tablet, laptop" />
            </div>
            <div>
              <Label>Source (provenance note)</Label>
              <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="Associates Central, 2026-09-02" />
            </div>
            <div>
              <Label>Start</Label>
              <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={createCampaign} disabled={saving}>{saving ? 'Saving…' : 'Create (paused)'}</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Test?</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.title_en}</TableCell>
                <TableCell className="capitalize">{c.merchant}</TableCell>
                <TableCell>{c.placement}</TableCell>
                <TableCell>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                </TableCell>
                <TableCell className="text-xs">
                  {new Date(c.start_at).toLocaleDateString()} → {new Date(c.end_at).toLocaleDateString()}
                </TableCell>
                <TableCell>{c.is_test ? 'yes' : 'no'}</TableCell>
                <TableCell className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => toggleEnabled(c)} title={c.enabled ? 'Pause' : 'Enable'}>
                    {c.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" asChild title="Preview destination">
                    <a href={c.destination_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteCampaign(c.id)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-on-surface-variant">No campaigns yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
