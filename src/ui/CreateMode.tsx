import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock3, Copy, Download, Link2, Plus, Trash2, Upload } from 'lucide-react';
import { CUSTOM_DECK_MAX_ENTRIES, customDeckCsvTemplate, parseCustomDeckCsv, validateCustomDeck, type CustomDeck, type CustomDeckEntry, type CustomDeckError, type CustomDeckInput } from '../game/customDeck';
import { createCustomDeck } from '../game/customDeckApi';
import { PART_OF_SPEECH_LABELS } from '../game/vocabulary';
import { LanguagePicker, useLanguage } from './LanguageContext';
import './create-mode.css';

type Translate = ReturnType<typeof useLanguage>['t'];
type DraftRow = CustomDeckEntry & { key: number };
const PAGE_SIZE = 10;
const blankRow = (key: number): DraftRow => ({ key, answer: '', meaning: '', partOfSpeech: 'noun', level: 1, type: 'mixed', sentence: '' });
const isBlank = (row: CustomDeckEntry) => !row.answer.trim() && !row.meaning.trim() && !row.sentence?.trim();
const ERROR_TEXT: Record<string, string> = {
  'Use between 1 and 500 questions.': 'Bộ từ cần từ 1 đến 500 câu hỏi.',
  'Question must be an object.': 'Câu hỏi không đúng định dạng. Hãy nhập lại dòng này.',
  'Answer must contain 1–18 English letters, with no spaces.': 'Đáp án cần 1–18 chữ cái tiếng Anh, không có khoảng trắng.',
  'Meaning must be text.': 'Nghĩa phải là văn bản.',
  'Meaning must be at most 400 characters with no control characters.': 'Nghĩa tối đa 400 ký tự và không chứa ký tự điều khiển.',
  'Choose a valid part of speech.': 'Hãy chọn từ loại hợp lệ.',
  'Level must be a whole number from 1 to 10.': 'Bậc phải là số nguyên từ 1 đến 10.',
  'Type must be mixed, translate, missing, scramble, or fill.': 'Dạng câu hỏi phải là mixed, translate, missing, scramble hoặc fill.',
  'Sentence must be text.': 'Câu điền từ phải là văn bản.',
  'Sentence must be at most 300 characters with no control characters.': 'Câu điền từ tối đa 300 ký tự và không chứa ký tự điều khiển.',
  'Fill-in-the-blank questions need exactly one ___ placeholder.': 'Câu điền từ cần đúng một chỗ trống ___ (3 dấu gạch dưới).',
  'Add sentence context around the blank.': 'Hãy thêm ngữ cảnh vào trước hoặc sau chỗ trống.',
  'Add a meaning or definition.': 'Hãy thêm nghĩa hoặc định nghĩa.',
  'Deck must be an object.': 'Bộ từ không đúng định dạng. Hãy kiểm tra lại dữ liệu.',
  'Title must contain 1–80 characters with no control characters.': 'Tên bộ từ cần 1–80 ký tự và không chứa ký tự điều khiển.',
  'Language must be vi or en.': 'Hãy chọn tiếng Việt hoặc tiếng Anh cho bộ từ.',
  'Damage mode must be health or one-hit.': 'Hãy chọn luật Máu bằng trái tim hoặc Một chạm là chết.',
  'Invalid quote or text after a closing quote.': 'Dấu ngoặc kép trong CSV chưa đúng. Hãy lưu lại bằng mẫu CSV.',
  'Unclosed quoted field.': 'Một ô CSV chưa đóng dấu ngoặc kép.',
  'CSV must be at most 1 MB of text.': 'File CSV không được lớn hơn 1 MB.',
  'CSV is empty.': 'File CSV đang trống.',
  'Unknown column. Use the downloadable CSV template headers.': 'Cột CSV không hợp lệ. Hãy dùng tiêu đề cột trong mẫu tải xuống.',
  'Duplicate column header.': 'File CSV có tiêu đề cột bị trùng.',
  'CSV needs an answer column.': 'File CSV cần cột answer.',
  'Column count differs from the header; quote values containing commas.': 'Số cột không khớp tiêu đề. Đặt nội dung chứa dấu phẩy trong ngoặc kép.',
};

export function customDeckErrorText(message: string, t: Translate): string {
  const duplicate = message.match(/^Duplicate answer; first used in row (\d+)\.$/);
  if (duplicate) return t('Đáp án bị trùng với dòng {0}.', [duplicate[1]]);
  return t(ERROR_TEXT[message] ?? message);
}

