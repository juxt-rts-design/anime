import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  searchAnime,
  getHomeContent,
  getCategoryContent,
  getAnimeDetail,
  getEpisodes,
  getSeasons,
  resolveFromCataloguePath,
} from './api.js';
import { getPlanning } from './planning.js';
import { resolveStream, proxyMedia, STREAM_CACHE_VERSION } from './stream.js';
import { cached, clearAll, getStale } from './cache.js';

clearAll();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;

const TTL = {
  home: 1000 * 60 * 5,
  category: 1000 * 60 * 10,
  search: 1000 * 60 * 15,
  anime: 1000 * 60 * 30,
  episodes: 1000 * 60 * 15,
  seasons: 1000 * 60 * 60,
  planning: 1000 * 60 * 60,
  path: 1000 * 60 * 60,
};

app.use(cors());
app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/home', async (_req, res) => {
  try {
    const items = await cached('home', TTL.home, getHomeContent);
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/category/*', async (req, res) => {
  try {
    const categoryPath = '/' + req.params[0];
    const items = await cached(`cat:${categoryPath}`, TTL.category, () =>
      getCategoryContent(categoryPath),
    );
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Math.max(Number(req.query.limit) || 21, 1), 21);
    if (!query) return res.json({ results: [], hasMore: false, page: 1 });

    const PAGE_SIZE = 21;
    const results = await cached(`search:${query}:${page}`, TTL.search, () =>
      searchAnime(query, page),
    );
    const sliced = results.slice(0, limit);
    res.json({
      results: sliced,
      page,
      hasMore: limit >= PAGE_SIZE ? results.length >= PAGE_SIZE : results.length > limit,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/resolve', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const path = String(req.query.path || '').trim();
    const full = req.query.full === '1';

    if (!query && !path) {
      return res.status(400).json({ error: 'Requête vide' });
    }

    let id;
    let title;

    if (path) {
      const resolved = await cached(`path:${path}`, TTL.path, () => resolveFromCataloguePath(path));
      id = resolved.id;
      title = resolved.title || query;
    } else {
      const results = await cached(`search:${query}:1`, TTL.search, () => searchAnime(query, 1));
      if (!results.length) return res.status(404).json({ error: 'Aucun résultat' });
      id = results[0].id;
      title = results[0].title;
    }

    const payload = { id, title };

    if (full) {
      payload.detail = await cached(`anime:${id}`, TTL.anime, () => getAnimeDetail(id));
    }

    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/anime/:id', async (req, res) => {
  try {
    const detail = await cached(`anime:${req.params.id}`, TTL.anime, () =>
      getAnimeDetail(req.params.id),
    );
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/episodes/:id', async (req, res) => {
  try {
    const episodes = await cached(`eps:${req.params.id}`, TTL.episodes, () =>
      getEpisodes(req.params.id),
    );
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(episodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/seasons', async (req, res) => {
  try {
    const { news_id, serie_tag = '', title_base = '' } = req.query;
    if (!news_id) return res.status(400).json({ error: 'news_id requis' });
    const key = `seasons:${news_id}:${serie_tag}:${title_base}`;
    const seasons = await cached(key, TTL.seasons, () =>
      getSeasons(String(news_id), String(serie_tag), String(title_base)),
    );
    res.json({ seasons });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/planning', async (_req, res) => {
  try {
    const data = await getPlanning();
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json(data);
  } catch (error) {
    const stale = getStale('planning:data');
    if (stale) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('X-Planning-Stale', '1');
      return res.json(stale);
    }
    res.status(503).json({
      error: 'Planning temporairement indisponible. Réessaie dans quelques minutes.',
    });
  }
});

app.get('/api/stream', async (req, res) => {
  try {
    const embed = String(req.query.embed || '');
    if (!embed) return res.status(400).json({ error: 'embed requis' });
    const stream = await resolveStream(embed);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(stream);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get('/api/proxy', async (req, res) => {
  try {
    const targetUrl = String(req.query.url || '');
    const referer = String(req.query.referer || '');
    if (!targetUrl.startsWith('http')) {
      return res.status(400).json({ error: 'URL invalide' });
    }

    const { body, contentType, binary } = await proxyMedia(targetUrl, referer);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (binary) {
      res.send(body);
    } else {
      res.send(body);
    }
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath, { maxAge: '1d', immutable: true }));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Serveur API sur http://localhost:${PORT} (stream ${STREAM_CACHE_VERSION})`);
});
