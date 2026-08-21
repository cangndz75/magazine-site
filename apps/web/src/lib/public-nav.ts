export type PublicNavItem = {
  label: string;
  href: string;
};

/** Category routes are not implemented yet; `#` entries are visual labels only. */
export function isPublicNavPlaceholder(item: PublicNavItem): boolean {
  return item.href === "#";
}

export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { label: "Gündem", href: "#" },
  { label: "Ünlüler", href: "#" },
  { label: "Diziler", href: "#" },
  { label: "Video", href: "#" },
  { label: "Astroloji", href: "#" },
  { label: "Takvim", href: "#" },
  { label: "Galeri", href: "#" },
];

export const PUBLIC_FOOTER_SECTION_LINKS: PublicNavItem[] = [
  { label: "Künye", href: "#" },
  { label: "İletişim", href: "#" },
  { label: "KVKK", href: "#" },
];
