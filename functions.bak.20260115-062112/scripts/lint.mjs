import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (existsSync("node_modules/typescript/bin/tsc")) {
  run("npm run -s build");
} else {
  console.error("typescript missing; run pnpm install");
  process.exit(1);
}
