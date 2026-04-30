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
  const [startCount, setStartCount] = useState(100);
  const [dropoutPct, setDropoutPct] = useState(2);
  const [screenFailPct, setScreenFailPct] = useState(30);
  const [randVisit, setRandVisit] = useState<string>("");

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

  // Preserve the order visits first appear in the uploaded SOA (chronological).
  // SOA cells come back ordered by insertion id, so a single pass is enough.
  const visitLabels = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of cells) {
      if (!seen.has(c.visit_label)) {
        seen.add(c.visit_label);
        out.push(c.visit_label);
      }
    }
    return out;
  }, [cells]);

  // Default the randomization visit to the first label containing "rand"
  // (case-insensitive); fall back to the first visit if none matches.
  useEffect(() => {
    if (randVisit || visitLabels.length === 0) return;
    const guess = visitLabels.find((v) => /rand/i.test(v)) || visitLabels[0];
    setRandVisit(guess);
  }, [visitLabels, randVisit]);

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

  // Compute per-visit completion using two levers:
  //   * screen-fail rate (sf): inflates pre-randomization visits so that the
  //     post-randomization population still hits `startCount`. Screened count
  //     = round(start / (1 - sf)).
  //   * dropout per visit (r): compounding decay applied to visits AT and
  //     AFTER the randomization visit, indexed from there. Pre-rand visits
  //     all share the screened count (no decay before randomization).
  // Stored in both enrolled_count and completion_count — pricing only uses
  // completion today, but enrolled is kept symmetric for visibility.
  async function applyDropout() {
    if (visitLabels.length === 0) return;
    const r = Math.max(0, Math.min(100, dropoutPct)) / 100;
    const sf = Math.max(0, Math.min(99, screenFailPct)) / 100;
    const randIdx = Math.max(0, visitLabels.indexOf(randVisit));
    const screenedCount = Math.round(startCount / Math.max(0.01, 1 - sf));

    const generated = visitLabels.map((v, i) => {
      let remaining: number;
      if (i < randIdx) {
        remaining = screenedCount;
      } else {
        remaining = Math.round(startCount * Math.pow(1 - r, i - randIdx));
      }
      remaining = Math.max(0, remaining);
      return {
        visit_label: v,
        enrolled_count: remaining,
        completion_count: remaining,
      };
    });
    await saveQuantities(generated);
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

  const STATUS_PILL: Record<typeof trial.status, string> = {
    DRAFT: "pill pill-emerald",
    NEGOTIATING: "pill pill-amber",
    AWARDED: "pill pill-blue",
    ARCHIVED: "pill pill-slate",
  };

  return (
    <div className="space-y-8">
      <header>
        <Link href="/" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
          ← Back to trials
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{trial.name}</h1>
          <span className={STATUS_PILL[trial.status]}>{trial.status}</span>
        </div>
        <div className="mt-1.5 text-sm text-slate-600">
          {trial.sponsor && <span>{trial.sponsor}</span>}
          {trial.sponsor && trial.protocol_number && <span className="mx-2 text-slate-300">·</span>}
          {trial.protocol_number && <span>Protocol {trial.protocol_number}</span>}
        </div>
      </header>

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{err}</div>}

      {/* SOA upload */}
      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="section-heading">Schedule of Activity</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Client&apos;s SOA xlsx — X marks where each procedure applies per visit.
            </p>
          </div>
          <label className={`cursor-pointer ${cells.length === 0 ? "btn-primary" : "btn-secondary"}`}>
            {cells.length === 0 ? "Upload client SOA" : "Replace SOA"}
            <input type="file" accept=".xlsx" onChange={onUpload} className="hidden" disabled={busy} />
          </label>
        </div>
        {cells.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
            No SOA uploaded yet.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{cells.length}</span>
              <span className="ml-1.5 text-slate-500">applicable cells</span>
            </div>
            <div>
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{visitLabels.length}</span>
              <span className="ml-1.5 text-slate-500">visits</span>
            </div>
          </div>
        )}
        {uploadResult && (
          <div className="mt-4 rounded-lg bg-indigo-50/50 p-3 text-sm ring-1 ring-indigo-100">
            <div className="text-slate-700">
              Parsed <span className="font-medium">{uploadResult.matched_count}</span> cells
              {uploadResult.parsed_trial_name && (
                <span className="text-slate-500">
                  {" "}(trial name in file: {uploadResult.parsed_trial_name})
                </span>
              )}
              .
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
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="section-heading">Quantities</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Per-visit completion counts drive the procedure roll-up.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fillAll(100)}
                className="btn-secondary"
                disabled={busy}
              >
                Fill all = 100
              </button>
              <button
                onClick={() => saveQuantities(quantities)}
                className="btn-primary"
                disabled={busy}
              >
                Save
              </button>
            </div>
          </div>

          {/* Dropout + screen-fail generator */}
          <div className="mb-5 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-slate-50/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
              Decay generator
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Target post-rand
                </span>
                <input
                  type="number"
                  min={0}
                  value={startCount}
                  onChange={(e) => setStartCount(Number(e.target.value) || 0)}
                  className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Screen fail (%)
                </span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  step={0.5}
                  value={screenFailPct}
                  onChange={(e) => setScreenFailPct(Number(e.target.value) || 0)}
                  className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Randomization visit
                </span>
                <select
                  value={randVisit}
                  onChange={(e) => setRandVisit(e.target.value)}
                  className="max-w-xs rounded-lg border border-slate-300 bg-white px-2 py-1.5 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {visitLabels.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Dropout per visit (%)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={dropoutPct}
                  onChange={(e) => setDropoutPct(Number(e.target.value) || 0)}
                  className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>
              <button
                onClick={applyDropout}
                disabled={busy}
                className="btn-primary"
              >
                Apply
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Pre-randomization visits sized at{" "}
              <code className="rounded bg-white/70 px-1.5 py-0.5 ring-1 ring-slate-200">target / (1 − screen fail)</code>;
              from randomization onward each count decays as{" "}
              <code className="rounded bg-white/70 px-1.5 py-0.5 ring-1 ring-slate-200">round(target × (1 − r)<sup>n</sup>)</code>.
              Fine-tune any cell after applying.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Visit</th>
                  <th className="px-3 py-2 font-medium">Enrolled</th>
                  <th className="px-3 py-2 font-medium">Completion</th>
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
                    <tr key={v} className="border-t border-slate-100 transition-colors hover:bg-slate-50/40">
                      <td className="px-3 py-1.5 text-slate-700">{v}</td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={q.enrolled_count}
                          onChange={(e) =>
                            setQty(v, "enrolled_count", Number(e.target.value) || 0)
                          }
                          className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={q.completion_count}
                          onChange={(e) =>
                            setQty(v, "completion_count", Number(e.target.value) || 0)
                          }
                          className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Rounds */}
      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="section-heading">Budget Rounds</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Negotiation snapshots — freeze one when you send the quote.
            </p>
          </div>
          <div className="flex gap-2">
            {rounds.length >= 2 && (
              <Link href={`/trials/${trialId}/compare`} className="btn-secondary">
                Compare rounds
              </Link>
            )}
            <button
              onClick={createRound}
              className="btn-primary"
              disabled={busy || cells.length === 0}
            >
              New round
            </button>
          </div>
        </div>
        {rounds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
            {cells.length === 0
              ? "Upload a SOA first to enable rounds."
              : "No rounds yet. Create one to compute and export the budget."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-slate-100 transition-colors hover:bg-slate-50/40"
                  >
                    <td className="px-3 py-2 text-slate-500">{r.round_number}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/trials/${trialId}/rounds/${r.id}`}
                        className="font-medium text-indigo-700 hover:text-indigo-900"
                      >
                        {r.label}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className={r.is_frozen ? "pill pill-blue" : "pill pill-emerald"}>
                        {r.is_frozen ? "FROZEN" : "EDITABLE"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
