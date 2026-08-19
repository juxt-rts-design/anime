import * as cheerio from 'cheerio';
import { cached } from './cache.js';

const PLANNING_URL = process.env.PLANNING_URL || 'https://animes-sama.fr/planning';
const HTML_CACHE_KEY = 'planning:html';
const DATA_CACHE_KEY = 'planning:data';

function decodeText(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function formatTime(raw = '') {
  const match = raw.match(/(\d{1,2})\s*[hH:]\s*(\d{2})/);
  if (!match) return raw || '';
  return `${match[1]}h${match[2]}`;
}

function parseCard($, card) {
  const el = $(card);
  const title = decodeText(el.attr('data-title') || el.find('.card-title').first().text());
  if (!title) return null;

  const infoTexts = el
    .find('.info-item.episode .info-text')
    .map((_, node) => decodeText($(node).text()))
    .get()
    .filter(Boolean);

  const timeRaw = infoTexts.find((t) => /\d{1,2}\s*[hH:]\s*\d{2}/i.test(t)) || '';
  const season = infoTexts.find((t) => /saison|partie|saga|film|oav/i.test(t)) || '';

  const type = decodeText(el.attr('data-card-type') || 'Anime');
  if (/^scan/i.test(type)) return null;

  return {
    title,
    type,
    language: decodeText(el.attr('data-carte-langue') || ''),
    time: formatTime(timeRaw),
    timeRaw: timeRaw.toUpperCase(),
    season,
    poster: el.find('img.card-image').attr('src') || '',
    sourceUrl: el.find('a').attr('href') || '',
    animeId: null,
  };
}

function dedupeReleases(list) {
  const seen = new Set();
  return list.filter((item) => {
    const key = `${item.title}|${item.language}|${item.time}|${item.season}|${item.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByTime(a, b) {
  const parse = (t) => {
    const m = t.match(/(\d{1,2})h(\d{2})/i);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 9999;
  };
  return parse(a.time) - parse(b.time);
}

export function parsePlanningHtml(html) {
  const $ = cheerio.load(html);
  const days = [];

  $('#planningClass > div').each((_, dayEl) => {
    const block = $(dayEl);
    const day = decodeText(block.find('.titreJours').first().text());
    if (!day) return;

    const dateLabel = decodeText(block.find('p.text-white.text-center').first().text());
    const releases = [];

    block.find('.planning-card').each((__, card) => {
      const parsed = parseCard($, card);
      if (parsed) releases.push(parsed);
    });

    days.push({
      day,
      dateLabel,
      releases: dedupeReleases(releases).sort(sortByTime),
    });
  });

  const unfixed = [];
  $('h2')
    .filter((_, el) => /sans jours fixes/i.test($(el).text()))
    .first()
    .next('.scrollBarStyled, .grabScroll')
    .find('.planning-card')
    .each((_, card) => {
      const parsed = parseCard($, card);
      if (parsed) unfixed.push(parsed);
    });

  return {
    days,
    unfixed: dedupeReleases(unfixed),
    updatedAt: new Date().toISOString(),
  };
}

async function fetchPlanningHtml() {
  const response = await fetch(PLANNING_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Planning indisponible (${response.status})`);
  }

  return response.text();
}

async function loadPlanningHtml() {
  return cached(HTML_CACHE_KEY, 1000 * 60 * 60, fetchPlanningHtml);
}

export async function getPlanning() {
  return cached(DATA_CACHE_KEY, 1000 * 60 * 30, async () => {
    const html = await loadPlanningHtml();
    return parsePlanningHtml(html);
  });
}
