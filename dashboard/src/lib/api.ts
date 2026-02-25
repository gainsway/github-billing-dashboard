import { type DateRange } from "./dateRange";

export type CopilotMetricsUserRow = {
  day: string;
  user_login: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  totals_by_language_model?: Array<{
    language: string;
    model: string;
    code_generation_activity_count: number;
    code_acceptance_activity_count: number;
  }>;
  totals_by_model_feature?: Array<{
    model: string;
    feature: string;
    user_initiated_interaction_count: number;
    code_generation_activity_count: number;
    code_acceptance_activity_count: number;
  }>;
};

export type CopilotMetricsUsersResponse = {
  org: string;
  report_start_day: string;
  report_end_day: string;
  rows: CopilotMetricsUserRow[];
  notes?: string[];
};

export type BillingPremiumResponse = {
  organization?: string;
  usageItems?: Array<{
    model?: string;
    netQuantity?: number;
    netAmount?: number;
  }>;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function qsRange(range: DateRange) {
  const q = new URLSearchParams();
  q.set("since", range.since);
  q.set("until", range.until);
  return q.toString();
}

export async function fetchCopilotUsersMetrics(org: string, range: DateRange) {
  const q = qsRange(range);
  return await getJson<CopilotMetricsUsersResponse>(
    `/api/copilot/metrics/users?org=${encodeURIComponent(org)}&${q}`
  );
}

export async function fetchBillingPremium(org: string, year: number, month: number) {
  return await getJson<BillingPremiumResponse>(
    `/api/billing/premium-request/org/${encodeURIComponent(org)}?year=${year}&month=${month}`
  );
}
