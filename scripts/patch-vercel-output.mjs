import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const configPath = [
  resolve(".vercel/output/config.json"),
  resolve("frontend/.vercel/output/config.json"),
].find((path) => existsSync(path));
const backendUrl = "https://shippinglabelsdashboard-1.onrender.com";

if (!configPath) {
  process.exit(0);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const routes = Array.isArray(config.routes) ? config.routes : [];
const proxyRoutes = [
  {
    src: "/api/v1/(.*)",
    dest: `${backendUrl}/api/v1/$1`,
  },
  {
    src: "/api/(.*)",
    dest: `${backendUrl}/api/v1/$1`,
  },
];

config.routes = [
  ...proxyRoutes,
  ...routes.filter((route) => !route.src?.startsWith("/api")),
];

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
