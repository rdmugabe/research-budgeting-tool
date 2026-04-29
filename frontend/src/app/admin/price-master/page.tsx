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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Price Master</h1>
        <button
          onClick={() => newDraftFrom(undefined)}
          disabled={busy}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          New empty version
        </button>
      </div>
      {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Label</th>
              <th className="px-4 py-2 font-medium">Effective</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/price-master/${v.id}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {v.label}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{v.effective_date}</td>
                <td className="px-4 py-2">
                  {v.is_published ? (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      PUBLISHED
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      DRAFT
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {new Date(v.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => newDraftFrom(v.id)}
                    className="text-sm text-blue-700 hover:underline"
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
