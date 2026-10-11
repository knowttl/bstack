import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";

export async function preview(port = 0) {
  const root = resolve(import.meta.dirname, "..");
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
  };
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const path = resolve(
        root,
        `.${pathname === "/" ? "/index.html" : pathname}`,
      );
      if (
        !path.startsWith(root + sep) ||
        (!["/index.html", "/style.css"].includes(pathname) &&
          !pathname.startsWith("/dist/") &&
          pathname !== "/")
      ) {
        res.writeHead(404);
        res.end();
        return;
      }
      const body = await readFile(path);
      res.setHeader(
        "Content-Type",
        types[extname(path)] ?? "application/octet-stream",
      );
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", done);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      ),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = await preview(4173);
  console.log(server.url);
}
