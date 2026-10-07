const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const api = path.join(root, "app", "api");

function routeFiles(dir, acc) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) routeFiles(p, acc);
    else if (name === "route.ts" || name === "route.ts.off") acc.push(p);
  }
  return acc;
}

function parkRoutes() {
  return routeFiles(api, []).filter(p => p.endsWith("route.ts")).map(p => {
    const parked = p + ".off";
    fs.renameSync(p, parked);
    return parked;
  });
}

function restoreRoutes(parked) {
  for (const p of parked) {
    if (fs.existsSync(p)) fs.renameSync(p, p.replace(/\.off$/, ""));
  }
}

function run(cmd, args, env) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

const parked = parkRoutes();
try {
  run("npx", ["next", "build"], { CAP_BUILD: "1" });
  run("npx", ["cap", "sync", "android"]);
} finally {
  restoreRoutes(parked);
}
