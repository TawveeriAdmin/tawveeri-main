'use client';

// Carries the LIVE-DERIVED navigable category list from the server (locale layout) to client
// components — principally the header in PublicPageShell, which cannot query the database.
//
// The list is measured once per layout render by getNavigableCategories() and handed down as
// data. Nothing here decides membership; it only transports it. See
// docs/CATEGORY-NAVIGATION-POLICY.md (ADR-150).
//
// Fallback is an EMPTY list, deliberately: if the measurement failed we show no category nav
// rather than a stale hardcoded one. A missing menu is recoverable; a menu of dead ends is the
// thing we are removing.

import { createContext, useContext } from 'react';
import type { NavigableCategory } from './navigable-categories';

/** Presentation-only shape — the client never needs the DB key or the raw count logic. */
export type NavCategoryClient = Pick<
  NavigableCategory,
  'key' | 'comparable' | 'labelAr' | 'labelEn' | 'query' | 'emoji' | 'slug'
>;

const NavigableCategoriesContext = createContext<NavCategoryClient[]>([]);

export function NavigableCategoriesProvider({
  categories,
  children,
}: {
  categories: NavCategoryClient[];
  children: React.ReactNode;
}) {
  return (
    <NavigableCategoriesContext.Provider value={categories}>
      {children}
    </NavigableCategoriesContext.Provider>
  );
}

/** Categories that currently clear the navigation rule, ordered by comparable depth. */
export function useNavigableCategories(): NavCategoryClient[] {
  return useContext(NavigableCategoriesContext);
}
