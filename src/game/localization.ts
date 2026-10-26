import { translate, type Language } from '../i18n';
import type { Snapshot, Word } from './types';

export function getWordMeaning(word: Pick<Word, 'meaning' | 'englishMeaning'>, language: Language): string {
  return language === 'en' ? word.englishMeaning ?? 'No English definition available.' : word.meaning;
}

/** Simulation state stays authoritative. Only presentation labels are localized here. */
export function localizeSnapshot(snapshot: Snapshot, language: Language): Snapshot {
  if (language === 'vi') return snapshot;
  const t = (text: string) => translate(language, text);
  return { ...snapshot, notice: t(snapshot.notice), hero: { ...snapshot.hero, skillName: t(snapshot.hero.skillName) },
    target: snapshot.target ? { ...snapshot.target, label: snapshot.target.name ?? t(snapshot.target.label ?? '') } : null,
    boss: snapshot.boss ? { ...snapshot.boss, label: snapshot.boss.name ?? t(snapshot.boss.label ?? '') } : null,
    ...(snapshot.world ? { world: { ...snapshot.world, nearby: snapshot.world.nearby
      ? { ...snapshot.world.nearby, label: t(snapshot.world.nearby.label) } : null } } : {}),
    ...(snapshot.party ? { party: { ...snapshot.party, players: snapshot.party.players.map(player => ({ ...player, name: t(player.name ?? '') })) } } : {}),
  };
}
