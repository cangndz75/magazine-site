import Link from "next/link";
import {
  PUBLIC_FOOTER_SECTION_LINKS,
  PUBLIC_NAV_ITEMS,
} from "@/lib/public-nav";

export function PublicSiteFooter() {
  return (
    <footer className="public-site-footer">
      <div className="public-site-footer__inner">
        <div className="public-site-footer__brand">
          <p className="public-site-footer__wordmark">MAGAZİN</p>
          <p className="public-site-footer__blurb">
            Türkiye&apos;nin magazin, ünlü ve eğlence yayını.
          </p>
        </div>

        <div className="public-site-footer__columns">
          <div className="public-site-footer__column">
            <p className="public-site-footer__label">Bölümler</p>
            <ul className="public-site-footer__links">
              {PUBLIC_NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="public-site-footer__column">
            <p className="public-site-footer__label">Kurumsal</p>
            <ul className="public-site-footer__links">
              {PUBLIC_FOOTER_SECTION_LINKS.map((item) => (
                <li key={item.label}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="public-site-footer__legal">
        © {new Date().getFullYear()} Magazin. Tüm hakları saklıdır.
      </p>
    </footer>
  );
}
