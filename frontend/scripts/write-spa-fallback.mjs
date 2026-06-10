import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const distRoot = join(projectRoot, "dist");
const indexFile = join(distRoot, "index.html");

if (!existsSync(indexFile)) {
  throw new Error("Cannot write SPA fallback before dist/index.html exists");
}

mkdirSync(distRoot, { recursive: true });
copyFileSync(indexFile, join(distRoot, "404.html"));
writeFileSync(join(distRoot, "_redirects"), "/* /index.html 200\n", "utf8");
