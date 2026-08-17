// src/lib/agent/home-mission-share.ts
// «شارك الخطة» (ADR-257) — pure logic for pre-purchase plan sharing.
//
// TRUST BOUNDARY: the share request comes from an anonymous client, so NOTHING the
// client sends is treated as fact. The client may only send STRUCTURE (category keys,
// quantities, canonical ids, room labels, purchased marks); every displayed FACT
// (product name, price, store, image, freshness, /go exit) is re-derived server-side
// from production data at share time. A tampered request can therefore never publish
// a fabricated price or product under Tawveeri's brand — it can at worst share a
// differently-shaped but truthful plan.
//
// The snapshot is IMMUTABLE (drift honesty = the viewer shows «كما رُصدت وقت
// المشاركة» + age); the owner re-shares for a fresh link. Viewing needs no account
// (capability URL: 128-bit crypto-random token). Feedback readback is gated by an
// owner_key returned once at creation.

import { GROUP_LABELS_PUBLIC } from "./home-mission-view";

export const SHARE_TOKEN_RE = /^[a-f0-9]{32}$/;
export const MAX_SHARE_LEGS = 24;
export const MAX_FEEDBACK_PER_SHARE = 80;

const KNOWN_CATEGORIES = new Set(Object.keys(GROUP_LABELS_PUBLIC));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Free-text scrubber for the few client strings we keep (room labels, names):
 *  caps length, strips control chars and anything URL-shaped. */
export function scrubText(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== "string") return null;
  const s = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
  return s || null;
}

export interface ShareLegIn {
  leg_id: string;
  category: string;
  canonical_id: string;
  purchased: boolean;
  space_label_ar?: string | null;
  area_m2?: number | null;
}
export interface ShareRequestIn {
  locale: "ar" | "en";
  budget_total: number | null;
  household_size: number | null;
  property_type: "apartment" | "villa" | "partial" | null;
  legs: ShareLegIn[];
}

/** Validate/clamp the client's share request STRUCTURE. Returns null when unusable. */
export function sanitizeShareRequest(body: unknown): ShareRequestIn | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const legsRaw = Array.isArray(b.legs) ? b.legs : [];
  const legs: ShareLegIn[] = [];
  for (const l of legsRaw.slice(0, MAX_SHARE_LEGS)) {
    if (!l || typeof l !== "object") continue;
    const x = l as Record<string, unknown>;
    const category = String(x.category ?? "");
    const canonical = String(x.canonical_id ?? "");
    const legId = String(x.leg_id ?? "").slice(0, 40);
    if (!KNOWN_CATEGORIES.has(category) || !UUID_RE.test(canonical) || !/^[a-z0-9_-]+$/i.test(legId)) continue;
    const area = Number(x.area_m2);
    legs.push({
      leg_id: legId,
      category,
      canonical_id: canonical.toLowerCase(),
      purchased: x.purchased === true,
      space_label_ar: scrubText(x.space_label_ar, 30),
      area_m2: Number.isFinite(area) && area >= 5 && area <= 200 ? Math.round(area) : null,
    });
  }
  if (!legs.length) return null;
  const budget = Number(b.budget_total);
  const household = Number(b.household_size);
  const property = ["apartment", "villa", "partial"].includes(String(b.property_type)) ? (String(b.property_type) as ShareRequestIn["property_type"]) : null;
  return {
    locale: b.locale === "en" ? "en" : "ar",
    budget_total: Number.isFinite(budget) && budget >= 1000 && budget <= 500000 ? Math.round(budget) : null,
    household_size: Number.isFinite(household) && household >= 1 && household <= 20 ? Math.round(household) : null,
    property_type: property,
    legs,
  };
}

/** Server-derived facts per canonical (from production, never from the client). */
export interface CanonicalFact {
  canonical_id: string;
  title_ar: string | null;
  title_en: string | null;
  price: number | null;
  store: string | null;
  store_count: number;
  image_url: string | null;
  observed_at: string | null;
  go_url: string | null;
}

export interface ShareSnapshot {
  v: 1;
  shared_at: string;
  locale: "ar" | "en";
  budget_total: number | null;
  household_size: number | null;
  property_type: string | null;
  total: number | null; // sum of leg prices (null if any missing)
  legs: Array<{
    leg_id: string;
    category: string;
    label_ar: string;
    label_en: string;
    space_label_ar: string | null;
    area_m2: number | null;
    purchased: boolean;
    title_ar: string | null;
    title_en: string | null;
    price: number | null;
    store: string | null;
    store_count: number;
    image_url: string | null;
    observed_at: string | null;
    go_url: string | null;
  }>;
}

/** Assemble the immutable snapshot: client STRUCTURE × server FACTS. Legs whose
 *  canonical has no server-side fact row are DROPPED (unknown beats incorrect). */
export function assembleSnapshot(req: ShareRequestIn, facts: Map<string, CanonicalFact>, now: Date): ShareSnapshot | null {
  const legs: ShareSnapshot["legs"] = [];
  for (const l of req.legs) {
    const f = facts.get(l.canonical_id);
    if (!f) continue;
    const labels = GROUP_LABELS_PUBLIC[l.category];
    legs.push({
      leg_id: l.leg_id,
      category: l.category,
      label_ar: labels.ar,
      label_en: labels.en,
      space_label_ar: l.space_label_ar ?? null,
      area_m2: l.area_m2 ?? null,
      purchased: l.purchased,
      title_ar: f.title_ar,
      title_en: f.title_en,
      price: f.price,
      store: f.store,
      store_count: f.store_count,
      image_url: f.image_url,
      observed_at: f.observed_at,
      go_url: f.go_url,
    });
  }
  if (!legs.length) return null;
  let total: number | null = 0;
  for (const l of legs) {
    if (l.price == null) { total = null; break; }
    total += l.price;
  }
  return {
    v: 1,
    shared_at: now.toISOString(),
    locale: req.locale,
    budget_total: req.budget_total,
    household_size: req.household_size,
    property_type: req.property_type,
    total,
    legs,
  };
}

export interface FeedbackIn {
  leg_id: string;
  reaction: "up" | "change";
  note: string | null;
  reviewer_name: string | null;
}

/** Validate recipient feedback against the share's own snapshot legs. */
export function validateFeedback(body: unknown, snapshot: ShareSnapshot): FeedbackIn | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const reaction = String(b.reaction ?? "");
  if (reaction !== "up" && reaction !== "change") return null;
  const legId = String(b.leg_id ?? "");
  if (legId !== "" && !snapshot.legs.some((l) => l.leg_id === legId)) return null;
  return {
    leg_id: legId,
    reaction,
    note: scrubText(b.note, 140),
    reviewer_name: scrubText(b.reviewer_name, 24),
  };
}
