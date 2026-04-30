"use client";

import { useEffect, useState } from "react";
import { api, AuditLogEntry } from "@/lib/api";

const ENTITY_TYPES = [
  "",
  "trial",
  "budget_round",
  "budget_round_override",
  "procedure",
  "fixed_fee",
  "price_master_version",
];

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("");

  const load = () => {
    api
      .listAudit({ entity_type: filterType || undefined, limit: 500 })
      .then(setEntries)
      .catch((e: Error) => setErr(e.message));
  };

  useEffect(load, [filterType]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Audit Log</h1>
          <p className="mt-1 text-sm text-slate-600">
            Append-only history of every meaningful action across the system.
          </p>
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t || "All entity types"}
            </option>
          ))}
        </select>
      </header>
      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{err}</div>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">When</th>
              <th className="px-3 py-2.5 font-medium">User</th>
              <th className="px-3 py-2.5 font-medium">Entity</th>
              <th className="px-3 py-2.5 font-medium">Action</th>
              <th className="px-3 py-2.5 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((a) => (
              <tr key={a.id} className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/40">
                <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-slate-600">
                  {a.user_id !== null ? `#${a.user_id}` : "—"}
                </td>
                <td className="px-3 py-1.5">
                  <span className="font-mono text-xs text-slate-700">
                    {a.entity_type}
                    {a.entity_id !== null && `/${a.entity_id}`}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <span className="pill pill-slate">{a.action}</span>
                </td>
                <td className="px-3 py-1.5 text-slate-700">{a.details || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.length === 0 && (
        <div className="text-sm text-slate-500">No audit entries yet.</div>
      )}
    </div>
  );
}
