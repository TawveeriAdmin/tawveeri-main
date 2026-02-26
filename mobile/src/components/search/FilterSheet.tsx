/**
 * Search Filter Bottom Sheet
 *
 * Modal with price range, brand, spec, discount, and condition filters.
 * Client-side filtering on fetched results.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal, TextInput,
} from 'react-native';
import { X, SlidersHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { CATEGORY_SPEC_FILTERS, extractSpecsFromTitle, type SpecFilterDefinition } from '@/src/lib/search/spec-utils';

export interface SearchFilters {
  brands: string[];
  minPrice: string;
  maxPrice: string;
  specs: Record<string, string[]>;  // specKey -> selected values
  dealsOnly: boolean;
  freeDeliveryOnly: boolean;
  condition: string[];  // 'new' | 'renewed' | 'used'
  discountMin: number;  // 0, 10, 25, 50, 70
}

export const EMPTY_FILTERS: SearchFilters = {
  brands: [],
  minPrice: '',
  maxPrice: '',
  specs: {},
  dealsOnly: false,
  freeDeliveryOnly: false,
  condition: [],
  discountMin: 0,
};

export function getActiveFilterCount(f: SearchFilters): number {
  let c = 0;
  if (f.brands.length) c++;
  if (f.minPrice || f.maxPrice) c++;
  if (Object.values(f.specs).some((v) => v.length > 0)) c++;
  if (f.dealsOnly) c++;
  if (f.freeDeliveryOnly) c++;
  if (f.condition.length) c++;
  if (f.discountMin > 0) c++;
  return c;
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  category: string;
  availableBrands: string[];
  locale: string;
}

const DISCOUNT_PRESETS = [10, 25, 50, 70];
const CONDITIONS = [
  { value: 'new', label_ar: 'جديد', label_en: 'New' },
  { value: 'renewed', label_ar: 'مجدد', label_en: 'Renewed' },
  { value: 'used', label_ar: 'مستعمل', label_en: 'Used' },
];

export function FilterSheet({ visible, onClose, filters, onApply, category, availableBrands, locale }: FilterSheetProps) {
  const { colors } = useTheme();
  const rtl = useRTL();
  const [draft, setDraft] = useState<SearchFilters>(filters);

  // Reset draft when opening
  React.useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible]);

  const specFilters: SpecFilterDefinition[] = useMemo(() => {
    if (category === 'all' || !category) return [];
    return CATEGORY_SPEC_FILTERS[category] || [];
  }, [category]);

  const toggleBrand = (brand: string) => {
    setDraft((prev) => ({
      ...prev,
      brands: prev.brands.includes(brand)
        ? prev.brands.filter((b) => b !== brand)
        : [...prev.brands, brand],
    }));
  };

  const toggleSpec = (specKey: string, value: string) => {
    setDraft((prev) => {
      const current = prev.specs[specKey] || [];
      return {
        ...prev,
        specs: {
          ...prev.specs,
          [specKey]: current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value],
        },
      };
    });
  };

  const toggleCondition = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      condition: prev.condition.includes(value)
        ? prev.condition.filter((c) => c !== value)
        : [...prev.condition, value],
    }));
  };

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply(draft);
    onClose();
  };

  const handleClear = () => {
    setDraft(EMPTY_FILTERS);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.separator }]}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <X size={20} color={colors.label} />
          </Pressable>
          <Text style={[typography.headline, { color: colors.label, fontWeight: '600' }]}>
            {locale === 'ar' ? 'الفلاتر' : 'Filters'}
          </Text>
          <Pressable onPress={handleClear} hitSlop={8}>
            <Text style={[typography.subheadline, { color: colors.primary }]}>
              {locale === 'ar' ? 'مسح' : 'Clear'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Quick Toggles */}
          <View style={[styles.section, { backgroundColor: colors.card, marginTop: spacing.md }]}>
            <ToggleChip
              label={locale === 'ar' ? 'العروض فقط' : 'Deals only'}
              active={draft.dealsOnly}
              onPress={() => setDraft((p) => ({ ...p, dealsOnly: !p.dealsOnly }))}
              colors={colors}
            />
            <ToggleChip
              label={locale === 'ar' ? 'توصيل مجاني' : 'Free delivery'}
              active={draft.freeDeliveryOnly}
              onPress={() => setDraft((p) => ({ ...p, freeDeliveryOnly: !p.freeDeliveryOnly }))}
              colors={colors}
            />
          </View>

          {/* Price Range */}
          <SectionLabel text={locale === 'ar' ? 'نطاق السعر (ر.س)' : 'Price Range (SAR)'} rtl={rtl} colors={colors} />
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TextInput
                value={draft.minPrice}
                onChangeText={(v) => setDraft((p) => ({ ...p, minPrice: v.replace(/[^0-9]/g, '') }))}
                placeholder={locale === 'ar' ? 'الحد الأدنى' : 'Min'}
                placeholderTextColor={colors.tertiaryLabel}
                keyboardType="numeric"
                style={[styles.priceInput, { backgroundColor: colors.secondaryBackground, color: colors.label, borderColor: colors.separator }]}
              />
              <TextInput
                value={draft.maxPrice}
                onChangeText={(v) => setDraft((p) => ({ ...p, maxPrice: v.replace(/[^0-9]/g, '') }))}
                placeholder={locale === 'ar' ? 'الحد الأقصى' : 'Max'}
                placeholderTextColor={colors.tertiaryLabel}
                keyboardType="numeric"
                style={[styles.priceInput, { backgroundColor: colors.secondaryBackground, color: colors.label, borderColor: colors.separator }]}
              />
            </View>
          </View>

          {/* Brands */}
          {availableBrands.length > 0 && (
            <>
              <SectionLabel text={locale === 'ar' ? 'العلامة التجارية' : 'Brand'} rtl={rtl} colors={colors} />
              <View style={[styles.section, { backgroundColor: colors.card }]}>
                <View style={styles.chipWrap}>
                  {availableBrands.map((brand) => (
                    <ToggleChip
                      key={brand}
                      label={brand}
                      active={draft.brands.includes(brand)}
                      onPress={() => toggleBrand(brand)}
                      colors={colors}
                    />
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Specs (dynamic per category) */}
          {specFilters.map((spec) => (
            <React.Fragment key={spec.key}>
              <SectionLabel text={locale === 'ar' ? spec.label_ar : spec.label_en} rtl={rtl} colors={colors} />
              <View style={[styles.section, { backgroundColor: colors.card }]}>
                <View style={styles.chipWrap}>
                  {spec.options.map((opt) => (
                    <ToggleChip
                      key={opt.value}
                      label={locale === 'ar' ? opt.label_ar : opt.label_en}
                      active={(draft.specs[spec.key] || []).includes(opt.value)}
                      onPress={() => toggleSpec(spec.key, opt.value)}
                      colors={colors}
                    />
                  ))}
                </View>
              </View>
            </React.Fragment>
          ))}

          {/* Discount % */}
          <SectionLabel text={locale === 'ar' ? 'نسبة الخصم' : 'Discount %'} rtl={rtl} colors={colors} />
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.chipWrap}>
              {DISCOUNT_PRESETS.map((pct) => (
                <ToggleChip
                  key={pct}
                  label={`${pct}%+`}
                  active={draft.discountMin === pct}
                  onPress={() => setDraft((p) => ({ ...p, discountMin: p.discountMin === pct ? 0 : pct }))}
                  colors={colors}
                />
              ))}
            </View>
          </View>

          {/* Condition */}
          <SectionLabel text={locale === 'ar' ? 'الحالة' : 'Condition'} rtl={rtl} colors={colors} />
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.chipWrap}>
              {CONDITIONS.map((c) => (
                <ToggleChip
                  key={c.value}
                  label={locale === 'ar' ? c.label_ar : c.label_en}
                  active={draft.condition.includes(c.value)}
                  onPress={() => toggleCondition(c.value)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.separator }]}>
          <Pressable onPress={handleApply} style={[styles.applyBtn, { backgroundColor: colors.primary }]}>
            <SlidersHorizontal size={18} color="#fff" />
            <Text style={[typography.headline, { color: '#fff', marginLeft: spacing.sm }]}>
              {locale === 'ar' ? 'تطبيق' : 'Apply'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// --- Helpers ---

function SectionLabel({ text, rtl, colors }: { text: string; rtl: ReturnType<typeof useRTL>; colors: any }) {
  return (
    <Text style={[typography.footnote, { color: colors.secondaryLabel, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs, textTransform: 'uppercase', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
      {text}
    </Text>
  );
}

function ToggleChip({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.secondaryBackground,
          borderWidth: active ? 0 : 1,
          borderColor: colors.separator,
        },
      ]}
    >
      <Text style={[typography.footnote, { color: active ? '#fff' : colors.label, fontWeight: active ? '600' : '400' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Apply filters to search results client-side.
 */
export function applyFilters(
  results: any[],
  filters: SearchFilters,
): any[] {
  return results.filter((item) => {
    // Price range
    if (filters.minPrice && item.price < Number(filters.minPrice)) return false;
    if (filters.maxPrice && item.price > Number(filters.maxPrice)) return false;

    // Brand
    if (filters.brands.length > 0) {
      const itemBrand = (item.brand || '').toLowerCase();
      if (!filters.brands.some((b) => itemBrand.includes(b.toLowerCase()))) return false;
    }

    // Deals only
    if (filters.dealsOnly && (!item.originalPrice || item.originalPrice <= item.price)) return false;

    // Discount %
    if (filters.discountMin > 0 && item.originalPrice) {
      const discount = ((item.originalPrice - item.price) / item.originalPrice) * 100;
      if (discount < filters.discountMin) return false;
    } else if (filters.discountMin > 0 && !item.originalPrice) {
      return false;
    }

    // Specs (extracted from title)
    const specKeys = Object.keys(filters.specs).filter((k) => filters.specs[k].length > 0);
    if (specKeys.length > 0) {
      const titleSpecs = extractSpecsFromTitle(item.title || '');
      for (const key of specKeys) {
        const selected = filters.specs[key];
        const extracted = titleSpecs[key];
        if (!extracted || !selected.includes(extracted)) return false;
      }
    }

    // Condition
    if (filters.condition.length > 0) {
      const titleSpecs = extractSpecsFromTitle(item.title || '');
      const itemCondition = titleSpecs.condition || 'new';
      if (!filters.condition.includes(itemCondition)) return false;
    }

    return true;
  });
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginHorizontal: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  priceInput: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
  },
});
