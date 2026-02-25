import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { X, Calendar, UserRound, ShieldAlert } from "lucide-react";
import { formatPeriod, useConfig } from "../lib/config";

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

export function ConfigDrawer() {
  const { isConfigOpen, setConfigOpen, period, setPeriod, userLogin, setUserLogin, includeUserEndpoints, setIncludeUserEndpoints } =
    useConfig();
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!root.current) return;
    const ctx = gsap.context(() => {
      if (isConfigOpen) {
        gsap.fromTo(
          "[data-drawer='backdrop']",
          { opacity: 0 },
          { opacity: 1, duration: 0.35, ease: "power2.out" }
        );
        gsap.fromTo(
          "[data-drawer='panel']",
          { x: 40, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }
        );
      }
    }, root);
    return () => ctx.revert();
  }, [isConfigOpen]);

  const years = useMemo(() => {
    const y = new Date().getUTCFullYear();
    return [y - 1, y, y + 1];
  }, []);

  if (!isConfigOpen) return null;

  return (
    <div ref={root} className="fixed inset-0 z-[60]">
      <button
        data-drawer="backdrop"
        className="absolute inset-0 bg-charcoal/40"
        onClick={() => setConfigOpen(false)}
        aria-label="Close configuration"
      />

      <div className="absolute right-4 top-4 bottom-4 w-[min(520px,calc(100%-2rem))]" data-drawer="panel">
        <div className="glass rounded-[3rem] h-full shadow-soft overflow-hidden">
          <div className="p-6 md:p-8 flex items-start justify-between border-b border-moss/10">
            <div>
              <div className="telemetry text-moss/70">CONFIGURE</div>
              <div className="mt-1 text-2xl font-semibold tracking-tightish text-charcoal">
                Dial the Instrument
              </div>
              <div className="mt-2 telemetry text-moss/60">
                Current period: <span className="font-semibold text-moss">{formatPeriod(period)}</span>
              </div>
            </div>

            <button
              className="h-11 w-11 rounded-[1.4rem] grid place-items-center border border-moss/15 bg-cream/70"
              onClick={() => setConfigOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5 text-moss" />
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-7">
            <div>
              <div className="flex items-center gap-2 telemetry text-moss/70">
                <Calendar className="h-4 w-4" />
                BILLING PERIOD
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                <select
                  className="rounded-[1.6rem] border border-moss/15 bg-cream px-4 py-3 telemetry"
                  value={period.year}
                  onChange={(e) => setPeriod({ year: Number(e.target.value), month: period.month })}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>

                <select
                  className="col-span-2 rounded-[1.6rem] border border-moss/15 bg-cream px-4 py-3 telemetry"
                  value={period.month}
                  onChange={(e) => setPeriod({ year: period.year, month: Number(e.target.value) })}
                >
                  {months.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-2 telemetry text-moss/60">
                This maps to GitHub billing endpoints that accept <span className="font-semibold">year</span> and <span className="font-semibold">month</span>.
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 telemetry text-moss/70">
                <UserRound className="h-4 w-4" />
                OPTIONAL USER VIEW
              </div>

              <div className="mt-3 rounded-[2rem] border border-moss/15 bg-cream p-4">
                <label className="flex items-center justify-between gap-4">
                  <span className="telemetry text-moss/70">Enable user endpoints</span>
                  <input
                    type="checkbox"
                    checked={includeUserEndpoints}
                    onChange={(e) => setIncludeUserEndpoints(e.target.checked)}
                    className="h-5 w-5 accent-moss"
                  />
                </label>

                <div className="mt-3 grid grid-cols-1 gap-2">
                  <input
                    className="rounded-[1.6rem] border border-moss/15 bg-cream px-4 py-3 telemetry"
                    value={userLogin}
                    onChange={(e) => setUserLogin(e.target.value)}
                    placeholder="GitHub username"
                  />
                </div>

                <div className="mt-3 flex items-start gap-2 telemetry text-moss/60">
                  <ShieldAlert className="h-4 w-4 mt-[2px]" />
                  <div>
                    User billing endpoints typically require the <span className="font-semibold">user</span> scope.
                    <div className="mt-1">
                      If needed, run: <span className="font-semibold">gh auth refresh -h github.com -s user</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="telemetry text-moss/70">NEXT RECOMMENDED MODULES</div>
              <ul className="mt-3 space-y-2 telemetry text-moss/70">
                <li>• Premium Requests: model mix, discount rate, cost concentration</li>
                <li>• Actions: minutes by runner + storage (gigabyte-hours)</li>
                <li>• Copilot seats: user-months burn rate vs seats</li>
                <li>• Drilldown chapters: Code / Collaboration / Operations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
