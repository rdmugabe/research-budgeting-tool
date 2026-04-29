// Thin client for the FastAPI backend. Server URL comes from NEXT_PUBLIC_API_URL.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "rbt_token";

export const auth = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string | null) {
    if (typeof window === "undefined") return;
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  },
};

function authHeader(): Record<string, string> {
  const t = auth.getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401 && typeof window !== "undefined") {
    auth.setToken(null);
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
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

export interface ProcedureWithPrice {
  id: number;
  code: string;
  name: string;
  category: string | null;
  coverage_status: CoverageStatus;
  cpt_code: string | null;
  price: {
    medicare_rate: number | null;
    amc_base_charge: number;
    overhead_pct: number;
    excluded_from_oh: boolean;
    sponsor_share: number;
    medicare_share: number;
    total_with_oh: number;
  };
}

export interface PriceMasterVersionDetail extends PriceMasterVersion {
  procedures: ProcedureWithPrice[];
}

export interface ProcedureWriteBody {
  code: string;
  name: string;
  category?: string | null;
  coverage_status: CoverageStatus;
  cpt_code?: string | null;
  medicare_rate?: number | null;
  amc_base_charge: number;
  overhead_pct: number;
  excluded_from_oh: boolean;
  sponsor_share: number;
  medicare_share: number;
}

export interface FixedFee {
  id: number;
  template_id: number;
  name: string;
  kind: "SITE_FEE" | "PASS_THROUGH";
  sponsor_proposed: number | null;
  site_default: number;
  frequency: string;
  sort_order: number;
}

export interface FixedFeeTemplate {
  id: number;
  label: string;
  effective_date: string;
  is_published: boolean;
  notes: string | null;
  created_at: string;
}

export interface FixedFeeTemplateDetail extends FixedFeeTemplate {
  fees: FixedFee[];
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

export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
  role: "ADMIN" | "ANALYST" | "VIEWER";
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  register: (body: { email: string; password: string; full_name?: string }) =>
    request<TokenResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request<AuthUser>("/auth/me"),

  listVersions: () => request<PriceMasterVersion[]>("/price-master/versions"),
  getVersion: (id: number) =>
    request<PriceMasterVersionDetail>(`/price-master/versions/${id}`),
  createVersion: (body: { label: string; clone_from_version_id?: number; notes?: string }) =>
    request<PriceMasterVersionDetail>("/price-master/versions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  publishVersion: (id: number) =>
    request<PriceMasterVersion>(`/price-master/versions/${id}/publish`, { method: "POST" }),
  updateProcedure: (versionId: number, procedureId: number, body: ProcedureWriteBody) =>
    request<ProcedureWithPrice>(
      `/price-master/versions/${versionId}/procedures/${procedureId}`,
      { method: "PUT", body: JSON.stringify(body) },
    ),
  addProcedure: (versionId: number, body: ProcedureWriteBody) =>
    request<ProcedureWithPrice>(`/price-master/versions/${versionId}/procedures`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteProcedure: (versionId: number, procedureId: number) =>
    request<{ deleted: number }>(
      `/price-master/versions/${versionId}/procedures/${procedureId}`,
      { method: "DELETE" },
    ),
  listFixedFeeTemplates: () =>
    request<FixedFeeTemplate[]>("/price-master/fixed-fee-templates"),
  getFixedFeeTemplate: (id: number) =>
    request<FixedFeeTemplateDetail>(`/price-master/fixed-fee-templates/${id}`),
  updateFixedFee: (templateId: number, feeId: number, body: Omit<FixedFee, "id" | "template_id">) =>
    request<FixedFee>(
      `/price-master/fixed-fee-templates/${templateId}/fees/${feeId}`,
      { method: "PUT", body: JSON.stringify(body) },
    ),

  listTrials: () => request<Trial[]>("/trials"),
  getTrial: (id: number) => request<Trial>(`/trials/${id}`),
  createTrial: (body: { name: string; sponsor?: string; protocol_number?: string }) =>
    request<Trial>("/trials", { method: "POST", body: JSON.stringify(body) }),

  uploadSOA: async (trialId: number, file: File): Promise<SOAUploadResult> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/trials/${trialId}/soa`, {
      method: "POST",
      body: fd,
      headers: { ...authHeader() },
    });
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

  listAudit: (params?: { entity_type?: string; entity_id?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.entity_id !== undefined) sp.set("entity_id", String(params.entity_id));
    if (params?.limit !== undefined) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    return request<AuditLogEntry[]>(`/audit${qs ? `?${qs}` : ""}`);
  },
};

export interface AuditLogEntry {
  id: number;
  created_at: string;
  user_id: number | null;
  entity_type: string;
  entity_id: number | null;
  action: string;
  details: string | null;
}

export const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
