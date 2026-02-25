export type CopilotUserDayModel = {
  day: string; // YYYY-MM-DD
  user: string;
  model: string;
  generationCount: number;
  acceptanceCount: number;
  interactionCount: number;
  // optional enrichments
  topLanguage?: string;
  topFeature?: string;
};

export type BillingModelTotals = {
  model: string;
  netAmount: number;
  netQuantity: number;
};

export type UserSeriesPoint = {
  day: string;
  // dynamic keys for models
  [k: string]: string | number;
};

export type UserSeries = {
  user: string;
  points: UserSeriesPoint[];
  // totals for header chips
  totalGen: number;
  totalAccept: number;
  acceptRate: number;
  topModel?: string;
  topLanguage?: string;
  topFeature?: string;
};

export type AttributionMode = "cost" | "requests";

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}

export function buildUserSeries(args: {
  rows: CopilotUserDayModel[];
  billingModels: BillingModelTotals[];
  // optional: ensure these users are present even if they have no activity in range
  ensureUsers?: string[];
}): {
  users: UserSeries[];
  models: string[];
  info: {
    costIsEstimated: boolean;
    modelCostRateByModel: Record<string, number>; // $ per generation within range
    usedBlendedRate: boolean;
    blendedRate: number;
  };
} {
  const models = Array.from(new Set(args.rows.map((r) => r.model).filter(Boolean))).sort();

  const billingByModel = new Map(
    args.billingModels.map((m) => [m.model, { netAmount: clamp(m.netAmount), netQuantity: clamp(m.netQuantity) }])
  );

  // total generations per model in the current range
  const totalGenByModel = new Map<string, number>();
  let totalGenAll = 0;
  for (const r of args.rows) {
    const g = clamp(r.generationCount);
    totalGenAll += g;
    totalGenByModel.set(r.model, (totalGenByModel.get(r.model) ?? 0) + g);
  }

  const totalBillingNet = args.billingModels.reduce((a, m) => a + clamp(m.netAmount), 0);
  const blendedRate = totalGenAll > 0 ? totalBillingNet / totalGenAll : 0;

  // $/generation for each model (estimated)
  // NOTE: billing model names often don't match Copilot Metrics model names.
  // If we can't compute per-model rates, we fall back to a single blended rate so charts are not flatlined.
  const modelCostRateByModel: Record<string, number> = {};
  let usedBlendedRate = false;

  for (const m of models) {
    const bill = billingByModel.get(m);
    const denom = totalGenByModel.get(m) ?? 0;
    const r = bill && denom > 0 ? bill.netAmount / denom : 0;
    modelCostRateByModel[m] = r;
    if (r === 0 && blendedRate > 0) usedBlendedRate = true;
  }

  if (usedBlendedRate) {
    for (const m of models) {
      if ((modelCostRateByModel[m] ?? 0) === 0) modelCostRateByModel[m] = blendedRate;
    }
  }

  const byUser = new Map<string, CopilotUserDayModel[]>();
  for (const r of args.rows) {
    const arr = byUser.get(r.user) ?? [];
    arr.push(r);
    byUser.set(r.user, arr);
  }

  // determine full day range present in data (used to create empty series for seats w/ no activity)
  const allDays = Array.from(new Set(args.rows.map((r) => r.day))).sort();

  const users: UserSeries[] = [];

  const ensure = (args.ensureUsers ?? []).slice().sort();
  for (const u of ensure) {
    if (!byUser.has(u)) byUser.set(u, []);
  }

  for (const [user, list] of byUser.entries()) {
    const byDay = new Map<string, CopilotUserDayModel[]>();
    for (const r of list) {
      const a = byDay.get(r.day) ?? [];
      a.push(r);
      byDay.set(r.day, a);
    }

    const days = allDays.length > 0 ? allDays : Array.from(byDay.keys()).sort();
    const points: UserSeriesPoint[] = [];

    let totalGen = 0;
    let totalAccept = 0;

    const modelTotals = new Map<string, number>();
    const langTotals = new Map<string, number>();
    const featureTotals = new Map<string, number>();

    for (const d of days) {
      const rows = byDay.get(d) ?? [];
      const p: UserSeriesPoint = { day: d };

      for (const m of models) {
        p[m] = 0;
      }

      for (const r of rows) {
        const g = clamp(r.generationCount);
        const a = clamp(r.acceptanceCount);
        totalGen += g;
        totalAccept += a;

        modelTotals.set(r.model, (modelTotals.get(r.model) ?? 0) + g);
        if (r.topLanguage) langTotals.set(r.topLanguage, (langTotals.get(r.topLanguage) ?? 0) + g);
        if (r.topFeature) featureTotals.set(r.topFeature, (featureTotals.get(r.topFeature) ?? 0) + g);

        p[r.model] = (p[r.model] as number) + g;
      }

      points.push(p);
    }

    const topModel = Array.from(modelTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topLanguage = Array.from(langTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topFeature = Array.from(featureTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

    users.push({
      user,
      points,
      totalGen,
      totalAccept,
      acceptRate: totalGen > 0 ? totalAccept / totalGen : 0,
      topModel,
      topLanguage,
      topFeature
    });
  }

  const costIsEstimated = true;
  users.sort((a, b) => {
    const costA = estimateUserCost(a, modelCostRateByModel);
    const costB = estimateUserCost(b, modelCostRateByModel);
    return costB - costA;
  });

  return { users, models, info: { costIsEstimated, modelCostRateByModel, usedBlendedRate, blendedRate } };
}

export function estimateUserCost(u: UserSeries, rateByModel: Record<string, number>) {
  let cost = 0;
  for (const pt of u.points) {
    for (const [k, v] of Object.entries(pt)) {
      if (k === "day") continue;
      const n = typeof v === "number" ? v : Number(v);
      cost += clamp(n) * (rateByModel[k] ?? 0);
    }
  }
  return cost;
}

export function applyCostToPoints(points: UserSeriesPoint[], rateByModel: Record<string, number>) {
  return points.map((p) => {
    const out: UserSeriesPoint = { day: p.day };
    for (const [k, v] of Object.entries(p)) {
      if (k === "day") continue;
      const n = typeof v === "number" ? v : Number(v);
      out[k] = clamp(n) * (rateByModel[k] ?? 0);
    }
    return out;
  });
}
