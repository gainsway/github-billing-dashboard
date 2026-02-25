import { useEffect, useMemo, useRef, useState } from "react";

export function UserCarousel(props: {
  items: Array<{ key: string; node: React.ReactNode }>;
  title?: string;
  subtitle?: string;
}) {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const pages = useMemo(() => props.items, [props.items]);
  const max = pages.length;

  useEffect(() => {
    if (idx >= max) setIdx(0);
  }, [idx, max]);

  const prev = () => setIdx((v) => (max === 0 ? 0 : (v - 1 + max) % max));
  const next = () => setIdx((v) => (max === 0 ? 0 : (v + 1) % max));

  return (
    <div className="rounded-[2rem] border border-moss/15 bg-cream/90 p-5 md:p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          {props.title ? <div className="telemetry text-moss/70">{props.title}</div> : null}
          {props.subtitle ? (
            <div className="mt-1 telemetry text-moss/60">{props.subtitle}</div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-magnetic telemetry bg-cream text-moss border border-moss/15"
            onClick={prev}
          >
            <span className="relative z-10">Prev</span>
            <span className="absolute inset-0 bg-clay" style={{ zIndex: 0, opacity: 0.0 }} />
          </button>
          <button
            type="button"
            className="btn-magnetic telemetry bg-moss text-cream"
            onClick={next}
          >
            <span className="relative z-10">Next</span>
            <span className="absolute inset-0 bg-clay" style={{ zIndex: 0 }} />
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden">
        <div
          ref={trackRef}
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {pages.map((p) => (
            <div key={p.key} className="w-full shrink-0">
              {p.node}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between telemetry text-moss/60">
        <div>
          {max === 0 ? "0" : idx + 1} / {max}
        </div>
        <div className="flex items-center gap-2">
          {pages.slice(0, 12).map((p, i) => (
            <button
              key={p.key}
              type="button"
              aria-label={`Go to ${i + 1}`}
              onClick={() => setIdx(i)}
              className={
                "h-2 w-2 rounded-full border border-moss/30 transition " +
                (i === idx ? "bg-moss" : "bg-cream")
              }
            />
          ))}
          {max > 12 ? <span className="opacity-50">…</span> : null}
        </div>
      </div>
    </div>
  );
}
