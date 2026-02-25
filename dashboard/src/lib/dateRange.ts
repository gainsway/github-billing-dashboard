export type DateRange = { since: string; until: string };

export function yyyyMmDd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function lastNDays(n: number): DateRange {
  const until = new Date();
  const since = new Date();
  since.setDate(until.getDate() - (n - 1));
  return { since: yyyyMmDd(since), until: yyyyMmDd(until) };
}

export function thisMonth(): DateRange {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { since: yyyyMmDd(since), until: yyyyMmDd(now) };
}

export function ytd(): DateRange {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return { since: yyyyMmDd(since), until: yyyyMmDd(now) };
}

export function clampRange(r: DateRange): DateRange {
  if (r.since <= r.until) return r;
  return { since: r.until, until: r.since };
}

export function monthFromIso(iso: string) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return { year: y, month: m };
}
