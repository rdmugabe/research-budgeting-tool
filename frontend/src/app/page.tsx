"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Trial } from "@/lib/api";

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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trials</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {showForm ? "Cancel" : "New Trial"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={onCreate}
          className="mb-6 rounded border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Trial name *</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2"
                placeholder="NN9490-8266"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Sponsor</span>
              <input
                value={sponsor}
                onChange={(e) => setSponsor(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2"
                placeholder="Novo Nordisk"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Protocol number</span>
              <input
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              disabled={creating || !name}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create trial"}
            </button>
          </div>
        </form>
      )}

      {err && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : trials.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No trials yet. Click <span className="font-medium">New Trial</span> to start.
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Sponsor</th>
                <th className="px-4 py-2 font-medium">Protocol</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/trials/${t.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{t.sponsor || "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{t.protocol_number || "—"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(t.created_at).toLocaleString()}
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
