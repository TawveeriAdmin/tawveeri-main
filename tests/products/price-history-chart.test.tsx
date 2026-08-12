/**
 * @jest-environment jsdom
 */
// Regression coverage for the price-history-chart production defect (2026-08-12).
//
// Root cause, proven against production (vyceqrzttspyycdpojtn): price_history.store_name is
// written inconsistently -- a store slug on some rows, an Arabic display name on others, with
// the exact Arabic spelling drifting between ingestion runs (e.g. Extra: "اكسترا" in price_history
// vs stores.name_ar "إكسترا" -- different Unicode codepoints for the same store). The chart
// queried `.eq('store_name', slug)`, which matched 0 of 1,461 canonical-linked (product, store)
// pairs in production. price_history.store_id (integer FK into stores.id) is populated and
// correct for every one of those pairs, recovering 100% coverage. This suite pins the query to
// store_id and pins that the component never renders a labelled section with no chart inside it.
import { render, waitFor } from '@testing-library/react';
import { PriceHistoryChart } from '@/components/products/price-history-chart';

const mockEq = jest.fn();
const mockGte = jest.fn();
const mockOrder = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/database', () => ({
  getSupabaseBrowserClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

jest.mock('next/navigation', () => ({ useParams: () => ({ locale: 'en' }) }));

function wireChain(finalResult: { data: unknown; error: unknown }) {
  // Rebuild a fresh chainable query builder each call: .from().select().eq().eq().gte().order()
  mockFrom.mockImplementation(() => ({ select: mockSelect }));
  mockSelect.mockImplementation(() => ({ eq: mockEq }));
  mockEq.mockImplementation(() => ({ eq: mockEq, gte: mockGte }));
  mockGte.mockImplementation(() => ({ order: mockOrder }));
  mockOrder.mockResolvedValue(finalResult);
}

describe('PriceHistoryChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries price_history by store_id, never by store_name', async () => {
    wireChain({
      data: [
        { price: 100, observed_at: '2026-08-01T00:00:00Z' },
        { price: 90, observed_at: '2026-08-10T00:00:00Z' },
      ],
      error: null,
    });

    render(
      <PriceHistoryChart
        canonicalProductId="canon-1"
        storeId={5}
        productName="Test product"
        storeName="Almanea"
        locale="en"
      />
    );

    await waitFor(() => expect(mockOrder).toHaveBeenCalled());

    expect(mockFrom).toHaveBeenCalledWith('price_history');
    const eqCalls = mockEq.mock.calls;
    expect(eqCalls).toContainEqual(['canonical_product_id', 'canon-1']);
    expect(eqCalls).toContainEqual(['store_id', 5]);
    expect(eqCalls.some(([column]) => column === 'store_name')).toBe(false);
  });

  it('renders a chart when price history exists', async () => {
    wireChain({
      data: [
        { price: 100, observed_at: '2026-08-01T00:00:00Z' },
        { price: 90, observed_at: '2026-08-10T00:00:00Z' },
      ],
      error: null,
    });

    const { container } = render(
      <PriceHistoryChart
        canonicalProductId="canon-1"
        storeId={5}
        productName="Test product"
        storeName="Almanea"
        locale="en"
      />
    );

    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
  });

  it('never renders a labelled empty section when no price history rows come back', async () => {
    wireChain({ data: [], error: null });

    const { container } = render(
      <PriceHistoryChart
        canonicalProductId="canon-1"
        storeId={5}
        productName="Test product"
        storeName="Almanea"
        locale="en"
      />
    );

    await waitFor(() => expect(mockOrder).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('never fires a query, and renders nothing, when the product has no canonical_product_id', () => {
    const { container } = render(
      <PriceHistoryChart
        canonicalProductId={null}
        storeId={5}
        productName="Test product"
        storeName="Almanea"
        locale="en"
      />
    );

    expect(mockFrom).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('never fires a query, and renders nothing, when storeId is missing', () => {
    const { container } = render(
      <PriceHistoryChart
        canonicalProductId="canon-1"
        storeId={null}
        productName="Test product"
        storeName="Almanea"
        locale="en"
      />
    );

    expect(mockFrom).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
