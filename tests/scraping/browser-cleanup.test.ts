import { BaseScraper } from '@/lib/scraping/base/base-scraper';

describe('scraper resource cleanup', () => {
  it('still closes the browser if closing its page fails', async () => {
    const scraper = Object.create(BaseScraper.prototype);
    const close = jest.fn().mockResolvedValue(undefined);
    scraper.page = { close: jest.fn().mockRejectedValue(new Error('page already detached')) };
    scraper.browser = { close };
    scraper.recordSessionEnd = jest.fn().mockResolvedValue(undefined);
    await expect(scraper.cleanup()).rejects.toThrow('page already detached');
    expect(close).toHaveBeenCalledTimes(1);
    expect(scraper.browser).toBeNull();
    expect(scraper.page).toBeNull();
    expect(scraper.recordSessionEnd).toHaveBeenCalledWith('closed_ok');
  });
  it('does not claim a closed browser if browser shutdown fails', async () => {
    const scraper = Object.create(BaseScraper.prototype);
    scraper.page = null;
    scraper.browser = { close: jest.fn().mockRejectedValue(new Error('browser close failed')) };
    scraper.recordSessionEnd = jest.fn();
    await expect(scraper.cleanup()).rejects.toThrow('browser close failed');
    expect(scraper.recordSessionEnd).not.toHaveBeenCalled();
  });
});
