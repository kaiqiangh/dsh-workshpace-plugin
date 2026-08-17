// Syntax-check every source file under src/ so new files are covered
// automatically (the previous check script enumerated files by hand).
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";

const files = globSync("src/**/*.ts").filter((file) => !file.endsWith(".d.ts")).sort();
let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--experimental-strip-types", "--check", file], { stdio: "pipe" });
  } catch (error) {
    failed += 1;
    console.error(`check failed: ${file}`);
    const stdout = error?.stdout?.toString?.();
    const stderr = error?.stderr?.toString?.();
    if (stderr) console.error(stderr.split("\n").slice(0, 8).join("\n"));
    else if (stdout) console.error(stdout.split("\n").slice(0, 8).join("\n"));
    else console.error(error?.message ?? error);
  }
}
if (failed > 0) {
  console.error(`${failed} source file(s) failed syntax check`);
  process.exit(1);
}
console.log(`check: ${files.length} source file(s) OK`);