export function customDeckShareUrl(id: string, currentUrl: string): string {
  const url = new URL(currentUrl);
  url.search = ''; url.hash = ''; url.searchParams.set('deck', id);
  return url.toString();
}

export function CreatedDeckPanel({ deck, shareUrl, onPlay, onClose }: { deck: CustomDeck; shareUrl: string; onPlay: () => void; onClose: () => void }) {
  const { t, locale } = useLanguage();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [now, setNow] = useState(Date.now);
  const linkInput = useRef<HTMLInputElement>(null);
  const expired = now >= deck.expiresAt;
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopyState('copied'); }
    catch { setCopyState('manual'); linkInput.current?.focus(); linkInput.current?.select(); }
  };
  return <section className="create-success" aria-labelledby="create-success-title">
    <Check className="create-success-check" size={36} aria-hidden="true" />
    <h1 id="create-success-title">{t('Bộ từ đã sẵn sàng')}</h1>
    <p className="create-success-name">{deck.title} <span>· {t('{0} câu hỏi', [deck.entries.length])}</span></p>
    <p className="create-success-rule">{t('Luật sinh tồn')}: <strong>{t(deck.damageMode === 'one-hit' ? 'Một chạm là chết' : 'Máu bằng trái tim')}</strong></p>
    <label className="create-field" htmlFor="custom-share-link">{t('Link chơi bộ từ')}</label>
    <div className="create-share-row">
      <input ref={linkInput} id="custom-share-link" value={shareUrl} readOnly onFocus={event => event.currentTarget.select()} />
      <button type="button" className="button secondary" onClick={copy}><Copy size={17} aria-hidden="true" />{t('Sao chép link')}</button>
    </div>
    <p className="create-copy-status" role="status">{copyState === 'copied' ? t('Đã sao chép link.') : copyState === 'manual' ? t('Chọn và sao chép link trong ô phía trên.') : t('Gửi link này để người khác chơi cùng bộ từ.')}</p>
    <p className="create-expiry"><Clock3 size={17} aria-hidden="true" />{expired ? t('Link đã hết hạn và không thể chơi tiếp.') : t('Tự xóa lúc {0}', [new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(deck.expiresAt)])}</p>
    <p className="create-muted">{t('Bất kỳ ai có link đều có thể mở bộ từ này trong 24 giờ kể từ lúc tạo.')}</p>
    <div className="create-success-actions">
      <button type="button" className="button primary" onClick={onPlay} disabled={expired}>{t('Chơi bộ từ này')}</button>
      <button type="button" className="button secondary" onClick={onClose}>{t('Về trò chơi')}</button>
    </div>
  </section>;
}

