const API_ROOT = '/api/tmdb';
const IMAGE_ROOT = 'https://image.tmdb.org/t/p';
const EMBED_ROOT = 'https://myembed.biz';

const app = document.querySelector('#app');
const header = document.querySelector('#site-header');
const menuButton = document.querySelector('#menu-button');
const searchForm = document.querySelector('#search-form');
const searchInput = document.querySelector('#search-input');

const state = {
  requestId: 0,
  show: null,
  season: null,
  genres: null,
  categoryCards: null,
  categoryFeed: null,
  categoryObserver: null,
  browseFeed: null,
  browseObserver: null,
  homeFeed: null,
  homeObserver: null,
  tvMode: null,
};

const icons = {
  play: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11-7.2a1 1 0 0 0 0-1.7L8.6 4c-.7-.5-1.6 0-1.6.8Z"/></svg>',
  star: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 2.8 2.8 5.7 6.3.9-4.5 4.4 1 6.3-5.6-3-5.6 3 1-6.3-4.5-4.4 6.3-.9L12 2.8Z"/></svg>',
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function imageUrl(path, size = 'w500') {
  return path ? `${IMAGE_ROOT}/${size}${path}` : '';
}

function titleOf(item) {
  return item.title || item.name || 'Título indisponível';
}

function yearOf(item) {
  const date = item.release_date || item.first_air_date;
  return date ? date.slice(0, 4) : 'Ano indisponível';
}

function typeOf(item) {
  if (item.media_type === 'movie' || item.title) return 'movie';
  return 'tv';
}

function formatRating(value) {
  return Number(value) > 0 ? Number(value).toFixed(1) : null;
}

function formatRuntime(minutes) {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest ? `${rest}min` : ''}`.trim() : `${rest}min`;
}

function setTitle(title) {
  document.title = title ? `${title} | CHEFEFLIX` : 'CHEFEFLIX';
}

function setActiveNav(name) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === name);
  });
}

async function api(path, parameters = {}) {
  const url = new URL(`${API_ROOT}${path}`, window.location.origin);
  Object.entries(parameters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  });
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error('O servidor do CHEFEFLIX está desligado. Execute iniciar-chefeflix.cmd e tente novamente.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.status_message || 'Não foi possível carregar os dados.');
  return data;
}

function loading() {
  app.innerHTML = '<div class="page-loader" aria-label="Carregando"><span class="loader-mark"><i></i><b></b></span><p>Preparando sua próxima história</p></div>';
}

function renderError(error) {
  setTitle('Erro');
  app.innerHTML = `
    <section class="page error-state">
      <div class="state-icon">!</div>
      <h2>Algo saiu do roteiro</h2>
      <p>${escapeHtml(error.message || 'Não foi possível carregar esta página. Tente novamente em instantes.')}</p>
      <button class="button button-violet" data-retry>Carregar novamente</button>
    </section>`;
}

function posterMarkup(item) {
  const poster = imageUrl(item.poster_path);
  if (poster) return `<img src="${poster}" alt="Capa de ${escapeHtml(titleOf(item))}" loading="lazy">`;
  return '<div class="no-poster"><span class="brand-mark"><i></i><b></b></span><small>Imagem indisponível</small></div>';
}

function mediaCard(item, showTypeBadge = false) {
  const type = typeOf(item);
  const rating = formatRating(item.vote_average);
  return `
    <a class="media-card ${showTypeBadge ? 'category-media-card' : ''}" href="#/${type}/${Number(item.id)}" aria-label="Ver detalhes de ${escapeHtml(titleOf(item))}">
      <div class="poster">
        ${posterMarkup(item)}
        ${showTypeBadge ? `<span class="type-badge">${type === 'movie' ? 'Filme' : 'Série'}</span>` : ''}
        <span class="card-play">${icons.play}</span>
      </div>
      <div class="card-info">
        <h3>${escapeHtml(titleOf(item))}</h3>
        <div class="card-meta">
          <span>${escapeHtml(yearOf(item))} · ${type === 'movie' ? 'Filme' : 'Série'}</span>
          ${rating ? `<span class="rating">${icons.star}${rating}</span>` : ''}
        </div>
      </div>
    </a>`;
}

function rail(title, items, href) {
  if (!items?.length) return '';
  return `
    <section class="rail">
      <div class="rail-head"><h2>${escapeHtml(title)}</h2><a href="${href}">Ver todos →</a></div>
      <div class="card-row">${items.slice(0, 14).map(mediaCard).join('')}</div>
    </section>`;
}

function heroMarkup(item) {
  const type = typeOf(item);
  const rating = formatRating(item.vote_average);
  const backdrop = imageUrl(item.backdrop_path, 'original') || imageUrl(item.poster_path, 'original');
  return `
    <section class="hero">
      <div class="hero-bg" style="background-image:url('${backdrop}')"></div>
      <div class="hero-content">
        <div class="eyebrow">Em alta agora</div>
        <h1>${escapeHtml(titleOf(item))}</h1>
        <p class="hero-copy">${escapeHtml(item.overview || 'Informações sobre este título ainda não estão disponíveis em português.')}</p>
        <div class="meta">
          <span>${escapeHtml(yearOf(item))}</span>
          <span>${type === 'movie' ? 'Filme' : 'Série'}</span>
          ${rating ? `<span class="rating">${icons.star}${rating}</span>` : ''}
        </div>
        <div class="actions">
          <a class="button" href="#/${type}/${Number(item.id)}?watch=1">${icons.play} Assistir agora</a>
          <a class="button button-secondary" href="#/${type}/${Number(item.id)}">Mais informações</a>
        </div>
      </div>
    </section>`;
}

async function renderHome(requestId) {
  setActiveNav('home');
  setTitle('');
  const [trending, popularMovies, popularShows, topMovies] = await Promise.all([
    api('/trending/all/week'),
    api('/movie/popular', { page: 1 }),
    api('/tv/popular', { page: 1 }),
    api('/movie/top_rated', { page: 1 }),
  ]);
  if (requestId !== state.requestId) return;
  const hero = trending.results.find((item) => item.backdrop_path && item.overview && ['movie', 'tv'].includes(item.media_type)) || trending.results[0];
  if (!hero) throw new Error('O catálogo está temporariamente vazio.');
  const catalogItems = interleaveResults(popularMovies.results || [], popularShows.results || []);
  state.homeFeed = {
    requestId,
    loading: false,
    seen: new Set(catalogItems.map((item) => `${item.media_type}-${item.id}`)),
    movie: { page: 1, totalPages: Math.min(Number(popularMovies.total_pages) || 1, 500) },
    tv: { page: 1, totalPages: Math.min(Number(popularShows.total_pages) || 1, 500) },
  };
  app.innerHTML = `
    ${heroMarkup(hero)}
    <div class="home-rails">
      ${rail('Em destaque', trending.results, '#/browse/trending')}
      ${rail('Filmes populares', popularMovies.results, '#/browse/movie')}
      ${rail('Séries para maratonar', popularShows.results, '#/browse/tv')}
      ${rail('Mais bem avaliados', topMovies.results, '#/browse/movie')}
    </div>
    <section class="home-catalog">
      <div class="rail-head"><div><div class="eyebrow">Continue explorando</div><h2>Todo o catálogo</h2></div></div>
      <div class="media-grid" id="home-catalog-grid">${catalogItems.map((item) => mediaCard(item, true)).join('')}</div>
      <div class="feed-sentinel" id="home-catalog-sentinel" aria-live="polite"><span>Role para descobrir mais títulos</span></div>
    </section>`;
  const sentinel = document.querySelector('#home-catalog-sentinel');
  state.homeObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadMoreHome();
  }, { rootMargin: '160px 0px' });
  state.homeObserver.observe(sentinel);
}

async function renderBrowse(kind, requestId) {
  const isMovie = kind === 'movie';
  const isTrending = kind === 'trending';
  setActiveNav(isTrending ? 'home' : kind);
  const heading = isTrending ? 'Em alta' : isMovie ? 'Filmes' : 'Séries';
  setTitle(heading);
  const data = isTrending
    ? await api('/trending/all/week')
    : await api(`/${kind}/popular`, { page: 1 });
  if (requestId !== state.requestId) return;
  const items = (data.results || []).filter((item) => typeOf(item) !== 'person');
  const seen = new Set(items.map((item) => item.id));
  if (!isTrending) {
    state.browseFeed = {
      kind,
      requestId,
      page: Number(data.page) || 1,
      totalPages: Math.min(Number(data.total_pages) || 1, 500),
      loading: false,
      seen,
    };
  }
  app.innerHTML = `
    <section class="page">
      <div class="page-heading">
        <div><div class="eyebrow">Explore o catálogo</div><h1>${heading}</h1></div>
        <span class="result-count" id="browse-count">${isTrending ? `${items.length} títulos nesta seleção` : `${items.length} títulos exibidos`}</span>
      </div>
      <div class="media-grid" id="browse-grid">${items.map(mediaCard).join('')}</div>
      ${isTrending ? '' : '<div class="feed-sentinel" id="browse-sentinel" aria-live="polite"><span>Role para ver mais títulos</span></div>'}
    </section>`;
  if (!isTrending) {
    const sentinel = document.querySelector('#browse-sentinel');
    state.browseObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreBrowse();
    }, { rootMargin: '160px 0px' });
    state.browseObserver.observe(sentinel);
  }
}

async function loadMoreBrowse() {
  const feed = state.browseFeed;
  if (!feed || feed.loading || feed.requestId !== state.requestId || feed.page >= feed.totalPages) return;
  feed.loading = true;
  const sentinel = document.querySelector('#browse-sentinel');
  if (sentinel) sentinel.innerHTML = '<span class="feed-loader"></span><span>Carregando mais títulos...</span>';
  try {
    const data = await api(`/${feed.kind}/popular`, { page: feed.page + 1 });
    if (feed !== state.browseFeed || feed.requestId !== state.requestId) return;
    feed.page = Number(data.page) || feed.page + 1;
    feed.totalPages = Math.min(Number(data.total_pages) || feed.totalPages, 500);
    const fresh = (data.results || []).filter((item) => {
      if (feed.seen.has(item.id)) return false;
      feed.seen.add(item.id);
      return true;
    });
    document.querySelector('#browse-grid')?.insertAdjacentHTML('beforeend', fresh.map(mediaCard).join(''));
    const count = document.querySelector('#browse-count');
    if (count) count.textContent = `${feed.seen.size} títulos exibidos`;
    if (feed.page >= feed.totalPages) {
      if (sentinel) sentinel.innerHTML = '<span>Todos os títulos disponibilizados pelo TMDB foram exibidos.</span>';
    } else {
      if (sentinel) sentinel.innerHTML = '<span>Continue rolando para ver mais</span>';
    }
  } catch (error) {
    if (feed !== state.browseFeed) return;
    state.browseObserver?.disconnect();
    if (sentinel) sentinel.innerHTML = `<span>${escapeHtml(error.message)}</span><button class="feed-retry" data-browse-retry>Tentar novamente</button>`;
  } finally {
    if (feed === state.browseFeed) feed.loading = false;
  }
}

async function loadMoreHome() {
  const feed = state.homeFeed;
  if (!feed || feed.loading || feed.requestId !== state.requestId) return;
  const movieDone = feed.movie.page >= feed.movie.totalPages;
  const tvDone = feed.tv.page >= feed.tv.totalPages;
  if (movieDone && tvDone) return;
  feed.loading = true;
  const sentinel = document.querySelector('#home-catalog-sentinel');
  if (sentinel) sentinel.innerHTML = '<span class="feed-loader"></span><span>Carregando mais títulos...</span>';
  try {
    const [movies, shows] = await Promise.all([
      movieDone ? Promise.resolve({ results: [], page: feed.movie.page, total_pages: feed.movie.totalPages }) : api('/movie/popular', { page: feed.movie.page + 1 }),
      tvDone ? Promise.resolve({ results: [], page: feed.tv.page, total_pages: feed.tv.totalPages }) : api('/tv/popular', { page: feed.tv.page + 1 }),
    ]);
    if (feed !== state.homeFeed || feed.requestId !== state.requestId) return;
    feed.movie.page = Number(movies.page) || feed.movie.page;
    feed.tv.page = Number(shows.page) || feed.tv.page;
    feed.movie.totalPages = Math.min(Number(movies.total_pages) || feed.movie.totalPages, 500);
    feed.tv.totalPages = Math.min(Number(shows.total_pages) || feed.tv.totalPages, 500);
    const fresh = interleaveResults(movies.results || [], shows.results || []).filter((item) => {
      const key = `${item.media_type}-${item.id}`;
      if (feed.seen.has(key)) return false;
      feed.seen.add(key);
      return true;
    });
    document.querySelector('#home-catalog-grid')?.insertAdjacentHTML('beforeend', fresh.map((item) => mediaCard(item, true)).join(''));
    const finished = feed.movie.page >= feed.movie.totalPages && feed.tv.page >= feed.tv.totalPages;
    if (sentinel) sentinel.innerHTML = finished ? '<span>Todo o catálogo disponibilizado pelo TMDB foi exibido.</span>' : '<span>Continue rolando para ver mais</span>';
  } catch (error) {
    if (feed !== state.homeFeed) return;
    state.homeObserver?.disconnect();
    if (sentinel) sentinel.innerHTML = `<span>${escapeHtml(error.message)}</span><button class="feed-retry" data-home-retry>Tentar novamente</button>`;
  } finally {
    if (feed === state.homeFeed) feed.loading = false;
  }
}

function genreKey(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function genreSlug(name) {
  return genreKey(name).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function getGenres() {
  if (state.genres) return state.genres;
  const [movies, shows] = await Promise.all([api('/genre/movie/list'), api('/genre/tv/list')]);
  const merged = new Map();
  for (const genre of movies.genres || []) {
    const key = genreKey(genre.name);
    merged.set(key, { name: genre.name, movieId: genre.id, tvId: null });
  }
  for (const genre of shows.genres || []) {
    const key = genreKey(genre.name);
    const current = merged.get(key) || { name: genre.name, movieId: null, tvId: null };
    current.tvId = genre.id;
    merged.set(key, current);
  }
  state.genres = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return state.genres;
}

async function renderCategories(requestId) {
  setActiveNav('categories');
  setTitle('Categorias');
  const genres = await getGenres();
  if (requestId !== state.requestId) return;

  if (!state.categoryCards) {
    const covers = await Promise.allSettled(genres.map((genre) => {
      const type = genre.movieId ? 'movie' : 'tv';
      const id = genre.movieId || genre.tvId;
      return api(`/discover/${type}`, { with_genres: id, page: 1, sort_by: 'popularity.desc', include_adult: false });
    }));
    if (requestId !== state.requestId) return;
    state.categoryCards = genres.map((genre, index) => {
      const data = covers[index].status === 'fulfilled' ? covers[index].value : null;
      const feature = data?.results?.find((item) => item.backdrop_path) || data?.results?.find((item) => item.poster_path);
      return { ...genre, image: feature?.backdrop_path || feature?.poster_path || null };
    });
  }

  app.innerHTML = `
    <section class="page categories-page">
      <div class="page-heading"><div class="category-intro"><div class="eyebrow">Explore por gênero</div><h1>Categorias</h1><p>Descubra novos mundos. Escolha um gênero e explore filmes e séries selecionados do catálogo.</p></div></div>
      <div class="category-grid">${state.categoryCards.map((genre) => {
        const parameters = new URLSearchParams({ name: genre.name });
        if (genre.movieId) parameters.set('movie', genre.movieId);
        if (genre.tvId) parameters.set('tv', genre.tvId);
        const image = genre.image ? imageUrl(genre.image, 'w780') : '';
        const types = [genre.movieId ? 'Filmes' : '', genre.tvId ? 'Séries' : ''].filter(Boolean).join(' e ');
        return `<a class="category-card" href="#/categories/${genreSlug(genre.name)}?${parameters}" ${image ? `style="--category-image:url('${image}')"` : ''}>
          <div><h2>${escapeHtml(genre.name)}</h2><span class="category-types">${types}</span></div>
        </a>`;
      }).join('')}</div>
    </section>`;
}

function interleaveResults(movies, shows) {
  const mixed = [];
  const length = Math.max(movies.length, shows.length);
  for (let index = 0; index < length; index += 1) {
    if (movies[index]) mixed.push({ ...movies[index], media_type: 'movie' });
    if (shows[index]) mixed.push({ ...shows[index], media_type: 'tv' });
  }
  return mixed;
}

function feedHasMore(feed) {
  return ['movie', 'tv'].some((type) => feed[type].id && feed[type].page < feed[type].totalPages);
}

function setFeedStatus(markup) {
  const sentinel = document.querySelector('#feed-sentinel');
  if (sentinel) sentinel.innerHTML = markup;
}

async function loadCategoryPage() {
  const feed = state.categoryFeed;
  if (!feed || feed.loading || feed.requestId !== state.requestId || !feedHasMore(feed)) return;
  feed.loading = true;
  setFeedStatus('<span class="feed-loader"></span><span>Carregando mais títulos...</span>');

  const sources = ['movie', 'tv'].filter((type) => feed[type].id && feed[type].page < feed[type].totalPages);
  const requests = sources.map((type) => {
    const source = feed[type];
    const page = source.page + 1;
    return api(`/discover/${type}`, { with_genres: source.id, page, sort_by: 'popularity.desc', include_adult: false })
      .then((data) => ({ type, page, data }));
  });
  const settled = await Promise.allSettled(requests);
  if (feed !== state.categoryFeed || feed.requestId !== state.requestId) return;

  const batches = { movie: [], tv: [] };
  let failed = false;
  for (const result of settled) {
    if (result.status === 'rejected') {
      failed = true;
      continue;
    }
    const { type, page, data } = result.value;
    feed[type].page = page;
    feed[type].totalPages = Math.max(0, Number(data.total_pages) || 0);
    batches[type] = data.results || [];
  }

  const fresh = interleaveResults(batches.movie, batches.tv).filter((item) => {
    const key = `${item.media_type}-${item.id}`;
    if (feed.seen.has(key)) return false;
    feed.seen.add(key);
    return true;
  });
  const grid = document.querySelector('#category-results');
  if (grid && fresh.length) grid.insertAdjacentHTML('beforeend', fresh.map((item) => mediaCard(item, true)).join(''));
  feed.loading = false;

  if (failed) {
    state.categoryObserver?.disconnect();
    feed.observerPaused = true;
    setFeedStatus('<span>Não foi possível carregar todos os títulos.</span><button class="feed-retry" data-feed-retry>Tentar novamente</button>');
  } else if (feedHasMore(feed)) {
    setFeedStatus('<span>Continue rolando para ver mais</span>');
    if (feed.observerPaused) {
      const sentinel = document.querySelector('#feed-sentinel');
      if (sentinel) state.categoryObserver?.observe(sentinel);
      feed.observerPaused = false;
    }
  } else if (!feed.seen.size) {
    setFeedStatus('<div class="empty-state"><div class="state-icon">⌕</div><h2>Nenhum título encontrado</h2><p>Esta categoria ainda não possui filmes ou séries disponíveis.</p></div>');
  } else {
    setFeedStatus('<span>Você chegou ao fim desta categoria.</span>');
  }
}

async function renderCategory(slug, params, requestId) {
  setActiveNav('categories');
  let name = params.get('name') || '';
  let movieId = Number(params.get('movie')) || null;
  let tvId = Number(params.get('tv')) || null;
  if (!name || (!movieId && !tvId)) {
    const genres = await getGenres();
    const genre = genres.find((item) => genreSlug(item.name) === slug);
    if (!genre) throw new Error('Esta categoria não foi encontrada.');
    name = genre.name;
    movieId = genre.movieId;
    tvId = genre.tvId;
  }
  if (requestId !== state.requestId) return;
  setTitle(name);
  app.innerHTML = `
    <section class="page category-results-page">
      <a class="back-link" href="#/categories">← Voltar para Categorias</a>
      <div class="category-result-head"><div class="eyebrow">Categoria</div><h1>${escapeHtml(name)}</h1><p>${movieId && tvId ? 'Filmes e séries' : movieId ? 'Filmes' : 'Séries'}</p></div>
      <div class="media-grid" id="category-results"></div>
      <div class="feed-sentinel" id="feed-sentinel" aria-live="polite"></div>
    </section>`;

  state.categoryFeed = {
    requestId,
    loading: false,
    observerPaused: false,
    seen: new Set(),
    movie: { id: movieId, page: 0, totalPages: movieId ? 1 : 0 },
    tv: { id: tvId, page: 0, totalPages: tvId ? 1 : 0 },
  };
  const sentinel = document.querySelector('#feed-sentinel');
  state.categoryObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadCategoryPage();
  }, { rootMargin: '160px 0px' });
  state.categoryObserver.observe(sentinel);
  await loadCategoryPage();
}

async function renderSearch(query, requestId) {
  setActiveNav('');
  setTitle(query ? `Busca: ${query}` : 'Busca');
  searchInput.value = query;
  if (!query || query.length < 2) {
    app.innerHTML = `
      <section class="page empty-state">
        <div class="state-icon">⌕</div><h2>Encontre sua próxima história</h2>
        <p>Digite pelo menos dois caracteres para buscar filmes e séries no catálogo do TMDB.</p>
      </section>`;
    return;
  }
  const data = await api('/search/multi', { query, include_adult: false, page: 1 });
  if (requestId !== state.requestId) return;
  const items = (data.results || []).filter((item) => ['movie', 'tv'].includes(item.media_type));
  app.innerHTML = `
    <section class="page">
      <div class="page-heading">
        <div><div class="eyebrow">Resultados para</div><h1>“${escapeHtml(query)}”</h1></div>
        <span class="result-count">${items.length} ${items.length === 1 ? 'título encontrado' : 'títulos encontrados'}</span>
      </div>
      ${items.length ? `<div class="media-grid">${items.map(mediaCard).join('')}</div>` : `
        <div class="empty-state"><div class="state-icon">⌕</div><h2>Nenhum título encontrado</h2><p>Tente outro nome, confira a ortografia ou busque por termos mais curtos.</p></div>`}
    </section>`;
}

function detailMeta(item, type) {
  const rating = formatRating(item.vote_average);
  const runtime = type === 'movie' ? formatRuntime(item.runtime) : (item.number_of_seasons ? `${item.number_of_seasons} temporada${item.number_of_seasons > 1 ? 's' : ''}` : '');
  return `
    <div class="meta">
      <span>${escapeHtml(yearOf(item))}</span>
      ${runtime ? `<span>${escapeHtml(runtime)}</span>` : ''}
      ${item.status ? `<span>${escapeHtml(item.status)}</span>` : ''}
      ${rating ? `<span class="rating">${icons.star}${rating} / 10</span>` : ''}
    </div>`;
}

function detailHero(item, type) {
  const backdrop = imageUrl(item.backdrop_path, 'original') || imageUrl(item.poster_path, 'original');
  return `
    <section class="detail-hero">
      <div class="detail-backdrop" style="background-image:url('${backdrop}')"></div>
      <div class="detail-content">
        <div class="eyebrow">${type === 'movie' ? 'Filme' : 'Série'}</div>
        <h1>${escapeHtml(titleOf(item))}</h1>
        ${item.tagline ? `<p class="tagline">${escapeHtml(item.tagline)}</p>` : ''}
        ${detailMeta(item, type)}
        ${item.genres?.length ? `<div class="genre-list">${item.genres.map((genre) => `<span class="genre">${escapeHtml(genre.name)}</span>`).join('')}</div>` : ''}
        <p class="overview">${escapeHtml(item.overview || 'Sinopse indisponível em português.')}</p>
        <div class="actions"><a class="button button-violet" href="#player">${icons.play} Assistir agora</a></div>
      </div>
    </section>`;
}

function playerFrame(url, title) {
  return `<iframe src="${escapeHtml(url)}" title="Player de ${escapeHtml(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="origin"></iframe>`;
}

