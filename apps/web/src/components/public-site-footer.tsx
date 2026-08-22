import Link from "next/link";
import {
  isPublicNavPlaceholder,
  PUBLIC_FOOTER_SECTION_LINKS,
  type PublicNavItem,
} from "@/lib/public-nav";

function FooterNavItem({
  item,
  className,
}: {
  item: PublicNavItem;
  className: string;
}) {
  if (isPublicNavPlaceholder(item)) {
    return (
      <span className={`${className} ${className}--placeholder`} aria-disabled="true">
        {item.label}
      </span>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}

export function PublicSiteFooter() {
  return (
    <footer className="public-site-footer">
      <div className="public-site-footer__body">
        <div className="public-site-footer__inner">
          <div className="public-site-footer__brand">
            <Link href="/" className="public-site-footer__wordmark">
              MAGAZİN
            </Link>
            <p className="public-site-footer__blurb">
              Türkiye&apos;nin magazin, ünlü ve eğlence yayını.
            </p>
          </div>

          <nav className="public-site-footer__column" aria-label="Kurumsal">
            <p className="public-site-footer__label">Kurumsal</p>
            <ul className="public-site-footer__links">
              {PUBLIC_FOOTER_SECTION_LINKS.map((item) => (
                <li key={item.label}>
                  <FooterNavItem item={item} className="public-site-footer__link" />
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="public-site-footer__legal">
        <div className="public-site-footer__legal-inner">
          <p className="public-site-footer__copyright">
            © {new Date().getFullYear()} Magazin. Tüm hakları saklıdır.
          </p>
          <ul className="public-site-footer__legal-links">
            {PUBLIC_FOOTER_SECTION_LINKS.map((item) => (
              <li key={item.label}>
                <FooterNavItem item={item} className="public-site-footer__legal-link" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
