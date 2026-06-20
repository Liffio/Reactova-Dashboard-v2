import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import server from './dist/server/server.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const STATIC_DIR = join(__dirname, 'dist', 'client');

const MIME = {
  '.js':    'application/javascript',
  '.mjs':   'application/javascript',
  '.css':   'text/css',
  '.html':  'text/html',
  '.json':  'application/json',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.webp':  'image/webp',
  '.map':   'application/json',
};

function serveStatic(urlPath, res) {
  const filePath = join(STATIC_DIR, urlPath);
  if (!filePath.startsWith(STATIC_DIR)) { res.writeHead(403); res.end(); return true; }
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const isImmutable = urlPath.startsWith('/assets/');
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': isImmutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    });
    createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // Serve static files from dist/client
  if (serveStatic(urlPath, res)) return;

  // SSR handler
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value != null) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = req.method !== 'GET' && req.method !== 'HEAD' && chunks.length > 0
    ? Buffer.concat(chunks)
    : undefined;

  const request = new Request(url.toString(), { method: req.method, headers, body });

  let response;
  try {
    response = await server.fetch(request);
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Internal Server Error');
    return;
  }

  const respHeaders = {};
  response.headers.forEach((value, key) => { respHeaders[key] = value; });
  res.writeHead(response.status, respHeaders);

  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
}).listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
