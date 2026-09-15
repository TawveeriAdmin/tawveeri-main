/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CheckClient } from '@/components/check/check-client';
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/auth-context';
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/analytics/track', () => ({ track: jest.fn(), initTestModeFromUrl: jest.fn() }));
jest.mock('next/link', () => ({ __esModule: true, default: (p: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...p} /> }));
jest.mock('@/components/catalog/exit-link', () => ({ ExitLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
jest.mock('@/components/products/price-alert-dialog', () => ({ PriceAlertDialog: ({ open, productId, onSaved }: { open: boolean; productId: string; onSaved: () => void }) => open ? <button onClick={onSaved}>save alert for {productId}</button> : null }));
const payload = { state: 'matched', canonicalId: 'canonical-id', title: 'Phone', alertProductId: 'storefront-id', cheaperCount: 0, history: { label: 'insufficient', days: 1 }, offers: [] };
describe('Check monitoring and telemetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: () => 'test-attempt' });
    Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: () => undefined });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => payload });
  });
  const submit = async () => {
    fireEvent.change(screen.getByLabelText('رابط المنتج'), { target: { value: 'https://www.extra.com/en-sa/p/100376379?tag=private' } });
    fireEvent.click(screen.getByText('افحص الرابط'));
    await screen.findByText('راقبه لي');
  };
  it('a guest watch click never claims the alert is saved or leaks the pasted URL', async () => {
    jest.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    render(<CheckClient locale="ar" />); await submit(); fireEvent.click(screen.getByText('راقبه لي'));
    expect(screen.getByText(/لم يُحفظ تنبيه بعد/)).toBeTruthy();
    expect(JSON.stringify(jest.mocked(track).mock.calls)).not.toContain('private');
    expect(jest.mocked(track).mock.calls.some(c => c[1]?.source === 'check_watch_saved')).toBe(false);
  });
  it('binds an authenticated alert to the storefront ID and counts only the saved callback', async () => {
    jest.mocked(useAuth).mockReturnValue({ user: { id: 'test-user' } } as ReturnType<typeof useAuth>);
    render(<CheckClient locale="ar" />); await submit(); fireEvent.click(screen.getByText('راقبه لي'));
    fireEvent.click(screen.getByText('save alert for storefront-id'));
    await waitFor(() => expect(jest.mocked(track).mock.calls.some(c => c[1]?.source === 'check_watch_saved')).toBe(true));
  });
  it('does not use a native type=url input, so pasted share-sheet text is never blocked before it reaches the app', () => {
    jest.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    render(<CheckClient locale="ar" />);
    const input = screen.getByLabelText('رابط المنتج') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('url');
  });
  it('shows a precise short-link tracking message, distinct from the generic unsupported message', async () => {
    jest.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ state: 'short_link_unresolved' }) });
    render(<CheckClient locale="ar" />);
    fireEvent.change(screen.getByLabelText('رابط المنتج'), { target: { value: 'https://link.amazon/B0jhDmiKd' } });
    fireEvent.click(screen.getByText('افحص الرابط'));
    await screen.findByText('تعذر تتبع الرابط المختصر');
    expect(screen.queryByText('لم نثبت هوية المنتج من هذا الرابط')).toBeNull();
  });
});
