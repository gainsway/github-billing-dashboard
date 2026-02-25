import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useQuery } from "@tanstack/react-query";
import { DiagnosticShuffler } from "../components/DiagnosticShuffler";
import { TelemetryFeed } from "../components/TelemetryFeed";
import { UserModelUsageGrid } from "../components/UserModelUsageGrid";
import { periodQuery, useConfig } from "../lib/config";
import { lastNDays, monthFromIso, thisMonth, ytd } from "../lib/dateRange";
import {
  buildUserSeries,
  type BillingModelTotals,
  type CopilotUserDayModel
} from "../lib/copilotAttribution";

type OrgMeta = {
  name?: string;
  login: string;
  plan?: { name: string; seats: number; filled_seats: number };
};

type UsageSummary = {
  usageItems?: Array<{
    product?: string;
    sku?: string;
    unitType?: string;
    netQuantity?: number;
    netAmount?: number;
  }>;
};

type PremiumRequestUsage = {
  usageItems?: Array<{
    product?: string;
    sku?: string;
    model?: string;
    unitType?: string;
    netQuantity?: number;
    netAmount?: number;
    grossQuantity?: number;
    grossAmount?: number;
    discountQuantity?: number;
    discountAmount?: number;
    pricePerUnit?: number;
  }>;
};

type AuthStatus = {
  ok: boolean;
  user?: string | null;
  scopes?: string[];
};

type CopilotSeats = {
  total_seats: number;
  seats: Array<{
    assignee?: { login: string; avatar_url?: string };
    plan_type?: string;
    last_activity_at?: string;
    last_activity_editor?: string;
  }>;
};

