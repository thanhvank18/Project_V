import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CombatStatus, HealthMeter } from './CombatFeedback';
import { GameHelp } from './GameHelp';
import { HeroPicker } from './HeroPicker';
import { LanguageProvider } from './LanguageContext';
import type { Snapshot } from '../game/types';

afterEach(() => vi.unstubAllGlobals());
const language = (value: 'vi' | 'en') => vi.stubGlobal('localStorage', { getItem: () => value });
const melee: NonNullable<Snapshot['combat']> = { class: 'melee', range: 110, inRange: false, approaching: true, queued: 3 };

describe('combat feedback', () => {
  it('scales health against the hero maximum and flags critical below thirty percent', () => {
    language('en');
    const atThirty = renderToStaticMarkup(<LanguageProvider><HealthMeter hp={45} maxHp={150} /></LanguageProvider>);
    expect(atThirty).toContain('width:30%');
    expect(atThirty).toContain('aria-valuemax="150"');
    expect(atThirty).toContain('<small>/150</small>');
    expect(atThirty).not.toContain('critical');
    const critical = renderToStaticMarkup(<LanguageProvider><HealthMeter hp={44} maxHp={150} /></LanguageProvider>);
    expect(critical).toContain('critical');
    expect(renderToStaticMarkup(<LanguageProvider><HealthMeter hp={100} maxHp={100} /></LanguageProvider>)).toContain('width:100%');
  });

  it('explains queued attacks and how to resume after retreating in both languages', () => {
    language('vi');
    const approaching = renderToStaticMarkup(<LanguageProvider><CombatStatus combat={melee} hasTarget active /></LanguageProvider>);
    expect(approaching).toContain('Đang áp sát · 3 chữ chờ');
    language('en');
    const retreating = renderToStaticMarkup(<LanguageProvider><CombatStatus combat={{ ...melee, approaching: false }} hasTarget active /></LanguageProvider>);
    expect(retreating).toContain('Type again to approach · Queued: 3');
    expect(retreating).not.toContain('Đang áp sát');
  });

  it('keeps contextual combat text out of ranged, idle, paused and targetless states', () => {
    language('vi');
    for (const combat of [undefined, { ...melee, class: 'ranged' as const }, { ...melee, inRange: true, queued: 0 }]) {
      expect(renderToStaticMarkup(<LanguageProvider><CombatStatus combat={combat} hasTarget active /></LanguageProvider>)).toBe('');
    }
    expect(renderToStaticMarkup(<LanguageProvider><CombatStatus combat={melee} hasTarget={false} active /></LanguageProvider>)).toBe('');
    expect(renderToStaticMarkup(<LanguageProvider><CombatStatus combat={melee} hasTarget active={false} /></LanguageProvider>)).toBe('');
  });

  it('shows hero class and health with matching English combat instructions', () => {
    language('en');
    expect(renderToStaticMarkup(<LanguageProvider><HeroPicker value="knight" onChange={() => {}} /></LanguageProvider>)).toContain('Melee · 150 HP');
    expect(renderToStaticMarkup(<LanguageProvider><HeroPicker value="wizard" onChange={() => {}} /></LanguageProvider>)).toContain('Ranged · 100 HP');
    const help = renderToStaticMarkup(<LanguageProvider><GameHelp /></LanguageProvider>);
    expect(help).toContain('queued letters only attack within reach');
    expect(help).toContain('Bosses block your path');
    expect(help).toContain('Below 30% health');
    expect(help).not.toContain('Below 30 HP');
  });
});
