import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import type { ReactElement, ReactNode } from "react";
import { AdminToaster } from "@/components/admin/ui/AdminToaster";
import "./admin.css";

/**
 * Root layout of the admin (/admin/**). Separate from the site root layout
 * (src/app/[locale]/layout.tsx): Russian only, own stylesheet (Tailwind), never indexed.
 * Access control lives in (panel)/layout.tsx + every query/action (src/lib/admin/auth.ts).
 */

const adminFont = Montserrat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-admin",
  display: "swap",
});

/** The admin reads cookies and the DB on every request; navigations may block. */
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Админка — ГАДЮКА", template: "%s — админка ГАДЮКА" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export const viewport: Viewport = {
  themeColor: "#010101",
  colorScheme: "dark",
};

export default function AdminRootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="ru" className={adminFont.variable}>
      <body className="min-h-dvh bg-ink text-fg antialiased">
        {children}
        <AdminToaster />
      </body>
    </html>
  );
}