type CopilotMetricsUsersResponse = {
  org: string;
  report_start_day: string;
  report_end_day: string;
  rows: Array<{
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
  }>;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function money(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function iso(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function Overview() {
  const hero = useRef<HTMLDivElement | null>(null);
  const { org, period, includeUserEndpoints, userLogin } = useConfig();
  const [showAllRows, setShowAllRows] = useState(false);

  // Date range for metrics charts (defaults to last 14 days)
  const [rangeStart, setRangeStart] = useState(() => lastNDays(14).since);
  const [rangeEnd, setRangeEnd] = useState(() => lastNDays(14).until);

  // Chart metric toggle
  const [mode, setMode] = useState<"cost" | "requests">("cost");

  useEffect(() => {
    if (!hero.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        "[data-hero='kicker']",
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 }
      )
        .fromTo(
          "[data-hero='title']",
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9 },
          "-=0.35"
        )
        .fromTo(
          "[data-hero='panel']",
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 },
          "-=0.45"
        )
        .fromTo(
          "[data-hero='below']",
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 },
          "-=0.35"
        );
    }, hero);
    return () => ctx.revert();
  }, [period.year, period.month]);

  const meta = useQuery({
    queryKey: ["org", org],
    queryFn: () => getJson<OrgMeta>(`/api/org/${org}`)
  });

  const auth = useQuery({
    queryKey: ["auth"],
    queryFn: () => getJson<AuthStatus>(`/api/auth/status`)
  });

  const qs = periodQuery(period);

  const usageSummary = useQuery({
    queryKey: ["billing", "usage", "summary", "org", org, period],
    queryFn: () => getJson<UsageSummary>(`/api/billing/usage/summary/org/${org}?${qs}`)
  });

  const premiumOrg = useQuery({
    queryKey: ["billing", "premium-request", "org", org, period],
    queryFn: () => getJson<PremiumRequestUsage>(`/api/billing/premium-request/org/${org}?${qs}`)
  });

  const copilotSeats = useQuery({
    queryKey: ["copilot", "seats", org],
    queryFn: () => getJson<CopilotSeats>(`/api/copilot/seats`)
  });

  const metricsUsers = useQuery({
    queryKey: ["copilot", "metrics", "users", org, rangeStart, rangeEnd],
    queryFn: () =>
      getJson<CopilotMetricsUsersResponse>(
        `/api/copilot/metrics/users?org=${encodeURIComponent(org)}&since=${rangeStart}&until=${rangeEnd}`
      )
  });

  const seats = useMemo(() => {
    const p = meta.data?.plan;
    if (!p) return null;
    return `${p.filled_seats}/${p.seats}`;
  }, [meta.data]);

  const premiumRows = useMemo(() => {
    const items = premiumOrg.data?.usageItems ?? [];
    const byModel = new Map<
      string,
      {
        product: string;
        sku: string;
        model: string;
        unitType: string;
        pricePerUnit: number;
        grossQuantity: number;
        grossAmount: number;
        discountQuantity: number;
        discountAmount: number;
        netQuantity: number;
        netAmount: number;
      }
    >();

    for (const it of items) {
      const model = it.model ?? "(unknown model)";
      const key = `${it.product ?? "?"}::${it.sku ?? "?"}::${model}`;
      const cur = byModel.get(key) ?? {
        product: it.product ?? "—",
        sku: it.sku ?? "—",
        model,
        unitType: it.unitType ?? "—",
        pricePerUnit: it.pricePerUnit ?? 0,
        grossQuantity: 0,
        grossAmount: 0,
        discountQuantity: 0,
        discountAmount: 0,
        netQuantity: 0,
        netAmount: 0
      };

      cur.pricePerUnit = it.pricePerUnit ?? cur.pricePerUnit;
      cur.grossQuantity += it.grossQuantity ?? 0;
      cur.grossAmount += it.grossAmount ?? 0;
      cur.discountQuantity += it.discountQuantity ?? 0;
      cur.discountAmount += it.discountAmount ?? 0;
      cur.netQuantity += it.netQuantity ?? 0;
      cur.netAmount += it.netAmount ?? 0;
      byModel.set(key, cur);
    }

    return Array.from(byModel.values()).sort((a, b) => b.netAmount - a.netAmount);
  }, [premiumOrg.data]);

  const premiumTotals = useMemo(() => {
    const rows = premiumRows;
    const gross = rows.reduce((a, r) => a + r.grossAmount, 0);
    const discount = rows.reduce((a, r) => a + r.discountAmount, 0);
    const net = rows.reduce((a, r) => a + r.netAmount, 0);
    const qty = rows.reduce((a, r) => a + r.netQuantity, 0);

    const discountRate = gross > 0 ? discount / gross : 0;
    const top3 = rows.slice(0, 3);
    const top3Net = top3.reduce((a, r) => a + r.netAmount, 0);
    const concentration = net > 0 ? top3Net / net : 0;

    const netPerReq = qty > 0 ? net / qty : 0;

    return {
      gross,
      discount,
      net,
      qty,
      discountRate,
      concentration,
      modelCount: rows.length,
      netPerReq
    };
  }, [premiumRows]);

  const premiumShuffler = useMemo(() => {
    const top = premiumRows.slice(0, 3);
    return top.map((r) => {
      const dRate = r.grossAmount > 0 ? r.discountAmount / r.grossAmount : 0;
      return {
        label: r.model,
        value: `${money(r.netAmount)} • ${r.netQuantity.toFixed(2)} req`,
        hint: `${r.sku} • discount ${pct(dRate)}`
      };
    });
  }, [premiumRows]);

  const topUsage = useMemo(() => {
    const items = usageSummary.data?.usageItems ?? [];
    return items
      .slice()
      .sort((a, b) => (b.netAmount ?? 0) - (a.netAmount ?? 0))
      .slice(0, 3);
  }, [usageSummary.data]);

  const authHint = useMemo(() => {
    if (!auth.data) return null;
    if (!auth.data.ok) return "GitHub auth not available";

    const scopes = auth.data.scopes ?? [];
    const hasReadOrg = scopes.includes("read:org");
    const hasUser = scopes.includes("user");

    if (!hasReadOrg) return "Token missing read:org";
    if (includeUserEndpoints && !hasUser) return "User endpoints need scope: user";
    return "Auth OK";
  }, [auth.data, includeUserEndpoints]);

  const rowsToShow = showAllRows ? premiumRows : premiumRows.slice(0, 8);
  const periodLabel = `${period.year}-${String(period.month).padStart(2, "0")}`;

  const metricsModelRows = useMemo<CopilotUserDayModel[]>(() => {
    const src = metricsUsers.data?.rows ?? [];
    const out: CopilotUserDayModel[] = [];

    for (const r of src) {
      const day = r.day;
      const user = r.user_login;
      const interactionCount = r.user_initiated_interaction_count ?? 0;

      // top feature (across all models)
      let topFeature: string | undefined;
      if (r.totals_by_model_feature && r.totals_by_model_feature.length > 0) {
        const featureMap = new Map<string, number>();
        for (const it of r.totals_by_model_feature) {
          featureMap.set(it.feature, (featureMap.get(it.feature) ?? 0) + (it.code_generation_activity_count ?? 0));
        }
        topFeature = Array.from(featureMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
      }

      // Per-model generation/acceptance counts derived from totals_by_language_model
      const modelMap = new Map<string, { gen: number; acc: number; langMap: Map<string, number> }>();
      if (r.totals_by_language_model && r.totals_by_language_model.length > 0) {
        for (const it of r.totals_by_language_model) {
          const model = it.model;
          const lang = it.language;
          const gen = it.code_generation_activity_count ?? 0;
          const acc = it.code_acceptance_activity_count ?? 0;
          const cur = modelMap.get(model) ?? { gen: 0, acc: 0, langMap: new Map<string, number>() };
          cur.gen += gen;
          cur.acc += acc;
          cur.langMap.set(lang, (cur.langMap.get(lang) ?? 0) + gen);
          modelMap.set(model, cur);
        }
      } else {
        // fallback: no model details; skip
        continue;
      }

      for (const [model, v] of modelMap.entries()) {
        const topLanguage = Array.from(v.langMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
        out.push({
          day,
          user,
          model,
          generationCount: v.gen,
          acceptanceCount: v.acc,
          interactionCount,
          topLanguage,
          topFeature
        });
      }
    }

    return out;
  }, [metricsUsers.data]);

  const billingModels = useMemo<BillingModelTotals[]>(() => {
    const by = new Map<string, { netAmount: number; netQuantity: number }>();
    for (const r of premiumRows) {
      const cur = by.get(r.model) ?? { netAmount: 0, netQuantity: 0 };
      cur.netAmount += r.netAmount;
      cur.netQuantity += r.netQuantity;
      by.set(r.model, cur);
    }

    return Array.from(by.entries())
      .map(([model, v]) => ({ model, netAmount: v.netAmount, netQuantity: v.netQuantity }))
      .sort((a, b) => b.netAmount - a.netAmount);
  }, [premiumRows]);

  const seatLogins = useMemo(() => {
    const seats = copilotSeats.data?.seats ?? [];
    const logins = seats
      .map((s) => s.assignee?.login)
      .filter((x): x is string => Boolean(x));
    return Array.from(new Set(logins)).sort();
  }, [copilotSeats.data]);

  const series = useMemo(() => {
    if (metricsModelRows.length === 0 && seatLogins.length === 0) return null;
    return buildUserSeries({
      rows: metricsModelRows,
      billingModels,
      ensureUsers: seatLogins
    });
  }, [metricsModelRows, billingModels, seatLogins]);

  const rangeMonth = useMemo(() => monthFromIso(rangeEnd), [rangeEnd]);

  return (
    <div ref={hero} className="relative">
      <div className="noise-overlay" />

      <section
        className={[
          "rounded-[3rem] overflow-hidden shadow-soft",
          "min-h-[70vh] md:min-h-[76vh]",
          "relative"
        ].join(" ")}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(46,64,54,0.6) 0%, rgba(26,26,26,0.92) 75%), url(https://images.unsplash.com/photo-1470115636492-6d2b56f9146d?auto=format&fit=crop&w=2200&q=80)",
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        />

        <div className="relative z-10 h-full flex flex-col justify-end px-8 md:px-12 pb-10 md:pb-14">
          <div data-hero="kicker" className="telemetry text-cream/80">
            ORGANISATION TELEMETRY • BILLING / USAGE • {periodLabel}
          </div>

          <div className="mt-4">
            <div
              data-hero="title"
              className="text-cream text-4xl md:text-6xl font-semibold tracking-tightish"
            >
              Gainsway GitHub Billing Dashboard
            </div>
          </div>

          <div data-hero="panel" className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              label="Plan Seats"
              value={meta.isLoading ? "…" : meta.isError ? "ERR" : seats ?? "—"}
              hint={meta.data?.plan?.name ? `Plan: ${meta.data.plan.name}` : "Org plan"}
            />

            <MetricCard
              label="Usage Summary"
              value={usageSummary.isLoading ? "…" : usageSummary.isError ? "ERR" : "OK"}
              hint={
                usageSummary.isError
                  ? "Billing summary unavailable"
                  : `${(usageSummary.data?.usageItems?.length ?? 0).toLocaleString()} meters this period`
              }
            />

            <MetricCard
              label="Premium Requests"
              value={
                premiumOrg.isLoading
                  ? "…"
                  : premiumOrg.isError
                    ? "ERR"
                    : premiumTotals.qty
                      ? premiumTotals.qty.toFixed(2)
                      : "—"
              }
              hint={premiumOrg.isError ? authHint ?? "Auth needed" : `Net ${money(premiumTotals.net)}`}
            />
          </div>

          <div data-hero="below" className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TelemetryFeed
              lines={[
                `Syncing billing period ${periodLabel}…`,
                "Downloading Copilot Metrics report…",
                "Extracting per-user per-day model telemetry…",
                "Attributing monthly spend by activity weights…",
                includeUserEndpoints
                  ? `User endpoints enabled for @${userLogin}`
                  : "User endpoints disabled (Configure)"
              ]}
            />

            <DiagnosticShuffler
              title="DIAGNOSTIC SHUFFLER — TOP PREMIUM MODELS"
              items={
                premiumShuffler.length
                  ? premiumShuffler
                  : [{ label: "No data", value: "—", hint: "Premium request usage not available" }]
              }
            />

            <div className="rounded-[2rem] border border-moss/15 bg-cream/90 p-5 md:p-6">
              <div className="telemetry text-moss/70">PREMIUM REQUESTS — INSIGHTS</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MiniStat label="Net" value={money(premiumTotals.net)} />
                <MiniStat label="Gross" value={money(premiumTotals.gross)} />
                <MiniStat label="Discount" value={money(premiumTotals.discount)} />
                <MiniStat label="Discount rate" value={pct(premiumTotals.discountRate)} />
                <MiniStat label="Models" value={String(premiumTotals.modelCount)} />
                <MiniStat label="Top-3 cost" value={pct(premiumTotals.concentration)} />
                <MiniStat label="Net / request" value={money(premiumTotals.netPerReq)} />
                <MiniStat label="Metric month" value={`${rangeMonth.year}-${String(rangeMonth.month).padStart(2, "0")}`} />
              </div>
              <div className="mt-3 telemetry text-moss/60">
                <span className="font-semibold">Per-user costs</span> are estimated by distributing monthly model totals across users/days using Copilot Metrics activity.
              </div>
            </div>
          </div>

          {/* New: per-user small-multiple model series */}
          <div className="mt-6 rounded-[2rem] bg-cream/90 border border-moss/15 p-5 md:p-6">
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
              <div>
                <div className="telemetry text-moss/70">COPILOT MODEL USAGE & COST — PER USER</div>
                <div className="mt-1 telemetry text-moss/60">
                  True per-user daily activity (Copilot Metrics) + cost attribution from Billing Premium Requests (estimated).
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <LabeledDate label="Since" value={rangeStart} onChange={setRangeStart} />
                <LabeledDate label="Until" value={rangeEnd} onChange={setRangeEnd} />

                <div className="rounded-[1.6rem] border border-moss/15 bg-cream px-4 py-3">
                  <div className="telemetry text-moss/70">Preset</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PresetBtn label="7d" onClick={() => { const r = lastNDays(7); setRangeStart(r.since); setRangeEnd(r.until); }} />
                    <PresetBtn label="14d" onClick={() => { const r = lastNDays(14); setRangeStart(r.since); setRangeEnd(r.until); }} />
                    <PresetBtn label="30d" onClick={() => { const r = lastNDays(30); setRangeStart(r.since); setRangeEnd(r.until); }} />
                    <PresetBtn label="This month" onClick={() => { const r = thisMonth(); setRangeStart(r.since); setRangeEnd(r.until); }} />
                    <PresetBtn label="YTD" onClick={() => { const r = ytd(); setRangeStart(r.since); setRangeEnd(r.until); }} />
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-moss/15 bg-cream px-4 py-3">
                  <div className="telemetry text-moss/70">Metric</div>
                  <div className="mt-2 flex gap-2">
                    <ModeBtn active={mode === "cost"} label="Cost ($)" onClick={() => setMode("cost")} />
                    <ModeBtn active={mode === "requests"} label="Usage" onClick={() => setMode("requests")} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              {metricsUsers.isLoading || copilotSeats.isLoading ? (
                <div className="telemetry text-moss/70">Loading Copilot Metrics…</div>
              ) : metricsUsers.isError ? (
                <div className="telemetry text-moss/70">
                  Copilot Metrics not available (check org API access / auth scopes).
                </div>
              ) : !series || series.users.length === 0 ? (
                <div className="telemetry text-moss/70">No per-user model rows returned in this range.</div>
              ) : (
                <UserModelUsageGrid
                  users={series.users}
                  models={series.models}
                  rateByModel={series.info.modelCostRateByModel}
                  mode={mode}
                />
              )}
            </div>

            <div className="mt-4 telemetry text-moss/60">
              Cost attribution is <span className="font-semibold">estimated</span>. We compute $/generation per model from the selected billing month ({periodLabel}) and apply it to the Copilot Metrics generation volume for the chosen range.
            </div>
          </div>

          {/* Premium breakdown table remains */}
          <div className="mt-6 rounded-[2rem] bg-cream/90 border border-moss/15 p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="telemetry text-moss/70">PREMIUM REQUESTS — BREAKDOWN BY MODEL</div>
                <div className="mt-1 telemetry text-moss/60">
                  Sorted by <span className="font-semibold">net amount</span>. Shows gross vs discounts vs net.
                </div>
              </div>
              <button
                className="btn-magnetic telemetry bg-moss text-cream"
                onClick={() => setShowAllRows((v) => !v)}
              >
                <span className="relative z-10">{showAllRows ? "Show less" : "Show all"}</span>
                <span className="absolute inset-0 bg-clay" style={{ zIndex: 0 }} />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr className="text-left telemetry text-moss/70">
                    <th className="py-2 pr-4">Model</th>
                    <th className="py-2 pr-4">SKU</th>
                    <th className="py-2 pr-4">Net</th>
                    <th className="py-2 pr-4">Net Qty</th>
                    <th className="py-2 pr-4">Gross</th>
                    <th className="py-2 pr-4">Discount</th>
                    <th className="py-2 pr-4">Discount %</th>
                  </tr>
                </thead>
                <tbody className="text-charcoal">
                  {premiumOrg.isLoading ? (
                    <tr>
                      <td className="py-3 telemetry text-moss/70" colSpan={7}>
                        Loading…
                      </td>
                    </tr>
                  ) : premiumOrg.isError ? (
                    <tr>
                      <td className="py-3 telemetry text-moss/70" colSpan={7}>
                        Premium request breakdown unavailable ({authHint ?? "check auth"})
                      </td>
                    </tr>
                  ) : rowsToShow.length === 0 ? (
                    <tr>
                      <td className="py-3 telemetry text-moss/70" colSpan={7}>
                        No premium request usage returned.
                      </td>
                    </tr>
                  ) : (
                    rowsToShow.map((r) => {
                      const d = r.grossAmount > 0 ? r.discountAmount / r.grossAmount : 0;
                      const unit = r.unitType === "requests" ? "req" : r.unitType;
                      return (
                        <tr key={`${r.sku}-${r.model}`} className="border-t border-moss/10">
                          <td className="py-3 pr-4">
                            <div className="font-semibold tracking-tightish">{r.model}</div>
                            <div className="telemetry text-moss/60">
                              {r.product} • {money(r.pricePerUnit)}/unit
                            </div>
                          </td>
                          <td className="py-3 pr-4 telemetry text-moss/70">{r.sku}</td>
                          <td className="py-3 pr-4 font-semibold">{money(r.netAmount)}</td>
                          <td className="py-3 pr-4 telemetry text-moss/70">
                            {r.netQuantity.toFixed(2)} {unit}
                          </td>
                          <td className="py-3 pr-4 telemetry text-moss/70">{money(r.grossAmount)}</td>
                          <td className="py-3 pr-4 telemetry text-moss/70">{money(r.discountAmount)}</td>
                          <td className="py-3 pr-4 telemetry text-moss/70">{pct(d)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 telemetry text-moss/60">
              Auth: {auth.isLoading ? "…" : auth.data?.ok ? `@${auth.data.user ?? "unknown"} (${authHint})` : "ERR"}
            </div>
          </div>

          <div className="mt-6 rounded-[2rem] bg-cream/90 border border-moss/15 p-5 md:p-6">
            <div className="telemetry text-moss/70">TOP METERS (SUMMARY)</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              {topUsage.length === 0 ? (
                <div className="telemetry text-moss/70">No usage items returned yet.</div>
              ) : (
                topUsage.map((it, idx) => (
                  <div key={idx} className="rounded-[1.6rem] border border-moss/10 bg-cream p-4">
                    <div className="telemetry text-moss/70">{it.product ?? "Product"}</div>
                    <div className="mt-1 text-lg font-semibold tracking-tightish text-charcoal">
                      {it.netAmount != null ? money(it.netAmount) : "—"}
                    </div>
                    <div className="mt-1 telemetry text-moss/70">
                      {it.sku ?? "SKU"} • {(it.netQuantity ?? 0).toLocaleString()} {it.unitType ?? "units"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard(props: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[2rem] bg-cream/90 border border-moss/15 p-5 md:p-6">
      <div className="telemetry text-moss/70">{props.label}</div>
      <div className="mt-2 text-3xl md:text-4xl font-semibold tracking-tightish text-charcoal">
        {props.value}
      </div>
      <div className="mt-2 telemetry text-moss/70">{props.hint}</div>
    </div>
  );
}

function MiniStat(props: { label: string; value: string }) {
  return (
    <div className="rounded-[1.6rem] border border-moss/10 bg-cream p-4">
      <div className="telemetry text-moss/70">{props.label}</div>
      <div className="mt-1 text-lg font-semibold tracking-tightish text-charcoal">
        {props.value}
      </div>
    </div>
  );
}

function LabeledDate(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-[1.6rem] border border-moss/15 bg-cream px-4 py-3">
      <div className="telemetry text-moss/70">{props.label}</div>
      <input
        className="mt-1 w-full bg-transparent outline-none telemetry"
        type="date"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

function PresetBtn(props: { label: string; onClick: () => void }) {
  return (
    <button
      className="telemetry rounded-[999px] border border-moss/15 bg-cream px-3 py-1 hover:scale-[1.02] transition"
      onClick={props.onClick}
      type="button"
    >
      {props.label}
    </button>
  );
}

function ModeBtn(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        "telemetry rounded-[999px] px-3 py-1 border transition " +
        (props.active
          ? "bg-moss text-cream border-moss"
          : "bg-cream text-moss border-moss/15 hover:scale-[1.02]")
      }
    >
      {props.label}
    </button>
  );
}
