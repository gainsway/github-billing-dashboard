import http from "node:http";
import { spawn } from "node:child_process";
import { URL } from "node:url";

const BASE_PORT = Number(process.env.PORT ?? "5174");

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });

    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));

    child.on("error", (e) => reject(e));
    child.on("close", (code) => {
      resolve({ code, out, err });
    });
  });
}

async function ghApi(path, query = new URLSearchParams()) {
  const qs = query.toString();
  const full = qs ? `${path}?${qs}` : path;

  const args = [
    "api",
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    "X-GitHub-Api-Version: 2022-11-28",
    full
  ];

  const { code, out, err } = await run("gh", args);
  if (code !== 0) {
    throw new Error(`gh api failed (${code}): ${err || out}`);
  }

  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

async function ghAuthStatus() {
  const { code, out, err } = await run("gh", ["auth", "status"]);
  if (code !== 0) {
    return { ok: false, error: err || out };
  }

  const tokenRedacted = out.replace(/gho_[A-Za-z0-9_]+/g, "gho_***");
  const scopesMatch = tokenRedacted.match(/Token scopes: ([^\n\r]+)/);
  const userMatch = tokenRedacted.match(/Logged in to github\.com account ([^\s]+)/);

  return {
    ok: true,
    user: userMatch ? userMatch[1] : null,
    scopes: scopesMatch
      ? scopesMatch[1]
          .split(",")
          .map((s) => s.trim().replace(/'/g, ""))
      : [],
    raw: tokenRedacted
  };
}

function clampPeriod(qp) {
  const year = Number(qp.get("year") ?? "NaN");
  const month = Number(qp.get("month") ?? "NaN");
  const okYear = Number.isFinite(year) && year >= 2008 && year <= 2100;
  const okMonth = Number.isFinite(month) && month >= 1 && month <= 12;
  return {
    year: okYear ? year : undefined,
    month: okMonth ? month : undefined
  };
}

function clampIso(d) {
  // very light validation: YYYY-MM-DD
  if (typeof d !== "string") return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return d;
}

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`download failed (${r.status})`);
  }
  return await r.text();
}

// Simple in-memory cache for downloaded reports
const cache = new Map();
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}
function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url ?? "/", `http://localhost:${BASE_PORT}`);

  if (req.method === "GET" && u.pathname === "/api/health") {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && u.pathname === "/api/auth/status") {
    json(res, 200, await ghAuthStatus());
    return;
  }

  const orgMeta = u.pathname.match(/^\/api\/org\/([^/]+)$/);
  if (req.method === "GET" && orgMeta) {
    const org = orgMeta[1];
    try {
      const data = await ghApi(`/orgs/${org}`);
      json(res, 200, data);
    } catch (e) {
      json(res, 502, { error: String(e?.message ?? e) });
    }
    return;
  }

  const usageSummaryOrg = u.pathname.match(
    /^\/api\/billing\/usage\/summary\/org\/([^/]+)$/
  );
  if (req.method === "GET" && usageSummaryOrg) {
    const org = usageSummaryOrg[1];
    const qp = new URLSearchParams(u.search);
    const p = clampPeriod(qp);
    const q = new URLSearchParams();
    if (p.year && p.month) {
      q.set("year", String(p.year));
      q.set("month", String(p.month));
    }

    try {
      const data = await ghApi(
        `/organizations/${org}/settings/billing/usage/summary`,
        q
      );
      json(res, 200, data);
    } catch (e) {
      json(res, 502, { error: String(e?.message ?? e) });
    }
    return;
  }

  const premiumOrg = u.pathname.match(
    /^\/api\/billing\/premium-request\/org\/([^/]+)$/
  );
  if (req.method === "GET" && premiumOrg) {
    const org = premiumOrg[1];
    const qp = new URLSearchParams(u.search);
    const p = clampPeriod(qp);
    const q = new URLSearchParams();
    if (p.year && p.month) {
      q.set("year", String(p.year));
      q.set("month", String(p.month));
    }

    try {
      const data = await ghApi(
        `/organizations/${org}/settings/billing/premium_request/usage`,
        q
      );
      json(res, 200, data);
    } catch (e) {
      json(res, 502, { error: String(e?.message ?? e) });
    }
    return;
  }

  const premiumUser = u.pathname.match(
    /^\/api\/billing\/premium-request\/user\/([^/]+)$/
  );
  if (req.method === "GET" && premiumUser) {
    const user = premiumUser[1];
    const qp = new URLSearchParams(u.search);
    const p = clampPeriod(qp);
    const q = new URLSearchParams();
    if (p.year && p.month) {
      q.set("year", String(p.year));
      q.set("month", String(p.month));
    }

    try {
      const data = await ghApi(
        `/users/${user}/settings/billing/premium_request/usage`,
        q
      );
      json(res, 200, data);
    } catch (e) {
      json(res, 502, {
        error: String(e?.message ?? e),
        hint: "This endpoint usually requires gh auth scope: user (gh auth refresh -h github.com -s user)"
      });
    }
    return;
  }

  if (req.method === "GET" && u.pathname === "/api/copilot/seats") {
    try {
      const data = await ghApi(`/orgs/gainsway/copilot/billing/seats`);
      json(res, 200, data);
    } catch (e) {
      json(res, 502, { error: String(e?.message ?? e) });
    }
    return;
  }

  // Copilot Metrics: per-user/day rows via the users-28-day report.
  if (req.method === "GET" && u.pathname === "/api/copilot/metrics/users") {
    const qp = new URLSearchParams(u.search);
    const org = qp.get("org") ?? "gainsway";
    const since = clampIso(qp.get("since") ?? "");
    const until = clampIso(qp.get("until") ?? "");

    const cacheKey = `users28:${org}`;

    try {
      let payload = cacheGet(cacheKey);
      if (!payload) {
        const meta = await ghApi(`/orgs/${org}/copilot/metrics/reports/users-28-day/latest`);
        const link = meta?.download_links?.[0];
        if (!link) {
          json(res, 502, { error: "No download_links returned from metrics report" });
          return;
        }
        const raw = await fetchText(link);
        payload = { meta, raw };
        cacheSet(cacheKey, payload, 5 * 60 * 1000);
      }

      const { meta, raw } = payload;
      const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const rows = [];
      for (const l of lines) {
        try {
          const o = JSON.parse(l);
          const day = String(o.day ?? "");
          if (since && day && day < since) continue;
          if (until && day && day > until) continue;
          rows.push(o);
        } catch {
          // skip malformed line
        }
      }

      json(res, 200, {
        org,
        report_start_day: meta.report_start_day,
        report_end_day: meta.report_end_day,
        rows,
        notes: [
          "Rows are sourced from GitHub Copilot Metrics users-28-day report.",
          "This endpoint downloads the report and filters by since/until (YYYY-MM-DD)."
        ]
      });
    } catch (e) {
      json(res, 502, { error: String(e?.message ?? e) });
    }
    return;
  }

  json(res, 404, { error: "Not found" });
});

function start(port, attemptsLeft = 20) {
  server.once("error", (err) => {
    if (err?.code === "EADDRINUSE" && attemptsLeft > 0) {
      const next = port + 1;
      console.warn(`[server] port ${port} in use, trying ${next}…`);
      start(next, attemptsLeft - 1);
      return;
    }

    console.error("[server] fatal:", err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });
}

start(BASE_PORT);
