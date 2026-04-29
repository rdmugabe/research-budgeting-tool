"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  api,
  CoverageStatus,
  fmtMoney,
  PriceMasterVersionDetail,
  ProcedureWithPrice,
  ProcedureWriteBody,
} from "@/lib/api";

const COVERAGE_OPTS: CoverageStatus[] = ["QCT_COVERED", "RESEARCH_REQUIRED", "SHARED"];

export default function PriceMasterDetail({ params }: { params: { id: string } }) {
  const versionId = Number(params.id);
  const [version, setVersion] = useState<PriceMasterVersionDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProcedureWithPrice | null>(null);

  const load = () => {
    api.getVersion(versionId).then(setVersion).catch((e: Error) => setErr(e.message));
  };
  useEffect(load, [versionId]);

  const filtered = useMemo(() => {
    if (!version) return [];
    const q = filter.toLowerCase();
    if (!q) return version.procedures;
    return version.procedures.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q),
    );
  }, [version, filter]);

  function startEdit(p: ProcedureWithPrice) {
    setEditing(p.id);
    setDraft({ ...p, price: { ...p.price } });
  }
  function cancelEdit() {
    setEditing(null);
    setDraft(null);
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setErr(null);
    try {
      const body: ProcedureWriteBody = {
        code: draft.code,
        name: draft.name,
        category: draft.category,
        coverage_status: draft.coverage_status,
        cpt_code: draft.cpt_code,
        medicare_rate: draft.price.medicare_rate,
        amc_base_charge: draft.price.amc_base_charge,
        overhead_pct: draft.price.overhead_pct,
        excluded_from_oh: draft.price.excluded_from_oh,
        sponsor_share: draft.price.sponsor_share,
        medicare_share: draft.price.medicare_share,
      };
      await api.updateProcedure(versionId, draft.id, body);
      cancelEdit();
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!confirm("Publish this version? Once published, prices are locked.")) return;
    setBusy(true);
    try {
      await api.publishVersion(versionId);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!version) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/price-master" className="text-sm text-blue-700 hover:underline">
          ← Versions
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{version.label}</h1>
            <div className="mt-1 text-sm text-slate-600">
              Effective {version.effective_date}
              <span className="mx-2">·</span>
              {version.is_published ? (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  PUBLISHED
                </span>
              ) : (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  DRAFT
                </span>
              )}
            </div>
          </div>
          {!version.is_published && (
            <button
              onClick={publish}
              disabled={busy}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Publish version
            </button>
          )}
        </div>
      </div>

      {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <input
        type="text"
        placeholder="Filter by code, name, or category…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />

      <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-2 py-2 font-medium">Code</th>
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">Category</th>
              <th className="px-2 py-2 font-medium">Coverage</th>
              <th className="px-2 py-2 text-right font-medium">AMC Base</th>
              <th className="px-2 py-2 text-right font-medium">OH%</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="px-2 py-2 text-right font-medium">Sp/Med</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isEdit = editing === p.id && draft;
              if (isEdit && draft) {
                return (
                  <tr key={p.id} className="border-b border-slate-100 bg-amber-50">
                    <td className="px-2 py-1.5">
                      <input
                        value={draft.code}
                        onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                        className="w-24 rounded border border-slate-300 px-1.5 py-1 font-mono text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={draft.category || ""}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                        className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={draft.coverage_status}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            coverage_status: e.target.value as CoverageStatus,
                          })
                        }
                        className="rounded border border-slate-300 px-1.5 py-1 text-xs"
                      >
                        {COVERAGE_OPTS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={draft.price.amc_base_charge}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            price: {
                              ...draft.price,
                              amc_base_charge: Number(e.target.value),
                            },
                          })
                        }
                        className="w-24 rounded border border-slate-300 px-1.5 py-1 text-right text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={draft.price.overhead_pct}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            price: { ...draft.price, overhead_pct: Number(e.target.value) },
                          })
                        }
                        className="w-16 rounded border border-slate-300 px-1.5 py-1 text-right text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                      {fmtMoney(
                        draft.price.excluded_from_oh
                          ? draft.price.amc_base_charge
                          : draft.price.amc_base_charge * (1 + draft.price.overhead_pct),
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={1}
                        value={draft.price.sponsor_share}
                        onChange={(e) => {
                          const sp = Number(e.target.value);
                          setDraft({
                            ...draft,
                            price: {
                              ...draft.price,
                              sponsor_share: sp,
                              medicare_share: 1 - sp,
                            },
                          });
                        }}
                        className="w-14 rounded border border-slate-300 px-1.5 py-1 text-right text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={save}
                        disabled={busy}
                        className="mr-2 text-xs font-medium text-emerald-700 hover:underline"
                      >
                        Save
                      </button>
                      <button onClick={cancelEdit} className="text-xs text-slate-500 hover:underline">
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-2 py-1.5 font-mono text-xs">{p.code}</td>
                  <td className="px-2 py-1.5">{p.name}</td>
                  <td className="px-2 py-1.5 text-slate-600">{p.category || "—"}</td>
                  <td className="px-2 py-1.5">
                    <span className="text-xs text-slate-700">{p.coverage_status}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {fmtMoney(p.price.amc_base_charge)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                    {(p.price.overhead_pct * 100).toFixed(0)}%
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {fmtMoney(p.price.total_with_oh)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                    {(p.price.sponsor_share * 100).toFixed(0)}/
                    {(p.price.medicare_share * 100).toFixed(0)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {!version.is_published && (
                      <button
                        onClick={() => startEdit(p)}
                        className="text-xs text-blue-700 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="text-sm text-slate-500">No procedures match.</div>
      )}
    </div>
  );
}
