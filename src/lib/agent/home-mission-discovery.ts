import type { Mission } from './home-mission-view';

export const HOME_PLAN_KEY = 'tw_home_mission_v3';
export const HOME_DRAFT_KEY = 'tw_home_mission_draft_v1';
export const HOME_SOURCES = ['homepage_card', 'navigation', 'ac_results', 'fridge_results', 'washer_results', 'example', 'shared_link', 'direct'] as const;
export type HomeSource = typeof HOME_SOURCES[number];
export function homeSource(value: string | null): HomeSource {
  return HOME_SOURCES.includes(value as HomeSource) ? value as HomeSource : 'direct';
}
export function categorySource(category: string | null): HomeSource | null {
  return ({ air_conditioner: 'ac_results', refrigerator: 'fridge_results', washing_machine: 'washer_results' } as const)[category as 'air_conditioner'] ?? null;
}
export function emptyHomeMission(): Mission {
  return { spaces: [], household_size: null, budget_total: null, posture: null, property_type: null,
    categories: {}, quantities: {}, priorities: [], deprioritized_priorities: [], excluded_priorities: [],
    whole_home: false, unsupported_mentions: [], parsed_from_text: '' };
}
export function missionFromSource(source: HomeSource): Mission | null {
  const category = ({ ac_results: 'air_conditioner', fridge_results: 'refrigerator', washer_results: 'washing_machine' } as Record<string, string>)[source];
  if (!category) return null;
  return { ...emptyHomeMission(), categories: { [category]: 'normal' }, quantities: { [category]: 1 },
    spaces: category === 'air_conditioner' ? [{ key: 'space_1', label_ar: 'غرفة', label_en: 'Room', area_m2: null }] : [] };
}
/** Fixed illustrative needs; prices and picks always come from the existing engine. */
export function exampleMission(): Mission {
  return { ...emptyHomeMission(), property_type: 'apartment', household_size: 2, budget_total: 15000,
    posture: 'balanced', whole_home: true,
    spaces: [{ key: 'space_1', label_ar: 'غرفة النوم', label_en: 'Bedroom', area_m2: 16 },
      { key: 'space_2', label_ar: 'الصالة', label_en: 'Living room', area_m2: 24 }],
    categories: { air_conditioner: 'normal', refrigerator: 'normal', washing_machine: 'normal' },
    quantities: { air_conditioner: 2, refrigerator: 1, washing_machine: 1 } };
}
