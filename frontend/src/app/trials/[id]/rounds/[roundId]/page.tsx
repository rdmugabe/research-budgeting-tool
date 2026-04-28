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
    <div className="space-y-6">
      <div>
        <Link href={`/trials/${trialId}`} className="text-sm text-blue-700 hover:underline">
          ← Back to trial
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Round {comp.round_number}: {comp.round_label}
            </h1>
            <div className="mt-1 text-sm">
              {comp.is_frozen ? (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  FROZEN
                </span>
              ) : (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  EDITABLE
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={api.exportFinalBudgetUrl(trialId, rid)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              Export Final Budget
            </a>
            <a
              href={api.exportPRAUrl(trialId, rid)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              Export PRA
            </a>
            {!comp.is_frozen && (
              <button
                onClick={freeze}
                disabled={busy}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                Freeze round
              </button>
            )}
          </div>
        </div>
      </div>

      {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {/* Totals strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Procedures" value={fmtMoney(comp.procedures_subtotal)} />
        <Stat label="Site fees" value={fmtMoney(comp.site_fees_subtotal)} />
        <Stat label="Pass-throughs" value={fmtMoney(comp.pass_throughs_subtotal)} />
        <Stat label="Grand total" value={fmtMoney(comp.grand_total)} highlight />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <Stat label="Sponsor" value={fmtMoney(comp.sponsor_grand_total)} />
        <Stat label="Medicare" value={fmtMoney(comp.medicare_grand_total)} />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4 text-sm">
          {(["summary", "visits", "procedures", "fees"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-1 py-2 capitalize ${
                tab === t ? "border-slate-900 font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === "summary" && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Active overrides ({overrides.length})</h2>
          {overrides.length === 0 ? (
            <p className="text-sm text-slate-500">No overrides on this round yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left">
                <tr>
                  <th className="px-2 py-2 font-medium">Target</th>
                  <th className="px-2 py-2 font-medium">New value</th>
                  <th className="px-2 py-2 font-medium">Reason</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-1.5">
                      {o.target_kind === "procedure_price"
                        ? `Procedure #${o.procedure_id}`
                        : `Fixed fee #${o.fixed_fee_id}`}
                    </td>
                    <td className="px-2 py-1.5">
                      {o.new_amc_base_charge !== null && `base = ${fmtMoney(o.new_amc_base_charge)}`}
                      {o.new_overhead_pct !== null && ` OH = ${(o.new_overhead_pct * 100).toFixed(1)}%`}
                      {o.new_amount !== null && fmtMoney(o.new_amount)}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">{o.reason || "—"}</td>
                    <td className="px-2 py-1.5">
                      {!comp.is_frozen && (
                        <button
                          onClick={() => deleteOverride(o.id)}
                          className="text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === "visits" && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Per-visit costs</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left">
              <tr>
                <th className="px-2 py-2 font-medium">Visit</th>
                <th className="px-2 py-2 font-medium">Lines</th>
                <th className="px-2 py-2 font-medium">Completion</th>
                <th className="px-2 py-2 text-right font-medium">Visit total</th>
                <th className="px-2 py-2 text-right font-medium">Sponsor</th>
                <th className="px-2 py-2 text-right font-medium">Medicare</th>
              </tr>
            </thead>
            <tbody>
              {comp.visits.map((v) => (
                <tr key={v.visit_label} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1.5">{v.visit_label}</td>
                  <td className="px-2 py-1.5">{v.line_count}</td>
                  <td className="px-2 py-1.5">{v.completion_count}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(v.visit_total)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                    {fmtMoney(v.sponsor_total)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                    {fmtMoney(v.medicare_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "procedures" && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Procedure lines ({comp.procedure_lines.length})</h2>
          <div className="max-h-[600px] overflow-y-auto rounded border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-left">
                <tr>
                  <th className="px-2 py-2 font-medium">Code</th>
                  <th className="px-2 py-2 font-medium">Procedure</th>
                  <th className="px-2 py-2 font-medium">Visit</th>
                  <th className="px-2 py-2 text-right font-medium">Unit (incl. OH)</th>
                  <th className="px-2 py-2 text-right font-medium">Qty</th>
                  <th className="px-2 py-2 text-right font-medium">Line total</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {comp.procedure_lines.map((line, i) => (
                  <tr
                    key={`${line.procedure_id}-${line.visit_label}-${i}`}
                    className={`border-b border-slate-100 last:border-0 ${line.overridden ? "bg-amber-50" : ""}`}
                  >
                    <td className="px-2 py-1.5 font-mono text-xs">{line.code}</td>
                    <td className="px-2 py-1.5">
                      {line.name}
                      {line.overridden && (
                        <span className="ml-1 rounded bg-amber-200 px-1 text-xs">override</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">{line.visit_label}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {fmtMoney(line.unit_total_with_oh)}
                    </td>
                    <td className="px-2 py-1.5 text-right">{line.completion_count}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(line.line_total)}</td>
                    <td className="px-2 py-1.5 text-right">
                      {!comp.is_frozen && (
                        <button
                          onClick={() => overrideProc(line)}
                          className="text-xs text-blue-700 hover:underline"
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

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded border p-4 ${
        highlight ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"
      }`}
    >
      <div className={`text-xs uppercase tracking-wide ${highlight ? "text-slate-300" : "text-slate-500"}`}>
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
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
    <div>
      <h3 className="mb-2 text-base font-semibold">{title}</h3>
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left">
          <tr>
            <th className="px-2 py-2 font-medium">Fee</th>
            <th className="px-2 py-2 text-right font-medium">Sponsor proposed</th>
            <th className="px-2 py-2 text-right font-medium">Site amount</th>
            <th className="px-2 py-2 font-medium">Frequency</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {fees.map((f) => (
            <tr
              key={f.fixed_fee_id}
              className={`border-b border-slate-100 last:border-0 ${f.overridden ? "bg-amber-50" : ""}`}
            >
              <td className="px-2 py-1.5">
                {f.name}
                {f.overridden && (
                  <span className="ml-1 rounded bg-amber-200 px-1 text-xs">override</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                {f.sponsor_proposed === null ? "—" : fmtMoney(f.sponsor_proposed)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(f.site_amount)}</td>
              <td className="px-2 py-1.5 text-slate-600">{f.frequency}</td>
              <td className="px-2 py-1.5 text-right">
                {editable && (
                  <button
                    onClick={() => onOverride(f)}
                    className="text-xs text-blue-700 hover:underline"
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
  );
}
