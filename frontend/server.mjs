import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./dist", import.meta.url)));
const indexFile = join(root, "index.html");
const port = Number(process.env.PORT || 5173);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

function sendFile(response, filePath, statusCode = 200) {
  const extension = extname(filePath);
  response.writeHead(statusCode, {
    "Content-Type": contentTypes.get(extension) || "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=31536000, immutable"
  });
  createReadStream(filePath).pipe(response);
}

function safeStaticPath(urlPath) {
  let decodedPath = "/";
  try {
    decodedPath = decodeURIComponent(urlPath.split("?")[0] || "/");
  } catch {
    return null;
  }
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, normalizedPath);
  return filePath === root || filePath.startsWith(`${root}${sep}`) ? filePath : null;
}

createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
    return;
  }

  const filePath = safeStaticPath(request.url || "/");
  if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(response, filePath);
    return;
  }

  const extension = extname(filePath || "");
  if (extension && extension !== ".html") {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  sendFile(response, indexFile);
}).listen(port, "0.0.0.0", () => {
  console.log(`UBOOK frontend serving ${root} on port ${port}`);
});