export function CreateMode({ onClose, onCreated }: { onClose: () => void; onCreated: (deck: CustomDeck) => void }) {
  const { language, t } = useLanguage();
  const [title, setTitle] = useState('');
  const [deckLanguage, setDeckLanguage] = useState<CustomDeckInput['language']>(language);
  const [damageMode, setDamageMode] = useState<NonNullable<CustomDeckInput['damageMode']>>('health');
  const [rows, setRows] = useState<DraftRow[]>([blankRow(1)]);
  const [page, setPage] = useState(0);
  const [errors, setErrors] = useState<CustomDeckError[]>([]);
  const [errorSource, setErrorSource] = useState<'editor' | 'csv'>('editor');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [created, setCreated] = useState<CustomDeck>();
  const [focusRow, setFocusRow] = useState<number>();
  const sequence = useRef(1);
  const inFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const errorsRef = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const maxPage = Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, maxPage);
  const busyAny = busy || importing;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  useEffect(() => { if (errors.length) errorsRef.current?.focus(); }, [errors]);
  useEffect(() => {
    if (focusRow !== undefined) { document.getElementById(`create-answer-${focusRow}`)?.focus(); setFocusRow(undefined); }
  }, [focusRow, currentPage]);

  const update = (key: number, values: Partial<CustomDeckEntry>) => {
    setRows(previous => previous.map(row => row.key === key ? { ...row, ...values } : row));
    setErrors([]); setNotice('');
  };
  const add = () => {
    if (rows.length >= CUSTOM_DECK_MAX_ENTRIES) return;
    const row = blankRow(++sequence.current);
    setRows(previous => [...previous, row]); setPage(Math.floor(rows.length / PAGE_SIZE)); setFocusRow(row.key); setErrors([]);
  };
  const remove = (key: number) => {
    setRows(previous => previous.filter(row => row.key !== key)); setErrors([]); setNotice('');
  };
  const template = () => {
    const url = URL.createObjectURL(new Blob([customDeckCsvTemplate(deckLanguage)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `zombie-vocabulary-template-${deckLanguage}.csv`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importCsv = async (file: File) => {
    setImporting(true); setNotice(''); setErrorSource('csv'); setErrors([]);
    try {
      if (file.size > 1_000_000) { setErrors([{ field: 'csv', message: 'CSV must be at most 1 MB of text.' }]); return; }
      const result = parseCustomDeckCsv(await file.text());
      if (!mounted.current) return;
      if (result.errors.length) { setErrors(result.errors); return; }
      const existing = rows.filter(row => !isBlank(row));
      if (existing.length + result.entries.length > CUSTOM_DECK_MAX_ENTRIES) {
        setErrors([{ field: 'entries', message: 'Use between 1 and 500 questions.' }]); return;
      }
      setRows([...existing, ...result.entries.map(entry => ({ ...entry, key: ++sequence.current }))]);
      setPage(Math.floor(existing.length / PAGE_SIZE));
      setNotice(t('Đã thêm {0} câu hỏi từ {1}.', [result.entries.length, file.name]));
    } catch { if (mounted.current) setErrors([{ field: 'csv', message: t('Không đọc được file. Hãy lưu dưới dạng CSV UTF-8 rồi thử lại.') }]); }
    finally { if (mounted.current) setImporting(false); }
  };
  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || importing) return;
    setErrorSource('editor'); setNotice('');
    const result = validateCustomDeck({ title, language: deckLanguage, damageMode, entries: rows.map(({ key: _key, ...entry }) => entry) });
    setErrors(result.errors);
    if (!result.data) return;
    inFlight.current = true; setBusy(true); request.current = new AbortController();
    try {
      const deck = await createCustomDeck(result.data, request.current.signal);
      if (mounted.current) { setCreated(deck); window.scrollTo({ top: 0, behavior: 'instant' }); }
    } catch (error) {
      if (!mounted.current || request.current.signal.aborted) return;
      const issues = error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors) ? error.errors as CustomDeckError[] : [];
      setErrors(issues.length ? issues : [{ field: 'deck', message: error instanceof Error ? error.message : t('Không tạo được link. Dữ liệu vẫn được giữ; hãy thử lại.') }]);
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  const jumpToError = (error: CustomDeckError) => {
    if (error.row) { const index = error.row - 1; setPage(Math.floor(index / PAGE_SIZE)); setFocusRow(rows[index]?.key); }
    else document.getElementById(`create-${error.field}`)?.focus();
  };
  const fieldInvalid = (row: number, field: string) => errorSource === 'editor' && errors.some(error => error.row === row && error.field === field);

  return <main className="create-mode">
    <header className="create-header">
      <button type="button" className="text-button" onClick={onClose} disabled={busyAny}><ArrowLeft size={18} aria-hidden="true" />{t('Về trò chơi')}</button>
      <LanguagePicker disabled={busyAny} />
    </header>
    {created ? <CreatedDeckPanel deck={created} shareUrl={customDeckShareUrl(created.id, window.location.href)} onPlay={() => onCreated(created)} onClose={onClose} /> : <>
      <div className="create-intro"><h1>{t('Tạo bộ từ của bạn')}</h1><p>{t('Nhập câu hỏi hoặc tải CSV lên, rồi chia sẻ link chơi có hiệu lực 24 giờ.')}</p></div>
      <form onSubmit={publish} noValidate>
        <fieldset className="create-meta" disabled={busyAny}>
          <legend className="sr-only">{t('Thông tin bộ từ')}</legend>
          <label className="create-field" htmlFor="create-title">{t('Tên bộ từ')}<input id="create-title" value={title} maxLength={80} placeholder={t('Ví dụ: Từ vựng lớp học')} onChange={event => { setTitle(event.target.value); setErrors([]); }} aria-invalid={errors.some(error => error.field === 'title') || undefined} /></label>
          <label className="create-field" htmlFor="create-language">{t('Ngôn ngữ nghĩa và câu hỏi')}<select id="create-language" value={deckLanguage} onChange={event => setDeckLanguage(event.target.value as CustomDeckInput['language'])}><option value="vi">{t('Tiếng Việt')}</option><option value="en">{t('Tiếng Anh')}</option></select></label>
          <label className="create-field" htmlFor="create-damageMode">{t('Luật sinh tồn')}<select id="create-damageMode" value={damageMode} onChange={event => { setDamageMode(event.target.value as NonNullable<CustomDeckInput['damageMode']>); setErrors([]); }} aria-describedby="create-damage-help"><option value="health">{t('Máu bằng trái tim')}</option><option value="one-hit">{t('Một chạm là chết')}</option></select></label>
          <p id="create-damage-help" className="create-rule-help">{t(damageMode === 'one-hit' ? 'Mọi anh hùng có 1 HP. Bất kỳ đòn gây sát thương nào từ quái hoặc Boss đều hạ bạn; hồi máu không thể vượt 1 HP.' : 'Cận chiến có 7 tim (150 HP), đánh xa có 5 tim (100 HP). Có thể hồi máu.')}</p>
        </fieldset>
        <section className="create-questions" aria-labelledby="create-question-title">
          <div className="create-list-heading"><div><h2 id="create-question-title">{t('Câu hỏi')}</h2><p>{t('{0}/{1} câu hỏi', [rows.length, CUSTOM_DECK_MAX_ENTRIES])}</p></div>
            <div className="create-import-actions">
              <button type="button" className="button secondary" onClick={template} disabled={busyAny}><Download size={17} aria-hidden="true" />{t('Tải mẫu CSV')}</button>
              <button type="button" className="button secondary" onClick={() => fileInput.current?.click()} disabled={busyAny}><Upload size={17} aria-hidden="true" />{importing ? t('Đang đọc CSV…') : t('Nhập CSV')}</button>
              <input ref={fileInput} type="file" accept=".csv,text/csv" hidden aria-label={t('Chọn file CSV')} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importCsv(file); }} />
            </div>
          </div>
          <p className="create-list-note">{t('Mỗi đáp án là một từ tiếng Anh, 1–18 chữ cái. CSV được thêm vào danh sách hiện tại.')}</p>
          <details className="create-csv-help"><summary>{t('Cách dùng mẫu CSV')}</summary><p>{t('Sửa các dòng ví dụ trong mẫu rồi lưu CSV UTF-8. Giữ tên cột: answer, meaning, partOfSpeech, level, type, sentence. Bậc từ 1 (dễ) đến 10 (khó).')}</p><p>{t('Dạng câu hỏi: mixed (trộn), translate (nghĩa), missing (chữ thiếu), scramble (xếp chữ), fill (điền từ). Với fill, viết câu có đúng một chỗ trống ___ trong cột sentence.')}</p></details>
          {errors.length > 0 && <div className="create-errors" role="alert" tabIndex={-1} ref={errorsRef}>
            <strong>{errorSource === 'csv' ? t('Chưa nhập CSV. Danh sách hiện tại vẫn được giữ.') : t('Hãy sửa các mục sau trước khi tạo link:')}</strong>
            <ul>{errors.slice(0, 20).map((error, index) => <li key={`${error.row}-${error.field}-${index}`}>
              {errorSource === 'editor' && (error.row || error.field === 'title') ? <button type="button" onClick={() => jumpToError(error)}>{error.row ? t('Dòng {0}: {1}', [error.row, customDeckErrorText(error.message, t)]) : customDeckErrorText(error.message, t)}</button> : error.row ? t('Dòng {0}: {1}', [error.row, customDeckErrorText(error.message, t)]) : customDeckErrorText(error.message, t)}
            </li>)}</ul>{errors.length > 20 && <p>{t('Còn {0} lỗi khác. Sửa các dòng trên rồi kiểm tra lại.', [errors.length - 20])}</p>}
          </div>}
          <p className="create-notice" role="status">{notice}</p>
          <div className="create-rows">
            {rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((row, offset) => {
              const number = currentPage * PAGE_SIZE + offset + 1;
              return <fieldset className="create-row" key={row.key} disabled={busyAny}>
                <legend>{t('Câu {0}', [number])}</legend>
                <div className="create-row-grid">
                  <label className="create-field create-answer" htmlFor={`create-answer-${row.key}`}>{t('Đáp án')}<input id={`create-answer-${row.key}`} value={row.answer} maxLength={18} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="apple" onChange={event => update(row.key, { answer: event.target.value })} aria-invalid={fieldInvalid(number, 'answer') || undefined} /></label>
                  <label className="create-field create-meaning" htmlFor={`create-meaning-${row.key}`}>{row.type === 'fill' ? t('Nghĩa (tùy chọn)') : t('Nghĩa / định nghĩa')}<textarea id={`create-meaning-${row.key}`} value={row.meaning} rows={2} maxLength={400} placeholder={deckLanguage === 'vi' ? t('Ví dụ: Quả táo') : 'A round fruit with red or green skin.'} onChange={event => update(row.key, { meaning: event.target.value })} aria-invalid={fieldInvalid(number, 'meaning') || undefined} /></label>
                  <label className="create-field" htmlFor={`create-pos-${row.key}`}>{t('Từ loại')}<select id={`create-pos-${row.key}`} value={row.partOfSpeech} onChange={event => update(row.key, { partOfSpeech: event.target.value as CustomDeckEntry['partOfSpeech'] })}>{Object.entries(PART_OF_SPEECH_LABELS).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label>
                  <label className="create-field" htmlFor={`create-level-${row.key}`}>{t('Bậc')}<select id={`create-level-${row.key}`} value={row.level} onChange={event => update(row.key, { level: Number(event.target.value) as CustomDeckEntry['level'] })}>{Array.from({ length: 10 }, (_, index) => <option value={index + 1} key={index}>{index + 1}</option>)}</select></label>
                  <label className="create-field create-type" htmlFor={`create-type-${row.key}`}>{t('Dạng câu hỏi')}<select id={`create-type-${row.key}`} value={row.type} onChange={event => update(row.key, { type: event.target.value as CustomDeckEntry['type'] })}><option value="mixed">{t('Trộn các dạng')}</option><option value="translate">{t('Đoán từ qua nghĩa')}</option><option value="missing">{t('Điền chữ thiếu')}</option><option value="scramble">{t('Xếp chữ')}</option><option value="fill">{t('Điền từ vào câu')}</option></select></label>
                  <button type="button" className="icon-button create-remove" onClick={() => remove(row.key)} aria-label={t('Xóa câu {0}', [number])} title={t('Xóa câu {0}', [number])}><Trash2 size={18} aria-hidden="true" /></button>
                  {row.type === 'fill' && <label className="create-field create-sentence" htmlFor={`create-sentence-${row.key}`}>{t('Câu có chỗ trống')}<input id={`create-sentence-${row.key}`} value={row.sentence ?? ''} maxLength={300} placeholder="I eat an ___ every day." onChange={event => update(row.key, { sentence: event.target.value })} aria-describedby={`create-sentence-help-${row.key}`} aria-invalid={fieldInvalid(number, 'sentence') || undefined} /><span id={`create-sentence-help-${row.key}`} className="create-muted">{t('Thay từ cần điền bằng ___ (3 dấu gạch dưới). Người chơi gõ đáp án ở trên.')}</span></label>}
                </div>
              </fieldset>;
            })}
            {!rows.length && <div className="create-empty"><p>{t('Chưa có câu hỏi. Thêm một câu hoặc nhập file CSV để bắt đầu.')}</p></div>}
          </div>
          {maxPage > 0 && <nav className="create-pagination" aria-label={t('Trang câu hỏi')}><button type="button" className="button secondary" disabled={currentPage === 0 || busyAny} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} aria-hidden="true" />{t('Trang trước')}</button><span>{t('Trang {0}/{1}', [currentPage + 1, maxPage + 1])}</span><button type="button" className="button secondary" disabled={currentPage >= maxPage || busyAny} onClick={() => setPage(currentPage + 1)}>{t('Trang sau')}<ChevronRight size={17} aria-hidden="true" /></button></nav>}
          <button type="button" className="button secondary create-add" onClick={add} disabled={rows.length >= CUSTOM_DECK_MAX_ENTRIES || busyAny}><Plus size={18} aria-hidden="true" />{t('Thêm câu hỏi')}</button>
        </section>
        <footer className="create-publish"><p><Clock3 size={18} aria-hidden="true" />{t('Link và bộ từ tự xóa sau 24 giờ kể từ lúc tạo.')}</p><button type="submit" className="button primary" disabled={busyAny || !rows.length}><Link2 size={18} aria-hidden="true" />{busy ? t('Đang tạo link…') : t('Tạo link chơi')}</button></footer>
      </form>
    </>}
  </main>;
}
