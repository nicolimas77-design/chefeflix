const TMDB_BASE = 'https://api.themoviedb.org/3';

const allowedTmdbPaths = [
  /^\/trending\/(all|movie|tv)\/week$/,
  /^\/(movie|tv)\/(popular|top_rated)$/,
  /^\/genre\/(movie|tv)\/list$/,
  /^\/discover\/(movie|tv)$/,
  /^\/search\/multi$/,
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/external_ids$/,
  /^\/tv\/\d+$/,
  /^\/tv\/\d+\/season\/\d+$/,
];

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const token = process.env.TMDB_READ_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'TMDB_READ_TOKEN não configurado no servidor.' });
    return;
  }

  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  const tmdbPath = `/${segments.filter(Boolean).join('/')}`;
  if (!allowedTmdbPaths.some((pattern) => pattern.test(tmdbPath))) {
    res.status(404).json({ error: 'Endpoint não permitido.' });
    return;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path' || key === 'api_key') continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  query.set('language', 'pt-BR');

  try {
    const response = await fetch(`${TMDB_BASE}${tmdbPath}?${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const body = await response.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(response.status).send(body);
  } catch {
    res.status(502).json({ error: 'Não foi possível consultar o TMDB agora.' });
  }
};
