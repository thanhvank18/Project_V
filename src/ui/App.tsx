import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BookOpen, Crosshair, Heart, Keyboard, Maximize2, Minimize2, Music2, Pause, Play, RotateCcw, Shield, SkipForward, Skull, Sparkles, Trophy, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { GameEngine } from '../game/engine';
import { getHeroCharacter } from '../game/characterCatalog';
import { HeroPicker } from './HeroPicker';
import { getWordLearningLevel, LEARNING_LEVEL_LABELS, MAX_LEARNING_LEVEL } from '../game/learningProgression';
import { historyKeysFor, PART_OF_SPEECH_LABELS, WORDS } from '../game/vocabulary';
import { getDistrictAt } from '../game/worldLayout';
import { getStorageWarning, markWordSeen, saveRun } from '../game/storage';
import { wordHistoryFor } from '../game/wordHistory';
import type { AudioState } from '../game/GameAudio';
import type { RenderOptions } from '../game/SurvivalScene';
import type { ItemKind, Progress, Snapshot, Word } from '../game/types';

const formatTime = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`;
const kindNames = { normal: 'Quái thường', runner: 'Quái nhanh', armored: 'Quái giáp', tank: 'Boss bảo hộ' };
const audioStatusLabels: Record<AudioState['status'], string> = { waiting: 'Chờ phát nhạc', playing: 'Đang phát', paused: 'Tạm dừng', unavailable: 'Nhạc chưa phát được' };
const readVolume = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : undefined;
const items: { key: ItemKind; name: string; number: number; help: string }[] = [
  { key: 'health', name: 'Hồi máu', number: 1, help: 'Hồi 25 HP' },
  { key: 'freeze', name: 'Đóng băng', number: 2, help: 'Dừng zombie 3 giây, trừ Boss' },
  { key: 'damage', name: 'Cường hóa', number: 3, help: 'Gây thêm sát thương giáp/Boss trong 6 giây' },
  { key: 'shield', name: 'Gợi ý từ', number: 4, help: 'Hiện thêm chữ gợi ý cho mục tiêu' },
];

function readSettings() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('zvs-settings-v1') || '{}');
    if (!value || typeof value !== 'object') return {};
    const settings = value as Record<string, unknown>;
    return {
      muted: typeof settings.muted === 'boolean' ? settings.muted : undefined,
      reducedMotion: typeof settings.reducedMotion === 'boolean' ? settings.reducedMotion : undefined,
      heroId: typeof settings.heroId === 'string' ? settings.heroId : undefined,
      musicVolume: readVolume(settings.musicVolume),
      sfxVolume: readVolume(settings.sfxVolume),
    };
  }
  catch { return {}; }
}

function Modal({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={20} /></button></div>
    {children}
  </dialog>;
}

export function App({ initialProgress, wordBank = WORDS }: { initialProgress: Progress; wordBank?: readonly Word[] }) {
  const [seenWords, setSeenWords] = useState(() => new Set([...Object.keys(initialProgress.seenWords ?? {}), ...Object.keys(initialProgress.words)]));
  const [engine] = useState(() => new GameEngine(Math.random, initialProgress, word => {
    markWordSeen(word);
    setSeenWords(previous => new Set(previous).add(word.answer));
  }, wordBank));
  const [snapshot, setSnapshot] = useState<Snapshot>(() => engine.snapshot());
  const [progress, setProgress] = useState(initialProgress);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState(getStorageWarning);
  const [settings, setSettings] = useState(() => { const s = readSettings(); return { muted: s.muted ?? false, reducedMotion: s.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches, heroId: getHeroCharacter(s.heroId).id, musicVolume: s.musicVolume ?? 0.25, sfxVolume: s.sfxVolume ?? 0.6 }; });
  const [audioState, setAudioState] = useState<AudioState>({ title: '', index: 0, total: 0, playing: false, status: 'waiting' });
  const [panel, setPanel] = useState<'help' | 'collection' | 'audio' | null>(null);
  const [collectionQuery, setCollectionQuery] = useState('');
  const [collectionPos, setCollectionPos] = useState('');
  const [collectionLevel, setCollectionLevel] = useState('');
  const [collectionPage, setCollectionPage] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const movementKeys = useRef(new Set<string>());
  const runtime = useRef<{ game: { destroy: (removeCanvas: boolean) => void }; setOptions: (opts: RenderOptions) => void; nextTrack: () => void } | null>(null);
  const saved = useRef(new Set<string>());
  const optionsRef = useRef(settings);
  optionsRef.current = settings;

  useEffect(() => {
    let disposed = false;
    void Promise.all([document.fonts.ready, import('../game/SurvivalScene')]).then(async ([, module]) => {
      if (disposed) return;
      const created = await module.createGame(host.current!, engine, setSnapshot, optionsRef.current, state => { if (!disposed) setAudioState(state); });
      if (disposed) { created.game.destroy(true); return; }
      runtime.current = created; created.setOptions(optionsRef.current); setReady(true);
    }).catch(() => { if (!disposed) setLoadError('Không tải được cảnh chơi. Hãy tải lại trang để thử lại.'); });
    return () => { disposed = true; runtime.current?.game.destroy(true); runtime.current = null; };
  }, [engine]);

  useEffect(() => {
    engine.setHero(settings.heroId);
    runtime.current?.setOptions(settings);
    try { localStorage.setItem('zvs-settings-v1', JSON.stringify(settings)); } catch { /* Settings are optional. */ }
  }, [settings, engine]);

  useEffect(() => { setSaveError(getStorageWarning()); }, [seenWords]);

  useEffect(() => {
    const summary = snapshot.summary;
    if (!summary || saved.current.has(summary.id)) return;
    saved.current.add(summary.id);
    void saveRun(summary).then(next => { setProgress(next); engine.setProgress(next); setSaveError(getStorageWarning()); }).catch(() => setSaveError('Trình duyệt chưa lưu được tiến trình. Bạn vẫn có thể chơi tiếp trong phiên này.'));
  }, [snapshot.summary, engine]);

  useEffect(() => {
    const pause = () => { engine.pause(); setSnapshot(engine.snapshot()); };
    const visibility = () => { if (document.hidden) pause(); };
    const screen = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('fullscreenchange', screen);
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', screen); };
  }, [engine]);

  const focusInput = useCallback(() => requestAnimationFrame(() => input.current?.focus({ preventScroll: true })), []);
  useEffect(() => { if (snapshot.phase === 'playing' && !panel) focusInput(); }, [snapshot.phase, panel, focusInput]);
  useEffect(() => {
    if (snapshot.phase !== 'playing' || panel) { movementKeys.current.clear(); engine.setMovement(0); }
  }, [snapshot.phase, panel, engine]);
  const start = (mode: 'survival' | 'boss') => { engine.setHero(settings.heroId); runtime.current?.setOptions(settings); setPanel(null); engine.start(mode); setSnapshot(engine.snapshot()); focusInput(); };
  const resume = () => { engine.resume(); setSnapshot(engine.snapshot()); focusInput(); };
  const home = () => { setPanel(null); engine.toMenu(); setSnapshot(engine.snapshot()); };
  const showPanel = (value: 'help' | 'collection' | 'audio') => { engine.pause(); setSnapshot(engine.snapshot()); setPanel(value); };
  const consume = (key: ItemKind) => { engine.useItem(key); setSnapshot(engine.snapshot()); focusInput(); };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (engine.snapshot().phase !== 'playing' || panel) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (!event.repeat) {
        movementKeys.current.add(event.key);
        engine.setMovement(event.key === 'ArrowLeft' ? -1 : 1);
      }
      return;
    }
    if (event.nativeEvent.isComposing || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === 'Escape') { event.preventDefault(); engine.pause(); setSnapshot(engine.snapshot()); return; }
    if (event.key === 'Tab') { event.preventDefault(); engine.cycleTarget(event.shiftKey ? -1 : 1); setSnapshot(engine.snapshot()); return; }
    if (/^[1-4]$/.test(event.key)) { event.preventDefault(); consume(items[Number(event.key) - 1].key); return; }
    if (/^[a-z]$/i.test(event.key) || event.key === 'Backspace') { event.preventDefault(); engine.typeKey(event.key); setSnapshot(engine.snapshot()); }
  };
  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (engine.snapshot().phase !== 'playing' || panel) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    movementKeys.current.delete(event.key);
    const remaining = [...movementKeys.current].at(-1);
    engine.setMovement(remaining === 'ArrowLeft' ? -1 : remaining === 'ArrowRight' ? 1 : 0);
  };
  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.current?.requestFullscreen(); }
    catch { /* Browser may not allow fullscreen. The normal layout remains playable. */ }
  };
  const playing = snapshot.phase === 'playing' || snapshot.phase === 'countdown' || snapshot.phase === 'paused';
  const summary = snapshot.summary;
  const collectionWords = useMemo(() => {
    if (panel !== 'collection') return [];
    const query = collectionQuery.trim().toLowerCase();
    return wordBank.filter(word => historyKeysFor(word).some(answer => seenWords.has(answer))
      && (!query || word.answer.includes(query) || word.meaning.toLowerCase().includes(query))
      && (!collectionPos || word.partOfSpeech === collectionPos)
      && (!collectionLevel || getWordLearningLevel(word) === Number(collectionLevel)))
      .sort((a, b) => getWordLearningLevel(a) - getWordLearningLevel(b) || a.answer.localeCompare(b.answer));
  }, [wordBank, seenWords, panel, collectionQuery, collectionPos, collectionLevel]);
  const collectionPages = Math.max(1, Math.ceil(collectionWords.length / 50));
  const page = Math.min(collectionPage, collectionPages - 1);
  const vocabularyComplete = summary?.reason === 'vocabulary-complete';
  const collectionFiltered = Boolean(collectionQuery || collectionPos || collectionLevel);

  return <main className={`app ${settings.reducedMotion ? 'reduce-motion' : ''}`}>
    <header className="site-header">
      <a className="wordmark" href="#" onClick={event => { event.preventDefault(); if (playing) { engine.pause(); setSnapshot(engine.snapshot()); } else home(); }} aria-label="Zombie Vocabulary Survival">
        <span className="brand-mark"><Skull strokeWidth={1.8} /></span><span><strong>ZOMBIE</strong><span>VOCABULARY SURVIVAL</span></span>
      </a>
      <p className="header-tagline">Learn English.<br /><strong>Live another day.</strong></p>
      <div className="header-actions">
        <span className="record"><Trophy size={18} /><span>Kỷ lục<strong>{progress.highScore.toLocaleString('vi-VN')}</strong></span></span>
        <button className="icon-button" onClick={() => setSettings(s => ({ ...s, muted: !s.muted }))} aria-pressed={settings.muted} aria-label={settings.muted ? 'Bật âm thanh' : 'Tắt âm thanh'} title={settings.muted ? 'Bật âm thanh' : 'Tắt âm thanh'}>{settings.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
        <button className={`icon-button ${settings.reducedMotion ? 'selected' : ''}`} onClick={() => setSettings(s => ({ ...s, reducedMotion: !s.reducedMotion }))} aria-pressed={settings.reducedMotion} aria-label="Giảm chuyển động" title="Giảm chuyển động"><Sparkles size={20} /></button>
        <button className="icon-button" onClick={() => showPanel('audio')} aria-label="Nhạc và âm thanh" aria-haspopup="dialog" title="Nhạc và âm thanh"><Music2 size={20} /></button>
        <button className="text-button collection-link" onClick={() => showPanel('collection')}><BookOpen size={17} /> Từ đã gặp</button>
      </div>
    </header>

    <section className="game-wrap" aria-label="Khu vực trò chơi">
      <div className="game-meta"><span><span className="status-dot" /> {playing ? getDistrictAt(snapshot.playerX).name.toLocaleUpperCase('vi-VN') : 'THÀNH PHỐ BỎ HOANG'}</span>{playing ? <div className="learning-progress" title={`Bậc ${snapshot.learning.level}: ${LEARNING_LEVEL_LABELS[snapshot.learning.level]}`}>
        <strong aria-live="polite" aria-atomic="true">BẬC {snapshot.learning.level}/{MAX_LEARNING_LEVEL}</strong>
        <div className="learning-track" role="progressbar" aria-label="Tiến độ lên bậc từ vựng" aria-valuemin={0} aria-valuemax={snapshot.learning.step} aria-valuenow={snapshot.learning.progress}><span style={{ width: `${snapshot.learning.progress / snapshot.learning.step * 100}%` }} /></div>
        <span>{snapshot.learning.nextLevelAt === null ? 'TỐI ĐA' : `${snapshot.learning.progress}/${snapshot.learning.step} từ`}</span>
      </div> : null}</div>
      <div className="game-stage" ref={stage} onKeyDown={onKey} onKeyUp={onKeyUp} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { movementKeys.current.clear(); engine.setMovement(0); engine.pause(); setSnapshot(engine.snapshot()); } }}>
        <div className="phaser-host" ref={host} aria-hidden="true" />
        {fullscreen && <button className="icon-button fullscreen-exit" onClick={() => void toggleFullscreen()} aria-label="Thoát toàn màn hình" title="Thoát toàn màn hình"><Minimize2 size={20} /></button>}
        {!ready && <div className="loading-state" role="status"><Skull size={42} /><strong>{loadError || 'Đang chuẩn bị thành phố…'}</strong>{loadError && <button className="button primary" onClick={() => location.reload()}>Tải lại trang</button>}</div>}
        {snapshot.phase === 'menu' && ready && <div className="menu-screen">
          <div className="menu-copy">
            {snapshot.vocabulary.remaining > 0 ? <button className="button primary start-button" onClick={() => start('survival')}><Crosshair size={21} /> Bắt đầu sinh tồn <span>↵</span></button> : <button className="button primary start-button" onClick={() => showPanel('collection')}><BookOpen size={21} /> Xem từ đã gặp</button>}
            <div className="menu-secondary"><button className="text-button" disabled={!snapshot.vocabulary.bossReady} title={snapshot.vocabulary.bossReady ? 'Đấu Tank với các từ dài chưa gặp' : 'Cần ít nhất 9 từ dài chưa gặp để đấu Tank'} onClick={() => start('boss')}><Shield size={17} /> Tập đấu Boss</button><button className="text-button" onClick={() => showPanel('help')}><Keyboard size={18} /> Cách chơi</button></div>
          </div>
          <HeroPicker value={settings.heroId} onChange={heroId => setSettings(current => ({ ...current, heroId }))} />
        </div>}

        {playing && <>
          <div className="hud" aria-label="Trạng thái trận đấu">
            <div className={`health-block ${snapshot.hp < 30 ? 'critical' : ''}`}><div className="health-title"><Heart size={17} fill="currentColor" /><span>SỨC KHỎE</span><strong>{Math.ceil(snapshot.hp)}<small>/100</small></strong></div><div className="health-track"><span style={{ width: `${snapshot.hp}%` }} /></div></div>
            <div className="time-block"><span>SỐNG SÓT</span><strong>{formatTime(snapshot.elapsed)}</strong></div>
            <div className="score-block"><span>ĐIỂM SỐ</span><strong>{snapshot.score.toLocaleString('vi-VN')}</strong></div>
            <div className={`combo-block ${snapshot.combo >= 3 ? 'hot' : ''}`}><Zap size={18} /><strong>{snapshot.combo}</strong><span>COMBO</span></div>
            <button className="icon-button pause-button" onClick={() => { engine.pause(); setSnapshot(engine.snapshot()); }} aria-label="Tạm dừng"><Pause size={20} /></button>
          </div>
          <div className={`hero-skill-hud ${snapshot.hero.activeRemaining > 0 ? 'active' : ''}`} aria-label={`Kỹ năng ${snapshot.hero.skillName}: ${snapshot.hero.charge}/${snapshot.hero.threshold} chữ đúng`}>
            <div><Sparkles size={14} /><strong>{snapshot.hero.skillName}</strong><span>{snapshot.hero.charge}/{snapshot.hero.threshold}</span></div>
            <div className="hero-charge-track" role="progressbar" aria-label="Tích kỹ năng" aria-valuemin={0} aria-valuemax={snapshot.hero.threshold} aria-valuenow={snapshot.hero.charge}><span style={{width: `${snapshot.hero.charge / snapshot.hero.threshold * 100}%`}} /></div>
            <p>{snapshot.hero.activeRemaining > 0 ? `Đang hiệu lực · ${(snapshot.hero.activeRemaining / 1000).toFixed(1)}s` : 'Tự kích hoạt khi đủ chữ đúng'}</p>
          </div>
          {snapshot.boss && <div className="boss-hud"><div><Skull size={16} /><strong>{snapshot.boss.label || 'BOSS BẢO HỘ'}</strong><span>PHASE {snapshot.boss.phase}</span><span>{snapshot.boss.hp}/{snapshot.boss.maxHp}</span></div><div className="boss-hp-track"><span style={{ width: `${snapshot.boss.hp / snapshot.boss.maxHp * 100}%` }} /></div><div className="rage-line"><span>CUỒNG NỘ</span><div><i style={{ width: `${snapshot.boss.rage}%` }} /></div></div></div>}
          <div className="combat-notice" role="status" aria-live="polite">{snapshot.notice}</div>
          <p className="movement-help"><kbd>←</kbd><kbd>→</kbd><span>Di chuyển</span></p>
          <div className="typing-dock">
            <div className="target-heading"><span><Crosshair size={15} /> {snapshot.target ? snapshot.target.label || kindNames[snapshot.target.kind] : 'Đang tìm mục tiêu'}</span><span>{snapshot.target ? <>{PART_OF_SPEECH_LABELS[snapshot.target.partOfSpeech]} · Bậc {snapshot.target.learningLevel}</> : ''}{snapshot.locked && <b> · ĐÃ KHÓA</b>}</span></div>
            <div className="target-prompt"><strong>{snapshot.target?.prompt || 'Chuẩn bị cho đợt tiếp theo…'}</strong>{snapshot.target?.hint && <span>{snapshot.target.hint}</span>}</div>
            {snapshot.target && snapshot.target.prompt !== snapshot.target.meaning && <p className="target-meaning">{snapshot.target.meaning}</p>}
            <div className={`input-frame ${snapshot.jamRemaining > 0 ? 'jammed' : ''}`}>
              <Keyboard size={23} /><label className="sr-only" htmlFor="word-input">Nhập toàn bộ từ tiếng Anh</label>
              <input id="word-input" ref={input} className="typing-input" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} readOnly value={snapshot.input} placeholder="Nhập toàn bộ từ tiếng Anh…" aria-describedby="typing-help" disabled={snapshot.phase !== 'playing'} />
              <span className="input-state">{snapshot.jamRemaining > 0 ? 'KẸT ĐẠN' : snapshot.target ? `${snapshot.input.length}/${snapshot.target.length}` : '…'}</span>
              {snapshot.jamRemaining > 0 && <span className="jam-progress" style={{ width: `${snapshot.jamRemaining / 300 * 100}%` }} />}
            </div>
            <div className="typing-bottom"><p id="typing-help"><kbd>Tab</kbd> đổi mục tiêu <span>·</span> <kbd>⌫</kbd> xóa chữ <span>·</span> <kbd>Esc</kbd> tạm dừng</p><span>{snapshot.words} từ <span>·</span> {snapshot.kills} zombie</span></div>
          </div>
          <div className="inventory" aria-label="Vật phẩm">
            {items.map(item => <button key={item.key} className={`item-button ${snapshot.inventory[item.key] === 0 ? 'empty' : ''}`} title={`${item.name}: ${item.help} · Phím ${item.number}`} aria-label={`${item.name}, còn ${snapshot.inventory[item.key]}`} disabled={snapshot.phase !== 'playing' || snapshot.inventory[item.key] === 0} onClick={() => consume(item.key)}><kbd>{item.number}</kbd><img src={`/art/items/${item.key}.png`} alt="" /><span>{snapshot.inventory[item.key]}</span></button>)}
            {(snapshot.freezeRemaining > 0 || snapshot.boostRemaining > 0) && <div className="active-effect">{snapshot.freezeRemaining > 0 ? `Đóng băng ${(snapshot.freezeRemaining / 1000).toFixed(1)}s` : `Tăng lực ${(snapshot.boostRemaining / 1000).toFixed(1)}s`}</div>}
          </div>
        </>}
        {snapshot.phase === 'countdown' && <div className="countdown"><span>Sẵn sàng tiếp tục</span><strong>{Math.max(1, Math.ceil(snapshot.countdown / 1000))}</strong></div>}
        <div className="mobile-note"><Keyboard size={28} /><strong>Cần một bàn phím để sống sót.</strong><p>Bản thử này dành cho máy tính. Hãy mở trên màn hình rộng và dùng bàn phím để chơi.</p></div>
      </div>
      <div className="game-footer"><div><button className="text-button" onClick={() => showPanel('help')}>Hướng dẫn</button><button className="icon-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>{fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button></div></div>
    </section>

    <footer className="page-footer"><span>Prototype · Tiến trình chỉ lưu trên trình duyệt này.</span></footer>
    {saveError && <p className="storage-notice" role="status">{saveError}</p>}

    {snapshot.phase === 'paused' && !panel && <Modal title="Nghỉ lấy hơi." onClose={resume} className="pause-modal"><p>Thành phố đang tạm dừng. Từ đang nhập và vật phẩm vẫn được giữ.</p><button className="button primary" onClick={resume}><Play size={19} /> Tiếp tục chiến đấu</button><button className="button secondary" onClick={() => showPanel('audio')}><Music2 size={18} /> Nhạc và âm thanh</button><button className="button secondary" onClick={home}>Về màn bắt đầu</button></Modal>}
    {panel === 'audio' && <Modal title="Nhạc và âm thanh" onClose={() => setPanel(null)} className="audio-modal">
      <div className="audio-current" role="status" aria-live="polite" aria-atomic="true">
        <div className="audio-track-status"><span>{audioStatusLabels[audioState.status]}</span>{audioState.total > 0 && <span>Bài {audioState.index + 1}/{audioState.total}</span>}</div>
        <strong>{audioState.title || (audioState.status === 'unavailable' ? 'Nhạc nền chưa sẵn sàng' : 'Đang chuẩn bị danh sách nhạc…')}</strong>
      </div>
      <button className="button secondary audio-next" disabled={!ready || audioState.total === 0 || audioState.status === 'unavailable'} onClick={() => runtime.current?.nextTrack()}><SkipForward size={18} /> Bài tiếp theo</button>
      <p className="audio-playlist-note">Nhạc phát lần lượt và lặp lại từ bài đầu khi hết danh sách.{snapshot.phase === 'paused' && ' Bài đã chọn sẽ phát khi bạn tiếp tục trận.'}</p>
      <div className="audio-volumes">
        <div className="audio-volume">
          <label htmlFor="music-volume">Nhạc nền <output htmlFor="music-volume">{Math.round(settings.musicVolume * 100)}%</output></label>
          <input id="music-volume" type="range" min="0" max="100" step="1" value={Math.round(settings.musicVolume * 100)} aria-valuetext={`${Math.round(settings.musicVolume * 100)} phần trăm`} onChange={event => setSettings(current => ({ ...current, musicVolume: Number(event.target.value) / 100 }))} />
        </div>
        <div className="audio-volume">
          <label htmlFor="sfx-volume">Hiệu ứng <output htmlFor="sfx-volume">{Math.round(settings.sfxVolume * 100)}%</output></label>
          <input id="sfx-volume" type="range" min="0" max="100" step="1" value={Math.round(settings.sfxVolume * 100)} aria-valuetext={`${Math.round(settings.sfxVolume * 100)} phần trăm`} onChange={event => setSettings(current => ({ ...current, sfxVolume: Number(event.target.value) / 100 }))} />
        </div>
      </div>
      <button className="button secondary audio-mute" onClick={() => setSettings(current => ({ ...current, muted: !current.muted }))} aria-pressed={settings.muted}>{settings.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}{settings.muted ? 'Bật âm thanh' : 'Tắt toàn bộ âm thanh'}</button>
      {settings.muted && <p className="audio-muted-note">Âm thanh đang tắt. Hai mức âm lượng vẫn được giữ lại.</p>}
    </Modal>}
    {panel === 'help' && <Modal title="Sống sót bằng từ vựng" onClose={() => setPanel(null)}><div className="help-content"><p>Đọc nghĩa tiếng Việt, từ loại và các chữ gợi ý trên zombie, rồi nhập <strong>toàn bộ từ tiếng Anh</strong>. Mỗi ký tự đúng hóa thành tên, nhát đánh hoặc phép chữ theo anh hùng đã chọn. Kỹ năng riêng tự kích khi tích đủ chữ đúng mới; gõ lại chữ đã tính không cộng thêm năng lượng.</p><dl><div><dt>Độ khó từ vựng</dt><dd>Mỗi trận bắt đầu bậc 1. Cứ hoàn thành 20 từ tăng một bậc, tối đa bậc 10. Tiến độ tính theo từ gõ hoàn chỉnh, không theo số ký tự hay số quái bị hạ. Nếu hết từ mới ở bậc hiện tại, game chọn bậc gần nhất còn từ; không lặp lại từ cũ. Tập Boss cần từ dài và có thể vượt bậc hiện tại.</dd></div><div><dt>Từ mới</dt><dd>Kho gồm {snapshot.vocabulary.total} từ. Mỗi từ chỉ xuất hiện một lần, kể cả qua các trận khác nhau. Lịch sử được lưu ngay khi từ xuất hiện; tải lại giữa trận cũng không đưa từ đó trở lại. Khi hết kho, game dừng và bạn có thể xem sổ Từ đã gặp.</dd></div><div><dt><kbd>←</kbd> / <kbd>→</kbd></dt><dd>Giữ phím để di chuyển qua 5 khu cảnh trên tuyến đường dài. Zombie tiếp tục đến từ cả hai phía; không thể đi xuyên qua chúng.</dd></div><div><dt><kbd>Tab</kbd> / <kbd>Shift + Tab</kbd></dt><dd>Chọn zombie trước khi gõ. Chữ đúng đầu tiên khóa mục tiêu.</dd></div><div><dt><kbd>Backspace</kbd></dt><dd>Xóa chữ. Xóa hết để mở khóa; gõ lại không tạo thêm sát thương.</dd></div><div><dt>Gõ sai</dt><dd>Đòn đánh bị kẹt 0,3 giây. Zombie vẫn tiến; phím trong lúc kẹt bị bỏ qua.</dd></div><div><dt><kbd>1</kbd> đến <kbd>4</kbd></dt><dd>Dùng vật phẩm: hồi máu, đóng băng, tăng lực, gợi ý. Mỗi trận thử được cấp một món mỗi loại. Khi hạ mục tiêu, từ dễ / vừa / khó có xác suất rơi thêm đồ 15% / 30% / 45%; mỗi loại giữ tối đa 5 món.</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Tạm dừng. Chuyển tab hoặc mất focus cũng tự dừng trận.</dd></div></dl><p className="help-note">Mỗi chữ trúng làm zombie khựng lại 0,3 giây, không có thời gian miễn khựng. Boss không khựng. Runner nhanh hơn; Tank dùng từ dài từ 7 ký tự và khiên che zombie phía sau cùng hướng. Hãy hạ Tank để mở mục tiêu bị che. Khi HP dưới 30, cảnh chơi chao nhẹ và tối viền; có thể bật Giảm chuyển động để tắt rung và chao. Hãy dùng bộ gõ tiếng Anh; điện thoại và bàn phím ảo chưa được hỗ trợ đầy đủ.</p></div><button className="button primary" onClick={() => setPanel(null)}>Đã hiểu</button></Modal>}
    {panel === 'collection' && <Modal title="Từ đã gặp" onClose={() => setPanel(null)}>
      <p className="modal-intro">{(snapshot.vocabulary.total - snapshot.vocabulary.remaining).toLocaleString('vi-VN')}/{snapshot.vocabulary.total.toLocaleString('vi-VN')} từ đã gặp · {progress.runs} trận đã lưu. Từ được ghi nhớ ngay khi xuất hiện, kể cả khi bạn chưa trả lời; thống kê hoàn thành được lưu khi kết thúc trận.</p>
      <div className="collection-search"><label htmlFor="collection-search">Tìm từ hoặc nghĩa</label><input id="collection-search" type="search" value={collectionQuery} onChange={event => { setCollectionQuery(event.target.value); setCollectionPage(0); }} placeholder="Nhập từ tiếng Anh hoặc nghĩa tiếng Việt…" /></div>
      <div className="collection-filters">
        <label>Từ loại<select value={collectionPos} onChange={event => { setCollectionPos(event.target.value); setCollectionPage(0); }}><option value="">Tất cả từ loại</option>{Object.entries(PART_OF_SPEECH_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Độ khó<select value={collectionLevel} onChange={event => { setCollectionLevel(event.target.value); setCollectionPage(0); }}><option value="">Tất cả bậc · dễ đến khó</option>{Object.entries(LEARNING_LEVEL_LABELS).map(([value, label]) => <option key={value} value={value}>Bậc {value} · {label}</option>)}</select></label>
      </div>
      {collectionWords.length ? <><div className="review-list">{collectionWords.slice(page * 50, (page + 1) * 50).map(word => {
        const result = wordHistoryFor(word, progress.words);
        return <div key={word.id}><strong>{word.answer}</strong><span>{word.meaning}</span><small>{PART_OF_SPEECH_LABELS[word.partOfSpeech]} · Bậc {getWordLearningLevel(word)} · {result ? `${result.mistakes} lỗi · ${result.completed} lần hoàn thành` : 'Đã gặp · Chưa có kết quả trận được lưu'}{word.sourceUrl && <> · <a href={word.sourceUrl} target="_blank" rel="noreferrer">Tra từ gốc</a></>}</small></div>;
      })}</div><div className="collection-pagination"><button className="text-button" disabled={page === 0} onClick={() => setCollectionPage(page - 1)}>← Trước</button><span>Trang {page + 1}/{collectionPages} · {collectionWords.length.toLocaleString('vi-VN')} từ</span><button className="text-button" disabled={page + 1 === collectionPages} onClick={() => setCollectionPage(page + 1)}>Sau →</button></div></> : <div className="empty-state"><BookOpen size={36} /><strong>{collectionFiltered ? 'Chưa tìm thấy từ phù hợp.' : 'Trang sổ còn trống.'}</strong><p>{collectionFiltered ? 'Thử từ khác hoặc đổi bộ lọc từ loại, độ khó.' : 'Từ sẽ được thêm vào đây ngay khi xuất hiện trong trận.'}</p></div>}
    </Modal>}
    {snapshot.phase === 'over' && summary && !panel && <Modal title={vocabularyComplete ? 'Đã hoàn thành kho từ!' : 'Một trận nữa nhé?'} onClose={home} className="summary-modal">
      <p className="modal-intro">{vocabularyComplete ? `Bạn đã gặp đủ ${snapshot.vocabulary.total.toLocaleString('vi-VN')} từ trong từ điển của game và dọn sạch đợt cuối. Bạn đã chiến thắng!` : `Bạn đã cầm cự ${formatTime(summary.durationMs)}. Còn ${snapshot.vocabulary.remaining.toLocaleString('vi-VN')} từ mới cho hành trình tiếp theo.`}</p>
      <div className="result-score"><Trophy size={24} /><strong>{summary.score.toLocaleString('vi-VN')}</strong><span>điểm</span></div>
      <div className="result-stats"><div><strong>{summary.kills}</strong><span>zombie</span></div><div><strong>{summary.words}</strong><span>từ hoàn thành</span></div><div><strong>{Math.round(summary.accuracy)}%</strong><span>chính xác</span></div><div><strong>{Math.round(summary.wpm)}</strong><span>WPM</span></div><div><strong>{summary.bestCombo}</strong><span>combo cao nhất</span></div></div>
      <h3>Những từ cần xem lại</h3>
      {summary.results.some(word => word.mistakes || word.completed < word.encounters) ? <div className="review-list compact">{summary.results.filter(word => word.mistakes || word.completed < word.encounters).slice(0, 10).map(word => <div key={word.word}><strong>{word.word}</strong><span>{word.meaning}</span><small>{word.mistakes ? `${word.mistakes} lỗi` : 'Chưa hoàn thành'}</small></div>)}</div> : <p className="muted">Không có từ sai trong trận này. Bạn có thể xem lại nghĩa trong sổ Từ đã gặp.</p>}
      <div className="summary-actions">{snapshot.vocabulary.remaining > 0 ? <button className="button primary" onClick={() => start('survival')}><RotateCcw size={18} /> Chơi trận mới</button> : <button className="button primary" onClick={() => showPanel('collection')}><BookOpen size={18} /> Xem từ đã gặp</button>}<button className="button secondary" onClick={home}>Về màn bắt đầu</button></div>
      <p className="save-caption">{saveError || 'Kết quả được lưu trên trình duyệt này. WPM = ký tự đúng có hiệu lực ÷ 5 ÷ phút chơi.'}</p>
    </Modal>}
  </main>;
}
