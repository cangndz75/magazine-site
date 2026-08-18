"use client";

import Link from "next/link";
import { useRef } from "react";
import { PUBLIC_NAV_ITEMS } from "@/lib/public-nav";

export function PublicSiteMobileMenu() {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  return (
    <details ref={detailsRef} className="public-site-header__menu">
      <summary className="public-site-header__menu-trigger">Menü</summary>
      <div className="public-site-header__menu-panel">
        <button
          type="button"
          className="public-site-header__menu-close"
          onClick={closeMenu}
        >
          Kapat
        </button>
        <nav aria-label="Mobil menü">
          <ul className="public-site-header__menu-list">
            {PUBLIC_NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="public-site-header__menu-link"
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </details>
  );
}
