import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export type DailyUserModelPoint = {
  date: string; // YYYY-MM-DD
  user: string;
  model: string;
  requests: number;
  netAmount: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function formatDateLabel(iso: string) {
  // keep it compact in the axis
  const [y, m, d] = iso.split("-");
  return `${m}/${d}`;
}

type Props = {
  title?: string;
  points: DailyUserModelPoint[];
  date: string;
  topUsers?: number;
};

export function ModelUsageByUserChart(props: Props) {
  const title = props.title ?? "DAILY MODEL USAGE BY USER";
  const topUsers = props.topUsers ?? 8;

  const { rows, models, metaByUser } = useMemo(() => {
    const dayPoints = props.points.filter((p) => p.date === props.date);

    const totalsByUser = new Map<string, { net: number; req: number }>();
    for (const p of dayPoints) {
      const cur = totalsByUser.get(p.user) ?? { net: 0, req: 0 };
      cur.net += p.netAmount;
      cur.req += p.requests;
      totalsByUser.set(p.user, cur);
    }

    const users = Array.from(totalsByUser.entries())
      .sort((a, b) => b[1].net - a[1].net)
      .slice(0, topUsers)
      .map(([u]) => u);

    const modelSet = new Set<string>();
    for (const p of dayPoints) {
      if (users.includes(p.user)) modelSet.add(p.model);
    }

    const models = Array.from(modelSet.values()).sort();

    const rows = users.map((user) => {
      const row: Record<string, any> = {
        user,
        totalNet: totalsByUser.get(user)?.net ?? 0,
        totalReq: totalsByUser.get(user)?.req ?? 0
      };

      for (const m of models) row[m] = 0;

      for (const p of dayPoints) {
        if (p.user !== user) continue;
        if (!models.includes(p.model)) continue;
        row[p.model] += p.netAmount;
      }

      return row;
    });

    const metaByUser = new Map(
      users.map((u) => [u, totalsByUser.get(u) ?? { net: 0, req: 0 }])
    );

    return { rows, models, metaByUser };
  }, [props.points, props.date, topUsers]);

  const yMax = useMemo(() => {
    const max = rows.reduce((a, r) => Math.max(a, r.totalNet ?? 0), 0);
    return clamp(max * 1.25, 5, Number.POSITIVE_INFINITY);
  }, [rows]);

  return (
    <div className="rounded-[2rem] bg-cream/90 border border-moss/15 p-5 md:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="telemetry text-moss/70">{title}</div>
          <div className="mt-1 telemetry text-moss/60">
            Date: <span className="font-semibold text-moss">{formatDateLabel(props.date)}</span>
            <span className="opacity-50"> • </span>
            Metric: <span className="font-semibold text-moss">Net spend ($)</span>
          </div>
        </div>
        <div className="telemetry text-moss/60">
          Bars are stacked by model; hover for full breakdown.
        </div>
      </div>

      <div className="mt-4 h-[320px]">
        {rows.length === 0 ? (
          <div className="telemetry text-moss/70">No data for this date.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="user" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                domain={[0, yMax]}
                tickFormatter={(v) => `$${Math.round(Number(v))}`}
              />
              <Tooltip
                cursor={{ fill: "rgba(46,64,54,0.06)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const meta = metaByUser.get(String(label)) ?? { net: 0, req: 0 };
                  const items = payload
                    .filter((p) => (p.value ?? 0) > 0)
                    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));

                  return (
                    <div className="rounded-[1.6rem] glass shadow-soft px-4 py-3">
                      <div className="telemetry text-moss/70">{label}</div>
                      <div className="mt-1 text-lg font-semibold tracking-tightish text-charcoal">
                        {money(meta.net)}
                      </div>
                      <div className="telemetry text-moss/60">
                        {meta.req.toFixed(0)} requests
                      </div>
                      <div className="mt-3 space-y-1">
                        {items.map((it) => (
                          <div key={String(it.dataKey)} className="flex items-center justify-between gap-6 telemetry">
                            <div className="text-moss/70">{String(it.dataKey)}</div>
                            <div className="font-semibold text-charcoal">{money(Number(it.value ?? 0))}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {models.map((m) => (
                <Bar key={m} dataKey={m} stackId="a" radius={[10, 10, 10, 10]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3 telemetry text-moss/60">
        Note: this chart uses model-level spend attribution. For true per-user/per-day Copilot metrics, enable the Copilot Metrics API access in GitHub org settings.
      </div>
    </div>
  );
}
