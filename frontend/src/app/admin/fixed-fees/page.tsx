"use client";

import { useEffect, useState } from "react";
import { api, FixedFee, FixedFeeTemplate, FixedFeeTemplateDetail, fmtMoney } from "@/lib/api";

export default function FixedFeesPage() {
  const [templates, setTemplates] = useState<FixedFeeTemplate[]>([]);
  const [active, setActive] = useState<FixedFeeTemplateDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<FixedFee | null>(null);

  const loadTemplates = () => api.listFixedFeeTemplates().then(setTemplates).catch(handleErr);
  const handleErr = (e: Error) => setErr(e.message);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (templates.length > 0 && !active) {
      api.getFixedFeeTemplate(templates[0].id).then(setActive).catch(handleErr);
    }
  }, [templates, active]);

  const reload = () => active && api.getFixedFeeTemplate(active.id).then(setActive).catch(handleErr);

  function startEdit(f: FixedFee) {
    setEditing(f.id);
    setDraft({ ...f });
  }
  function cancelEdit() {
    setEditing(null);
    setDraft(null);
  }
  async function save() {
    if (!draft || !active) return;
    setBusy(true);
    setErr(null);
    try {
      await api.updateFixedFee(active.id, draft.id, {
        name: draft.name,
        kind: draft.kind,
        sponsor_proposed: draft.sponsor_proposed,
        site_default: draft.site_default,
        frequency: draft.frequency,
        sort_order: draft.sort_order,
      });
      cancelEdit();
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!active) return <div className="text-sm text-slate-500">Loading…</div>;

  const siteFees = active.fees.filter((f) => f.kind === "SITE_FEE");
  const passThroughs = active.fees.filter((f) => f.kind === "PASS_THROUGH");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Fixed Fees</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
          <span>{active.label}</span>
          <span className={active.is_published ? "pill pill-blue" : "pill pill-emerald"}>
            {active.is_published ? "PUBLISHED" : "DRAFT"}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Standard site fees and pass-throughs added on top of every trial budget.
        </p>
      </header>
      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{err}</div>}

      <FeeTable
        title="Site Fees"
        fees={siteFees}
        editable={!active.is_published}
        editing={editing}
        draft={draft}
        onStart={startEdit}
        onCancel={cancelEdit}
        onSave={save}
        onChange={setDraft}
        busy={busy}
      />
      <FeeTable
        title="Pass-Throughs"
        fees={passThroughs}
        editable={!active.is_published}
        editing={editing}
        draft={draft}
        onStart={startEdit}
        onCancel={cancelEdit}
        onSave={save}
        onChange={setDraft}
        busy={busy}
      />
    </div>
  );
}

function FeeTable({
  title,
  fees,
  editable,
  editing,
  draft,
  onStart,
  onCancel,
  onSave,
  onChange,
  busy,
}: {
  title: string;
  fees: FixedFee[];
  editable: boolean;
  editing: number | null;
  draft: FixedFee | null;
  onStart: (f: FixedFee) => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (f: FixedFee) => void;
  busy: boolean;
}) {
  return (
    <div className="card p-6">
      <h2 className="section-heading mb-3">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Frequency</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fees.map((f) => {
              const isEdit = editing === f.id && draft;
              if (isEdit && draft) {
                return (
                  <tr key={f.id} className="border-b border-slate-100 bg-amber-50">
                    <td className="px-3 py-1.5">
                      <input
                        value={draft.name}
                        onChange={(e) => onChange({ ...draft, name: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={draft.site_default}
                        onChange={(e) =>
                          onChange({ ...draft, site_default: Number(e.target.value) })
                        }
                        className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={draft.frequency}
                        onChange={(e) => onChange({ ...draft, frequency: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        onClick={onSave}
                        disabled={busy}
                        className="mr-2 text-xs font-medium text-emerald-700 hover:underline"
                      >
                        Save
                      </button>
                      <button onClick={onCancel} className="text-xs text-slate-500 hover:underline">
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={f.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/40">
                  <td className="px-3 py-1.5 text-slate-800">{f.name}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums text-slate-900">{fmtMoney(f.site_default)}</td>
                  <td className="px-3 py-1.5 text-slate-600">{f.frequency}</td>
                  <td className="px-3 py-1.5 text-right">
                    {editable && (
                      <button
                        onClick={() => onStart(f)}
                        className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
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
    </div>
  );
}
