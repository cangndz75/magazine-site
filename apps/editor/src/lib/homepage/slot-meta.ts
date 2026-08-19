import {
  HOMEPAGE_ATF_SLOT_KEYS,
  HOMEPAGE_FEATURED_SLOT_KEYS,
  HOMEPAGE_SLOT_KEY,
  type HomepageSlotKey,
} from "@magazine/domain";

export const HOMEPAGE_SLOT_LABEL: Record<HomepageSlotKey, string> = {
  [HOMEPAGE_SLOT_KEY.LEAD]: "Lead",
  [HOMEPAGE_SLOT_KEY.SUPPORT_1]: "Destek 1",
  [HOMEPAGE_SLOT_KEY.SUPPORT_2]: "Destek 2",
  [HOMEPAGE_SLOT_KEY.FEATURED_1]: "Öne Çıkan 1",
  [HOMEPAGE_SLOT_KEY.FEATURED_2]: "Öne Çıkan 2",
  [HOMEPAGE_SLOT_KEY.FEATURED_3]: "Öne Çıkan 3",
  [HOMEPAGE_SLOT_KEY.FEATURED_4]: "Öne Çıkan 4",
  [HOMEPAGE_SLOT_KEY.FEATURED_5]: "Öne Çıkan 5",
};

export const HOMEPAGE_SLOT_SHORT_LABEL: Record<HomepageSlotKey, string> = {
  [HOMEPAGE_SLOT_KEY.LEAD]: "Lead",
  [HOMEPAGE_SLOT_KEY.SUPPORT_1]: "Destek 1",
  [HOMEPAGE_SLOT_KEY.SUPPORT_2]: "Destek 2",
  [HOMEPAGE_SLOT_KEY.FEATURED_1]: "1",
  [HOMEPAGE_SLOT_KEY.FEATURED_2]: "2",
  [HOMEPAGE_SLOT_KEY.FEATURED_3]: "3",
  [HOMEPAGE_SLOT_KEY.FEATURED_4]: "4",
  [HOMEPAGE_SLOT_KEY.FEATURED_5]: "5",
};

export const HOMEPAGE_ATF_KEYS = [...HOMEPAGE_ATF_SLOT_KEYS];
export const HOMEPAGE_FEATURED_KEYS = [...HOMEPAGE_FEATURED_SLOT_KEYS];

export type HomepageFeaturedSlotKey = (typeof HOMEPAGE_FEATURED_SLOT_KEYS)[number];

export function isHomepageFeaturedSlotKey(
  value: HomepageSlotKey,
): value is HomepageFeaturedSlotKey {
  return (HOMEPAGE_FEATURED_SLOT_KEYS as readonly HomepageSlotKey[]).includes(value);
}

export function isHomepageSlotKey(value: string): value is HomepageSlotKey {
  return value in HOMEPAGE_SLOT_LABEL;
}
