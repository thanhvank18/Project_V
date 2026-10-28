import { useEffect, useId, useState, type FormEvent } from 'react';
import { customDeckWords, type CustomDeck } from '../game/customDeck';
import { CustomDeckApiError, loadCustomDeck } from '../game/customDeckApi';
import { normalizePlayerName, PLAYER_NAME_MAX_LENGTH } from '../game/customDeckLeaderboard';
import { emptyProgress } from '../game/storage';
import { App } from './App';
import { DeckLeaderboard } from './DeckLeaderboard';
import { useLanguage } from './LanguageContext';
import './deck-leaderboard.css';

export function CustomDeckGame({ id, onHome, onCreate }: { id: string; onHome: () => void; onCreate: () => void }) {
  const { t, language, setLanguage } = useLanguage();
  const [deck, setDeck] = useState<CustomDeck | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setDeck(null); setError('');
    void loadCustomDeck(id, controller.signal).then(value => {
      if (!controller.signal.aborted) { setLanguage(value.language); setDeck(value); }
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof CustomDeckApiError ? reason.code : 'unavailable');
    });
    return () => controller.abort();
  }, [id, attempt, setLanguage]);
  useEffect(() => {
    if (!deck) return;
    const expire = () => { if (Date.now() >= deck.expiresAt) setError('deck-expired'); };
    const timer = window.setTimeout(expire, Math.max(0, deck.expiresAt - Date.now()));
    document.addEventListener('visibilitychange', expire);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', expire); };
  }, [deck]);
  if (!error && deck?.id === id && language === deck.language) return <DeckApp key={deck.id} deck={deck} onHome={onHome} onCreate={onCreate} onExpired={() => setError('deck-expired')} />;
  const expired = error === 'deck-expired' || error === 'deck-missing' || error === 'not-found';
  return <main className="dictionary-loading">
    <div role={error ? 'alert' : 'status'}>
      <strong>{t(expired ? 'Link đã hết hạn hoặc không còn tồn tại.' : error ? 'Chưa mở được bộ câu hỏi.' : 'Đang mở bộ câu hỏi…')}</strong>
      <p>{t(expired ? 'Bộ câu hỏi được xóa sau 24 giờ kể từ khi tạo.' : error ? 'Kiểm tra kết nối rồi thử lại.' : 'Chuẩn bị bộ từ được chia sẻ với bạn.')}</p>
    </div>
    {error && !expired && <button className="button primary" onClick={() => setAttempt(value => value + 1)}>{t('Thử lại')}</button>}
    <button className="button primary" onClick={onCreate}>{t('Tạo bộ câu hỏi')}</button>
    <button className="button ghost" onClick={onHome}>{t('Về game chính')}</button>
  </main>;
}

const playerNameStorageKey = 'zvs-custom-player-name-v1';

function readPlayerName(): string {
  try { return normalizePlayerName(localStorage.getItem(playerNameStorageKey)) ?? ''; } catch { return ''; }
}

export function DeckNameGate({ deck, onContinue, onHome }: { deck: CustomDeck; onContinue: (name: string) => void; onHome: () => void }) {
  const { t } = useLanguage();
  const fieldId = useId();
  const boardId = useId();
  const [name, setName] = useState(readPlayerName);
  const [invalid, setInvalid] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizePlayerName(name);
    if (!normalized) { setInvalid(true); return; }
    try { localStorage.setItem(playerNameStorageKey, normalized); } catch { /* The name still works for this visit. */ }
    onContinue(normalized);
  };
  return <main className="deck-entry">
    <section className="deck-entry-panel" aria-labelledby={`${fieldId}-title`}>
      <h1 id={`${fieldId}-title`}>{deck.title}</h1>
      <form onSubmit={submit} noValidate>
        <label htmlFor={fieldId}>{t('Tên người chơi')}</label>
        <input id={fieldId} name="playerName" value={name} onChange={event => { setName(event.target.value); setInvalid(false); }}
          required maxLength={PLAYER_NAME_MAX_LENGTH * 2} autoComplete="nickname" autoFocus spellCheck={false}
          aria-invalid={invalid || undefined} aria-describedby={`${fieldId}-hint${invalid ? ` ${fieldId}-error` : ''}`}
          placeholder={t('Nhập tên của bạn')} />
        <p id={`${fieldId}-hint`} className="deck-entry-hint">{t('Tên này sẽ hiện trên bảng danh vọng.')}</p>
        {invalid && <p id={`${fieldId}-error`} className="deck-entry-error" role="alert">{t('Tên cần có từ 1 đến 24 ký tự, không chứa ký tự điều khiển.')}</p>}
        <button className="button primary" type="submit">{t('Vào sảnh')}</button>
      </form>
      <div className="deck-entry-links">
        <button className="text-button" type="button" aria-expanded={showLeaderboard} aria-controls={boardId}
          onClick={() => setShowLeaderboard(value => !value)}>{t(showLeaderboard ? 'Ẩn bảng danh vọng' : 'Xem bảng danh vọng')}</button>
        <button className="text-button" type="button" onClick={onHome}>{t('Về game chính')}</button>
      </div>
    </section>
    <div id={boardId} className="deck-entry-board" hidden={!showLeaderboard}>{showLeaderboard && <DeckLeaderboard deckId={deck.id} />}</div>
  </main>;
}

function DeckApp({ deck, onHome, onCreate, onExpired }: { deck: CustomDeck; onHome: () => void; onCreate: () => void; onExpired: () => void }) {
  const [words] = useState(() => customDeckWords(deck));
  const [progress] = useState(emptyProgress);
  const [playerName, setPlayerName] = useState<string | null>(null);
  if (!playerName) return <DeckNameGate deck={deck} onContinue={setPlayerName} onHome={onHome} />;
  return <App initialProgress={progress} wordBank={words} customDeck={deck} customPlayerName={playerName} onCreateMode={onCreate} onDeckExpired={onExpired} />;
}
