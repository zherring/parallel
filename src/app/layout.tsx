import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const description =
  "Search any actor, director, writer or cinematographer and see their films on a timeline. Add more people to find the films they made together.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Parallel", template: "%s | Parallel" },
  description,
  openGraph: { siteName: "Parallel", type: "website", description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
