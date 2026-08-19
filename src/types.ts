export interface AnimeItem {
  id: string;
  title: string;
  poster: string;
  episodes?: string | null;
  type?: string;
  year?: string | null;
}

export interface AnimeDetail extends AnimeItem {
  titleBase: string;
  banner: string;
  trailer?: string | null;
  tagz: string;
  synopsis: string;
  year: string;
  episodesLabel: string;
  version: string;
  status: string;
  originalTitle: string;
  studio: string;
  directors: string[];
  cast: string[];
  genres: string[];
}

export type PlayerType =
  | 'vidzy'
  | 'luluvid'
  | 'uqload'
  | 'voe'
  | 'dood'
  | 'filmoon'
  | 'netu'
  | 'premium';

export interface EpisodeSources {
  vidzy?: string;
  luluvid?: string;
  uqload?: string;
  voe?: string;
  dood?: string;
  filmoon?: string;
  netu?: string;
  premium?: string;
}

export interface EpisodeInfo {
  title?: string;
  synopsis?: string;
  poster?: string;
}

export interface EpisodesData {
  vf: Record<string, EpisodeSources>;
  vostfr: Record<string, EpisodeSources>;
  info: Record<string, EpisodeInfo>;
  alt_titles?: Record<string, string>;
}

export interface Season {
  id: string;
  title: string;
  alt_name: string;
  full_url: string;
  affiche: string;
  serie_anne: string;
  season_number: number;
}

export interface PlanningRelease {
  title: string;
  type: string;
  language: string;
  time: string;
  timeRaw: string;
  season: string;
  poster: string;
  sourceUrl: string;
  animeId: string | null;
}

export interface PlanningDay {
  day: string;
  dateLabel: string;
  releases: PlanningRelease[];
}

export interface PlanningData {
  days: PlanningDay[];
  unfixed: PlanningRelease[];
  updatedAt: string;
}

export type Version = 'vf' | 'vostfr';
