/**
 * Local static server that mirrors the production routing contract so QA can run
 * before deploying: trailing-slash directory indexes, configured 301s, a real
 * 404 page and 410 Gone for the verified spam category URLs.
 *
 *   node scripts/serve.mjs [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { redirects, GONE_CATEGORY_SLUGS } from '../src/lib/redirects.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist', 'client');
const PORT = Number(process.argv[2] || 4399);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const GONE_PATHS = new Set(GONE_CATEGORY_SLUGS.map((s) => `/category/${s}/`));

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);

  const redirect = redirects[pathname];
  if (redirect) {
    const dest = typeof redirect === 'string' ? redirect : redirect.destination;
    const status = typeof redirect === 'string' ? 301 : redirect.status;
    res.writeHead(status, { location: dest });
    return res.end();
  }

  if (GONE_PATHS.has(pathname)) {
    res.writeHead(410, { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' });
    return res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>410 Gone - Inserts Hub</title></head><body><h1>410 Gone</h1><p>This URL was created by a security incident and has been permanently removed.</p></body></html>');
  }

  // Directory URLs resolve to their index.html; assets are served as-is.
  let file = path.join(DIST, pathname);
  if (pathname.endsWith('/')) file = path.join(file, 'index.html');

  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file);
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' });
    return res.end(fs.readFileSync(file));
  }

  // A path missing its trailing slash gets one, matching trailingSlash: 'always'.
  if (!pathname.endsWith('/') && fs.existsSync(path.join(DIST, pathname, 'index.html'))) {
    res.writeHead(301, { location: pathname + '/' });
    return res.end();
  }

  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
  return res.end(fs.readFileSync(path.join(DIST, '404.html')));
});

server.listen(PORT, () => console.log(`serving dist/client on http://localhost:${PORT}`));