function embedNotice() {
  return '<p class="embed-note">A presença do título no TMDB não garante sua disponibilidade no player. Por ser um conteúdo incorporado de outro domínio, o CHEFEFLIX não consegue confirmar com segurança se o vídeo interno carregou ou está disponível.</p>';
}

async function renderMovie(id, watch, requestId) {
  setActiveNav('movie');
  const movie = await api(`/movie/${id}`, { append_to_response: 'external_ids' });
  if (requestId !== state.requestId) return;
  setTitle(titleOf(movie));
  const tmdbUrl = `${EMBED_ROOT}/filme/${movie.id}`;
  const imdbId = movie.external_ids?.imdb_id;
  app.innerHTML = `
    ${detailHero(movie, 'movie')}
    <section class="watch-section" id="player">
      <button class="tv-mode-exit" type="button" data-tv-exit>Sair do Modo TV</button>
      <p class="tv-mode-tip">Espelhe a tela na TV e gire o aparelho para a horizontal</p>
      <div class="section-title"><div class="eyebrow">Sessão</div><h2>Assistir filme</h2><p>Escolha uma das fontes disponíveis para este título.</p></div>
      <div class="player-shell" data-player>
        ${playerFrame(tmdbUrl, titleOf(movie))}
        <div class="player-bar">
          <span class="player-status">Fonte selecionada: ID TMDB</span>
          <div class="source-buttons">
             <button class="source-button active" data-player-url="${tmdbUrl}" data-source="ID TMDB">TMDB</button>
             ${imdbId ? `<button class="source-button" data-player-url="${EMBED_ROOT}/filme/${escapeHtml(imdbId)}" data-source="ID IMDb">IMDb</button>` : ''}
             <button class="source-button tv-mode-button" type="button" data-tv-enter>Modo TV</button>
          </div>
        </div>
      </div>
      ${embedNotice()}
    </section>`;
  if (watch) requestAnimationFrame(() => document.querySelector('#player')?.scrollIntoView());
}

