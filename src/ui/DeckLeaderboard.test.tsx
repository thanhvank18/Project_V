import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeckLeaderboard, DeckLeaderboardTable } from './DeckLeaderboard';
import { DeckNameGate } from './CustomDeckGame';
import { LanguageProvider } from './LanguageContext';
import type { CustomDeck } from '../game/customDeck';
import type { DeckLeaderboardEntry } from '../game/customDeckLeaderboard';

afterEach(() => vi.unstubAllGlobals());
const setLanguage = (language: 'vi' | 'en', savedName = '') => vi.stubGlobal('localStorage', {
  getItem: (key: string) => key === 'zvs-language-v1' ? language : savedName,
});
const deck: CustomDeck = { id: '0123456789abcdef0123456789abcdef', title: '<Word pack>', language: 'en', createdAt: 1000, expiresAt: 86_401_000,
  entries: [{ answer: 'apple', meaning: 'A round fruit.', partOfSpeech: 'noun', level: 1, type: 'mixed' }] };
const entry = (id: string, players: string[], score: number, words = 3): DeckLeaderboardEntry => ({
  id, players, score, words, accuracy: 95, durationMs: 40000, endedAt: 50000, reason: 'defeat',
});

describe('shared pack name gate and hall of fame', () => {
  it('requires a labeled name and explicit confirmation even when a previous name was saved', () => {
    setLanguage('vi', '  Thanh  Vân ');
    const accepted = vi.fn();
    const markup = renderToStaticMarkup(<LanguageProvider><DeckNameGate deck={deck} onContinue={accepted} onHome={() => {}} /></LanguageProvider>);
    expect(markup).toContain('Tên người chơi');
    expect(markup).toContain('required=""');
    expect(markup).toContain('autoComplete="nickname"');
    expect(markup).toContain('value="Thanh Vân"');
    expect(markup).toContain('Tên này sẽ hiện trên bảng danh vọng.');
    expect(markup).toContain('Vào sảnh');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('&lt;Word pack&gt;');
    expect(accepted).not.toHaveBeenCalled();
  });

  it('localizes the gate and safely ignores an invalid saved name', () => {
    setLanguage('en', 'x'.repeat(25));
    const markup = renderToStaticMarkup(<LanguageProvider><DeckNameGate deck={deck} onContinue={() => {}} onHome={() => {}} /></LanguageProvider>);
    expect(markup).toContain('Player name');
    expect(markup).toContain('value=""');
    expect(markup).toContain('This name will appear in the hall of fame.');
    expect(markup).toContain('Enter lobby');
    expect(markup).not.toContain('Tên người chơi');
  });

  it('separates team and solo scores, orders attempts and highlights the current run', () => {
    setLanguage('en');
    const entries = [entry('low', ['Low'], 100), entry('team', ['Team A', 'Team B'], 9999), entry('high', ['<High>'], 500), entry('tied', ['Tie'], 500, 4)];
    const markup = renderToStaticMarkup(<LanguageProvider><DeckLeaderboardTable entries={entries} mode="solo" currentRunId="high" /></LanguageProvider>);
    expect(markup.indexOf('Tie')).toBeLessThan(markup.indexOf('&lt;High&gt;'));
    expect(markup.indexOf('&lt;High&gt;')).toBeLessThan(markup.indexOf('Low'));
    expect(markup).not.toContain('Team A');
    expect(markup).toContain('class="deck-current-run"');
    expect(markup).toContain('Your run');
    expect(markup).toContain('scope="col"');
    expect(markup).toContain('scope="row"');
    expect(entries[0].id).toBe('low');
    const team = renderToStaticMarkup(<LanguageProvider><DeckLeaderboardTable entries={entries} mode="coop" /></LanguageProvider>);
    expect(team).toContain('Team A');
    expect(team).toContain('Team B');
    expect(team).not.toContain('Low');
  });

  it('caps a category at 50 attempts and never substitutes a fake score for an empty board', () => {
    setLanguage('vi');
    const entries = Array.from({ length: 55 }, (_, index) => entry(`run${index}`, [`Tên ${index}`], index));
    const markup = renderToStaticMarkup(<LanguageProvider><DeckLeaderboardTable entries={entries} mode="solo" /></LanguageProvider>);
    expect((markup.match(/scope="row"/g) ?? []).length).toBe(50);
    expect(markup).toContain('Tên 54');
    expect(markup).not.toContain('<bdi>Tên 4</bdi>');
    const empty = renderToStaticMarkup(<LanguageProvider><DeckLeaderboardTable entries={entries} mode="coop" /></LanguageProvider>);
    expect(empty).toContain('Chưa có lượt co-op.');
    expect(empty).not.toContain('<table');
  });

  it('shows an accessible loading state in the chosen category before any network result', () => {
    setLanguage('en');
    const markup = renderToStaticMarkup(<LanguageProvider><DeckLeaderboard deckId={deck.id} initialMode="coop" /></LanguageProvider>);
    expect(markup).toContain('Loading hall of fame…');
    expect(markup).toContain('aria-pressed="true">Co-op');
    expect(markup).not.toContain('<table');
  });
});
