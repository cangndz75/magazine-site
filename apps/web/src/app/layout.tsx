import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "@/lib/env";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
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
      <body>{children}</body>
    </html>
  );
}
