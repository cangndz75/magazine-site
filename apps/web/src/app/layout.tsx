import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { PublicSiteFooter } from "@/components/public-site-footer";
import { PublicSiteHeader } from "@/components/public-site-header";
import "@/lib/env";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Magazin",
    template: "%s | Magazin",
  },
  description: "Magazin haber ve yaşam platformu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={geist.variable}>
      <body>
        <div className="public-site-shell">
          <PublicSiteHeader />
          <main className="public-site-main">{children}</main>
          <PublicSiteFooter />
        </div>
      </body>
    </html>
  );
}
