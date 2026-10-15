import { createServer } from "node:http";

// Pengganti origin statis editor untuk e2e apps/web: `/editor/*` → index.html (SPA fallback) + satu script eksternal.
const port = Number(process.argv[2] ?? 5998);
createServer((req, res) => {
  if (req.url === "/editor/app.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    res.end('document.body.dataset.editorScript = "ok";');
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(
    '<!doctype html><html><head><title>Editor fixture</title></head><body><script type="module" src="/editor/app.js"></script></body></html>',
  );
}).listen(port, "127.0.0.1");
