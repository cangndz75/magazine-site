import Link from "next/link";
import { PublicSiteMobileMenu } from "@/components/public-site-mobile-menu";
import { isPublicNavPlaceholder, PUBLIC_NAV_ITEMS } from "@/lib/public-nav";

function PublicSearchLink({ className }: { className: string }) {
  return (
    <Link href="/arama" className={className} aria-label="Arama">
      Ara
    </Link>
  );
}

export function PublicSiteHeader() {
  return (
    <header className="public-site-header">
      <div className="public-site-header__bar">
        <Link href="/" className="public-site-header__wordmark">
          MAGAZİN
        </Link>

        <nav className="public-site-header__nav" aria-label="Ana menü">
          <ul className="public-site-header__nav-list">
            {PUBLIC_NAV_ITEMS.map((item) => (
              <li key={item.label}>
                {isPublicNavPlaceholder(item) ? (
                  <span
                    className="public-site-header__nav-link public-site-header__nav-link--placeholder"
                    aria-disabled="true"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className="public-site-header__nav-link">
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <PublicSearchLink className="public-site-header__search" />
      </div>

      <div className="public-site-header__mobile">
        <Link href="/" className="public-site-header__wordmark">
          MAGAZİN
        </Link>
        <div className="public-site-header__mobile-actions">
          <PublicSearchLink className="public-site-header__search" />
          <PublicSiteMobileMenu />
        </div>
      </div>
    </header>
  );
}
