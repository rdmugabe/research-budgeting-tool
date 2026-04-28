// Thin client for the FastAPI backend. Server URL comes from NEXT_PUBLIC_API_URL.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) message = `${message}: ${body.detail}`;
    } catch {}
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// --- Types ---

export type CoverageStatus = "QCT_COVERED" | "RESEARCH_REQUIRED" | "SHARED";

export interface PriceMasterVersion {
  id: number;
  label: string;
  effective_date: string;
  is_published: boolean;
  notes: string | null;
  created_at: string;
}

export interface Trial {
  id: number;
  name: string;
  sponsor: string | null;
  protocol_number: string | null;
  status: "DRAFT" | "NEGOTIATING" | "AWARDED" | "ARCHIVED";
  price_master_version_id: number;
  fixed_fee_template_id: number;
  created_at: string;
  updated_at: string;
}

export interface SOACell {
  id: number;
  procedure_id: number;
  visit_label: string;
}

export interface SOAUploadResult {
  trial_id: number;
  parsed_trial_name: string | null;
  matched_count: number;
  unmatched_codes: { code: string; name: string; occurrence_count: number }[];
  cells: SOACell[];
}

export interface TrialQuantity {
  id?: number;
  visit_label: string;
  enrolled_count: number;
  completion_count: number;
}

export interface BudgetRound {
  id: number;
  trial_id: number;
  round_number: number;
  label: string;
  notes: string | null;
  is_frozen: boolean;
  created_at: string;
}

export interface Override {
  id: number;
  round_id: number;
  target_kind: "procedure_price" | "fixed_fee";
  procedure_id: number | null;
  fixed_fee_id: number | null;
  new_amc_base_charge: number | null;
  new_overhead_pct: number | null;
  new_amount: number | null;
  reason: string | null;
}

export interface ComputedProcedureLine {
  procedure_id: number;
  code: string;
  name: string;
  category: string | null;
  coverage_status: CoverageStatus;
  visit_label: string;
  unit_amc_base: number;
  unit_overhead_pct: number;
  unit_total_with_oh: number;
  completion_count: number;
  line_total: number;
  sponsor_portion: number;
  medicare_portion: number;
  overridden: boolean;
}

export interface ComputedVisit {
  visit_label: string;
  enrolled_count: number;
  completion_count: number;
  line_count: number;
  visit_total: number;
  sponsor_total: number;
  medicare_total: number;
}

export interface ComputedFixedFee {
  fixed_fee_id: number;
  name: string;
  kind: "SITE_FEE" | "PASS_THROUGH";
  sponsor_proposed: number | null;
  site_amount: number;
  frequency: string;
  overridden: boolean;
}

export interface ComputedBudget {
  trial_id: number;
  round_id: number;
  round_label: string;
  round_number: number;
  is_frozen: boolean;
  visits: ComputedVisit[];
  procedure_lines: ComputedProcedureLine[];
  site_fees: ComputedFixedFee[];
  pass_throughs: ComputedFixedFee[];
  procedures_subtotal: number;
  site_fees_subtotal: number;
  pass_throughs_subtotal: number;
  grand_total: number;
  sponsor_grand_total: number;
  medicare_grand_total: number;
}

// --- API ---

export const api = {
  health: () => request<{ status: string }>("/health"),

  listVersions: () => request<PriceMasterVersion[]>("/price-master/versions"),

  listTrials: () => request<Trial[]>("/trials"),
  getTrial: (id: number) => request<Trial>(`/trials/${id}`),
  createTrial: (body: { name: string; sponsor?: string; protocol_number?: string }) =>
    request<Trial>("/trials", { method: "POST", body: JSON.stringify(body) }),

  uploadSOA: async (trialId: number, file: File): Promise<SOAUploadResult> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/trials/${trialId}/soa`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },
  listSOACells: (trialId: number) => request<SOACell[]>(`/trials/${trialId}/soa`),

  listQuantities: (trialId: number) => request<TrialQuantity[]>(`/trials/${trialId}/quantities`),
  putQuantities: (trialId: number, quantities: TrialQuantity[]) =>
    request<TrialQuantity[]>(`/trials/${trialId}/quantities`, {
      method: "PUT",
      body: JSON.stringify({ quantities }),
    }),

  listRounds: (trialId: number) => request<BudgetRound[]>(`/trials/${trialId}/rounds`),
  createRound: (trialId: number, body: { label: string; notes?: string }) =>
    request<BudgetRound>(`/trials/${trialId}/rounds`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  freezeRound: (trialId: number, roundId: number) =>
    request<BudgetRound>(`/trials/${trialId}/rounds/${roundId}/freeze`, { method: "POST" }),
  computeRound: (trialId: number, roundId: number) =>
    request<ComputedBudget>(`/trials/${trialId}/rounds/${roundId}/compute`),

  listOverrides: (trialId: number, roundId: number) =>
    request<Override[]>(`/trials/${trialId}/rounds/${roundId}/overrides`),
  addOverride: (
    trialId: number,
    roundId: number,
    body: Partial<Override> & { target_kind: "procedure_price" | "fixed_fee" },
  ) =>
    request<Override>(`/trials/${trialId}/rounds/${roundId}/overrides`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteOverride: (trialId: number, roundId: number, overrideId: number) =>
    request<{ deleted: number }>(
      `/trials/${trialId}/rounds/${roundId}/overrides/${overrideId}`,
      { method: "DELETE" },
    ),

  exportFinalBudgetUrl: (trialId: number, roundId: number) =>
    `${API_URL}/trials/${trialId}/rounds/${roundId}/export/final-budget`,
  exportPRAUrl: (trialId: number, roundId: number) =>
    `${API_URL}/trials/${trialId}/rounds/${roundId}/export/pra`,
};

export const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
