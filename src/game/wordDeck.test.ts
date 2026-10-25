import { describe, expect, it } from 'vitest';
import type { LearningLevel, Word } from './types';
import { WordDeck } from './wordDeck';

function word(answer: string, alternatives?: string[]): Word {
  return { id: answer, answer, meaning: answer, category: 'Test', partOfSpeech: 'noun', difficulty: 2, alternatives };
}

describe('indexed finite word deck', () => {
  it('caches availability and changes it only when previously unseen entries become seen', () => {
    const deck = new WordDeck([word('apple'), word('elephant')], () => 0);
    const before = deck.availability;
    const planned = deck.reserve(1)!;
    expect(deck.availability).toBe(before);
    deck.markShown(planned[0]);
    const after = deck.availability;
    expect(after).not.toBe(before);
    expect(after.remaining).toBe(1);
    deck.addSeen([' APPLE ', 'apple', 'outsidebank']);
    expect(deck.availability).toBe(after);
  });

  it('blocks shared accepted aliases during reservation and after exposure', () => {
    const grey = word('grey', ['gray']);
    const gray = word('gray');
    const deck = new WordDeck([grey, gray, word('blue')], () => 0);
    const planned = deck.reserve(2)!;
    expect(planned).toContain(grey);
    expect(planned).not.toContain(gray);
    deck.markShown(grey);
    deck.release(planned);
    expect(deck.availability.remaining).toBe(1);
    expect(deck.reserve(1)?.[0].answer).toBe('blue');
  });

  it('rolls back a reservation atomically if accepted aliases make the requested count impossible', () => {
    const deck = new WordDeck([word('grey', ['gray']), word('gray')], () => 0);
    expect(deck.reserve(2)).toBeUndefined();
    expect(deck.availability.remaining).toBe(2);
    expect(deck.reserve(1)?.[0].answer).toBe('grey');
  });

  it('releases only unseen reservations on a new run and preserves historical exposure', () => {
    const apple = word('apple');
    const bread = word('bread');
    const deck = new WordDeck([apple, bread], () => 0);
    const planned = deck.reserve(2)!;
    deck.markShown(planned[0]);
    deck.clearReservations();
    expect(deck.availability.remaining).toBe(1);
    expect(deck.reserve(1)?.[0]).toBe(bread);
  });

  it('does not reserve short words for Tank while reporting reserved-but-unshown long words as remaining', () => {
    const bank = ['lantern', 'blanket', 'village', 'pumpkin', 'thunder', 'chicken', 'morning', 'mountain', 'library'].map((answer) => word(answer));
    const deck = new WordDeck([...bank, word('cat')], () => 0);
    expect(deck.reserve(9, true)).toHaveLength(9);
    expect(deck.availability).toEqual({ total: 10, remaining: 10, bossReady: true });
    expect(deck.reserve(1, true)).toBeUndefined();
    expect(deck.reserve(1)?.[0].answer).toBe('cat');
  });
});

describe('indexed learning-level pools', () => {
  const graded = (answer: string, learningLevel: LearningLevel, alternatives?: string[]): Word => ({
    ...word(answer, alternatives), learningLevel,
  });

  it('takes current, nearest lower, then nearest higher levels regardless of bank order', () => {
    const bank = [graded('seven', 7), graded('one', 1), graded('four', 4), graded('three', 3), graded('five', 5)];
    const deck = new WordDeck(bank, () => .999);
    expect(deck.reserve(5, false, 4)?.map(entry => entry.learningLevel)).toEqual([4, 3, 1, 5, 7]);
    expect(deck.reserve(1, false, 4)).toBeUndefined();
    expect(deck.availability.remaining).toBe(5); // Holding a word is not exposure.
  });

  it('allows the next band only after history and active reservations exhaust all lower eligible pools', () => {
    const bank = [graded('one', 1), graded('two', 2), graded('three', 3), graded('four', 4)];
    const deck = new WordDeck(bank, () => 0);
    deck.addSeen([' TWO ']);
    const held = deck.reserve(1, false, 2)!;
    expect(held[0].answer).toBe('one');
    expect(deck.reserve(1, false, 2)?.[0].answer).toBe('three');
    deck.release(held);
    expect(deck.reserve(1, false, 2)?.[0].answer).toBe('one');
  });

  it('keeps a Boss reservation atomic and within current/lower levels until practice explicitly permits higher ones', () => {
    const easy = Array.from({ length: 8 }, (_, index) => graded(`lantern${String.fromCharCode(97 + index)}`, 1));
    const hard = graded('mountain', 8);
    const deck = new WordDeck([...easy, hard, graded('cat', 1)], () => 0);
    expect(deck.reserve(9, true, 1, false)).toBeUndefined();
    const practice = deck.reserve(9, true, 1, true)!;
    expect(practice).toHaveLength(9);
    expect(new Set(practice.slice(0, 8))).toEqual(new Set(easy));
    expect(practice[8]).toBe(hard);
    expect(deck.reserve(1, false, 1)?.[0].answer).toBe('cat');
    deck.markShown(practice[0]);
    expect(deck.availability.remaining).toBe(9);
    deck.clearReservations();
    expect(deck.reserve(8, true, 1, true)?.map(entry => entry.answer)).not.toContain(practice[0].answer);
  });

  it('rolls back cross-level alias conflicts without leaving any cached pool blocked', () => {
    const deck = new WordDeck([graded('grey', 2, ['gray']), graded('gray', 1), graded('blue', 3)], () => 0);
    expect(deck.reserve(3, false, 2)).toBeUndefined();
    const available = deck.reserve(2, false, 2)!;
    expect(available.map(entry => entry.answer)).toEqual(['grey', 'blue']);
    deck.markShown(available[0]);
    deck.release(available);
    expect(deck.availability.remaining).toBe(1);
    expect(deck.reserve(1, false, 1)?.[0].answer).toBe('blue');
  });

  it('exhausts every remaining band exactly once even when the preferred band is empty', () => {
    const deck = new WordDeck([graded('one', 1), graded('five', 5), graded('ten', 10)], () => 0);
    const shown: string[] = [];
    for (let index = 0; index < 3; index++) {
      const next = deck.reserve(1, false, 3)![0];
      shown.push(next.answer);
      deck.markShown(next);
    }
    expect(shown).toEqual(['one', 'five', 'ten']);
    expect(deck.availability.remaining).toBe(0);
    expect(deck.reserve(1, false, 3)).toBeUndefined();
  });

  it('reads the 70,000-word level bank once, then reserves and releases using cached indices', () => {
    let gradeReads = 0;
    const bank = Array.from({ length: 70_000 }, (_, index) => ({
      ...word(`word${index}`),
      get learningLevel() { gradeReads++; return (index % 10 + 1) as LearningLevel; },
    }));
    const deck = new WordDeck(bank, () => .73);
    gradeReads = 0;
    for (let iteration = 0; iteration < 1000; iteration++) {
      const held = deck.reserve(9, true, (iteration % 10 + 1) as LearningLevel)!;
      expect(held).toHaveLength(9);
      deck.markShown(held[0]);
      deck.release(held);
    }
    expect(gradeReads).toBe(0);
    expect(deck.availability.remaining).toBe(69_000);
  });
});
