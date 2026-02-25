import React, { createContext, useContext, useMemo, useState } from "react";

export type BillingPeriod = {
  year: number;
  month: number; // 1-12
};

export type DashboardConfig = {
  org: string;
  period: BillingPeriod;
  setPeriod: (p: BillingPeriod) => void;
  isConfigOpen: boolean;
  setConfigOpen: (v: boolean) => void;
  userLogin: string;
  setUserLogin: (v: string) => void;
  includeUserEndpoints: boolean;
  setIncludeUserEndpoints: (v: boolean) => void;
};

const Ctx = createContext<DashboardConfig | null>(null);

function currentPeriod(): BillingPeriod {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function ConfigProvider(props: { children: React.ReactNode }) {
  const [period, setPeriod] = useState<BillingPeriod>(currentPeriod());
  const [isConfigOpen, setConfigOpen] = useState(false);
  const [userLogin, setUserLogin] = useState("timechainer");
  const [includeUserEndpoints, setIncludeUserEndpoints] = useState(false);

  const value = useMemo<DashboardConfig>(() => {
    return {
      org: "gainsway",
      period,
      setPeriod,
      isConfigOpen,
      setConfigOpen,
      userLogin,
      setUserLogin,
      includeUserEndpoints,
      setIncludeUserEndpoints
    };
  }, [period, isConfigOpen, userLogin, includeUserEndpoints]);

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useConfig() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useConfig must be used within ConfigProvider");
  return v;
}

export function formatPeriod(p: BillingPeriod) {
  const mm = String(p.month).padStart(2, "0");
  return `${p.year}-${mm}`;
}

export function periodQuery(p: BillingPeriod) {
  const qs = new URLSearchParams();
  qs.set("year", String(p.year));
  qs.set("month", String(p.month));
  return qs;
}
