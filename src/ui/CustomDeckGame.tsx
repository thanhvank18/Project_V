import { useEffect, useState } from 'react';
import { customDeckWords, type CustomDeck } from '../game/customDeck';
import { CustomDeckApiError, loadCustomDeck } from '../game/customDeckApi';
import { emptyProgress } from '../game/storage';
import { App } from './App';
import { useLanguage } from './LanguageContext';

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
  if (!error && deck && language === deck.language) return <DeckApp deck={deck} onCreate={onCreate} onExpired={() => setError('deck-expired')} />;
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

function DeckApp({ deck, onCreate, onExpired }: { deck: CustomDeck; onCreate: () => void; onExpired: () => void }) {
  const [words] = useState(() => customDeckWords(deck));
  const [progress] = useState(emptyProgress);
  return <App initialProgress={progress} wordBank={words} customDeck={deck} onCreateMode={onCreate} onDeckExpired={onExpired} />;
}
