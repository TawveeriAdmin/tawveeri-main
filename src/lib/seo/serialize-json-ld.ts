/** Serialize JSON for an HTML script raw-text context, preserving JSON values. */
export function serializeJsonLd(data: unknown): string {
  try {
    return (JSON.stringify(data) ?? 'null').replace(/</g, '\\u003c');
  } catch {
    // Invalid optional structured data (cycles/BigInt) must not break the page.
    return 'null';
  }
}