function seasonOptions(show, selected) {
  return (show.seasons || [])
    .filter((season) => season.season_number > 0)
    .map((season) => `<option value="${season.season_number}" ${season.season_number === selected ? 'selected' : ''}>${escapeHtml(season.name)} (${season.episode_count || 0})</option>`)
    .join('');
}

function episodeItems(episodes, selectedEpisode = null) {
  if (!episodes?.length) return '<div class="episode-loading">Nenhum episódio listado para esta temporada.</div>';
  return episodes.map((episode) => `
    <button class="episode-item ${episode.episode_number === selectedEpisode ? 'active' : ''}" data-episode="${episode.episode_number}" title="${escapeHtml(episode.name || `Episódio ${episode.episode_number}`)}">
      <span class="episode-number">E${String(episode.episode_number).padStart(2, '0')}</span>
      <span class="episode-name">${escapeHtml(episode.name || `Episódio ${episode.episode_number}`)}</span>
      <span class="episode-runtime">${episode.runtime ? `${episode.runtime} min` : ''}</span>
    </button>`).join('');
}

async function renderShow(id, watch, requestId) {
  setActiveNav('tv');
  const show = await api(`/tv/${id}`);
  if (requestId !== state.requestId) return;
  state.show = show;
  const firstSeason = show.seasons?.find((season) => season.season_number > 0)?.season_number;
  let season = null;
  if (firstSeason !== undefined) season = await api(`/tv/${id}/season/${firstSeason}`);
  if (requestId !== state.requestId) return;
  state.season = season;
  setTitle(titleOf(show));
  const listUrl = `${EMBED_ROOT}/serie/${show.id}`;
  app.innerHTML = `
    ${detailHero(show, 'tv')}
    <section class="watch-section" id="player">
      <button class="tv-mode-exit" type="button" data-tv-exit>Sair do Modo TV</button>
      <p class="tv-mode-tip">Espelhe a tela na TV e gire o aparelho para a horizontal</p>
      <div class="section-title"><div class="eyebrow">Temporadas e episódios</div><h2>Escolha o que assistir</h2><p>Selecione um episódio para abrir diretamente ou use a lista do próprio player.</p></div>
      <div class="episodes-layout">
        <aside class="episode-panel">
          <div class="season-control">
            <label for="season-select">Temporada</label>
            <select id="season-select" ${firstSeason === undefined ? 'disabled' : ''}>${seasonOptions(show, firstSeason)}</select>
          </div>
          <div class="episode-list" id="episode-list">${episodeItems(season?.episodes)}</div>
        </aside>
        <div class="player-column">
          <div class="player-shell" data-player>
            ${playerFrame(listUrl, titleOf(show))}
            <div class="player-bar">
              <span class="player-status">Lista de episódios do player</span>
              <div class="source-buttons"><button class="source-button active" data-player-url="${listUrl}" data-source="Lista de episódios do player">Abrir lista do player</button><button class="source-button tv-mode-button" type="button" data-tv-enter>Modo TV</button></div>
            </div>
          </div>
          ${embedNotice()}
        </div>
      </div>
    </section>`;
  if (watch) requestAnimationFrame(() => document.querySelector('#player')?.scrollIntoView());
}

