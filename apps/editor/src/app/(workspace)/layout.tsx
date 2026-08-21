import Link from "next/link";
import { CAPABILITY, authorizeEntityWrite, hasCapability } from "@magazine/domain";
import { requireStaffSession } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaffSession();
  const canReadContent = hasCapability(session.roles, CAPABILITY.CONTENT_READ);
  const canReview = hasCapability(session.roles, CAPABILITY.CONTENT_REVIEW);
  const canManageHomepage = hasCapability(session.roles, CAPABILITY.HOMEPAGE_MANAGE);
  const canLegal = hasCapability(session.roles, CAPABILITY.CONTENT_LEGAL);
  const canManageStaff = hasCapability(session.roles, CAPABILITY.STAFF_MANAGE);
  const canManageEntities = authorizeEntityWrite({ roles: session.roles }).ok;
  const canReadAnalytics = hasCapability(session.roles, CAPABILITY.ANALYTICS_READ);

  const navLinkClass =
    "shrink-0 rounded px-2 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 sm:px-2.5";

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-zinc-50">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
        <div className="flex h-10 items-center justify-between gap-2 px-4 sm:h-12">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Magazin
            </span>
            <nav
              aria-label="Ana menü"
              className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:flex sm:flex-nowrap"
            >
              {canManageStaff && (
                <Link href="/dashboard" className={navLinkClass}>
                  Kontrol Merkezi
                </Link>
              )}
              <Link href="/" className={navLinkClass}>
                İçerikler
              </Link>
              {canReadContent && (
                <Link href="/media" className={navLinkClass}>
                  Medya
                </Link>
              )}
              {canReadContent && (
                <Link href="/videos" className={navLinkClass}>
                  Videolar
                </Link>
              )}
              {canReadContent && (
                <Link href="/seo" className={navLinkClass}>
                  SEO
                </Link>
              )}
              {canReadAnalytics && (
                <Link href="/analytics" className={navLinkClass}>
                  Analytics
                </Link>
              )}
              {canReview && (
                <Link href="/review" className={navLinkClass}>
                  İnceleme
                </Link>
              )}
              {canManageHomepage && (
                <Link href="/homepage" className={navLinkClass}>
                  Ana Sayfa
                </Link>
              )}
              {canLegal && (
                <Link href="/legal" className={navLinkClass}>
                  Yasal
                </Link>
              )}
              {canManageEntities && (
                <Link href="/entities" className={navLinkClass}>
                  Varlıklar
                </Link>
              )}
              {canManageStaff && (
                <Link href="/staff" className={navLinkClass}>
                  Personel
                </Link>
              )}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link
              href="/settings/security"
              className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              Güvenlik
            </Link>
            <span className="max-w-[7rem] truncate text-xs text-zinc-500 sm:max-w-none">
              {session.displayName}
            </span>
            <form method="post" action="/api/auth/logout">
              <button
                type="submit"
                className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
              >
                Çıkış
              </button>
            </form>
          </div>
        </div>
        <nav
          aria-label="Ana menü"
          className="flex gap-0.5 overflow-x-auto border-t border-zinc-100 px-3 pb-2 pt-1 sm:hidden"
        >
          {canManageStaff && (
            <Link href="/dashboard" className={navLinkClass}>
              Kontrol Merkezi
            </Link>
          )}
          <Link href="/" className={navLinkClass}>
            İçerikler
          </Link>
          {canReadContent && (
            <Link href="/media" className={navLinkClass}>
              Medya
            </Link>
          )}
          {canReadContent && (
            <Link href="/videos" className={navLinkClass}>
              Videolar
            </Link>
          )}
          {canReadContent && (
            <Link href="/seo" className={navLinkClass}>
              SEO
            </Link>
          )}
          {canReadAnalytics && (
            <Link href="/analytics" className={navLinkClass}>
              Analytics
            </Link>
          )}
          {canReview && (
            <Link href="/review" className={navLinkClass}>
              İnceleme
            </Link>
          )}
          {canManageHomepage && (
            <Link href="/homepage" className={navLinkClass}>
              Ana Sayfa
            </Link>
          )}
          {canLegal && (
            <Link href="/legal" className={navLinkClass}>
              Yasal
            </Link>
          )}
          {canManageEntities && (
            <Link href="/entities" className={navLinkClass}>
              Varlıklar
            </Link>
          )}
          {canManageStaff && (
            <Link href="/staff" className={navLinkClass}>
              Personel
            </Link>
          )}
        </nav>
      </header>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
