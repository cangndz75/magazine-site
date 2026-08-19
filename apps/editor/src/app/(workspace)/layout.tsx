import Link from "next/link";
import { CAPABILITY, hasCapability } from "@magazine/domain";
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

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-zinc-50">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white px-4 py-2 sm:py-0">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:h-12 sm:flex-nowrap">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 sm:gap-6">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Magazin
            </span>
            <nav className="flex min-w-0 flex-wrap items-center gap-1 sm:flex-nowrap">
            <Link
              href="/"
              className="rounded px-2.5 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              İçerikler
            </Link>
            {canReadContent && (
              <Link
                href="/media"
                className="rounded px-2.5 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
              >
                Medya
              </Link>
            )}
            {canReadContent && (
              <Link
                href="/videos"
                className="rounded px-2.5 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
              >
                Videolar
              </Link>
            )}
            {canReview && (
              <Link
                href="/review"
                className="rounded px-2.5 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
              >
                İnceleme
              </Link>
            )}
            {canManageHomepage && (
              <Link
                href="/homepage"
                className="rounded px-2.5 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
              >
                Ana Sayfa
              </Link>
            )}
          </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span className="max-w-[9rem] truncate text-xs text-zinc-500 sm:max-w-none">
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
      </header>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
