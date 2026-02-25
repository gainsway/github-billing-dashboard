import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";

export type ShufflerItem = {
  label: string;
  value: string;
  hint: string;
};

export function DiagnosticShuffler(props: { title: string; items: ShufflerItem[] }) {
  const { items } = props;
  const [stack, setStack] = useState(() => items.slice(0, 3));
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setStack(items.slice(0, 3));
  }, [items]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStack((prev) => {
        if (prev.length < 2) return prev;
        const next = prev.slice();
        // rotate: unshift(pop())
        next.unshift(next.pop()!);
        return next;
      });
    }, 3000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!root.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-card]",
        { y: 10, opacity: 0.8 },
        {
          y: 0,
          opacity: 1,
          duration: 0.55,
          ease: "cubic-bezier(0.34, 1.56, 0.64, 1)"
        }
      );
    }, root);
    return () => ctx.revert();
  }, [stack]);

  const layers = useMemo(() => {
    const top = stack[0];
    const mid = stack[1];
    const bot = stack[2];
    return [top, mid, bot].filter(Boolean);
  }, [stack]);

  return (
    <div ref={root} className="rounded-[2rem] border border-moss/15 bg-cream/90 p-5 md:p-6">
      <div className="telemetry text-moss/70">{props.title}</div>

      <div className="mt-4 relative h-[120px]">
        {layers.map((it, idx) => (
          <div
            key={`${it.label}-${idx}`}
            data-card
            className="absolute inset-0 rounded-[1.8rem] border border-moss/10 bg-cream p-4"
            style={{
              // Critical: without zIndex, the last element in the DOM sits on top and can be a blurred layer.
              // This keeps the top card crisp.
              zIndex: 30 - idx,
              pointerEvents: idx === 0 ? "auto" : "none",
              willChange: "transform, opacity, filter",
              transform: `translate3d(0, ${idx * 10}px, 0) scale(${1 - idx * 0.04})`,
              filter: idx === 0 ? "none" : `blur(${idx * 1.2}px)`,
              opacity: idx === 0 ? 1 : 0.75 - idx * 0.1
            }}
          >
            <div className="telemetry text-moss/70">{it.label}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tightish text-charcoal">
              {it.value}
            </div>
            <div className="mt-1 telemetry text-moss/60">{it.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
