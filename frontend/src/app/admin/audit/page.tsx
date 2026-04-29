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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t || "All entity types"}
            </option>
          ))}
        </select>
      </div>
      {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((a) => (
              <tr key={a.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-slate-600">
                  {a.user_id !== null ? `#${a.user_id}` : "—"}
                </td>
                <td className="px-3 py-1.5">
                  <span className="font-mono text-xs">
                    {a.entity_type}
                    {a.entity_id !== null && `/${a.entity_id}`}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                    {a.action}
                  </span>
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
