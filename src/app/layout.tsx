import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DISCLAIMER } from "@/lib/config";

export const metadata: Metadata = {
  title: "CareerSignal AI",
  description: "Evidence-first career positioning, LinkedIn profile intelligence and personal brand strategy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only">Skip to content</a>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>CS</span> CareerSignal AI
          </Link>
          <nav className="topnav" aria-label="Main">
            <Link href="/workspaces">My analyses</Link>
            <Link href="/settings">Settings &amp; privacy</Link>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer className="footer">{DISCLAIMER}</footer>
      </body>
    </html>
  );
}
