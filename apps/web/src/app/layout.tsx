import type { Metadata } from "next";
import { Geist } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import "./site.css";
import { SiteHeader } from "@/components/SiteHeader";
import { ConciergeChat } from "@/components/ConciergeChat";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Champions",
  description: "Backlog, ROI, governance, and the App Store — one app.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <NextTopLoader
          color="#7C2D2D"
          height={2.5}
          showSpinner={false}
          shadow="0 0 8px rgba(124,45,45,0.5)"
          speed={300}
        />
        <div className="v3-root v3-accent-burgundy">
          <SiteHeader />
          <main className="v3-page animate-fade-in">{children}</main>
        </div>
        <ConciergeChat />
      </body>
    </html>
  );
}
