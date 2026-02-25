import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { Shield, Activity, ChevronDown } from "lucide-react";
import { formatPeriod, useConfig } from "../lib/config";

export function Navbar() {
  const el = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const { org, period, setConfigOpen } = useConfig();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!el.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.current,
        { y: -18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
      );
    }, el);
    return () => ctx.revert();
  }, []);

  const periodLabel = useMemo(() => formatPeriod(period), [period]);

  return (
    <div className="fixed top-4 left-0 right-0 z-40 flex justify-center px-4">
      <div
        ref={el}
        className={[
          "w-full max-w-5xl rounded-[3rem] px-4 md:px-6 py-3 transition-all duration-300",
          "flex items-center justify-between",
          scrolled ? "glass shadow-soft" : "bg-transparent"
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <div
            className={[
              "h-10 w-10 rounded-[1.2rem] grid place-items-center",
              scrolled
                ? "bg-moss text-cream"
                : "bg-cream/15 text-cream border border-cream/25"
            ].join(" ")}
          >
            <Shield className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div
              className={[
                "text-sm font-semibold tracking-tightish",
                scrolled ? "text-moss" : "text-cream"
              ].join(" ")}
            >
              Gainsway
            </div>
            <div
              className={[
                "telemetry opacity-80",
                scrolled ? "text-moss" : "text-cream"
              ].join(" ")}
            >
              GitHub Billing Dashboard
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={[
              "hidden md:flex items-center gap-2 telemetry",
              scrolled ? "text-moss" : "text-cream"
            ].join(" ")}
          >
            <span className="inline-flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="opacity-80">Org</span>
              <span className="font-semibold">{org}</span>
            </span>
            <span className="opacity-50">•</span>
            <span className="opacity-80">Period</span>
            <span className="font-semibold">{periodLabel}</span>
          </div>

          <button
            onClick={() => setConfigOpen(true)}
            className={[
              "btn-magnetic telemetry",
              scrolled
                ? "bg-moss text-cream"
                : "bg-cream/15 text-cream border border-cream/25"
            ].join(" ")}
          >
            <span className="relative z-10 inline-flex items-center gap-2">
              Configure <ChevronDown className="h-4 w-4" />
            </span>
            <span className="absolute inset-0 bg-clay" style={{ zIndex: 0 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
