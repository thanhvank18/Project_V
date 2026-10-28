import { createRoot } from 'react-dom/client';
import { lazy, Suspense, useEffect, useState } from 'react';
import '@fontsource/bungee/400.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import { App } from './ui/App';
import { emptyProgress, loadProgress } from './game/storage';
import { loadDictionary } from './game/dictionary';
import type { Progress, Word } from './game/types';
import { LanguagePicker, LanguageProvider, useLanguage } from './ui/LanguageContext';
import './ui/styles.css';

const root = createRoot(document.getElementById('root')!);
const CreateMode = lazy(() => import('./ui/CreateMode').then(module => ({ default: module.CreateMode })));
const CustomDeckGame = lazy(() => import('./ui/CustomDeckGame').then(module => ({ default: module.CustomDeckGame })));
const goHome = () => location.assign(location.pathname);
const goCreate = () => location.assign(`${location.pathname}?create=1`);

function GameRoute() {
  const { t } = useLanguage();
  const query = new URLSearchParams(location.search);
  return <Suspense fallback={<main className="dictionary-loading" role="status">{t('Đang tải…')}</main>}>
    {query.get('create') === '1' ? <CreateMode onClose={goHome} onCreated={deck => location.assign(`${location.pathname}?deck=${encodeURIComponent(deck.id)}`)} />
      : query.has('deck') ? <CustomDeckGame id={query.get('deck')!} onHome={goHome} onCreate={goCreate} /> : <Bootstrap />}
  </Suspense>;
}

function Bootstrap() {
  const { t } = useLanguage();
  const [loaded, setLoaded] = useState<{ progress: Progress; words: readonly Word[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    setFailed(false);
    void Promise.all([loadProgress().catch(() => emptyProgress()), loadDictionary()])
      .then(([progress, dictionary]) => { if (!disposed) setLoaded({ progress, words: dictionary.words }); })
      .catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; };
  }, [attempt]);
  if (loaded) return <App initialProgress={loaded.progress} wordBank={loaded.words} onCreateMode={goCreate} />;
  return <main className="dictionary-loading">
    <LanguagePicker />
    <div role={failed ? 'alert' : 'status'}>
      <strong>{t(failed ? 'Chưa mở được từ điển.' : 'Đang mở từ điển…')}</strong>
      <p>{t(failed ? 'Không tải được dữ liệu từ vựng của game. Hãy thử lại.' : 'Chuẩn bị kho từ và lịch sử đã chơi của bạn.')}</p>
    </div>
    {failed && <button className="button primary" onClick={() => setAttempt(value => value + 1)}>{t('Thử lại')}</button>}
  </main>;
}

root.render(<LanguageProvider><GameRoute /></LanguageProvider>);
