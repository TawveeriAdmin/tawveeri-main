// src/lib/campaigns/destination-validation.ts
// Merchant-destination allowlist for affiliate campaigns (Phase 1A). Reuses the SAME
// Amazon-host detector already live in the exit path (src/lib/providers/networks/amazon.ts)
// so "what counts as an Amazon URL" is answered in exactly one place. Prevents an
// arbitrary external destination_url from ever being saved — an admin-facing input,
// so this is a real open-redirect guard, not a formality.
import { isAmazonHost } from '@/lib/providers/networks/amazon';
import type { CampaignMerchant } from './types';

const NOON_HOST_RE = /(^|\.)noon\.com$/i;

/** True when `host` is an approved destination host for `merchant`. */
export function isApprovedMerchantHost(merchant: CampaignMerchant, host: string): boolean {
  const h = host.toLowerCase();
  if (merchant === 'amazon') return isAmazonHost(h);
  if (merchant === 'noon') return NOON_HOST_RE.test(h);
  return false;
}

export interface DestinationValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a campaign destination URL against its declared merchant. Rejects:
 *   - unparseable URLs
 *   - non-http(s) protocols
 *   - any host not on the merchant's approved list (blocks arbitrary external URLs
 *     and prevents an open-redirect via /go/campaign/[id])
 * Never throws.
 */
export function validateCampaignDestination(merchant: CampaignMerchant, destinationUrl: string): DestinationValidationResult {
  let url: URL;
  try {
    url = new URL(destinationUrl);
  } catch {
    return { valid: false, reason: 'unparseable_url' };
  }
  if (!/^https?:$/i.test(url.protocol)) {
    return { valid: false, reason: 'invalid_protocol' };
  }
  if (!isApprovedMerchantHost(merchant, url.hostname)) {
    return { valid: false, reason: 'host_not_approved_for_merchant' };
  }
  return { valid: true };
}
