import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

const source = resolve("frontend/.vercel/output");
const destination = resolve(".vercel/output");

if (!existsSync(source)) {
  throw new Error(`Expected Vercel build output at ${source}`);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(dirname(destination), { recursive: true });
cpSync(source, destination, { recursive: true });
