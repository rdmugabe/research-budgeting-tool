"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  BudgetRound,
  SOACell,
  SOAUploadResult,
  Trial,
  TrialQuantity,
} from "@/lib/api";

export default function TrialDetailPage({ params }: { params: { id: string } }) {
  const trialId = Number(params.id);
  const router = useRouter();

  const [trial, setTrial] = useState<Trial | null>(null);
  const [cells, setCells] = useState<SOACell[]>([]);
  const [quantities, setQuantities] = useState<TrialQuantity[]>([]);
  const [rounds, setRounds] = useState<BudgetRound[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<SOAUploadResult | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    try {
      const [t, c, q, r] = await Promise.all([
        api.getTrial(trialId),
        api.listSOACells(trialId),
        api.listQuantities(trialId),
        api.listRounds(trialId),
      ]);
      setTrial(t);
      setCells(c);
      setQuantities(q);
      setRounds(r);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialId]);

  const visitLabels = useMemo(() => {
    return Array.from(new Set(cells.map((c) => c.visit_label))).sort();
  }, [cells]);

  const quantitiesByVisit = useMemo(() => {
    const m: Record<string, TrialQuantity> = {};
    for (const q of quantities) m[q.visit_label] = q;
    return m;
  }, [quantities]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const result = await api.uploadSOA(trialId, file);
      setUploadResult(result);
      await loadAll();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function saveQuantities(updated: TrialQuantity[]) {
    setBusy(true);
    setErr(null);
    try {
      const saved = await api.putQuantities(trialId, updated);
      setQuantities(saved);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function setQty(visit: string, field: "enrolled_count" | "completion_count", value: number) {
    const existing = quantitiesByVisit[visit] || {
      visit_label: visit,
      enrolled_count: 0,
      completion_count: 0,
    };
    const updated: TrialQuantity = { ...existing, [field]: value };
    const all = visitLabels.map((v) =>
      v === visit ? updated : (quantitiesByVisit[v] || { visit_label: v, enrolled_count: 0, completion_count: 0 }),
    );
    setQuantities(all);
  }

  async function fillAll(value: number) {
    const all = visitLabels.map((v) => ({
      visit_label: v,
      enrolled_count: value,
      completion_count: value,
    }));
    await saveQuantities(all);
  }

  async function createRound() {
    const label = prompt("Round label", `Round ${rounds.length + 1}`);
    if (!label) return;
    setBusy(true);
    try {
      const rd = await api.createRound(trialId, { label });
      router.push(`/trials/${trialId}/rounds/${rd.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!trial) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-blue-700 hover:underline">
          ← Back to trials
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{trial.name}</h1>
        <div className="mt-1 text-sm text-slate-600">
          {trial.sponsor && <span>{trial.sponsor}</span>}
          {trial.sponsor && trial.protocol_number && <span className="mx-2">·</span>}
          {trial.protocol_number && <span>Protocol {trial.protocol_number}</span>}
          <span className="mx-2">·</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{trial.status}</span>
        </div>
      </div>

      {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {/* SOA upload */}
      <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Schedule of Activity</h2>
          <label className="cursor-pointer rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            {cells.length === 0 ? "Upload client SOA" : "Replace SOA"}
            <input type="file" accept=".xlsx" onChange={onUpload} className="hidden" disabled={busy} />
          </label>
        </div>
        {cells.length === 0 ? (
          <p className="text-sm text-slate-500">
            Upload the client&apos;s SOA xlsx with X marks indicating which procedures apply at each visit.
          </p>
        ) : (
          <div className="text-sm text-slate-700">
            <span className="font-medium">{cells.length}</span> applicable cells across{" "}
            <span className="font-medium">{visitLabels.length}</span> visits.
          </div>
        )}
        {uploadResult && (
          <div className="mt-3 rounded bg-slate-50 p-3 text-sm">
            <div>
              Parsed {uploadResult.matched_count} cells.{" "}
              {uploadResult.parsed_trial_name && (
                <span className="text-slate-500">
                  (Trial name in file: {uploadResult.parsed_trial_name})
                </span>
              )}
            </div>
            {uploadResult.unmatched_codes.length > 0 && (
              <div className="mt-2">
                <div className="font-medium text-amber-800">
                  {uploadResult.unmatched_codes.length} unmatched code(s):
                </div>
                <ul className="ml-4 list-disc text-slate-700">
                  {uploadResult.unmatched_codes.map((u) => (
                    <li key={u.code}>
                      <code className="rounded bg-white px-1 text-xs">{u.code}</code> — {u.name} ({u.occurrence_count}×)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Quantities */}
      {visitLabels.length > 0 && (
        <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Quantities</h2>
            <div className="flex gap-2">
              <button
                onClick={() => fillAll(100)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                disabled={busy}
              >
                Fill all = 100
              </button>
              <button
                onClick={() => saveQuantities(quantities)}
                className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                disabled={busy}
              >
                Save
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left">
              <tr>
                <th className="px-2 py-2 font-medium">Visit</th>
                <th className="px-2 py-2 font-medium">Enrolled</th>
                <th className="px-2 py-2 font-medium">Completion count</th>
              </tr>
            </thead>
            <tbody>
              {visitLabels.map((v) => {
                const q = quantitiesByVisit[v] || {
                  visit_label: v,
                  enrolled_count: 0,
                  completion_count: 0,
                };
                return (
                  <tr key={v} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-1.5">{v}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={q.enrolled_count}
                        onChange={(e) =>
                          setQty(v, "enrolled_count", Number(e.target.value) || 0)
                        }
                        className="w-24 rounded border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={q.completion_count}
                        onChange={(e) =>
                          setQty(v, "completion_count", Number(e.target.value) || 0)
                        }
                        className="w-24 rounded border border-slate-300 px-2 py-1"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Rounds */}
      <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Budget Rounds</h2>
          <button
            onClick={createRound}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            disabled={busy || cells.length === 0}
          >
            New round
          </button>
        </div>
        {rounds.length === 0 ? (
          <p className="text-sm text-slate-500">
            No rounds yet. {cells.length === 0 ? "Upload a SOA first." : "Create one to start computing the budget."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left">
              <tr>
                <th className="px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Label</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-2 py-1.5">{r.round_number}</td>
                  <td className="px-2 py-1.5">
                    <Link
                      href={`/trials/${trialId}/rounds/${r.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {r.label}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5">
                    {r.is_frozen ? (
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        FROZEN
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        EDITABLE
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
