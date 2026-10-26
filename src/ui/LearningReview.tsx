import { Star, Volume2, Square } from 'lucide-react';
import { useMemo } from 'react';
import { PART_OF_SPEECH_LABELS } from '../game/vocabulary';
import { getWordLearningLevel } from '../game/learningProgression';
import { exampleForWord } from '../game/reviewExamples';
import type { Word, WordResult } from '../game/types';
import { selectRunReview } from '../game/learningReview';

interface LearningWordCardProps {
  word: Word; result?: WordResult; favorite: boolean; speaking: boolean; speechAvailable: boolean;
  onFavorite: (word: string) => void; onSpeak: (word: string) => void; onStop: () => void;
}

export function LearningWordCard({ word, result, favorite, speaking, speechAvailable, onFavorite, onSpeak, onStop }: LearningWordCardProps) {
  const example = exampleForWord(word);
  return <article className="learning-word" aria-label={`Ôn từ ${word.answer}`}>
    <div className="learning-word-heading">
      <div><h3 lang="en">{word.answer}</h3><span>{PART_OF_SPEECH_LABELS[word.partOfSpeech]} · Bậc {getWordLearningLevel(word)}</span></div>
      <div className="learning-word-actions">
        <button className={`icon-button ${speaking ? 'selected' : ''}`} disabled={!speechAvailable} onClick={() => speaking ? onStop() : onSpeak(word.answer)} aria-label={speaking ? `Dừng đọc ${word.answer}` : `Nghe phát âm ${word.answer}`} title={speechAvailable ? 'Nghe phát âm tiếng Anh' : 'Trình duyệt chưa hỗ trợ đọc từ'}>{speaking ? <Square size={17} /> : <Volume2 size={19} />}</button>
        <button className={`icon-button favorite-button ${favorite ? 'selected' : ''}`} aria-pressed={favorite} onClick={() => onFavorite(word.answer)} aria-label={favorite ? `Bỏ yêu thích ${word.answer}` : `Yêu thích ${word.answer}`}><Star size={19} fill={favorite ? 'currentColor' : 'none'} /></button>
      </div>
    </div>
    <p className="learning-word-meaning">{word.meaning}</p>
    {example && <blockquote className="learning-example"><p lang="en">{example.english}</p><p>{example.vietnamese}</p></blockquote>}
    <div className="learning-word-foot"><span>{result ? result.mistakes > 0 ? `${result.mistakes} lỗi trong lúc gõ` : result.completed < result.encounters ? 'Đã gặp · Chưa hoàn thành' : result.assisted > 0 ? 'Đã hoàn thành · Có gợi ý' : 'Đã hoàn thành chính xác' : 'Đã gặp'}</span>{word.sourceUrl && <a href={word.sourceUrl} target="_blank" rel="noreferrer">Tra từ gốc</a>}</div>
  </article>;
}

export interface LearningReviewProps {
  words: readonly Word[]; results: readonly WordResult[]; runReview?: boolean;
  favorites: ReadonlySet<string>; speakingWord: string; speechAvailable: boolean;
  onFavorite: (word: string) => void; onSpeak: (word: string) => void; onStop: () => void;
}

/** Loaded with the notebook/result panel so example data stays out of gameplay startup. */
export default function LearningReview({ words, results, runReview = false, favorites, speakingWord, ...actions }: LearningReviewProps) {
  const entries = useMemo(() => {
    if (runReview) return selectRunReview(results, words, word => Boolean(exampleForWord(word)));
    const byWord = new Map(results.map(result => [result.word, result]));
    return words.map(word => ({ word, result: byWord.get(word.answer) }));
  }, [words, results, runReview]);
  if (!entries.length) return <p className="muted">Chưa có từ để ôn trong trận này.</p>;
  return <div className="learning-review">{entries.map(({ word, result }) => <LearningWordCard key={word.id} word={word} result={result} favorite={favorites.has(word.answer)} speaking={speakingWord === word.answer} {...actions} />)}</div>;
}
