import { useLanguage, LanguagePicker } from './LanguageContext';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BookOpen, Crosshair, Heart, Keyboard, Maximize2, Minimize2, Music2, Pause, Play, RotateCcw, Shield, SkipForward, Skull, Sparkles, Star, Trophy, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { RoomClient } from '../game/RoomClient';
import type { CustomDeck } from '../game/customDeck';
import { getHeroCharacter } from '../game/characterCatalog';
import { getHeroCombat } from '../game/heroCombat';
import { CombatStatus, HealthMeter } from './CombatFeedback';
import { TargetClue } from './TargetClue';
import { HeroPicker } from './HeroPicker';
import { GameHelp } from './GameHelp';
import { MultiplayerLobby } from './MultiplayerLobby';
import { getWordLearningLevel, LEARNING_LEVEL_LABELS, MAX_LEARNING_LEVEL } from '../game/learningProgression';
import { historyKeysFor, PART_OF_SPEECH_LABELS, WORDS } from '../game/vocabulary';
import { getDistrictAt } from '../game/worldLayout';
import { getStorageWarning, markWordSeen, saveRun } from '../game/storage';
import { wordHistoryFor } from '../game/wordHistory';
import { readWordFavorites, saveWordFavorites } from '../game/learningReview';
import { LearningPanel } from './LearningPanel';
import { useWordSpeech } from './useWordSpeech';
import { getWordMeaning } from '../game/localization';
import type { AudioState } from '../game/GameAudio';
import type { RenderOptions } from '../game/SurvivalScene';
import type { ItemKind, Progress, Snapshot, Word } from '../game/types';

