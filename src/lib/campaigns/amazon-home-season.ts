/** Owner-requested editorial window, NOT a claim about Amazon's sale dates.
 * Merchant dates were not verified; deliberately no public date label.
 * Only the existing evergreen homepage row receives the seasonal presentation.
 */
export const AMAZON_HOME_CAMPAIGN_ID = 'f48b9b5d-1136-4ad0-964a-7ab34490a63a';
export const AMAZON_HOME_SEASON_START = Date.parse('2026-09-20T00:00:00+03:00');
export const AMAZON_HOME_SEASON_END = Date.parse('2026-10-01T00:00:00+03:00');

export function isAmazonHomeSeason(id: string, merchant: string, now: number): boolean {
  return id === AMAZON_HOME_CAMPAIGN_ID && merchant === 'amazon'
    && now >= AMAZON_HOME_SEASON_START && now < AMAZON_HOME_SEASON_END;
}