function renderAbout() {
  setActiveNav('about');
  setTitle('Sobre');
  app.innerHTML = `
    <section class="page about-page">
      <div class="about-wrap">
        <div class="eyebrow">Sobre o CHEFEFLIX</div>
        <h1>Cinema em todo lugar<span class="violet">.</span></h1>
        <div class="about-grid">
          <article class="about-card"><h2>Uma experiência direta</h2><p>O CHEFEFLIX organiza filmes e séries em uma interface simples, escura e cinematográfica. Pesquise um título, consulte informações e acesse as opções de reprodução incorporadas.</p></article>
          <article class="about-card"><div class="tmdb-wordmark">TMDB</div><p>Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB. Dados, sinopses, avaliações e imagens são fornecidos pelo The Movie Database.</p></article>
        </div>
      </div>
    </section>`;
}

async function updateSeason(seasonNumber) {
  const list = document.querySelector('#episode-list');
  if (!state.show || !list) return;
  list.innerHTML = '<div class="episode-loading">Carregando episódios...</div>';
  try {
    const season = await api(`/tv/${state.show.id}/season/${seasonNumber}`);
    state.season = season;
    list.innerHTML = episodeItems(season.episodes);
  } catch (error) {
    list.innerHTML = `<div class="episode-loading">${escapeHtml(error.message)}</div>`;
  }
}

