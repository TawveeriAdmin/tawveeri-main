/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeMissionEntry } from '@/components/public/home-mission-entry';
import { HomeMissionExample } from '@/components/public/home-mission-example';
import { HomeMissionClient } from '@/app/[locale]/home-mission/home-mission-client';
import { categorySource, exampleMission, HOME_DRAFT_KEY, HOME_PLAN_KEY, homeSource, missionFromSource } from '@/lib/agent/home-mission-discovery';
import { trackHome } from '@/lib/analytics/home-mission';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/lib/analytics/home-mission', () => ({ trackHome: jest.fn(), currentHomeSource: () => 'homepage_card' }));
jest.mock('@/lib/analytics/track', () => ({ track: jest.fn() }));

beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

test('sources use an allowlist and contextual review never imports a search budget or product', () => {
  expect(homeSource('private-link')).toBe('direct');
  expect(categorySource('smartphone')).toBeNull();
  expect(categorySource('washing_machine')).toBe('washer_results');
  expect(missionFromSource('fridge_results')).toMatchObject({ budget_total: null, quantities: { refrigerator: 1 }, spaces: [] });
  expect(missionFromSource('ac_results')?.spaces[0].area_m2).toBeNull();
  expect(missionFromSource('navigation')).toBeNull();
  const copy = exampleMission(); copy.spaces[0].area_m2 = 99;
  expect(exampleMission().spaces[0].area_m2).toBe(16);
});

test('entry impression requires viewport visibility and stays single across rerenders; both links retain source', () => {
  let intersect: (entries: { isIntersecting: boolean }[]) => void = () => {};
  const disconnect = jest.fn();
  window.IntersectionObserver = jest.fn().mockImplementation(cb => { intersect = cb; return { observe: jest.fn(), disconnect }; });
  localStorage.setItem('tw_home_entry_dismissed', '1');
  const { rerender } = render(<HomeMissionEntry locale="ar" source="homepage_card" />);
  expect(trackHome).not.toHaveBeenCalled();
  act(() => intersect([{ isIntersecting: false }]));
  expect(trackHome).not.toHaveBeenCalled();
  act(() => intersect([{ isIntersecting: true }]));
  rerender(<HomeMissionEntry locale="ar" source="homepage_card" />);
  act(() => intersect([{ isIntersecting: true }]));
  expect(trackHome).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'ابدأ خطة بيتك' })).toHaveAttribute('href', '/ar/home-mission?source=homepage_card');
  expect(screen.getByRole('link', { name: 'شوف مثال لخطة جاهزة' })).toHaveAttribute('href', '/ar/home-mission/example?source=homepage_card');
});

test('example cancellation preserves saved plan and draft; confirmed adoption copies every room to review', async () => {
  const understood = exampleMission();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ state: 'partial', understood, generated_at: new Date().toISOString(), legs: [] }) });
  localStorage.setItem(HOME_PLAN_KEY, 'existing-plan');
  localStorage.setItem(HOME_DRAFT_KEY, 'existing-draft');
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<HomeMissionExample locale="ar" />);
  const button = await screen.findByRole('button', { name: 'سوِّ خطة لبيتك' });
  fireEvent.click(button);
  expect(localStorage.getItem(HOME_PLAN_KEY)).toBe('existing-plan');
  expect(localStorage.getItem(HOME_DRAFT_KEY)).toBe('existing-draft');
  expect(push).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(button);
  expect(JSON.parse(localStorage.getItem(HOME_DRAFT_KEY)!).draft).toEqual(understood);
  expect(localStorage.getItem(HOME_PLAN_KEY)).toBeNull();
  expect(push).toHaveBeenCalledWith('/ar/home-mission?source=example');
  expect(trackHome).toHaveBeenCalledWith('example_view', undefined, 'example');
  confirm.mockRestore();
});

test('draft survives mount, review edits and a failed generation request', async () => {
  const mission = exampleMission();
  localStorage.setItem(HOME_DRAFT_KEY, JSON.stringify({ draft: mission, text: 'private description', ts: Date.now() }));
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
  render(<HomeMissionClient locale="ar" />);
  const build = await screen.findByRole('button', { name: 'ابنِ الخطة' });
  expect(JSON.parse(localStorage.getItem(HOME_DRAFT_KEY)!).draft.spaces).toEqual(mission.spaces);
  fireEvent.click(build);
  await waitFor(() => expect(trackHome).toHaveBeenCalledWith('plan_failed', undefined, 'personal', { operation: 'plan' }));
  expect(screen.getByRole('button', { name: 'ابنِ الخطة' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(HOME_DRAFT_KEY)!).draft).toEqual(mission);
});

test('free description persists and no free text reaches journey telemetry', async () => {
  render(<HomeMissionClient locale="ar" />);
  fireEvent.change(screen.getByRole('textbox', { name: 'وصف احتياجات بيتك' }), { target: { value: 'غسالة لعائلة خالد ميزانيتي 5000' } });
  fireEvent.click(screen.getByRole('button', { name: 'راجع احتياجاتك' }));
  await waitFor(() => expect(trackHome).toHaveBeenCalledWith('started'));
  expect(JSON.stringify((trackHome as jest.Mock).mock.calls)).not.toContain('خالد');
  expect(JSON.parse(localStorage.getItem(HOME_DRAFT_KEY)!).text).toContain('خالد');
});
