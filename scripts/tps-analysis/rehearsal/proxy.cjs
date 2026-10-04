// proxy.cjs — minimal reverse proxy so a stock supabase-js client works against bare PostgREST.
// supabase-js calls <url>/rest/v1/<table>; PostgREST serves at root. This strips "/rest/v1"
// and streams the request/response untouched. 127.0.0.1 only.
const http = require("node:http");
const LISTEN = Number(process.env.PROXY_PORT || 54331);
const TARGET = Number(process.env.REST_PORT || 54330);
const agent = new http.Agent({ keepAlive: true, maxSockets: 64 });
http.createServer((req, res) => {
  const url = req.url.startsWith("/rest/v1") ? req.url.slice("/rest/v1".length) || "/" : req.url;
  const headers = { ...req.headers, host: `127.0.0.1:${TARGET}` };
  const up = http.request({ host: "127.0.0.1", port: TARGET, method: req.method, path: url, headers, agent }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  up.on("error", (e) => { if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" }); res.end(JSON.stringify({ message: "proxy: " + e.message })); });
  req.pipe(up);
}).listen(LISTEN, "127.0.0.1", () => console.log(`proxy listening on 127.0.0.1:${LISTEN} -> ${TARGET}`));