function setPlayer(url, source) {
  const shell = document.querySelector('[data-player]');
  if (!shell) return;
  const frame = shell.querySelector('iframe');
  frame.src = url;
  shell.querySelector('.player-status').textContent = source;
  shell.querySelectorAll('[data-player-url]').forEach((button) => button.classList.toggle('active', button.dataset.playerUrl === url));
}

function exitTvMode(rewindHistory = false) {
  const tvMode = state.tvMode;
  if (!tvMode) return;
  state.tvMode = null;
  document.body.classList.remove('tv-mode');
  tvMode.section.classList.remove('tv-mode-stage');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (rewindHistory && history.state?.chefeflixTvMode) history.back();
}

async function enterTvMode(button) {
  if (state.tvMode) return;
  const section = button.closest('.watch-section');
  if (!section?.querySelector('iframe')) return;
  state.tvMode = { section, fullscreenActive: false };
  document.body.classList.add('tv-mode');
  section.classList.add('tv-mode-stage');
  history.pushState({ ...history.state, chefeflixTvMode: true }, '', location.href);

  if (typeof section.requestFullscreen !== 'function') return;
  try {
    await section.requestFullscreen();
    if (state.tvMode?.section === section) state.tvMode.fullscreenActive = true;
  } catch {
    // The CSS layout remains active when fullscreen is blocked by the browser.
  }
}

