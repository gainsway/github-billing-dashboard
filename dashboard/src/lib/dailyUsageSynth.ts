// A deterministic synthesizer to create per-day/per-user/per-model points
// from the org's premium request usage totals.
//
// Why: GitHub's Copilot Metrics API is currently disabled for this org (422).
// This allows us to ship the UX now; when Metrics is enabled, we can swap data sources.

export type PremiumModelTotal = {
  model: string;
  netAmount: number;
  requests: number;
};

export type DailyUserModelPoint = {
  date: string; // YYYY-MM-DD
  user: string;
  model: string;
  requests: number;
  netAmount: number;
};

function mulberry32(a: number) {
  return function () {
    // eslint-disable-next-line no-bitwise
    let t = (a += 0x6d2b79f5);
    // eslint-disable-next-line no-bitwise
    t = Math.imul(t ^ (t >>> 15), t | 1);
    // eslint-disable-next-line no-bitwise
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    // eslint-disable-next-line no-bitwise
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    // eslint-disable-next-line no-bitwise
    h ^= s.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    h = Math.imul(h, 16777619);
  }
  // eslint-disable-next-line no-bitwise
  return h >>> 0;
}

function iso(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function enumerateDays(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);

  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(iso(d));
  }
  return days;
}

export function synthesizeDailyUsageByUser(args: {
  startDate: string;
  endDate: string;
  users: string[];
  models: PremiumModelTotal[];
  seed: string;
}): DailyUserModelPoint[] {
  const days = enumerateDays(args.startDate, args.endDate);
  const seedBase = hash(args.seed);

  // Weight models by netAmount (higher spend → more likely usage)
  const modelWeights = args.models.map((m) => Math.max(0.001, m.netAmount));
  const weightSum = modelWeights.reduce((a, b) => a + b, 0);

  const points: DailyUserModelPoint[] = [];

  for (const day of days) {
    for (const user of args.users) {
      const r = mulberry32(seedBase ^ hash(`${day}::${user}`));

      // daily intensity: 0..1; quiet days should be common
      const intensity = Math.pow(r(), 1.3);
      const userBudget = intensity * 0.22; // maps to net $ scale; tuned for small orgs

      // allocate across models
      for (let i = 0; i < args.models.length; i++) {
        const m = args.models[i];
        const w = modelWeights[i] / weightSum;
        const noise = 0.6 + r() * 0.9;

        const net = userBudget * w * noise * m.netAmount;
        if (net < 0.05) continue;

        const req = Math.max(1, Math.round((net / Math.max(0.05, m.netAmount)) * m.requests * 0.12));

        points.push({
          date: day,
          user,
          model: m.model,
          requests: req,
          netAmount: net
        });
      }
    }
  }

  return points;
}
