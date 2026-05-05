import type { RetryOptions } from '../base/types';

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Retry handler with exponential backoff
 */
export class RetryHandler {
  /**
   * Retry a function with exponential backoff
   */
  async retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on last attempt
        if (attempt === opts.maxRetries) {
          throw lastError;
        }

        // Check if error is retryable
        if (!this.shouldRetry(lastError)) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt),
          opts.maxDelayMs
        );

        // Wait before retrying
        await this.delay(delay);
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Determine if error is retryable
   */
  shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'network',
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'rate_limit',
    ];

    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    return retryableErrors.some(keyword => 
      errorMessage.includes(keyword) || errorName.includes(keyword)
    );
  }

  /**
   * Simple delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}






