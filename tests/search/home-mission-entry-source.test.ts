import { homeMissionEntrySource } from '@/lib/search/home-mission-entry-source';

test.each([
  ['air_conditioner', 'مكيف', 'ac_results'],
  ['appliance', 'ثلاجة', 'fridge_results'],
  ['appliance', 'غسالة', 'washer_results'],
  ['appliance', 'fridge 400 liters', 'fridge_results'],
  ['appliance', 'washing machine under 2000', 'washer_results'],
  ['appliance', 'غسالة صحون', null],
  ['appliance', 'ميكروويف', null],
  ['appliance', 'أجهزة منزلية', null],
  ['appliance', 'ايفون وثلاجة', null],
  ['smartphone', 'غسالة', null],
  [null, 'ثلاجة', null],
])('maps the confirmed storefront group %s / %s to %s without inviting unrelated searches', (category, query, expected) => {
  expect(homeMissionEntrySource(category, query!)).toBe(expected);
});
