import type { Progress, Word } from './types';
import { historyKeysFor } from './vocabulary';

/** Read each historical spelling once; never write totals back over their source records. */
export function wordHistoryFor(word: Word, history: Progress['words']): Progress['words'][string] | undefined {
  const records = historyKeysFor(word).map(answer => history[answer]).filter(Boolean);
  if (!records.length) return undefined;
  const latest = records.reduce((previous, current) => current.lastSeen > previous.lastSeen ? current : previous);
  return {
    word: word.answer, meaning: word.meaning,
    encounters: records.reduce((sum, result) => sum + result.encounters, 0),
    completed: records.reduce((sum, result) => sum + result.completed, 0),
    mistakes: records.reduce((sum, result) => sum + result.mistakes, 0),
    assisted: records.reduce((sum, result) => sum + result.assisted, 0),
    totalResponseMs: records.reduce((sum, result) => sum + result.totalResponseMs, 0),
    lastSeen: latest.lastSeen, nextReview: latest.nextReview,
  };
}
