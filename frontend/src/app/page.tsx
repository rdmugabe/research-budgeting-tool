"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Trial } from "@/lib/api";

const STATUS_PILL: Record<Trial["status"], string> = {
  DRAFT: "pill pill-emerald",
  NEGOTIATING: "pill pill-amber",
  AWARDED: "pill pill-blue",
  ARCHIVED: "pill pill-slate",
};

export default function TrialsPage() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [protocol, setProtocol] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .listTrials()
      .then(setTrials)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setErr(null);
    try {
      await api.createTrial({
        name,
        sponsor: sponsor || undefined,
        protocol_number: protocol || undefined,
      });
      setName("");
      setSponsor("");
      setProtocol("");
      setShowForm(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Trials</h1>
          <p className="mt-1 text-sm text-slate-600">
            Active client engagements. Open one to upload its SOA, set quantities, and run negotiation rounds.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className={showForm ? "btn-secondary" : "btn-primary"}
        >
          {showForm ? "Cancel" : "New trial"}
        </button>
      </header>

      {showForm && (
        <form onSubmit={onCreate} className="card p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Trial name *</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="NN9490-8266"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Sponsor</span>
              <input
                value={sponsor}
                onChange={(e) => setSponsor(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Novo Nordisk"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Protocol number</span>
              <input
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button disabled={creating || !name} className="btn-primary">
              {creating ? "Creating…" : "Create trial"}
            </button>
          </div>
        </form>
      )}

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{err}</div>}

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : trials.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-indigo-50 text-indigo-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900">No trials yet</h3>
          <p className="mt-1 text-sm text-slate-600">
            Click <span className="font-medium">New trial</span> to start your first engagement.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Sponsor</th>
                <th className="px-4 py-3 font-medium">Protocol</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/trials/${t.id}`}
                      className="font-medium text-indigo-700 hover:text-indigo-900"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{t.sponsor || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{t.protocol_number || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={STATUS_PILL[t.status]}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(t.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
