import * as cheerio from 'cheerio';
import { fetchFromApi } from './config.js';

function parseSearchResults(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('.search-item').each((_, el) => {
    const item = $(el);
    const onclick = item.attr('onclick') || '';
    const linkMatch = onclick.match(/location\.href='([^']+)'/);
    const href = linkMatch?.[1] || '';
    const idMatch = href.match(/\/(\d+)-/) || href.match(/newsid=(\d+)/);
    const title = item.find('.search-title').text().trim();
    const poster = item.find('img').attr('src') || '';
    const yearMatch = title.match(/\((\d{4})\)/);
    const cleanTitle = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();

    if (title && idMatch?.[1]) {
      results.push({
        id: idMatch[1],
        title: cleanTitle,
        year: yearMatch?.[1] || null,
        poster,
      });
    }
  });

  return results;
}

function parseHomeItems(html) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $('a.short-poster').each((_, el) => {
    const link = $(el);
    const href = link.attr('href') || '';
    const idMatch = href.match(/newsid=(\d+)/);
    const id = idMatch?.[1];
    if (!id || seen.has(id)) return;
    seen.add(id);

    const title = link.attr('alt') || link.find('img').attr('alt') || '';
    const poster = link.find('img').attr('src') || '';
    const short = link.closest('.short');
    const episodes = short.find('.mli-eps').text().trim() || null;
    const type = short.find('.mli-type a').text().trim() || 'Anime';

    items.push({ id, title, poster, episodes, type });
  });

  return items;
}

function parseAnimeDetail(html, id) {
  const $ = cheerio.load(html);
  const configEl = $('#serie-config');
  const metaEl = $('[data-newsid]').first();

  const title =
    configEl.attr('data-title') ||
    metaEl.attr('data-title') ||
    $('h1#s-title').text().trim() ||
    $('title').text().split('|')[0].trim();

  const poster =
    metaEl.attr('data-affiche') ||
    $('img.dvd-thumbnail').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    '';

  let banner = '';
  const heroStyle = $('.hero-backdrop').attr('style') || '';
  const backdropMatch = heroStyle.match(/url\(['"]?([^'")]+)/i);
  if (backdropMatch?.[1]) {
    banner = backdropMatch[1];
  }

  const trailer = metaEl.attr('data-trailer') || null;
  const tagz = metaEl.attr('data-tagz') || '';
  const synopsis = $('.fdesc').first().text().trim() || $('.full-text, .full-story, .s-desc').first().text().trim() || '';
  const year = $('.facts .release').first().text().trim() || '';
  const episodesLabel = $('.short-meta.short-label').first().text().trim() || '';
  const status = $('.short-meta.short-qual, .short-statut').first().text().trim() || '';
  const version = $('#s-list li').filter((_, el) => $(el).find('span').first().text().includes('Version')).text().replace(/^Version:\s*/i, '').trim()
    || $('.short-meta.short-qual').first().text().trim();

  const genres = [];
  $('.facts .genres a').each((_, el) => {
    const genre = $(el).text().trim();
    if (genre && !genres.includes(genre)) genres.push(genre);
  });

  let originalTitle = '';
  let studio = '';
  const directors = [];
  const cast = [];

  $('#s-list li').each((_, el) => {
    const label = $(el).find('span').first().text().replace(':', '').trim();
    const value = $(el).clone().children('span').remove().end().text().trim();
    const links = $(el)
      .find('a')
      .map((__, a) => $(a).text().trim())
      .get()
      .filter(Boolean);

    if (/titre original/i.test(label)) originalTitle = value;
    if (/studio/i.test(label)) studio = value || links[0] || '';
    if (/director|réalisateur/i.test(label)) directors.push(...(links.length ? links : [value].filter(Boolean)));
    if (/casting/i.test(label)) cast.push(...(links.length ? links : [value].filter(Boolean)));
  });

  const titleBase = title.replace(/\s*-?\s*[Ss]aison\s*\d+.*$/, '').trim();

  return {
    id,
    title,
    titleBase,
    poster,
    banner,
    trailer,
    tagz,
    synopsis,
    year,
    episodesLabel,
    version,
    status,
    originalTitle,
    studio,
    directors: directors.slice(0, 4),
    cast: cast.slice(0, 8),
    genres,
  };
}

async function searchAnime(query, page = 1) {
  const response = await fetchFromApi('/engine/ajax/search.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `query=${encodeURIComponent(query)}&page=${page}`,
  });
  const html = await response.text();
  return parseSearchResults(html);
}

async function getHomeContent() {
  const response = await fetchFromApi('/');
  const html = await response.text();
  return parseHomeItems(html);
}

async function getCategoryContent(path, page = 1) {
  const base = path.replace(/^\//, '').replace(/\/$/, '');
  const fetchPath = page > 1 ? `/${base}/page/${page}/` : `/${base}/`;
  const response = await fetchFromApi(fetchPath);
  const html = await response.text();
  return parseHomeItems(html);
}

async function getAnimeDetail(id) {
  const response = await fetchFromApi(`/index.php?newsid=${id}`);
  const html = await response.text();
  return parseAnimeDetail(html, id);
}

async function getEpisodes(id) {
  const response = await fetchFromApi(`/engine/ajax/manga_episodes_api.php?id=${id}`);
  return response.json();
}

async function getSeasons(newsId, serieTag, titleBase) {
  const params = new URLSearchParams({
    news_id: newsId,
    serie_tag: serieTag,
    title_base: titleBase,
  });
  const response = await fetchFromApi(`/engine/ajax/get_seasons.php?${params}`);
  return response.json();
}

async function resolveFromCataloguePath(path) {
  const response = await fetchFromApi(path);
  const html = await response.text();
  const idMatch = html.match(/newsid=(\d+)/i) || html.match(/\/(\d+)-/);
  if (!idMatch?.[1]) {
    throw new Error('ID introuvable');
  }

  const $ = cheerio.load(html);
  const title =
    $('#serie-config').attr('data-title') ||
    $('[data-newsid]').first().attr('data-title') ||
    $('h1#s-title').text().trim() ||
    '';

  return { id: idMatch[1], title };
}

export {
  searchAnime,
  getHomeContent,
  getCategoryContent,
  getAnimeDetail,
  getEpisodes,
  getSeasons,
  resolveFromCataloguePath,
  parseSearchResults,
  parseHomeItems,
};