function currentRoute() {
  const raw = location.hash.slice(1) || '/';
  const [path, queryString = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(queryString) };
}

async function route() {
  const requestId = ++state.requestId;
  const { parts, params } = currentRoute();
  const [section, value] = parts;
  exitTvMode(false);
  state.categoryObserver?.disconnect();
  state.categoryObserver = null;
  state.categoryFeed = null;
  state.browseObserver?.disconnect();
  state.browseObserver = null;
  state.browseFeed = null;
  state.homeObserver?.disconnect();
  state.homeObserver = null;
  state.homeFeed = null;
  state.show = null;
  state.season = null;
  header.classList.remove('menu-open');
  menuButton.setAttribute('aria-expanded', 'false');
  window.scrollTo({ top: 0 });
  loading();
  try {
    if (!section) await renderHome(requestId);
    else if (section === 'search') await renderSearch(params.get('q')?.trim() || '', requestId);
    else if (section === 'browse' && ['movie', 'tv', 'trending'].includes(value)) await renderBrowse(value, requestId);
    else if (section === 'categories' && !value) await renderCategories(requestId);
    else if (section === 'categories' && value) await renderCategory(value, params, requestId);
    else if (section === 'movie' && /^\d+$/.test(value)) await renderMovie(value, params.get('watch') === '1', requestId);
    else if (section === 'tv' && /^\d+$/.test(value)) await renderShow(value, params.get('watch') === '1', requestId);
    else if (section === 'about') renderAbout();
    else throw new Error('A página que você procura não existe.');
  } catch (error) {
    if (requestId === state.requestId) renderError(error);
  }
  app.focus({ preventScroll: true });
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (query.length >= 2) location.hash = `#/search?q=${encodeURIComponent(query)}`;
});

