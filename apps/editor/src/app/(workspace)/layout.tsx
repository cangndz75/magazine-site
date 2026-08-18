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
  const canReview = hasCapability(session.roles, CAPABILITY.CONTENT_REVIEW);
  const canManageHomepage = hasCapability(session.roles, CAPABILITY.HOMEPAGE_MANAGE);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-zinc-200 bg-white px-4">
        <div className="flex items-center gap-6">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Magazin
          </span>
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="rounded px-2.5 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              İçerikler
            </Link>
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
                Homepage
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500">{session.displayName}</span>
          <form method="post" action="/api/auth/logout">
            <button
              type="submit"
              className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            >
              Çıkış
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
