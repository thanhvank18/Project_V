import type { LearningLevel, Word } from './types';
import { historyKeysFor } from './vocabulary';
import { getWordLearningLevel, learningLevelOrder, MAX_LEARNING_LEVEL } from './learningProgression';

interface Entry {
  word: Word; aliases: string[]; long: boolean; seen: boolean; blocked: number;
  level: LearningLevel; allSlot: number; longSlot: number; levelSlot: number; levelLongSlot: number;
}

/** Pre-indexed finite vocabulary. Rendering and simulation never scan the dictionary. */
export class WordDeck {
  private entries: Entry[];
  private byWord = new Map<Word, number>();
  private byAlias = new Map<string, number[]>();
  private seen = new Set<string>();
  private all: number[] = [];
  private long: number[] = [];
  private levels: number[][] = Array.from({ length: MAX_LEARNING_LEVEL + 1 }, () => []);
  private longLevels: number[][] = Array.from({ length: MAX_LEARNING_LEVEL + 1 }, () => []);
  private reserved = new Map<number, number[]>();
  private remaining: number;
  private longRemaining: number;
  private cached: Readonly<{ remaining: number; total: number; bossReady: boolean }>;

  constructor(bank: readonly Word[], private random: () => number = Math.random) {
    this.entries = bank.map((word, index) => {
      const aliases = historyKeysFor(word);
      this.byWord.set(word, index);
      for (const alias of aliases) {
        const ids = this.byAlias.get(alias);
        if (ids) ids.push(index); else this.byAlias.set(alias, [index]);
      }
      return { word, aliases, long: word.answer.length >= 7, seen: false, blocked: 0, level: getWordLearningLevel(word),
        allSlot: -1, longSlot: -1, levelSlot: -1, levelLongSlot: -1 };
    });
    for (let index = 0; index < this.entries.length; index++) this.makeAvailable(index);
    this.remaining = bank.length;
    this.longRemaining = this.long.length;
    this.cached = { remaining: bank.length, total: bank.length, bossReady: this.longRemaining >= 9 };
  }

  get availability(): Readonly<{ remaining: number; total: number; bossReady: boolean }> { return this.cached; }

  /** Merge historical exposure without rebuilding pools or normalizing already known keys. */
  addSeen(answers: Iterable<string>): void {
    let changed = false;
    for (const raw of answers) {
      if (this.seen.has(raw)) continue;
      const answer = raw.trim().toLowerCase();
      if (this.seen.has(answer)) continue;
      this.seen.add(answer);
      for (const id of this.byAlias.get(answer) ?? []) {
        const entry = this.entries[id];
        if (entry.seen) continue;
        entry.seen = true;
        this.remaining--;
        if (entry.long) this.longRemaining--;
        this.removeAvailable(id);
        changed = true;
      }
    }
    if (changed) this.cached = { remaining: this.remaining, total: this.entries.length, bossReady: this.longRemaining >= 9 };
  }

  isUnseen(word: Word): boolean {
    const id = this.byWord.get(word);
    return id === undefined ? !historyKeysFor(word).some((answer) => this.seen.has(answer))
      : !this.entries[id].seen;
  }

  /** Atomic reservation in at most ten indexed bands; no bank scan, even on fallback. */
  reserve(count: number, longOnly = false, preferredLevel?: LearningLevel, allowHigherLevels = true): Word[] | undefined {
    const pools = preferredLevel === undefined ? [longOnly ? this.long : this.all]
      : learningLevelOrder(preferredLevel).filter(level => allowHigherLevels || level <= preferredLevel)
        .map(level => (longOnly ? this.longLevels : this.levels)[level]);
    if (pools.reduce((total, pool) => total + pool.length, 0) < count) return undefined;
    const chosen: Word[] = [];
    while (chosen.length < count) {
      const pool = pools.find(available => available.length > 0);
      if (!pool) break;
      const fraction = this.random();
      const random = Number.isFinite(fraction) ? Math.max(0, Math.min(.999999, fraction)) : 0;
      const id = pool[Math.floor(random * pool.length)];
      const affected = [...new Set(this.entries[id].aliases.flatMap((alias) => this.byAlias.get(alias) ?? []))];
      this.reserved.set(id, affected);
      for (const related of affected) {
        this.entries[related].blocked++;
        this.removeAvailable(related);
      }
      chosen.push(this.entries[id].word);
    }
    if (chosen.length === count) return chosen;
    this.release(chosen);
    return undefined;
  }

  markShown(word: Word): void {
    const id = this.byWord.get(word);
    this.addSeen(id === undefined ? historyKeysFor(word) : this.entries[id].aliases);
    this.release([word]);
  }

  release(words: readonly Word[]): void {
    for (const word of words) {
      const id = this.byWord.get(word);
      if (id === undefined) continue;
      const affected = this.reserved.get(id);
      if (!affected) continue;
      this.reserved.delete(id);
      for (const related of affected) {
        this.entries[related].blocked--;
        this.makeAvailable(related);
      }
    }
  }

  clearReservations(): void {
    this.release([...this.reserved.keys()].map((id) => this.entries[id].word));
  }

  private makeAvailable(id: number): void {
    const entry = this.entries[id];
    if (entry.seen || entry.blocked > 0 || entry.allSlot >= 0) return;
    entry.allSlot = this.all.length;
    this.all.push(id);
    entry.levelSlot = this.levels[entry.level].length;
    this.levels[entry.level].push(id);
    if (entry.long) { entry.longSlot = this.long.length; this.long.push(id); }
    if (entry.long) { entry.levelLongSlot = this.longLevels[entry.level].length; this.longLevels[entry.level].push(id); }
  }

  private removeAvailable(id: number): void {
    const remove = (pool: number[], slotName: 'allSlot' | 'longSlot' | 'levelSlot' | 'levelLongSlot') => {
      const entry = this.entries[id];
      const slot = entry[slotName];
      if (slot < 0) return;
      const last = pool.pop()!;
      if (slot < pool.length) { pool[slot] = last; this.entries[last][slotName] = slot; }
      entry[slotName] = -1;
    };
    remove(this.all, 'allSlot');
    remove(this.long, 'longSlot');
    remove(this.levels[this.entries[id].level], 'levelSlot');
    remove(this.longLevels[this.entries[id].level], 'levelLongSlot');
  }
}
