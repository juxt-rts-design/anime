import type { EpisodesData, Version } from '../types';

export function getEpisodeKeys(data: EpisodesData, version: Version): string[] {
  const keys = Object.keys(data[version] || {});
  const numeric = keys.filter((k) => !k.startsWith('oav')).map(Number).sort((a, b) => a - b);
  const oav = keys.filter((k) => k.startsWith('oav'));
  return [...numeric.map(String), ...oav];
}

export function getAvailableVersions(data: EpisodesData): Version[] {
  const versions: Version[] = [];
  if (Object.keys(data.vf || {}).length) versions.push('vf');
  if (Object.keys(data.vostfr || {}).length) versions.push('vostfr');
  return versions.length ? versions : ['vostfr'];
}
