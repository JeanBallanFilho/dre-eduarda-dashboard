const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const base = __dirname;
const port = 4173;
const sheets = {
  actual2026: "814918860",
  actual2025: "998510839",
  budget2026: "1577072601"
};
const sheetBaseUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQe1qVYU1Phvbnjs3-X1lSNYCvmZFz78TqSj4VowqilN6p_FdvqLxYoUboU8JhXh8IlBBsaOkH2cF61/pub";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

http
  .createServer(async (request, response) => {
    try {
      if (request.url.startsWith("/api/sheet")) {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const gid = sheets[url.searchParams.get("name")];
        if (!gid) throw new Error("Invalid sheet");
        const sheet = await fetch(`${sheetBaseUrl}?gid=${gid}&single=true&output=csv&t=${Date.now()}`);
        const csv = await sheet.text();
        response.writeHead(200, {
          "content-type": "text/csv; charset=utf-8",
          "cache-control": "no-store"
        });
        response.end(csv);
        return;
      }

      const route = decodeURIComponent(request.url.split("?")[0]);
      const filePath = path.join(base, route === "/" ? "index.html" : route);
      if (!filePath.startsWith(base)) throw new Error("Invalid path");
      const data = await fs.readFile(filePath);
      response.writeHead(200, { "content-type": types[path.extname(filePath)] || "application/octet-stream" });
      response.end(data);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Arquivo nao encontrado");
    }
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Dashboard: http://127.0.0.1:${port}`);
  });
