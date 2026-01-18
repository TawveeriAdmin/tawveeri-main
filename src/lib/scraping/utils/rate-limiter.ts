import type { RateLimitConfig } from '../base/types';

/**
 * Rate limiter to control request frequency
 * Implements token bucket algorithm
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private requests: number[] = [];
  private lastReset: number = Date.now();

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Wait for next allowed request based on rate limit
   */
  async wait(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove requests older than 1 minute
    this.requests = this.requests.filter(timestamp => timestamp > oneMinuteAgo);

    // Check if we've exceeded requests per minute
    if (this.requests.length >= this.config.requests_per_minute) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 60000 - (now - oldestRequest) + 100; // Add 100ms buffer
      await this.delay(waitTime);
      return this.wait(); // Recursively check again
    }

    // Add random delay between min and max
    const delayMs = this.getRandomDelay();
    await this.delay(delayMs);

    // Record this request
    this.requests.push(Date.now());
  }

  /**
   * Get random delay between min and max
   */
  private getRandomDelay(): number {
    const { min_delay_ms, max_delay_ms } = this.config;
    return Math.floor(Math.random() * (max_delay_ms - min_delay_ms + 1)) + min_delay_ms;
  }

  /**
   * Simple delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requests = this.requests.filter(timestamp => timestamp > oneMinuteAgo);
    return Math.max(0, this.config.requests_per_minute - this.requests.length);
  }

  /**
   * Reset rate limit window
   */
  reset(): void {
    this.requests = [];
    this.lastReset = Date.now();
  }
}

