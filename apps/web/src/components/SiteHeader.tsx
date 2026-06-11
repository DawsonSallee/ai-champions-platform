"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/backlog", label: "Backlog" },
  { href: "/governance", label: "Governance" },
  { href: "/app-store", label: "App Store" },
  { href: "/admin", label: "Admin" },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "";
  return (
    <header className="v3-header">
      <div className="v3-header-inner">
        <div style={{ display: "flex", alignItems: "center" }}>
          <Link href="/" className="v3-brand">
            <span className="v3-brand-mark" aria-hidden />
            <span className="v3-brand-name">AI Champions</span>
            <span className="v3-brand-tag">Enercon</span>
          </Link>
          <nav className="v3-nav">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "active" : ""}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
