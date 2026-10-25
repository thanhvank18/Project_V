import { createRoot } from 'react-dom/client';
import '@fontsource/bungee/400.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import { App } from './ui/App';
import { emptyProgress, loadProgress } from './game/storage';
import { loadDictionary } from './game/dictionary';
import './ui/styles.css';

const root = createRoot(document.getElementById('root')!);

async function boot(): Promise<void> {
  root.render(<main className="dictionary-loading" role="status"><strong>Đang mở từ điển…</strong><p>Chuẩn bị kho từ và lịch sử đã chơi của bạn.</p></main>);
  try {
    const [initialProgress, dictionary] = await Promise.all([
      loadProgress().catch(() => emptyProgress()), loadDictionary(),
    ]);
    root.render(<App initialProgress={initialProgress} wordBank={dictionary.words} />);
  } catch {
    root.render(<main className="dictionary-loading" role="alert"><strong>Chưa mở được từ điển.</strong><p>Không tải được dữ liệu từ vựng của game. Hãy thử lại.</p><button className="button primary" onClick={() => void boot()}>Thử lại</button></main>);
  }
}

void boot();
