import generated from './audioCatalog.generated.json';

/** Local audio supplied in Sound/. Generated selection is kept in audio-manifest.json. */
export type AudioCue =
  | 'letter' | 'jam' | 'impact' | 'kill' | 'player-hurt'
  | 'boss-slam' | 'pickup' | 'skill' | 'game-over' | 'victory';

export interface AudioTrack {
  id: string;
  title: string;
  url: string;
  duration: number;
}

export interface AudioSample {
  url: string;
  volume?: number;
  start?: number;
  duration?: number;
}

interface AudioCatalog {
  music: readonly AudioTrack[];
  sfx: Readonly<Partial<Record<AudioCue, AudioSample>>>;
}

const catalog: AudioCatalog = generated;
export const MUSIC_TRACKS = catalog.music;
export const AUDIO_CUES = catalog.sfx;
export const AUDIO_CATALOG = { music: MUSIC_TRACKS, sfx: AUDIO_CUES } as const;
