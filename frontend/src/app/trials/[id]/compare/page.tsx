"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, BudgetRound, ComputedBudget, fmtMoney } from "@/lib/api";

export default function CompareRoundsPage({ params }: { params: { id: string } }) {
  const trialId = Number(params.id);

  const [rounds, setRounds] = useState<BudgetRound[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [computed, setComputed] = useState<Record<number, ComputedBudget>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .listRounds(trialId)
      .then((rs) => {
        setRounds(rs);
        setSelected(rs.slice(0, 2).map((r) => r.id));
      })
      .catch((e: Error) => setErr(e.message));
  }, [trialId]);

  useEffect(() => {
    if (selected.length === 0) {
      setComputed({});
      return;
    }
    setLoading(true);
    setErr(null);
    Promise.all(selected.map((rid) => api.computeRound(trialId, rid)))
      .then((results) => {
        const map: Record<number, ComputedBudget> = {};
        results.forEach((c) => {
          map[c.round_id] = c;
        });
        setComputed(map);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [trialId, selected]);

  function toggle(roundId: number) {
    setSelected((s) =>
      s.includes(roundId) ? s.filter((x) => x !== roundId) : [...s, roundId],
    );
  }

  const orderedSelected = useMemo(
    () => selected.map((id) => computed[id]).filter((c): c is ComputedBudget => Boolean(c)),
    [selected, computed],
  );

  // Union of visit labels and fixed-fee ids, preserving the order from the first round.
  const visitLabels = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of orderedSelected) {
      for (const v of c.visits) {
        if (!seen.has(v.visit_label)) {
          seen.add(v.visit_label);
          out.push(v.visit_label);
        }
      }
    }
    return out;
  }, [orderedSelected]);

  const siteFees = useMemo(() => {
    const seen = new Set<number>();
    const out: { id: number; name: string }[] = [];
    for (const c of orderedSelected) {
      for (const f of c.site_fees) {
        if (!seen.has(f.fixed_fee_id)) {
          seen.add(f.fixed_fee_id);
          out.push({ id: f.fixed_fee_id, name: f.name });
        }
      }
    }
    return out;
  }, [orderedSelected]);

  const passThroughs = useMemo(() => {
    const seen = new Set<number>();
    const out: { id: number; name: string }[] = [];
    for (const c of orderedSelected) {
      for (const f of c.pass_throughs) {
        if (!seen.has(f.fixed_fee_id)) {
          seen.add(f.fixed_fee_id);
          out.push({ id: f.fixed_fee_id, name: f.name });
        }
      }
    }
    return out;
  }, [orderedSelected]);

  return (
    <div className="space-y-8">
      <header>
        <Link href={`/trials/${trialId}`} className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
          ← Back to trial
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Compare rounds</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick two or more rounds to see how the budget changes across negotiation steps.
        </p>
      </header>

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{err}</div>}

      <section className="card p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Rounds</div>
        <div className="flex flex-wrap gap-2">
          {rounds.length === 0 ? (
            <span className="text-sm text-slate-500">No rounds on this trial yet.</span>
          ) : (
            rounds.map((r) => {
              const on = selected.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    on
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  R{r.round_number}: {r.label}
                  {r.is_frozen && <span className="ml-1 text-xs opacity-70">(frozen)</span>}
                </button>
              );
            })
          )}
        </div>
      </section>

      {loading && <div className="text-sm text-slate-500">Computing…</div>}

      {orderedSelected.length > 0 && (
        <>
          {/* Totals comparison */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Totals</h2>
            <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Metric</th>
                    {orderedSelected.map((c) => (
                      <th key={c.round_id} className="px-3 py-2 text-right font-medium">
                        R{c.round_number}: {c.round_label}
                      </th>
                    ))}
                    {orderedSelected.length >= 2 && (
                      <th className="px-3 py-2 text-right font-medium text-slate-700">Δ first→last</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Procedures", "procedures_subtotal"],
                      ["Site fees", "site_fees_subtotal"],
                      ["Pass-throughs", "pass_throughs_subtotal"],
                      ["Sponsor portion", "sponsor_grand_total"],
                      ["Medicare portion", "medicare_grand_total"],
                      ["Grand total", "grand_total"],
                    ] as const
                  ).map(([label, field]) => {
                    const first = orderedSelected[0][field];
                    const last = orderedSelected[orderedSelected.length - 1][field];
                    const delta = last - first;
                    const isGrand = field === "grand_total";
                    return (
                      <tr
                        key={field}
                        className={`border-b border-slate-100 last:border-0 ${
                          isGrand ? "bg-slate-50 font-medium" : ""
                        }`}
                      >
                        <td className="px-3 py-2">{label}</td>
                        {orderedSelected.map((c) => (
                          <td
                            key={c.round_id}
                            className="px-3 py-2 text-right tabular-nums"
                          >
                            {fmtMoney(c[field])}
                          </td>
                        ))}
                        {orderedSelected.length >= 2 && (
                          <td
                            className={`px-3 py-2 text-right tabular-nums ${
                              delta > 0 ? "text-emerald-700" : delta < 0 ? "text-red-700" : "text-slate-500"
                            }`}
                          >
                            {delta > 0 ? "+" : ""}
                            {fmtMoney(delta)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Per-visit comparison */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Per-visit totals</h2>
            <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Visit</th>
                    {orderedSelected.map((c) => (
                      <th key={c.round_id} className="px-3 py-2 text-right font-medium">
                        R{c.round_number}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visitLabels.map((vl) => {
                    const values = orderedSelected.map(
                      (c) => c.visits.find((v) => v.visit_label === vl)?.visit_total ?? 0,
                    );
                    return (
                      <tr key={vl} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2">{vl}</td>
                        {values.map((val, i) => (
                          <td
                            key={i}
                            className="px-3 py-2 text-right tabular-nums"
                          >
                            {fmtMoney(val)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Site fees comparison */}
          <FeeComparison
            title="Site fees"
            fees={siteFees}
            rounds={orderedSelected}
            kind="site_fees"
          />
          <FeeComparison
            title="Pass-throughs"
            fees={passThroughs}
            rounds={orderedSelected}
            kind="pass_throughs"
          />
        </>
      )}
    </div>
  );
}

function FeeComparison({
  title,
  fees,
  rounds,
  kind,
}: {
  title: string;
  fees: { id: number; name: string }[];
  rounds: ComputedBudget[];
  kind: "site_fees" | "pass_throughs";
}) {
  if (fees.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Fee</th>
              {rounds.map((c) => (
                <th key={c.round_id} className="px-3 py-2 text-right font-medium">
                  R{c.round_number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fees.map((f) => (
              <tr key={f.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2">{f.name}</td>
                {rounds.map((c) => {
                  const fee = c[kind].find((x) => x.fixed_fee_id === f.id);
                  return (
                    <td
                      key={c.round_id}
                      className={`px-3 py-2 text-right tabular-nums ${
                        fee?.overridden ? "bg-amber-50 font-medium" : ""
                      }`}
                    >
                      {fee ? fmtMoney(fee.site_amount) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
