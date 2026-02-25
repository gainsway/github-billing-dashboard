import { useEffect, useMemo, useState } from "react";

export function TelemetryFeed(props: { lines?: string[] }) {
  const lines = useMemo(
    () =>
      props.lines ?? [
        "Optimizing billing telemetry…",
        "Indexing Copilot premium requests…",
        "Computing discount rate…",
        "Detecting cost concentration…",
        "Synthesizing monthly burn…"
      ],
    [props.lines]
  );

  const [i, setI] = useState(0);
  const [t, setT] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setT((prev) => {
        const next = prev + 1;
        const cur = lines[i] ?? "";
        if (next > cur.length + 12) {
          setI((x) => (x + 1) % lines.length);
          return 0;
        }
        return next;
      });
    }, 36);
    return () => window.clearInterval(id);
  }, [i, lines]);

  const cur = lines[i] ?? "";
  const visible = cur.slice(0, Math.min(cur.length, t));

  return (
    <div className="rounded-[2rem] border border-moss/15 bg-cream/90 p-5 md:p-6">
      <div className="flex items-center justify-between">
        <div className="telemetry text-moss/70">TELEMETRY FEED</div>
        <div className="telemetry text-moss/70 inline-flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-clay opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-clay" />
          </span>
          Live
        </div>
      </div>

      <div className="mt-4 font-mono text-[13px] text-charcoal">
        {visible}
        <span className="ml-1 inline-block w-[8px] h-[18px] align-[-3px] bg-clay animate-pulse" />
      </div>

      <div className="mt-2 telemetry text-moss/60">A lightweight UI artifact to keep the instrument feeling alive.</div>
    </div>
  );
}
