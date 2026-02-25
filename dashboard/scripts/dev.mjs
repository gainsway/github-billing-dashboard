import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

function envWith(base, extra) {
  return { ...base, ...extra };
}

function tryListen(port) {
  return new Promise((resolve) => {
    const srv = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        srv.close(() => resolve(true));
      });

    srv.listen(port, "127.0.0.1");
  });
}

async function findFreePort(preferred, maxScan = 80) {
  for (let p = preferred; p < preferred + maxScan; p++) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await tryListen(p);
    if (ok) return p;
  }
  throw new Error(
    `No free port found in range ${preferred}-${preferred + maxScan - 1}`
  );
}

function run(cmd, args, opts) {
  return spawn(cmd, args, {
    ...opts,
    stdio: "inherit",
    windowsHide: true
  });
}

function runNpmScript(script, opts) {
  // Most reliable: invoke npm's JS entrypoint via node (avoids .cmd spawning issues).
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return run(process.execPath, [npmExecPath, "run", script], opts);
  }

  // Fallback: use cmd.exe to run npm (works even when npm is a .cmd on PATH).
  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/s", "/c", `npm run ${script}`], opts);
  }

  return run("npm", ["run", script], opts);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// Prefer the familiar Vite defaults, but be resilient.
const BASE_CLIENT = 5173;
const BASE_SERVER = 5174;

const serverPort = await findFreePort(BASE_SERVER);
// If server grabbed 5173 (rare), move client range away.
const clientBase = serverPort === BASE_CLIENT ? BASE_CLIENT + 10 : BASE_CLIENT;
const clientPort = await findFreePort(clientBase);

console.log(`[dev] chosen ports → client:${clientPort} server:${serverPort}`);

let server;
let client;

function shutdown(code = 0) {
  try {
    client?.kill("SIGTERM");
  } catch {}
  try {
    server?.kill("SIGTERM");
  } catch {}
  process.exit(code);
}

server = run(process.execPath, ["server/index.mjs"], {
  cwd: root,
  env: envWith(process.env, { PORT: String(serverPort) })
});

server.on("error", (err) => {
  console.error(`[dev] failed to start server: ${err?.message ?? err}`);
  shutdown(1);
});

client = runNpmScript("dev:client", {
  cwd: root,
  env: envWith(process.env, {
    VITE_PORT: String(clientPort),
    VITE_API_TARGET: `http://localhost:${serverPort}`
  })
});

client.on("error", (err) => {
  console.error(`[dev] failed to start client: ${err?.message ?? err}`);
  shutdown(1);
});

client.on("exit", (code) => {
  console.log(`[dev] client exited (${code ?? 0})`);
  shutdown(code ?? 0);
});

server.on("exit", (code) => {
  console.log(`[dev] server exited (${code ?? 0})`);
  shutdown(code ?? 0);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
