const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const TMDB_BASE = 'https://api.themoviedb.org/3';

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const PORT = Number(process.env.PORT) || 3000;
const TOKEN = process.env.TMDB_READ_TOKEN;
const allowedTmdbPaths = [
  /^\/trending\/(all|movie|tv)\/week$/,
  /^\/(movie|tv)\/(popular|top_rated)$/,
  /^\/genre\/(movie|tv)\/list$/,
  /^\/discover\/(movie|tv)$/,
  /^\/search\/multi$/,
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/external_ids$/,
  /^\/tv\/\d+$/,
  /^\/tv\/\d+\/season\/\d+$/
];
const staticFiles = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml']
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': type.startsWith('application/json') ? 'no-store' : 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

async function proxyTmdb(req, res, url) {
  if (!TOKEN) {
    send(res, 500, JSON.stringify({ error: 'TMDB_READ_TOKEN não configurado no servidor.' }));
    return;
  }

  const tmdbPath = url.pathname.replace('/api/tmdb', '') || '/';
  if (!allowedTmdbPaths.some((pattern) => pattern.test(tmdbPath))) {
    send(res, 404, JSON.stringify({ error: 'Endpoint não permitido.' }));
    return;
  }

  const query = new URLSearchParams(url.searchParams);
  query.set('language', 'pt-BR');
  query.delete('api_key');

  try {
    const response = await fetch(`${TMDB_BASE}${tmdbPath}?${query}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json'
      }
    });
    const body = await response.text();
    send(res, response.status, body);
  } catch {
    send(res, 502, JSON.stringify({ error: 'Não foi possível consultar o TMDB agora.' }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method !== 'GET') {
    send(res, 405, JSON.stringify({ error: 'Método não permitido.' }));
    return;
  }

  if (url.pathname.startsWith('/api/tmdb/')) {
    await proxyTmdb(req, res, url);
    return;
  }

  const file = staticFiles[url.pathname];
  if (!file) {
    send(res, 404, 'Página não encontrada.', 'text/plain; charset=utf-8');
    return;
  }

  fs.readFile(path.join(ROOT, file[0]), (error, content) => {
    if (error) send(res, 500, 'Erro ao carregar o site.', 'text/plain; charset=utf-8');
    else send(res, 200, content, file[1]);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CHEFEFLIX disponível em http://localhost:${PORT}`);
});