const formatTime = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`;
const kindNames = { normal: 'Quái thường', runner: 'Quái nhanh', armored: 'Quái giáp', tank: 'Boss bảo hộ', barrel: 'Thùng nổ' };
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
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label={t("Đóng")}><X size={20} /></button></div>
    {children}
  </dialog>;
}

export function App({ initialProgress, wordBank = WORDS, customDeck, onCreateMode, onDeckExpired }: { initialProgress: Progress; wordBank?: readonly Word[]; customDeck?: CustomDeck; onCreateMode?: () => void; onDeckExpired?: () => void }) {
  const { t, language, locale, setLanguage } = useLanguage();
  const [seenWords, setSeenWords] = useState(() => new Set([...Object.keys(initialProgress.seenWords ?? {}), ...Object.keys(initialProgress.words)]));
  const [engine] = useState(() => new RoomClient(initialProgress, word => {
    if (!customDeck) markWordSeen(word);
    setSeenWords(previous => new Set(previous).add(word.answer));
  }, wordBank, customDeck?.language ?? language, customDeck));
  const [snapshot, setSnapshot] = useState<Snapshot>(() => engine.snapshot());
  const [room, setRoom] = useState(() => engine.room);
  const [teamRun, setTeamRun] = useState(false);
  const [progress, setProgress] = useState(initialProgress);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState(() => customDeck ? '' : getStorageWarning());
  const [settings, setSettings] = useState(() => { const s = readSettings(); return { muted: s.muted ?? false, reducedMotion: s.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches, heroId: getHeroCharacter(s.heroId).id, musicVolume: s.musicVolume ?? 0.25, sfxVolume: s.sfxVolume ?? 0.6 }; });
  const [audioState, setAudioState] = useState<AudioState>({ title: '', index: 0, total: 0, playing: false, status: 'waiting' });
  const [panel, setPanel] = useState<'help' | 'collection' | 'audio' | null>(null);
  const [collectionQuery, setCollectionQuery] = useState('');
  const [collectionPos, setCollectionPos] = useState('');
  const [collectionLevel, setCollectionLevel] = useState('');
  const [collectionPage, setCollectionPage] = useState(0);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favoriteState] = useState(() => customDeck ? { words: new Set<string>(), available: true } : readWordFavorites());
  const [favorites, setFavorites] = useState(favoriteState.words);
  const [favoriteWarning, setFavoriteWarning] = useState(favoriteState.available ? '' : 'Chưa đọc được danh sách yêu thích đã lưu.');
  const pronunciation = useWordSpeech(`${snapshot.phase}:${panel ?? 'none'}`);
  const [fullscreen, setFullscreen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const movementKeys = useRef(new Set<string>());
  const previousPhase = useRef(snapshot.phase);
  const runtime = useRef<{ game: { destroy: (removeCanvas: boolean) => void }; setOptions: (opts: RenderOptions) => void; nextTrack: () => void } | null>(null);
  const saved = useRef(new Set<string>());
  const optionsRef = useRef({ ...settings, language });
  optionsRef.current = { ...settings, language };

  useEffect(() => { engine.setLanguage(language); setSnapshot(engine.snapshot()); }, [engine, language]);
  useEffect(() => { if (room.status === 'expired') onDeckExpired?.(); }, [room.status, onDeckExpired]);
  useEffect(() => {
    if (!room.languagePending && (room.status === 'lobby' || room.status === 'playing')) setLanguage(room.language);
  }, [room.language, room.languagePending, room.status, room.error, setLanguage]);

  useEffect(() => {
    const unsubscribe = engine.subscribeRoom(setRoom);
    engine.connect();
    return () => { unsubscribe(); engine.dispose(); };
  }, [engine]);
  const acknowledgedHero = room.players.find(player => player.id === room.selfId)?.heroId;
  useEffect(() => {
    if (acknowledgedHero) setSettings(current => current.heroId === acknowledgedHero ? current : { ...current, heroId: acknowledgedHero });
  }, [acknowledgedHero]);

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
    runtime.current?.setOptions({ ...settings, language });
    try { localStorage.setItem('zvs-settings-v1', JSON.stringify(settings)); } catch { /* Settings are optional. */ }
  }, [settings, engine, language]);

  useEffect(() => { if (!customDeck) setSaveError(getStorageWarning()); }, [seenWords, customDeck]);

  useEffect(() => {
    const summary = snapshot.summary;
    if (!summary || saved.current.has(summary.id)) return;
    saved.current.add(summary.id);
    if (customDeck) return;
    void saveRun(summary).then(next => { setProgress(next); engine.setProgress(next); setSaveError(getStorageWarning()); }).catch(() => setSaveError('Trình duyệt chưa lưu được tiến trình. Bạn vẫn có thể chơi tiếp trong phiên này.'));
  }, [snapshot.summary, engine, customDeck]);

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
  useEffect(() => {
    const beganMatch = snapshot.phase === 'playing' && (previousPhase.current === 'menu' || previousPhase.current === 'over');
    previousPhase.current = snapshot.phase;
    if (beganMatch) { setPanel(null); setTeamRun((snapshot.party?.players.length ?? 0) > 1); }
  }, [snapshot.phase, snapshot.party?.players.length]);
  useEffect(() => {
    if (snapshot.phase === 'menu') setTeamRun(false);
    else if ((snapshot.party?.players.length ?? 0) > 1) setTeamRun(true);
  }, [snapshot.phase, snapshot.party?.players.length]);
  useEffect(() => {
    if (room.status === 'disconnected' && snapshot.phase === 'paused') setPanel(null);
  }, [room.status, snapshot.phase]);
  useEffect(() => { if (snapshot.phase === 'playing' && !panel) focusInput(); }, [snapshot.phase, panel, focusInput]);
  useEffect(() => {
    if (snapshot.phase !== 'playing' || panel) { movementKeys.current.clear(); engine.setMovement(0); }
  }, [snapshot.phase, panel, engine]);
  const start = (mode: 'survival' | 'boss') => { engine.setHero(settings.heroId); runtime.current?.setOptions({ ...settings, language }); setPanel(null); engine.start(mode); setSnapshot(engine.snapshot()); focusInput(); };
  const resume = () => { engine.resume(); setSnapshot(engine.snapshot()); focusInput(); };
  const home = () => { setPanel(null); engine.toMenu(); setSnapshot(engine.snapshot()); };
  const showPanel = (value: 'help' | 'collection' | 'audio') => { engine.pause(); setSnapshot(engine.snapshot()); setPanel(value); };
  const consume = (key: ItemKind) => { engine.useItem(key); setSnapshot(engine.snapshot()); focusInput(); };
  const interact = () => { engine.interactWorld?.(); setSnapshot(engine.snapshot()); focusInput(); };
  const toggleFavorite = useCallback((word: string) => {
    const next = new Set(favorites);
    if (next.has(word)) next.delete(word); else next.add(word);
    setFavorites(next);
    if (!customDeck) setFavoriteWarning(saveWordFavorites(next) ? '' : 'Yêu thích chỉ được giữ trong phiên này vì trình duyệt chưa lưu được.');
  }, [favorites, customDeck]);
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (engine.snapshot().phase !== 'playing' || panel) return;
    if (engine.snapshot().hp <= 0 && event.key !== 'Escape') { event.preventDefault(); return; }
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
    if (event.key === 'Enter') { event.preventDefault(); interact(); return; }
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
  const spectating = snapshot.hp <= 0 && teamRun && snapshot.phase === 'playing';
  const maxHp = snapshot.maxHp ?? getHeroCombat(snapshot.hero.id).maxHp;
  const encounteredWords = useMemo(() => panel === 'collection'
    ? wordBank.filter(word => historyKeysFor(word).some(answer => seenWords.has(answer))) : [], [wordBank, seenWords, panel]);
  const collectionWords = useMemo(() => {
    if (panel !== 'collection') return [];
    const query = collectionQuery.trim().toLowerCase();
    return encounteredWords.filter(word => (!query || word.answer.includes(query) || getWordMeaning(word, language).toLowerCase().includes(query))
      && (!collectionPos || word.partOfSpeech === collectionPos)
      && (!onlyFavorites || favorites.has(word.answer))
      && (!collectionLevel || getWordLearningLevel(word) === Number(collectionLevel)))
      .sort((a, b) => getWordLearningLevel(a) - getWordLearningLevel(b) || a.answer.localeCompare(b.answer));
  }, [encounteredWords, panel, collectionQuery, collectionPos, collectionLevel, onlyFavorites, favorites, language]);
  const collectionPages = Math.max(1, Math.ceil(collectionWords.length / 20));
  const page = Math.min(collectionPage, collectionPages - 1);
  const visibleCollection = useMemo(() => collectionWords.slice(page * 20, (page + 1) * 20), [collectionWords, page]);
  const collectionResults = useMemo(() => visibleCollection.flatMap(word => { const result = wordHistoryFor(word, progress.words); return result ? [result] : []; }), [visibleCollection, progress.words]);
  const vocabularyComplete = summary?.reason === 'vocabulary-complete';
  const canStart = room.status === 'offline' || (room.status === 'lobby' && room.selfId === room.hostId);
  const online = room.status === 'playing' || room.status === 'lobby';
  const canReplay = room.status === 'offline' || (online && room.selfId === room.hostId);
  const takenHeroes = room.players.filter(player => player.id !== room.selfId).map(player => player.heroId);
  const collectionFiltered = Boolean(collectionQuery || collectionPos || collectionLevel || onlyFavorites);
  const learningActions = { favorites, speakingWord: pronunciation.status.state === 'speaking' ? pronunciation.status.word : '', speechAvailable: pronunciation.available, onFavorite: toggleFavorite, onSpeak: pronunciation.speak, onStop: pronunciation.stop };
  const learningStatus = <><p className="learning-status" role="status" aria-live="polite">{pronunciation.available ? t(pronunciation.status.message) : t("Trình duyệt này chưa hỗ trợ đọc từ. Bạn vẫn có thể xem nghĩa và lưu yêu thích.")}</p>{favoriteWarning && <p className="learning-storage-warning" role="status">{t(favoriteWarning)}</p>}</>;

  return <main className={`app ${settings.reducedMotion ? 'reduce-motion' : ''}`}>
    <header className="site-header">
      <a className="wordmark" href="#" onClick={event => { event.preventDefault(); if (playing) { engine.pause(); setSnapshot(engine.snapshot()); } else home(); }} aria-label="Zombie Vocabulary Survival">
        <span className="brand-mark"><Skull strokeWidth={1.8} /></span><span><strong>ZOMBIE</strong><span>VOCABULARY SURVIVAL</span></span>
      </a>
      <p className="header-tagline">Learn English.<br /><strong>Live another day.</strong></p>
      <div className="header-actions">
        <LanguagePicker disabled={Boolean(customDeck) || Boolean(room.languagePending) || snapshot.phase !== 'menu' || room.status === 'connecting' || room.status === 'disconnected' || (room.status === 'lobby' && room.selfId !== room.hostId)} title={t(customDeck ? 'Ngôn ngữ do người tạo bộ câu hỏi chọn.' : room.status === 'lobby' && room.selfId !== room.hostId ? 'Chủ phòng chọn ngôn ngữ trước trận.' : 'Đổi ngôn ngữ trước khi bắt đầu trận.')} />
        <span className="record"><Trophy size={18} /><span>{t("Kỷ lục")}<strong>{progress.highScore.toLocaleString(locale)}</strong></span></span>
        <button className="icon-button" onClick={() => setSettings(s => ({ ...s, muted: !s.muted }))} aria-pressed={settings.muted} aria-label={settings.muted ? t("Bật âm thanh") : t("Tắt âm thanh")} title={settings.muted ? t("Bật âm thanh") : t("Tắt âm thanh")}>{settings.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
        <button className={`icon-button ${settings.reducedMotion ? 'selected' : ''}`} onClick={() => setSettings(s => ({ ...s, reducedMotion: !s.reducedMotion }))} aria-pressed={settings.reducedMotion} aria-label={t("Giảm chuyển động")} title={t("Giảm chuyển động")}><Sparkles size={20} /></button>
        <button className="icon-button" onClick={() => showPanel('audio')} aria-label={t("Nhạc và âm thanh")} aria-haspopup="dialog" title={t("Nhạc và âm thanh")}><Music2 size={20} /></button>
        <button className="text-button collection-link" onClick={() => showPanel('collection')}><BookOpen size={17} />{t(" Từ đã gặp")}</button>
      </div>
    </header>

    {(customDeck || (!playing && onCreateMode)) && <div className="custom-deck-bar">
      {customDeck ? <div><strong>{customDeck.title}</strong><span>{t('Hết hạn {0}', [new Date(customDeck.expiresAt).toLocaleString(locale)])}</span></div> : <span>{t('Chơi với bộ từ của bạn')}</span>}
      <div>{customDeck && <a href={location.pathname}>{t('Về game chính')}</a>}{!playing && onCreateMode && <button className="text-button" onClick={onCreateMode}>{t('Tạo bộ câu hỏi')}</button>}</div>
    </div>}

    <section className="game-wrap" aria-label={t("Khu vực trò chơi")}>
      <div className="game-meta"><span><span className="status-dot" /> {playing ? t(getDistrictAt(snapshot.playerX).name).toLocaleUpperCase(locale) : t("THÀNH PHỐ BỎ HOANG")}</span>{playing ? <div className="learning-progress" title={t("Bậc {0}: {1}", [snapshot.learning.level, t(LEARNING_LEVEL_LABELS[snapshot.learning.level])])}>
        <strong aria-live="polite" aria-atomic="true">{t("BẬC ")}{snapshot.learning.level}/{MAX_LEARNING_LEVEL}</strong>
        <div className="learning-track" role="progressbar" aria-label={t("Tiến độ lên bậc từ vựng")} aria-valuemin={0} aria-valuemax={snapshot.learning.step} aria-valuenow={snapshot.learning.progress}><span style={{ width: `${snapshot.learning.progress / snapshot.learning.step * 100}%` }} /></div>
        <span>{snapshot.learning.nextLevelAt === null ? t("TỐI ĐA") : t("{0}/{1} từ", [snapshot.learning.progress, snapshot.learning.step])}</span>
      </div> : null}</div>
      <div className="game-stage" ref={stage} onKeyDown={onKey} onKeyUp={onKeyUp} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { movementKeys.current.clear(); engine.setMovement(0); engine.pause(); setSnapshot(engine.snapshot()); } }}>
        <div className="phaser-host" ref={host} aria-hidden="true" />
        {fullscreen && <button className="icon-button fullscreen-exit" onClick={() => void toggleFullscreen()} aria-label={t("Thoát toàn màn hình")} title={t("Thoát toàn màn hình")}><Minimize2 size={20} /></button>}
        {!ready && <div className="loading-state" role="status"><Skull size={42} /><strong>{(loadError && t(loadError)) || t("Đang chuẩn bị thành phố…")}</strong>{loadError && <button className="button primary" onClick={() => location.reload()}>{t("Tải lại trang")}</button>}</div>}
        {snapshot.phase === 'menu' && ready && <div className="menu-screen">
          <div className="menu-copy has-lobby">
            <MultiplayerLobby room={room} onJoin={pin => engine.joinRoom(pin)} onCreate={() => engine.createRoom()} onOffline={() => engine.playOffline()} />
            {customDeck || snapshot.vocabulary.remaining > 0 ? <button className="button primary start-button" disabled={!canStart} onClick={() => start('survival')}><Crosshair size={21} /> {room.status === 'lobby' && room.selfId !== room.hostId ? t("Chờ chủ phòng bắt đầu") : t("Bắt đầu sinh tồn")}</button> : <button className="button primary start-button" onClick={() => showPanel('collection')}><BookOpen size={21} />{t(" Xem từ đã gặp")}</button>}
            <div className="menu-secondary"><button className="text-button" disabled={!canStart || !snapshot.vocabulary.bossReady} title={snapshot.vocabulary.bossReady ? t("Đấu Tank với các từ dài chưa gặp") : t("Cần ít nhất 9 từ dài chưa gặp để đấu Tank")} onClick={() => start('boss')}><Shield size={17} />{t(" Tập đấu Boss")}</button><button className="text-button" onClick={() => showPanel('help')}><Keyboard size={18} />{t(" Cách chơi")}</button></div>
          </div>
          <HeroPicker value={acknowledgedHero ?? settings.heroId} taken={takenHeroes} disabled={room.status === 'connecting' || room.status === 'disconnected'} onChange={heroId => { if (room.status === 'offline') setSettings(current => ({ ...current, heroId })); else engine.setHero(heroId); }} />
        </div>}

        {playing && <>
          <div className="hud" aria-label={t("Trạng thái trận đấu")}>
            <HealthMeter hp={snapshot.hp} maxHp={maxHp} />
            <div className="time-block"><span>{t("SỐNG SÓT")}</span><strong>{formatTime(snapshot.elapsed)}</strong></div>
            <div className="score-block"><span>{teamRun ? t("ĐIỂM ĐỘI") : t("ĐIỂM SỐ")}</span><strong>{snapshot.score.toLocaleString(locale)}</strong></div>
            <div className={`combo-block ${snapshot.combo >= 3 ? 'hot' : ''}`}><Zap size={18} /><strong>{snapshot.combo}</strong><span>COMBO</span></div>
            <button className="icon-button pause-button" onClick={() => { engine.pause(); setSnapshot(engine.snapshot()); }} aria-label={t("Tạm dừng")}><Pause size={20} /></button>
          </div>
          <div className={`hero-skill-hud ${snapshot.hero.activeRemaining > 0 ? 'active' : ''}`} aria-label={t("Kỹ năng {0}: {1}/{2} chữ đúng", [t(snapshot.hero.skillName), snapshot.hero.charge, snapshot.hero.threshold])}>
            <div><Sparkles size={14} /><strong>{t(snapshot.hero.skillName)}</strong><span>{snapshot.hero.charge}/{snapshot.hero.threshold}</span></div>
            <div className="hero-charge-track" role="progressbar" aria-label={t("Tích kỹ năng")} aria-valuemin={0} aria-valuemax={snapshot.hero.threshold} aria-valuenow={snapshot.hero.charge}><span style={{width: `${snapshot.hero.charge / snapshot.hero.threshold * 100}%`}} /></div>
            <p>{snapshot.hero.activeRemaining > 0 ? t("Đang hiệu lực · {0}s", [(snapshot.hero.activeRemaining / 1000).toFixed(1)]) : t("Tự kích hoạt khi đủ chữ đúng")}</p>
          </div>
          {snapshot.momentum && snapshot.momentum.level > 0 && <div className="momentum-hud" aria-label={t("Nhịp hoàn hảo bậc {0}, điểm nhân {1}", [snapshot.momentum.level, snapshot.momentum.multiplier.toFixed(1)])}>
            <div><Zap size={14} /><strong>{t("NHỊP HOÀN HẢO")}</strong><span>{t("×")}{snapshot.momentum.multiplier.toFixed(1)}</span></div>
            <div className="momentum-track" aria-hidden="true"><span style={{ width: `${Math.min(100, snapshot.momentum.remaining / 15000 * 100)}%` }} /></div>
          </div>}
          {snapshot.world?.nearby?.kind === 'gate' && !spectating && <button className="world-interaction" disabled={snapshot.phase !== 'playing' || Boolean(snapshot.input)} onClick={interact}><kbd>Enter</kbd><span>{t(snapshot.world.nearby.label)}</span><small>{snapshot.input ? t("Xóa hết chữ để tương tác") : snapshot.world.nearby.state === 'closed' ? t("Mở cổng") : t("Đóng cổng")}</small></button>}
          {snapshot.world?.nearby?.kind === 'healing-zone' && snapshot.world.healingProgress > 0 && <div className="world-healing" role="progressbar" aria-label={t("Giữ vị trí để hồi phục")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(snapshot.world.healingProgress * 100)}><Heart size={14} /><span>{t("Giữ vị trí để hồi phục")}</span><i style={{ width: `${snapshot.world.healingProgress * 100}%` }} /></div>}
          {snapshot.boss && <div className="boss-hud"><div><Skull size={16} /><strong>{(snapshot.boss.label && t(snapshot.boss.label)) || t("BOSS BẢO HỘ")}</strong><span>PHASE {snapshot.boss.phase}</span><span>{snapshot.boss.hp}/{snapshot.boss.maxHp}</span></div><div className="boss-hp-track"><span style={{ width: `${snapshot.boss.hp / snapshot.boss.maxHp * 100}%` }} /></div><div className="rage-line"><span>{t("CUỒNG NỘ")}</span><div><i style={{ width: `${snapshot.boss.rage}%` }} /></div></div></div>}
          <div className="combat-notice" role="status" aria-live="polite">{spectating ? t("Bạn đã gục. Đang theo dõi đồng đội chiến đấu.") : snapshot.notice}</div>
          {!spectating && <p className="movement-help"><kbd>←</kbd><kbd>→</kbd><span>{t("Di chuyển")}</span></p>}
          <div className="typing-dock">
            <div className="target-heading"><span><Crosshair size={15} /> {snapshot.target ? t(snapshot.target.label || kindNames[snapshot.target.kind]) : spectating ? t("Đang theo dõi đồng đội") : t("Đang tìm mục tiêu")}</span><span>{snapshot.target ? <>{t(PART_OF_SPEECH_LABELS[snapshot.target.partOfSpeech])}{t(" · Bậc ")}{snapshot.target.learningLevel}</> : ''}{snapshot.locked && <b>{t(" · ĐÃ KHÓA")}</b>}</span></div>
            <TargetClue target={snapshot.target} />
            <div className={`input-frame ${snapshot.jamRemaining > 0 ? 'jammed' : ''}`}>
              <Keyboard size={23} /><label className="sr-only" htmlFor="word-input">{t("Nhập toàn bộ từ tiếng Anh")}</label>
              <input id="word-input" ref={input} className="typing-input" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} readOnly value={snapshot.input} placeholder={spectating ? t("Đang theo dõi đồng đội…") : t("Nhập toàn bộ từ tiếng Anh…")} aria-describedby="typing-help" disabled={snapshot.phase !== 'playing' || spectating} />
              <span className="input-state">{snapshot.jamRemaining > 0 ? t("KẸT ĐẠN") : snapshot.target ? `${snapshot.input.length}/${snapshot.target.length}` : '…'}</span>
              {snapshot.jamRemaining > 0 && <span className="jam-progress" style={{ width: `${snapshot.jamRemaining / 300 * 100}%` }} />}
            </div>
            <CombatStatus combat={snapshot.combat} hasTarget={Boolean(snapshot.target)} active={snapshot.phase === 'playing' && !spectating} />
            <div className="typing-bottom"><p id="typing-help"><kbd>Tab</kbd>{t(" đổi mục tiêu ")}<span>·</span> <kbd>⌫</kbd>{t(" xóa chữ ")}<span>·</span> <kbd>Esc</kbd>{t(" tạm dừng")}</p><span>{snapshot.words}{t(" từ ")}<span>·</span> {snapshot.kills} zombie</span></div>
          </div>
          <div className="inventory" aria-label={t("Vật phẩm")}>
            {items.map(item => <button key={item.key} className={`item-button ${snapshot.inventory[item.key] === 0 ? 'empty' : ''}`} title={t("{0}: {1} · Phím {2}", [t(item.name), t(item.help), item.number])} aria-label={t("{0}, còn {1}", [t(item.name), snapshot.inventory[item.key]])} disabled={snapshot.phase !== 'playing' || spectating || snapshot.inventory[item.key] === 0} onClick={() => consume(item.key)}><kbd>{item.number}</kbd><img src={`/art/items/${item.key}.png`} alt="" /><span>{snapshot.inventory[item.key]}</span></button>)}
            {(snapshot.freezeRemaining > 0 || snapshot.boostRemaining > 0) && <div className="active-effect">{snapshot.freezeRemaining > 0 ? t("Đóng băng {0}s", [(snapshot.freezeRemaining / 1000).toFixed(1)]) : t("Tăng lực {0}s", [(snapshot.boostRemaining / 1000).toFixed(1)])}</div>}
          </div>
        </>}
        {snapshot.phase === 'countdown' && <div className="countdown"><span>{t("Sẵn sàng tiếp tục")}</span><strong>{Math.max(1, Math.ceil(snapshot.countdown / 1000))}</strong></div>}
        <div className="mobile-note"><Keyboard size={28} /><strong>{t("Cần một bàn phím để sống sót.")}</strong><p>{t("Bản thử này dành cho máy tính. Hãy mở trên màn hình rộng và dùng bàn phím để chơi.")}</p></div>
      </div>
      <div className="game-footer"><div><button className="text-button" onClick={() => showPanel('help')}>{t("Hướng dẫn")}</button><button className="icon-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? t("Thoát toàn màn hình") : t("Toàn màn hình")}>{fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button></div></div>
    </section>

    <footer className="page-footer"><span>{t(customDeck ? 'Bộ tự tạo có thể chơi lại trong thời hạn của link.' : 'Prototype · Tiến trình chỉ lưu trên trình duyệt này.')}</span></footer>
    {saveError && <p className="storage-notice" role="status">{t(saveError)}</p>}

    {snapshot.phase === 'paused' && !panel && <Modal title={room.status === 'disconnected' || room.status === 'connecting' ? t("Đang mất kết nối phòng") : t("Nghỉ lấy hơi.")} onClose={room.status === 'disconnected' || room.status === 'connecting' ? () => engine.connect() : resume} className="pause-modal">
      <p>{room.status === 'disconnected' || room.status === 'connecting' ? t("Trận đấu của phòng vẫn tiếp tục. Kết nối lại trong 20 giây để trở về; hết thời gian này bạn sẽ nhận phòng mới.") : online ? t("Bạn đang tạm dừng điều khiển. Trận đấu trong phòng vẫn tiếp tục; quay lại sớm để hỗ trợ đồng đội.") : t("Thành phố đang tạm dừng. Từ đang nhập và vật phẩm vẫn được giữ.")}</p>
      {room.status === 'disconnected' || room.status === 'connecting' ? <button className="button primary" disabled={room.status === 'connecting'} onClick={() => engine.connect()}>{room.status === 'connecting' ? t("Đang kết nối lại…") : t("Kết nối lại phòng")}</button> : <button className="button primary" onClick={resume}><Play size={19} />{t(" Tiếp tục chiến đấu")}</button>}
      <button className="button secondary" onClick={() => showPanel('audio')}><Music2 size={18} />{t(" Nhạc và âm thanh")}</button><button className="button secondary" onClick={home}>{room.status !== 'offline' ? t("Rời phòng") : t("Về màn bắt đầu")}</button>
    </Modal>}
    {panel === 'audio' && <Modal title={t("Nhạc và âm thanh")} onClose={() => setPanel(null)} className="audio-modal">
      <div className="audio-current" role="status" aria-live="polite" aria-atomic="true">
        <div className="audio-track-status"><span>{t(audioStatusLabels[audioState.status])}</span>{audioState.total > 0 && <span>{t("Bài ")}{audioState.index + 1}/{audioState.total}</span>}</div>
        <strong>{audioState.title || (audioState.status === 'unavailable' ? t("Nhạc nền chưa sẵn sàng") : t("Đang chuẩn bị danh sách nhạc…"))}</strong>
      </div>
      <button className="button secondary audio-next" disabled={!ready || audioState.total === 0 || audioState.status === 'unavailable'} onClick={() => runtime.current?.nextTrack()}><SkipForward size={18} />{t(" Bài tiếp theo")}</button>
      <p className="audio-playlist-note">{t("Nhạc phát lần lượt và lặp lại từ bài đầu khi hết danh sách.")}{snapshot.phase === 'paused' && t(" Bài đã chọn sẽ phát khi bạn tiếp tục trận.")}</p>
      <div className="audio-volumes">
        <div className="audio-volume">
          <label htmlFor="music-volume">{t("Nhạc nền ")}<output htmlFor="music-volume">{Math.round(settings.musicVolume * 100)}%</output></label>
          <input id="music-volume" type="range" min="0" max="100" step="1" value={Math.round(settings.musicVolume * 100)} aria-valuetext={t("{0} phần trăm", [Math.round(settings.musicVolume * 100)])} onChange={event => setSettings(current => ({ ...current, musicVolume: Number(event.target.value) / 100 }))} />
        </div>
        <div className="audio-volume">
          <label htmlFor="sfx-volume">{t("Hiệu ứng ")}<output htmlFor="sfx-volume">{Math.round(settings.sfxVolume * 100)}%</output></label>
          <input id="sfx-volume" type="range" min="0" max="100" step="1" value={Math.round(settings.sfxVolume * 100)} aria-valuetext={t("{0} phần trăm", [Math.round(settings.sfxVolume * 100)])} onChange={event => setSettings(current => ({ ...current, sfxVolume: Number(event.target.value) / 100 }))} />
        </div>
      </div>
      <button className="button secondary audio-mute" onClick={() => setSettings(current => ({ ...current, muted: !current.muted }))} aria-pressed={settings.muted}>{settings.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}{settings.muted ? t("Bật âm thanh") : t("Tắt toàn bộ âm thanh")}</button>
      {settings.muted && <p className="audio-muted-note">{t("Âm thanh đang tắt. Hai mức âm lượng vẫn được giữ lại.")}</p>}
    </Modal>}
    {panel === 'help' && <Modal title={t("Sống sót bằng từ vựng")} onClose={() => setPanel(null)}><GameHelp /><button className="button primary" onClick={() => setPanel(null)}>{t("Đã hiểu")}</button></Modal>}
    {panel === 'collection' && <Modal title={t("Từ đã gặp")} onClose={() => setPanel(null)}>
      <p className="modal-intro">{customDeck ? t('{0}/{1} từ đã gặp trong phiên này.', [encounteredWords.length, wordBank.length]) : <>{encounteredWords.length.toLocaleString(locale)}/{wordBank.length.toLocaleString(locale)}{t(" từ trong sổ của bạn · ")}{progress.runs}{t(" trận đã lưu. Từ được ghi nhớ ngay khi xuất hiện; thống kê của trận được lưu khi kết thúc.")}</>}</p>
      <div className="collection-search"><label htmlFor="collection-search">{t("Tìm từ hoặc nghĩa")}</label><input id="collection-search" type="search" value={collectionQuery} onChange={event => { setCollectionQuery(event.target.value); setCollectionPage(0); }} placeholder={t("Nhập từ tiếng Anh hoặc nghĩa tiếng Việt…")} /></div>
      <div className="collection-filters">
        <label>{t("Từ loại")}<select value={collectionPos} onChange={event => { setCollectionPos(event.target.value); setCollectionPage(0); }}><option value="">{t("Tất cả từ loại")}</option>{Object.entries(PART_OF_SPEECH_LABELS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
        <label>{t("Độ khó")}<select value={collectionLevel} onChange={event => { setCollectionLevel(event.target.value); setCollectionPage(0); }}><option value="">{t("Tất cả bậc · dễ đến khó")}</option>{Object.entries(LEARNING_LEVEL_LABELS).map(([value, label]) => <option key={value} value={value}>{t("Bậc ")}{value} · {t(label)}</option>)}</select></label>
      </div>
      <button className={`text-button collection-favorite-filter ${onlyFavorites ? 'selected' : ''}`} aria-pressed={onlyFavorites} onClick={() => { pronunciation.stop(); setOnlyFavorites(value => !value); setCollectionPage(0); }}><Star size={17} fill={onlyFavorites ? 'currentColor' : 'none'} />{t(" Chỉ xem yêu thích")}</button>
      {learningStatus}
      {collectionWords.length ? <><LearningPanel words={visibleCollection} results={collectionResults} {...learningActions} /><div className="collection-pagination"><button className="text-button" disabled={page === 0} onClick={() => { pronunciation.stop(); setCollectionPage(page - 1); }}>{t("← Trước")}</button><span>{t("Trang ")}{page + 1}/{collectionPages} · {collectionWords.length.toLocaleString(locale)}{t(" từ")}</span><button className="text-button" disabled={page + 1 === collectionPages} onClick={() => { pronunciation.stop(); setCollectionPage(page + 1); }}>{t("Sau →")}</button></div></> : <div className="empty-state"><BookOpen size={36} /><strong>{collectionFiltered ? t("Chưa tìm thấy từ phù hợp.") : t("Trang sổ còn trống.")}</strong><p>{collectionFiltered ? t("Thử từ khác hoặc đổi bộ lọc từ loại, độ khó, yêu thích.") : t("Từ sẽ được thêm vào đây ngay khi xuất hiện trong trận.")}</p></div>}
    </Modal>}
    {snapshot.phase === 'over' && summary && !panel && <Modal title={vocabularyComplete ? t("Đã hoàn thành kho từ!") : t("Một trận nữa nhé?")} onClose={home} className="summary-modal">
      <p className="modal-intro">{vocabularyComplete ? customDeck ? t('Đã hoàn thành toàn bộ {0} câu trong bộ này!', [snapshot.vocabulary.total]) : teamRun ? t("Cả đội đã hoàn tất kho từ của phòng và dọn sạch đợt cuối. Chiến thắng!") : t("Bạn đã gặp đủ {0} từ trong từ điển của game và dọn sạch đợt cuối. Bạn đã chiến thắng!", [snapshot.vocabulary.total.toLocaleString(locale)]) : t("{0} đã cầm cự {1}. Còn {2} từ mới{3}.", [teamRun ? t("Cả đội") : t("Bạn"), formatTime(summary.durationMs), snapshot.vocabulary.remaining.toLocaleString(locale), teamRun ? t(" trong kho của phòng") : t(" cho hành trình tiếp theo")])}</p>
      {room.error && <p className="lobby-feedback" role="status">{t(room.error)}</p>}
      <div className="result-score"><Trophy size={24} /><strong>{summary.score.toLocaleString(locale)}</strong><span>{teamRun ? t("điểm cả đội") : t("điểm")}</span></div>
      <div className="result-stats"><div><strong>{summary.kills}</strong><span>{teamRun ? t("quái cả đội hạ") : 'zombie'}</span></div><div><strong>{summary.words}</strong><span>{teamRun ? t("từ cả đội") : t("từ hoàn thành")}</span></div><div><strong>{Math.round(summary.accuracy)}%</strong><span>{teamRun ? t("chính xác đội") : t("chính xác")}</span></div><div><strong>{Math.round(summary.wpm)}</strong><span>{teamRun ? t("WPM cả đội") : 'WPM'}</span></div><div><strong>{summary.bestCombo}</strong><span>{teamRun ? t("combo đội") : t("combo cao nhất")}</span></div></div>
      <h3>{t("Nhớ thêm vài từ")}</h3>
      <LearningPanel words={wordBank} results={summary.results} runReview {...learningActions} />
      {learningStatus}
      <button className="text-button" onClick={() => showPanel('collection')}><BookOpen size={17} />{t(" Mở sổ từ đã gặp")}</button>
      <div className="summary-actions">{customDeck || snapshot.vocabulary.remaining > 0 ? <button className="button primary" disabled={!canReplay} onClick={() => start('survival')}><RotateCcw size={18} /> {canReplay ? t("Chơi trận mới") : t("Chờ chủ phòng chơi tiếp")}</button> : <button className="button primary" onClick={() => showPanel('collection')}><BookOpen size={18} />{t(" Xem từ đã gặp")}</button>}<button className="button secondary" onClick={home}>{online ? room.selfId === room.hostId ? t("Về sảnh phòng") : t("Rời phòng") : t("Về màn bắt đầu")}</button></div>
      <p className="save-caption">{customDeck ? t('Bạn có thể luyện lại toàn bộ bộ câu hỏi đến khi link hết hạn.') : (saveError && t(saveError)) || t("{0} được lưu trên trình duyệt này. WPM = {1}ký tự đúng có hiệu lực ÷ 5 ÷ phút chơi.", [teamRun ? t("Kết quả chung của đội") : t("Kết quả"), teamRun ? t("tổng ") : ''])}</p>
    </Modal>}
  </main>;
}
