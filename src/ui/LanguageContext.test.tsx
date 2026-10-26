import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguagePicker, LanguageProvider } from './LanguageContext';
import LearningReview, { LearningWordCard } from './LearningReview';
import { HeroPicker } from './HeroPicker';
import { MultiplayerLobby } from './MultiplayerLobby';
import type { Word, WordResult } from '../game/types';
import type { RoomState } from '../game/RoomClient';

afterEach(() => vi.unstubAllGlobals());
const word: Word = { id: 'apple', answer: 'apple', meaning: 'quả táo', englishMeaning: 'A round fruit with red or green skin.', partOfSpeech: 'noun', difficulty: 1, category: 'Thức ăn' };
const card = (value: Word) => <LearningWordCard word={value} favorite={false} speaking={false} speechAvailable onFavorite={() => {}} onSpeak={() => {}} onStop={() => {}} />;
const setLanguage = (language: string) => vi.stubGlobal('localStorage', { getItem: () => language });

describe('bilingual React surfaces', () => {
  it('shows English definitions without examples that lack a verified English sense binding', () => {
    setLanguage('en');
    const html = renderToStaticMarkup(<LanguageProvider>{card(word)}</LanguageProvider>);
    expect(html).toContain('A round fruit with red or green skin.');
    expect(html).not.toContain('I eat an apple every day.');
    expect(html).not.toContain('learning-example');
    expect(html).toContain('Noun');
    expect(html).toContain('Listen to apple');
    expect(html).not.toContain('quả táo');
    expect(html).not.toContain('Tôi ăn');
  });

  it('keeps Vietnamese definitions and translated examples in Vietnamese mode', () => {
    setLanguage('vi');
    const html = renderToStaticMarkup(<LanguageProvider>{card(word)}</LanguageProvider>);
    expect(html).toContain('quả táo');
    expect(html).toContain('Tôi ăn một quả táo mỗi ngày.');
    expect(html).toContain('Nghe phát âm apple');
    expect(html).not.toContain(word.englishMeaning);
  });

  it.each([
    ['charge', 'vật mang, vật chở, vật gánh; gánh nặng ((nghĩa đen) & (nghĩa bóng))', 'A sudden rush toward something.', 'To be a charge on someone'],
    ['spring', 'sự nhảy; cái nhảy', 'The season between winter and summer.', 'To take a spring'],
    ['light', 'ánh sáng, ánh sáng mặt trời, ánh sáng ban ngày', 'A device used to produce a flame.', 'In the light of these facts'],
  ])('does not attach a Vietnamese-source example to another English sense of %s', (answer, meaning, englishMeaning, sentence) => {
    const value: Word = { ...word, id: answer, answer, meaning, englishMeaning };
    setLanguage('vi');
    expect(renderToStaticMarkup(<LanguageProvider>{card(value)}</LanguageProvider>)).toContain(sentence);
    setLanguage('en');
    const english = renderToStaticMarkup(<LanguageProvider>{card(value)}</LanguageProvider>);
    expect(english).toContain(englishMeaning);
    expect(english).not.toContain(sentence);
    expect(english).not.toContain('learning-example');
  });

  it('does not fall back to a Vietnamese gloss when an old notebook word lacks an English definition', () => {
    setLanguage('en');
    const html = renderToStaticMarkup(<LanguageProvider>{card({ ...word, englishMeaning: undefined })}</LanguageProvider>);
    expect(html).toContain('No English definition available.');
    expect(html).not.toContain('quả táo');
  });

  it('renders the selected language, hero tactics and room feedback in English', () => {
    setLanguage('en');
    const room: RoomState = { status: 'lobby', language: 'en', pin: '123456', selfId: 'one', hostId: 'one',
      players: [{ id: 'one', name: 'Người chơi 1', heroId: 'priest', connected: true }, { id: 'two', name: 'Người chơi 2', heroId: 'archer', connected: true }], error: 'Anh hùng này đã có người chọn.' };
    const html = renderToStaticMarkup(<LanguageProvider><LanguagePicker disabled /><HeroPicker value="priest" taken={['archer']} onChange={() => {}} /><MultiplayerLobby room={room} onJoin={() => {}} onCreate={() => {}} onOffline={() => {}} /></LanguageProvider>);
    expect(html).toContain('aria-label="English" aria-pressed="true" disabled');
    expect(html).toContain('Restoring Light');
    expect(html).toContain('Stand still for at least one second');
    expect(html).toContain('Player 2');
    expect(html).toContain('This hero is already taken.');
    expect(html).not.toContain('Người chơi');
    expect(html).not.toContain('Tu sĩ');
  });

  it('reviews words completed with their bound English sense without admitting an unrelated sense', () => {
    setLanguage('en');
    const results: WordResult[] = [
      { word: 'apple', meaning: word.englishMeaning!, encounters: 1, completed: 1, mistakes: 0, assisted: 0, totalResponseMs: 2000 },
      { word: 'bank', meaning: 'A financial institution.', encounters: 1, completed: 1, mistakes: 0, assisted: 0, totalResponseMs: 2000 },
    ];
    const bank: Word[] = [word, { ...word, id: 'bank', answer: 'bank', meaning: 'bờ sông', englishMeaning: 'The land beside a river.' }];
    const html = renderToStaticMarkup(<LanguageProvider><LearningReview words={bank} results={results} runReview favorites={new Set()} speakingWord="" speechAvailable onFavorite={() => {}} onSpeak={() => {}} onStop={() => {}} /></LanguageProvider>);
    expect(html).toContain('Review apple');
    expect(html).toContain(word.englishMeaning);
    expect(html).not.toContain('No words to review');
    expect(html).not.toContain('Review bank');
    expect(results[0].meaning).toBe(word.englishMeaning);
  });
});
