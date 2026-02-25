import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useMemo, useState } from "react";
import {
  applyCostToPoints,
  estimateUserCost,
  type UserSeries,
  type UserSeriesPoint
} from "../lib/copilotAttribution";

// Distinct, high-contrast palette (stable mapping by model)
const palette = [
  "#2E4036", // moss
  "#CC5833", // clay
  "#1A1A1A", // charcoal
  "#3B6EA8", // blue
  "#7A4EAB", // violet
  "#1F8A70", // teal
  "#C49A2C", // gold
  "#B13A5B" // rose
];

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function colorForModel(model: string) {
  return palette[hash(model) % palette.length];
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtDay(d: string) {
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[1]}/${parts[2]}`;
}

export function UserModelLineCard(props: {
  user: UserSeries;
  models: string[];
  rateByModel: Record<string, number>;
  mode: "cost" | "requests";
  seatMeta?: {
    last_activity_at?: string;
    last_activity_editor?: string;
    plan_type?: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);

  const points: UserSeriesPoint[] = useMemo(() => {
    if (props.mode === "cost") {
      return applyCostToPoints(props.user.points, props.rateByModel);
    }
    return props.user.points;
  }, [props.mode, props.user.points, props.rateByModel]);

  const totalCost = useMemo(
    () => estimateUserCost(props.user, props.rateByModel),
    [props.user, props.rateByModel]
  );

  const shownModels = useMemo(() => {
    if (expanded) return props.models;
    const sums = props.models
      .map((m) => {
        let s = 0;
        for (const p of points) s += Number(p[m] ?? 0);
        return { m, s };
      })
      .sort((a, b) => b.s - a.s);
    return sums.slice(0, 4).map((x) => x.m);
  }, [expanded, props.models, points]);

  const yMax = useMemo(() => {
    let max = 0;
    for (const p of points) {
      for (const m of shownModels) max = Math.max(max, Number(p[m] ?? 0));
    }
    return Math.max(1, max * 1.15);
  }, [points, shownModels]);

  const noActivity = props.user.totalGen === 0;
  const lastActivityDay = useMemo(() => {
    const iso = props.seatMeta?.last_activity_at;
    if (!iso || iso.length < 10) return null;
    return iso.slice(0, 10);
  }, [props.seatMeta?.last_activity_at]);

  const hasDayInRange = useMemo(() => {
    if (!lastActivityDay) return false;
    return points.some((p) => p.day === lastActivityDay);
  }, [points, lastActivityDay]);

  return (
    <div className="rounded-[2rem] border border-moss/15 bg-cream/90 p-5 md:p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold tracking-tightish text-charcoal">
            {props.user.user}
          </div>
          <div className="mt-1 telemetry text-moss/60">
            {props.mode === "cost" ? (
              <>
                Est. spend <span className="font-semibold text-moss">{money(totalCost)}</span>
              </>
            ) : (
              <>
                Generations <span className="font-semibold text-moss">{props.user.totalGen}</span>
              </>
            )}
            <span className="opacity-50"> • </span>
            Accept <span className="font-semibold text-moss">{Math.round(props.user.acceptRate * 100)}%</span>
            {noActivity ? (
              <>
                <span className="opacity-50"> • </span>
                <span className="text-clay font-semibold">No model telemetry in range</span>
              </>
            ) : null}
          </div>

          {noActivity && (props.seatMeta?.last_activity_at || props.seatMeta?.last_activity_editor) ? (
            <div className="mt-2 telemetry text-moss/60">
              Seat activity: {props.seatMeta?.last_activity_at ?? "—"}
              {props.seatMeta?.last_activity_editor ? ` • ${props.seatMeta.last_activity_editor}` : ""}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2 telemetry text-moss/70">
            {props.user.topModel ? <Chip label="Top model" value={props.user.topModel} /> : null}
            {props.user.topLanguage ? <Chip label="Top lang" value={props.user.topLanguage} /> : null}
            {props.user.topFeature ? <Chip label="Top feature" value={props.user.topFeature} /> : null}
          </div>
        </div>

        <button
          className="btn-magnetic telemetry bg-moss text-cream"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          <span className="relative z-10">{expanded ? "Top models" : "All models"}</span>
          <span className="absolute inset-0 bg-clay" style={{ zIndex: 0 }} />
        </button>
      </div>

      <div className="mt-4 h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tickFormatter={fmtDay} tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              domain={[0, yMax]}
              tickFormatter={(v) =>
                props.mode === "cost" ? `$${Math.round(Number(v))}` : String(Math.round(Number(v)))
              }
            />
            <Tooltip
              cursor={{ stroke: "rgba(46,64,54,0.2)", strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const items = payload
                  .filter((p) => (p.value ?? 0) > 0)
                  .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));

                return (
                  <div className="rounded-[1.6rem] glass shadow-soft px-4 py-3">
                    <div className="telemetry text-moss/70">{props.user.user}</div>
                    <div className="mt-1 text-lg font-semibold tracking-tightish text-charcoal">
                      {String(label)}
                    </div>

                    <div className="mt-3 space-y-1">
                      {items.length === 0 ? (
                        <div className="telemetry text-moss/60">No model activity for this day.</div>
                      ) : (
                        items.map((it) => (
                          <div
                            key={String(it.dataKey)}
                            className="flex items-center justify-between gap-6 telemetry"
                          >
                            <div className="text-moss/70">{String(it.dataKey)}</div>
                            <div className="font-semibold text-charcoal">
                              {props.mode === "cost"
                                ? money(Number(it.value ?? 0))
                                : Math.round(Number(it.value ?? 0))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {noActivity && lastActivityDay ? (
                      <div className="mt-3 telemetry text-moss/60">
                        Seat last activity: <span className="font-semibold">{lastActivityDay}</span>
                      </div>
                    ) : null}

                    <div className="mt-3 telemetry text-moss/60">
                      Values are {props.mode === "cost" ? "estimated spend" : "generation volume"} derived from Copilot Metrics + Billing.
                    </div>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />

            {/* If there is seat activity but no metrics telemetry rows, show a marker so the card doesn't read as "dead". */}
            {noActivity && lastActivityDay && hasDayInRange ? (
              <ReferenceDot
                x={lastActivityDay}
                y={0}
                r={7}
                fill="#CC5833"
                stroke="#CC5833"
                label={{ value: "last", position: "top", fill: "#CC5833" }}
              />
            ) : null}

            {shownModels.map((m) => (
              <Line
                key={m}
                type="monotone"
                dataKey={m}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                stroke={colorForModel(m)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 telemetry text-moss/60">
        Cost attribution is <span className="font-semibold">estimated</span> from Billing + Copilot Metrics activity.
      </div>
    </div>
  );
}

function Chip(props: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[999px] border border-moss/15 bg-cream px-3 py-1">
      <span className="text-moss/60">{props.label}</span>
      <span className="font-semibold text-charcoal">{props.value}</span>
    </span>
  );
}
