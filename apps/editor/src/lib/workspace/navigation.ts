export type WorkspaceNavigationInput = {
  canReadContent: boolean;
  canReview: boolean;
  canPublish: boolean;
  canManageHomepage: boolean;
  canLegal: boolean;
  canManageStaff: boolean;
  canManageEntities: boolean;
  canReadAnalytics: boolean;
};

export type WorkspaceNavigationItem = {
  href: string;
  label: string;
  description: string;
  marker: string;
};

export type WorkspaceNavigationGroup = {
  label: string;
  items: WorkspaceNavigationItem[];
};

export function buildWorkspaceNavigation(
  input: WorkspaceNavigationInput,
): WorkspaceNavigationGroup[] {
  const groups: WorkspaceNavigationGroup[] = [
    {
      label: "Çalışma Alanı",
      items: input.canReadContent
        ? [
            {
              href: "/",
              label: "Haber Masası",
              description: "İçerik listesi, filtreler ve hızlı özet",
              marker: "HM",
            },
          ]
        : [],
    },
    {
      label: "İçerik",
      items: input.canReadContent
        ? [
            {
              href: "/media",
              label: "Medya",
              description: "Görsel ve dosya kütüphanesi",
              marker: "M",
            },
            {
              href: "/videos",
              label: "Videolar",
              description: "Hosted video varlıkları",
              marker: "V",
            },
          ]
        : [],
    },
    {
      label: "Yayın",
      items: [
        input.canPublish
          ? {
              href: "/calendar",
              label: "Yayın Takvimi",
              description: "Planlanan yayınlar ve takvim",
              marker: "T",
            }
          : null,
        input.canReview
          ? {
              href: "/review",
              label: "İnceleme",
              description: "Onay bekleyen içerikler",
              marker: "İ",
            }
          : null,
        input.canManageHomepage
          ? {
              href: "/homepage",
              label: "Ana Sayfa",
              description: "Manşet ve blok yerleşimi",
              marker: "A",
            }
          : null,
        input.canLegal
          ? {
              href: "/legal",
              label: "Yasal",
              description: "Düzeltme, tekzip ve kısıtlar",
              marker: "Y",
            }
          : null,
      ].filter(Boolean) as WorkspaceNavigationItem[],
    },
    {
      label: "Büyüme",
      items: [
        input.canReadContent
          ? {
              href: "/seo",
              label: "SEO",
              description: "Arama görünümü ve meta kontrolü",
              marker: "S",
            }
          : null,
        input.canReadAnalytics
          ? {
              href: "/analytics",
              label: "Analytics",
              description: "Okunma ve yayın performansı",
              marker: "G",
            }
          : null,
        input.canManageEntities
          ? {
              href: "/entities",
              label: "Varlıklar",
              description: "Kişi, kurum ve konu kayıtları",
              marker: "V",
            }
          : null,
      ].filter(Boolean) as WorkspaceNavigationItem[],
    },
    {
      label: "Yönetim",
      items: input.canManageStaff
        ? [
            {
              href: "/dashboard",
              label: "Kontrol Merkezi",
              description: "Sistem ve ekip özeti",
              marker: "K",
            },
            {
              href: "/staff",
              label: "Personel",
              description: "Roller, kapsam ve güvenlik",
              marker: "P",
            },
          ]
        : [],
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}

export function findActiveWorkspaceHref(
  pathname: string,
  groups: readonly WorkspaceNavigationGroup[],
): string {
  const items = groups.flatMap((group) => group.items);
  const active = items
    .filter((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(`${item.href}/`) || pathname === item.href,
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  return active?.href ?? "/";
}
