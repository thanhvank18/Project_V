import { useEffect, useId, useState } from 'react';
import { Trophy } from 'lucide-react';
import { CustomDeckApiError, loadDeckLeaderboard } from '../game/customDeckApi';
import { compareLeaderboardEntries, LEADERBOARD_CATEGORY_LIMIT, type DeckLeaderboardEntry } from '../game/customDeckLeaderboard';
import { useLanguage } from './LanguageContext';
import './deck-leaderboard.css';

type BoardMode = 'solo' | 'coop';
interface BoardState { deckId: string; status: 'loading' | 'ready' | 'error' | 'expired'; entries: DeckLeaderboardEntry[] }

export function DeckLeaderboard({ deckId, currentRunId, refreshKey, initialMode = 'solo' }: {
  deckId: string; currentRunId?: string; refreshKey?: string; initialMode?: BoardMode;
}) {
  const { t } = useLanguage();
  const headingId = useId();
  const [mode, setMode] = useState<BoardMode>(initialMode);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BoardState>({ deckId, status: 'loading', entries: [] });
  useEffect(() => {
    const controller = new AbortController();
    setState({ deckId, status: 'loading', entries: [] });
    void loadDeckLeaderboard(deckId, controller.signal).then(board => {
      if (!controller.signal.aborted) setState({ deckId, status: 'ready', entries: board.entries });
    }).catch(error => {
      if (controller.signal.aborted) return;
      const expired = error instanceof CustomDeckApiError && ['deck-expired', 'deck-missing', 'not-found'].includes(error.code);
      setState({ deckId, status: expired ? 'expired' : 'error', entries: [] });
    });
    return () => controller.abort();
  }, [deckId, refreshKey, attempt]);
  const status = state.deckId === deckId ? state.status : 'loading';
  return <section className="deck-leaderboard" aria-labelledby={headingId}>
    <div className="deck-leaderboard-heading">
      <h3 id={headingId}><Trophy size={18} aria-hidden="true" />{t('Bảng danh vọng')}</h3>
      <button type="button" className="text-button" onClick={() => setAttempt(value => value + 1)} disabled={status === 'loading' || status === 'expired'}>{t('Làm mới')}</button>
    </div>
    <div className="deck-leaderboard-modes" role="group" aria-label={t('Chế độ xếp hạng')}>
      <button type="button" aria-pressed={mode === 'solo'} onClick={() => setMode('solo')}>{t('Chơi một mình')}</button>
      <button type="button" aria-pressed={mode === 'coop'} onClick={() => setMode('coop')}>{t('Co-op')}</button>
    </div>
    <p className="deck-leaderboard-caption">{t('Top 50 lượt chơi · Điểm cao nhất đứng đầu.')}</p>
    {status === 'loading' && <p className="deck-leaderboard-status" role="status">{t('Đang tải bảng danh vọng…')}</p>}
    {status === 'expired' && <p className="deck-leaderboard-status" role="status">{t('Bảng danh vọng đã hết hạn cùng bộ câu hỏi.')}</p>}
    {status === 'error' && <div className="deck-leaderboard-status" role="alert">
      <p>{t('Chưa tải được bảng danh vọng. Kiểm tra kết nối rồi thử lại.')}</p>
      <button type="button" className="button secondary" onClick={() => setAttempt(value => value + 1)}>{t('Thử lại')}</button>
    </div>}
    {status === 'ready' && <DeckLeaderboardTable entries={state.entries} mode={mode} currentRunId={currentRunId} />}
  </section>;
}

export function DeckLeaderboardTable({ entries, mode, currentRunId }: { entries: DeckLeaderboardEntry[]; mode: BoardMode; currentRunId?: string }) {
  const { t, locale } = useLanguage();
  const rows = entries.filter(entry => mode === 'solo' ? entry.players.length === 1 : entry.players.length > 1)
    .sort(compareLeaderboardEntries).slice(0, LEADERBOARD_CATEGORY_LIMIT);
  if (!rows.length) return <p className="deck-leaderboard-status" role="status">{t(mode === 'solo' ? 'Chưa có lượt chơi một mình. Hoàn thành trận đầu tiên để ghi danh.' : 'Chưa có lượt co-op. Rủ bạn vào cùng phòng để ghi danh.')}</p>;
  return <div className="deck-leaderboard-scroll" tabIndex={0} role="region" aria-label={t('Top lượt chơi')}>
    <table className="deck-leaderboard-table">
      <caption className="sr-only">{t(mode === 'solo' ? 'Bảng danh vọng chơi một mình' : 'Bảng danh vọng co-op')}</caption>
      <thead><tr>
        <th scope="col" className="deck-rank">{t('Hạng')}</th>
        <th scope="col">{t(mode === 'solo' ? 'Người chơi' : 'Đội')}</th>
        <th scope="col" className="deck-number">{t('Điểm')}</th>
        <th scope="col" className="deck-number deck-extra-stat">{t('Từ hoàn thành')}</th>
        <th scope="col" className="deck-number deck-extra-stat">{t('Chính xác')}</th>
      </tr></thead>
      <tbody>{rows.map((entry, index) => <tr key={entry.id} className={entry.id === currentRunId ? 'deck-current-run' : undefined}>
        <td className="deck-rank">{index + 1}</td>
        <th scope="row" className="deck-player-name">
          {entry.players.map((name, playerIndex) => <span key={`${playerIndex}-${name}`}>
            {playerIndex > 0 && <span className="deck-name-separator"> / </span>}<bdi>{name}</bdi>
          </span>)}
          {entry.id === currentRunId && <small className="deck-own-run">{t('Lượt của bạn')}</small>}
          <small className="deck-mobile-stats">{t('{0} từ · {1}% chính xác', [entry.words.toLocaleString(locale), entry.accuracy.toLocaleString(locale, { maximumFractionDigits: 1 })])}</small>
        </th>
        <td className="deck-number deck-score">{entry.score.toLocaleString(locale)}</td>
        <td className="deck-number deck-extra-stat">{entry.words.toLocaleString(locale)}</td>
        <td className="deck-number deck-extra-stat">{entry.accuracy.toLocaleString(locale, { maximumFractionDigits: 1 })}%</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
