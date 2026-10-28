import type Phaser from 'phaser';

export function summarizeFrames(frames: readonly { interval: number; cpu: number }[]) {
  const intervals = frames.map(frame => frame.interval).sort((a, b) => a - b);
  const cpus = frames.map(frame => frame.cpu).sort((a, b) => a - b);
  const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const percentile = (values: readonly number[]) => values[Math.max(0, Math.ceil(values.length * .95) - 1)] ?? 0;
  const interval = mean(intervals);
  return { fps: interval > 0 ? 1000 / interval : 0, frameP95: percentile(intervals), cpuMean: mean(cpus), cpuP95: percentile(cpus), slowFrames: intervals.filter(value => value > 25).length, samples: frames.length };
}

/** Opt-in diagnostics. CPU includes Phaser update + render submission, not GPU execution. */
export function attachPerformanceMonitor(game: Phaser.Game, parent: HTMLElement, context: () => string): void {
  if (new URLSearchParams(location.search).get('perf') !== '1') return;
  const output = document.createElement('pre');
  output.dataset.performanceMonitor = 'true';
  output.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:100;padding:6px 8px;margin:0;background:#100d0eee;color:#fff1d0;font:11px/1.4 monospace;pointer-events:none;white-space:pre';
  parent.append(output);
  const frames: { interval: number; cpu: number }[] = [];
  let start = 0, published = 0, resuming = true;
  const begin = () => { start = performance.now(); };
  const end = () => {
    const now = performance.now();
    if (document.hidden || !document.hasFocus()) { frames.length = 0; resuming = true; return; }
    // A focus/visibility transition is not a gameplay frame.
    if (resuming) { resuming = false; return; }
    if (game.loop.rawDelta > 0) {
      frames.push({ interval: game.loop.rawDelta, cpu: now - start });
      if (frames.length > 180) frames.shift();
    }
    if (now - published < 1000) return;
    published = now;
    const stats = summarizeFrames(frames);
    output.textContent = `${stats.fps.toFixed(1)} FPS · frame p95 ${stats.frameP95.toFixed(1)} ms\nCPU ${stats.cpuMean.toFixed(2)} ms · p95 ${stats.cpuP95.toFixed(2)} ms\n>25 ms: ${stats.slowFrames}/${stats.samples} · ${context()}`;
  };
  const visibility = () => { frames.length = 0; resuming = true; output.textContent = 'FPS: waiting for focused gameplay'; };
  game.events.on('prestep', begin);
  game.events.on('postrender', end);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', visibility);
  game.events.once('destroy', () => {
    game.events.off('prestep', begin);
    game.events.off('postrender', end);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', visibility);
    output.remove();
  });
}