menuButton.addEventListener('click', () => {
  const open = header.classList.toggle('menu-open');
  menuButton.setAttribute('aria-expanded', String(open));
  if (open) setTimeout(() => searchInput.focus(), 100);
});

document.addEventListener('click', (event) => {
  const retry = event.target.closest('[data-retry]');
  if (retry) route();

  const feedRetry = event.target.closest('[data-feed-retry]');
  if (feedRetry) loadCategoryPage();

  const browseRetry = event.target.closest('[data-browse-retry]');
  if (browseRetry) {
    state.browseObserver?.observe(document.querySelector('#browse-sentinel'));
    loadMoreBrowse();
  }

  const homeRetry = event.target.closest('[data-home-retry]');
  if (homeRetry) {
    state.homeObserver?.observe(document.querySelector('#home-catalog-sentinel'));
    loadMoreHome();
  }

  const source = event.target.closest('[data-player-url]');
  if (source) setPlayer(source.dataset.playerUrl, source.dataset.source);

  const tvEnter = event.target.closest('[data-tv-enter]');
  if (tvEnter) enterTvMode(tvEnter);

  const tvExit = event.target.closest('[data-tv-exit]');
  if (tvExit) exitTvMode(true);

  const episode = event.target.closest('[data-episode]');
  if (episode && state.show && state.season) {
    const seasonNumber = state.season.season_number;
    const episodeNumber = Number(episode.dataset.episode);
    const url = `${EMBED_ROOT}/serie/${state.show.id}/${seasonNumber}/${episodeNumber}`;
    setPlayer(url, `Temporada ${seasonNumber}, episódio ${episodeNumber}`);
    document.querySelectorAll('.episode-item').forEach((item) => item.classList.toggle('active', item === episode));
    if (window.innerWidth <= 820) document.querySelector('[data-player]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (event.target.closest('.mobile-menu a')) {
    header.classList.remove('menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('change', (event) => {
  if (event.target.matches('#season-select')) updateSeason(Number(event.target.value));
});

window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 24), { passive: true });
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.tvMode) exitTvMode(true);
});
window.addEventListener('popstate', () => {
  if (state.tvMode) exitTvMode(false);
});
document.addEventListener('fullscreenchange', () => {
  if (state.tvMode?.fullscreenActive && !document.fullscreenElement) exitTvMode(true);
});
window.addEventListener('hashchange', route);
route();
