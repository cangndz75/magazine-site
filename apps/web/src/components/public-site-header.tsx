import Link from "next/link";
import { PublicSiteMobileMenu } from "@/components/public-site-mobile-menu";
import { PUBLIC_NAV_ITEMS } from "@/lib/public-nav";

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
                <Link href={item.href} className="public-site-header__nav-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="public-site-header__search"
          aria-label="Ara (yakında)"
          disabled
        >
          Ara
        </button>
      </div>

      <div className="public-site-header__mobile">
        <Link href="/" className="public-site-header__wordmark">
          MAGAZİN
        </Link>
        <div className="public-site-header__mobile-actions">
          <button
            type="button"
            className="public-site-header__search"
            aria-label="Ara (yakında)"
            disabled
          >
            Ara
          </button>
          <PublicSiteMobileMenu />
        </div>
      </div>
    </header>
  );
}
