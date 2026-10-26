import { useLanguage } from './LanguageContext';
import { Star, Volume2, Square } from 'lucide-react';
import { useMemo } from 'react';
import { PART_OF_SPEECH_LABELS } from '../game/vocabulary';
import { getWordLearningLevel } from '../game/learningProgression';
import { exampleForWord } from '../game/reviewExamples';
import type { Word, WordResult } from '../game/types';
import { selectRunReview } from '../game/learningReview';
import { getWordMeaning } from '../game/localization';

interface LearningWordCardProps {
  word: Word; result?: WordResult; favorite: boolean; speaking: boolean; speechAvailable: boolean;
  onFavorite: (word: string) => void; onSpeak: (word: string) => void; onStop: () => void;
}

export function LearningWordCard({ word, result, favorite, speaking, speechAvailable, onFavorite, onSpeak, onStop }: LearningWordCardProps) {
  const { t, language } = useLanguage();
  // Existing examples are bound to the Vietnamese source sense only. The English
  // definition may select another sense; do not imply that these sentences match it.
  const example = language === 'vi' ? exampleForWord(word) : undefined;
  return <article className="learning-word" aria-label={t("Ôn từ {0}", [word.answer])}>
    <div className="learning-word-heading">
      <div><h3 lang="en">{word.answer}</h3><span>{t(PART_OF_SPEECH_LABELS[word.partOfSpeech])}{t(" · Bậc ")}{getWordLearningLevel(word)}</span></div>
      <div className="learning-word-actions">
        <button className={`icon-button ${speaking ? 'selected' : ''}`} disabled={!speechAvailable} onClick={() => speaking ? onStop() : onSpeak(word.answer)} aria-label={speaking ? t("Dừng đọc {0}", [word.answer]) : t("Nghe phát âm {0}", [word.answer])} title={speechAvailable ? t("Nghe phát âm tiếng Anh") : t("Trình duyệt chưa hỗ trợ đọc từ")}>{speaking ? <Square size={17} /> : <Volume2 size={19} />}</button>
        <button className={`icon-button favorite-button ${favorite ? 'selected' : ''}`} aria-pressed={favorite} onClick={() => onFavorite(word.answer)} aria-label={favorite ? t("Bỏ yêu thích {0}", [word.answer]) : t("Yêu thích {0}", [word.answer])}><Star size={19} fill={favorite ? 'currentColor' : 'none'} /></button>
      </div>
    </div>
    <p className="learning-word-meaning">{getWordMeaning(word, language)}</p>
    {example && <blockquote className="learning-example"><p lang="en">{example.english}</p>{language === 'vi' && <p>{example.vietnamese}</p>}</blockquote>}
    <div className="learning-word-foot"><span>{result ? result.mistakes > 0 ? t("{0} lỗi trong lúc gõ", [result.mistakes]) : result.completed < result.encounters ? t("Đã gặp · Chưa hoàn thành") : result.assisted > 0 ? t("Đã hoàn thành · Có gợi ý") : t("Đã hoàn thành chính xác") : t("Đã gặp")}</span>{word.sourceUrl && <a href={word.sourceUrl} target="_blank" rel="noreferrer">{t("Tra từ gốc")}</a>}</div>
  </article>;
}

export interface LearningReviewProps {
  words: readonly Word[]; results: readonly WordResult[]; runReview?: boolean;
  favorites: ReadonlySet<string>; speakingWord: string; speechAvailable: boolean;
  onFavorite: (word: string) => void; onSpeak: (word: string) => void; onStop: () => void;
}

/** Loaded with the notebook/result panel so example data stays out of gameplay startup. */
export default function LearningReview({ words, results, runReview = false, favorites, speakingWord, ...actions }: LearningReviewProps) {
  const { t, language } = useLanguage();
  const entries = useMemo(() => {
    if (runReview) {
      // An English run records its displayed definition. Resolve only the explicitly
      // bound bilingual sense; unknown or changed meanings retain the existing guard.
      const bilingualSenses = new Map(words.filter(word => word.englishMeaning)
        .map(word => [`${word.answer}\0${word.englishMeaning}`, word.meaning]));
      const canonicalResults = results.map(result => {
        const meaning = bilingualSenses.get(`${result.word}\0${result.meaning}`);
        return meaning === undefined ? result : { ...result, meaning };
      });
      return selectRunReview(canonicalResults, words, word => language === 'vi' && Boolean(exampleForWord(word)));
    }
    const byWord = new Map(results.map(result => [result.word, result]));
    return words.map(word => ({ word, result: byWord.get(word.answer) }));
  }, [words, results, runReview, language]);
  if (!entries.length) return <p className="muted">{t("Chưa có từ để ôn trong trận này.")}</p>;
  return <div className="learning-review">{entries.map(({ word, result }) => <LearningWordCard key={word.id} word={word} result={result} favorite={favorites.has(word.answer)} speaking={speakingWord === word.answer} {...actions} />)}</div>;
}
