import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import AuthBar from "@/components/AuthBar";

export const metadata: Metadata = {
  title: "Research Budgeting Tool",
  description: "Clinical-trial site budgeting at an Academic Medical Center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Research Budgeting Tool
            </Link>
            <div className="flex items-center gap-6">
              <nav className="flex gap-4 text-sm">
                <Link href="/" className="text-slate-600 hover:text-slate-900">
                  Trials
                </Link>
                <Link href="/admin/price-master" className="text-slate-600 hover:text-slate-900">
                  Price Master
                </Link>
                <Link href="/admin/fixed-fees" className="text-slate-600 hover:text-slate-900">
                  Fixed Fees
                </Link>
                <Link href="/admin/audit" className="text-slate-600 hover:text-slate-900">
                  Audit Log
                </Link>
              </nav>
              <AuthBar />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
