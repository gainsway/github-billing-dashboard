import { useMemo, useState } from "react";
import { UserModelLineCard } from "./UserModelLineCard";
import { UserCarousel } from "./UserCarousel";
import { type UserSeries } from "../lib/copilotAttribution";

export function UserModelUsageGrid(props: {
  users: UserSeries[];
  models: string[];
  rateByModel: Record<string, number>;
  mode: "cost" | "requests";
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return props.users;
    return props.users.filter((u) => u.user.toLowerCase().includes(s));
  }, [q, props.users]);

  const pages = useMemo(
    () =>
      filtered.map((u) => ({
        key: u.user,
        node: (
          <UserModelLineCard
            user={u}
            models={props.models}
            rateByModel={props.rateByModel}
            mode={props.mode}
          />
        )
      })),
    [filtered, props.models, props.rateByModel, props.mode]
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="telemetry text-moss/70">PER-USER MODEL SERIES</div>
          <div className="mt-1 telemetry text-moss/60">
            Carousel view for focus. Search users; each slide is a time-series (models as lines).
          </div>
        </div>

        <div className="w-full md:w-[360px]">
          <div className="rounded-[1.8rem] border border-moss/15 bg-cream px-4 py-3">
            <div className="telemetry text-moss/70">Filter</div>
            <input
              className="mt-1 w-full bg-transparent outline-none telemetry"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type a GitHub login…"
            />
          </div>
        </div>
      </div>

      <div className="mt-6">
        {filtered.length === 0 ? (
          <div className="telemetry text-moss/70">No matching users.</div>
        ) : (
          <UserCarousel
            title="USER CHARTS"
            subtitle="Use Prev/Next (or dots) to browse each GitHub user."
            items={pages}
          />
        )}
      </div>

      <div className="mt-4 telemetry text-moss/60">
        Showing <span className="font-semibold">{filtered.length}</span> users.
      </div>
    </div>
  );
}
