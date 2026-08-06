import { nextjsSsrAdapter } from '../../src/lib/providers/sourcing/nextjs-ssr-adapter';
import { getProvider } from '../../src/lib/providers/registry';

async function main() {
  const provider = getProvider('blackbox');
  if (!provider) throw new Error('blackbox provider not found in registry');
  console.log('provider config:', JSON.stringify(provider, null, 2));
  console.log('adapter.supports:', nextjsSsrAdapter.supports(provider));

  const result = await nextjsSsrAdapter.fetchOffers(provider, { maxPages: 2 });
  console.log('=== RESULT ===');
  console.log('count:', result.count);
  console.log('errors:', result.errors);
  console.log('sample (first 5):');
  console.log(JSON.stringify(result.products.slice(0, 5), null, 2));
  const prices = result.products.map((p) => p.current_price).sort((a, b) => a - b);
  console.log('price range:', prices[0], '-', prices[prices.length - 1]);
  console.log('min price observed:', Math.min(...prices));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
