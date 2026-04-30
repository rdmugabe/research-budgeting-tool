import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import AuthBar from "@/components/AuthBar";

export const metadata: Metadata = {
  title: "Research Budgeting Tool",
  description: "Clinical-trial site budgeting at an Academic Medical Center",
};

const navLinks = [
  { href: "/", label: "Trials" },
  { href: "/admin/price-master", label: "Price Master" },
  { href: "/admin/fixed-fees", label: "Fixed Fees" },
  { href: "/admin/audit", label: "Audit Log" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-slate-900 antialiased">
        <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-bold text-white shadow-sm">
                R
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-slate-900 group-hover:text-indigo-700">
                Research Budgeting
              </span>
            </Link>
            <div className="flex items-center gap-7">
              <nav className="flex gap-6 text-sm">
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-slate-600 transition-colors hover:text-slate-900"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
              <AuthBar />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
