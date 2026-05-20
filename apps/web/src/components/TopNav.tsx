"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/backlog", label: "Backlog" },
  { href: "/governance", label: "Governance" },
  { href: "/app-store", label: "App Store" },
  { href: "/admin", label: "Admin" },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 nav-frosted border-b border-surface-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-hover text-brand-fg text-sm font-semibold shadow-sm transition-transform group-hover:scale-105">
            AI
          </div>
          <span className="font-semibold tracking-tight text-ink">
            AI Champions
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors",
                  active
                    ? "bg-brand-subtle text-brand"
                    : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
