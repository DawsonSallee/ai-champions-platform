import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/TopNav";
import { ConciergeChat } from "@/components/ConciergeChat";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Champions",
  description: "Backlog, ROI, governance, and the App Store — one app.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <TopNav />
        <main className="mx-auto max-w-7xl px-6 py-10 animate-fade-in">
          {children}
        </main>
        <ConciergeChat />
      </body>
    </html>
  );
}
