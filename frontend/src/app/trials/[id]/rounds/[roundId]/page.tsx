"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  api,
  ComputedBudget,
  ComputedFixedFee,
  ComputedProcedureLine,
  fmtMoney,
  Override,
} from "@/lib/api";

export default function RoundDetailPage({
  params,
}: {
  params: { id: string; roundId: string };
}) {
  const trialId = Number(params.id);
  const rid = Number(params.roundId);

  const [comp, setComp] = useState<ComputedBudget | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"summary" | "visits" | "procedures" | "fees">("summary");

  const load = async () => {
    try {
      const [c, ov] = await Promise.all([
        api.computeRound(trialId, rid),
        api.listOverrides(trialId, rid),
      ]);
      setComp(c);
      setOverrides(ov);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialId, rid]);

  async function freeze() {
    if (!confirm("Freeze this round? Overrides will be locked.")) return;
    setBusy(true);
    try {
      await api.freezeRound(trialId, rid);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function overrideFee(fee: ComputedFixedFee) {
    const value = prompt(`Override "${fee.name}" amount`, String(fee.site_amount));
    if (value === null) return;
    const amt = Number(value);
    if (!Number.isFinite(amt)) return alert("Invalid number");
    const reason = prompt("Reason (optional)") || undefined;
    setBusy(true);
    try {
      await api.addOverride(trialId, rid, {
        target_kind: "fixed_fee",
        fixed_fee_id: fee.fixed_fee_id,
        new_amount: amt,
        reason,
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function overrideProc(line: ComputedProcedureLine) {
    const value = prompt(`Override base price for "${line.name}" (${line.code})`, String(line.unit_amc_base));
    if (value === null) return;
    const amt = Number(value);
    if (!Number.isFinite(amt)) return alert("Invalid number");
    const reason = prompt("Reason (optional)") || undefined;
    setBusy(true);
    try {
      await api.addOverride(trialId, rid, {
        target_kind: "procedure_price",
        procedure_id: line.procedure_id,
        new_amc_base_charge: amt,
        reason,
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteOverride(id: number) {
    if (!confirm("Delete this override?")) return;
    setBusy(true);
    try {
      await api.deleteOverride(trialId, rid, id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!comp) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-8">
      <header>
        <Link href={`/trials/${trialId}`} className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
          ← Back to trial
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                {comp.round_label}
              </h1>
              <span className="pill pill-slate">Round {comp.round_number}</span>
              <span className={comp.is_frozen ? "pill pill-blue" : "pill pill-emerald"}>
                {comp.is_frozen ? "FROZEN" : "EDITABLE"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={api.exportFinalBudgetUrl(trialId, rid)} className="btn-secondary">
              Export Final Budget
            </a>
            <a href={api.exportPRAUrl(trialId, rid)} className="btn-secondary">
              Export PRA
            </a>
            {!comp.is_frozen && (
              <button onClick={freeze} disabled={busy} className="btn-primary">
                Freeze round
              </button>
            )}
          </div>
        </div>
      </header>

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{err}</div>}

      {/* Totals strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Procedures" value={fmtMoney(comp.procedures_subtotal)} />
        <Stat label="Site fees" value={fmtMoney(comp.site_fees_subtotal)} />
        <Stat label="Pass-throughs" value={fmtMoney(comp.pass_throughs_subtotal)} />
        <Stat label="Grand total" value={fmtMoney(comp.grand_total)} highlight />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat
          label="Sponsor portion"
          value={fmtMoney(comp.sponsor_grand_total)}
          accent="indigo"
        />
        <Stat
          label="Medicare portion"
          value={fmtMoney(comp.medicare_grand_total)}
          accent="emerald"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 text-sm">
          {(["summary", "visits", "procedures", "fees"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2.5 capitalize transition-colors ${
                tab === t
                  ? "border-indigo-600 font-semibold text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === "summary" && (
        <section className="card p-6">
          <h2 className="section-heading">
            Active overrides{" "}
            <span className="ml-1 text-xs font-normal text-slate-500">({overrides.length})</span>
          </h2>
          {overrides.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No overrides on this round yet.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Target</th>
                    <th className="px-3 py-2 font-medium">New value</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((o) => (
                    <tr key={o.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">
                        {o.target_kind === "procedure_price"
                          ? `Procedure #${o.procedure_id}`
                          : `Fixed fee #${o.fixed_fee_id}`}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {o.new_amc_base_charge !== null && `base = ${fmtMoney(o.new_amc_base_charge)}`}
                        {o.new_overhead_pct !== null && ` OH = ${(o.new_overhead_pct * 100).toFixed(1)}%`}
                        {o.new_amount !== null && fmtMoney(o.new_amount)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{o.reason || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {!comp.is_frozen && (
                          <button
                            onClick={() => deleteOverride(o.id)}
                            className="text-xs font-medium text-red-700 hover:text-red-900"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "visits" && (
        <section className="card p-6">
          <h2 className="section-heading mb-4">Per-visit costs</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Visit</th>
                  <th className="px-3 py-2 font-medium">Lines</th>
                  <th className="px-3 py-2 font-medium">Completion</th>
                  <th className="px-3 py-2 text-right font-medium">Visit total</th>
                  <th className="px-3 py-2 text-right font-medium">Sponsor</th>
                  <th className="px-3 py-2 text-right font-medium">Medicare</th>
                </tr>
              </thead>
              <tbody>
                {comp.visits.map((v) => (
                  <tr
                    key={v.visit_label}
                    className="border-t border-slate-100 transition-colors hover:bg-slate-50/40"
                  >
                    <td className="px-3 py-2 text-slate-700">{v.visit_label}</td>
                    <td className="px-3 py-2 text-slate-500">{v.line_count}</td>
                    <td className="px-3 py-2 text-slate-700">{v.completion_count}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900">
                      {fmtMoney(v.visit_total)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-indigo-700">
                      {fmtMoney(v.sponsor_total)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {fmtMoney(v.medicare_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "procedures" && (
        <section className="card p-6">
          <h2 className="section-heading mb-4">
            Procedure lines{" "}
            <span className="ml-1 text-xs font-normal text-slate-500">
              ({comp.procedure_lines.length})
            </span>
          </h2>
          <div className="max-h-[600px] overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95 text-left text-xs uppercase tracking-wide text-slate-500 backdrop-blur">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Procedure</th>
                  <th className="px-3 py-2 font-medium">Visit</th>
                  <th className="px-3 py-2 text-right font-medium">Unit (incl. OH)</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Line total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {comp.procedure_lines.map((line, i) => (
                  <tr
                    key={`${line.procedure_id}-${line.visit_label}-${i}`}
                    className={`border-t border-slate-100 transition-colors ${
                      line.overridden ? "bg-amber-50/60" : "hover:bg-slate-50/40"
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-700">{line.code}</td>
                    <td className="px-3 py-1.5">
                      <span className="text-slate-800">{line.name}</span>
                      {line.overridden && <span className="ml-2 pill pill-amber">override</span>}
                    </td>
                    <td className="px-3 py-1.5 text-slate-500">{line.visit_label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {fmtMoney(line.unit_total_with_oh)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                      {line.completion_count}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums text-slate-900">
                      {fmtMoney(line.line_total)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {!comp.is_frozen && (
                        <button
                          onClick={() => overrideProc(line)}
                          className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                        >
                          Override
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "fees" && (
        <section className="space-y-6">
          <FeeTable title="Site fees" fees={comp.site_fees} onOverride={overrideFee} editable={!comp.is_frozen} />
          <FeeTable title="Pass-through costs" fees={comp.pass_throughs} onOverride={overrideFee} editable={!comp.is_frozen} />
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accent?: "indigo" | "emerald";
}) {
  if (highlight) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-md ring-1 ring-slate-700">
        <div className="text-xs uppercase tracking-wide text-slate-300">{label}</div>
        <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
      </div>
    );
  }
  const accentBar =
    accent === "indigo"
      ? "before:bg-indigo-500"
      : accent === "emerald"
      ? "before:bg-emerald-500"
      : "before:bg-slate-300";
  return (
    <div
      className={`relative rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm overflow-hidden before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${accentBar}`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function FeeTable({
  title,
  fees,
  onOverride,
  editable,
}: {
  title: string;
  fees: ComputedFixedFee[];
  onOverride: (f: ComputedFixedFee) => void;
  editable: boolean;
}) {
  return (
    <div className="card p-6">
      <h3 className="section-heading mb-3">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Fee</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Frequency</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fees.map((f) => (
              <tr
                key={f.fixed_fee_id}
                className={`border-t border-slate-100 transition-colors ${
                  f.overridden ? "bg-amber-50/60" : "hover:bg-slate-50/40"
                }`}
              >
                <td className="px-3 py-1.5">
                  <span className="text-slate-800">{f.name}</span>
                  {f.overridden && <span className="ml-2 pill pill-amber">override</span>}
                </td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums text-slate-900">
                  {fmtMoney(f.site_amount)}
                </td>
                <td className="px-3 py-1.5 text-slate-600">{f.frequency}</td>
                <td className="px-3 py-1.5 text-right">
                  {editable && (
                    <button
                      onClick={() => onOverride(f)}
                      className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                    >
                      Override
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
