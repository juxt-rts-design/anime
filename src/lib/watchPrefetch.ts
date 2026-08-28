import { getCachedEpisodes, getEpisodes, prefetchStream } from './api';
import { getAvailableVersions, getEpisodeKeys } from './episodes';
import { getAvailablePlayers, getEmbedUrl, getSourceCode, usesIframeFallback } from './players';
import type { Version, EpisodesData } from '../types';

export function prefetchWatchStream(id: string, version?: Version, episode?: string) {
  const run = (episodes: EpisodesData) => {
    const versions = getAvailableVersions(episodes);
    const ver =
      version && versions.includes(version)
        ? version
        : versions.includes('vostfr')
          ? 'vostfr'
          : versions[0];
    if (!ver) return;

    const keys = getEpisodeKeys(episodes, ver);
    const ep = episode && keys.includes(episode) ? episode : keys[0];
    if (!ep) return;

    const data = episodes[ver]?.[ep];
    if (!data) return;

    for (const source of getAvailablePlayers(data)) {
      if (usesIframeFallback(source)) continue;
      const embed = getEmbedUrl(source, getSourceCode(data, source));
      if (embed) {
        prefetchStream(embed);
        return;
      }
    }
  };

  const cached = getCachedEpisodes(id);
  if (cached) {
    run(cached);
    return;
  }

  void getEpisodes(id)
    .then(run)
    .catch(() => {});
}
