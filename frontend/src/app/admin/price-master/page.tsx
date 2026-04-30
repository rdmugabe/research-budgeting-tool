"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, PriceMasterVersion } from "@/lib/api";

export default function PriceMasterListPage() {
  const router = useRouter();
  const [versions, setVersions] = useState<PriceMasterVersion[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.listVersions().then(setVersions).catch((e: Error) => setErr(e.message));
  };
  useEffect(load, []);

  async function newDraftFrom(versionId?: number) {
    const label = prompt("New version label", "Draft");
    if (!label) return;
    setBusy(true);
    try {
      const v = await api.createVersion({
        label,
        clone_from_version_id: versionId,
      });
      router.push(`/admin/price-master/${v.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Price Master</h1>
          <p className="mt-1 text-sm text-slate-600">
            Versioned snapshots of every procedure&apos;s AMC price. Trials pin to a published version.
          </p>
        </div>
        <button onClick={() => newDraftFrom(undefined)} disabled={busy} className="btn-primary">
          New empty version
        </button>
      </header>
      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{err}</div>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Effective</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/price-master/${v.id}`}
                    className="font-medium text-indigo-700 hover:text-indigo-900"
                  >
                    {v.label}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{v.effective_date}</td>
                <td className="px-4 py-3">
                  <span className={v.is_published ? "pill pill-blue" : "pill pill-emerald"}>
                    {v.is_published ? "PUBLISHED" : "DRAFT"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(v.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => newDraftFrom(v.id)}
                    className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
                    disabled={busy}
                  >
                    Clone
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
