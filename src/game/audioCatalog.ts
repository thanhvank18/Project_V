import generated from './audioCatalog.generated.json';
import combat from './combatAudioCatalog.generated.json';

/** Local audio supplied in Sound/. Generated selection is kept in audio-manifest.json. */
export type AudioCue =
  | 'letter' | 'jam' | 'impact' | 'kill' | 'player-hurt'
  | 'boss-slam' | 'pickup' | 'skill' | 'game-over' | 'victory'
  | 'attack-sword' | 'attack-axe' | 'attack-arrow' | 'attack-magic'
  | 'guard' | 'heal' | 'frost' | 'volley';

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

export type AudioSampleSet = AudioSample | readonly AudioSample[];

export interface AudioCatalog {
  music: readonly AudioTrack[];
  sfx: Readonly<Partial<Record<AudioCue, AudioSampleSet>>>;
}

export function audioSamples(samples: AudioSampleSet | undefined): readonly AudioSample[] {
  if (!samples) return [];
  return Array.isArray(samples) ? samples : [samples as AudioSample];
}

const catalog: AudioCatalog = { music: generated.music, sfx: { ...generated.sfx, ...combat.sfx } };
export const MUSIC_TRACKS = catalog.music;
export const AUDIO_CUES = catalog.sfx;
export const AUDIO_CATALOG = { music: MUSIC_TRACKS, sfx: AUDIO_CUES } as const;
