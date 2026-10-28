import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CombatStatus, HealthMeter, HeartRow } from './CombatFeedback';
import { GameHelp } from './GameHelp';
import { HeroPicker } from './HeroPicker';
import { LanguageProvider } from './LanguageContext';
import type { Snapshot } from '../game/types';
import { getHealthHearts } from './healthHearts';

afterEach(() => vi.unstubAllGlobals());
const language = (value: 'vi' | 'en') => vi.stubGlobal('localStorage', { getItem: () => value });
const melee: NonNullable<Snapshot['combat']> = { class: 'melee', range: 110, inRange: false, approaching: true, queued: 3 };

describe('combat feedback', () => {
  it('shows five hearts for ranged heroes and seven for melee heroes without a visible HP counter', () => {
    language('en');
    const ranged = renderToStaticMarkup(<LanguageProvider><HealthMeter hp={100} maxHp={100} /></LanguageProvider>);
    const melee = renderToStaticMarkup(<LanguageProvider><HealthMeter hp={150} maxHp={150} /></LanguageProvider>);
    expect(ranged.match(/class="heart-slot"/g)).toHaveLength(5);
    expect(melee.match(/class="heart-slot"/g)).toHaveLength(7);
    expect(melee.match(/data-fill="full"/g)).toHaveLength(7);
    expect(melee).not.toContain('<strong>150');
    expect(melee).not.toContain('health-track');
  });

  it('keeps partial hearts proportional to actual HP, including small damage and healing', () => {
    expect(getHealthHearts(90, 100).hearts).toEqual([1, 1, 1, 1, 0.5]);
    const damaged = getHealthHearts(149, 150).hearts;
    expect(damaged.slice(0, 6)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(damaged[6]).toBeCloseTo(0.95333, 4);
    expect(getHealthHearts(1, 150).hearts[0]).toBeCloseTo(0.04667, 4);
    expect(getHealthHearts(15, 100).hearts).toEqual([0.75, 0, 0, 0, 0]);
    language('en');
    const partial = renderToStaticMarkup(<LanguageProvider><HeartRow hp={90} maxHp={100} /></LanguageProvider>);
    expect(partial).toContain('data-fill="partial"');
    expect(partial).toContain('width:50%');
  });

  it('supports empty health and the one-hit survival rule without changing HP', () => {
    expect(getHealthHearts(0, 100).hearts).toEqual([0, 0, 0, 0, 0]);
    expect(getHealthHearts(1, 1).hearts).toEqual([1]);
    expect(getHealthHearts(0, 1).hearts).toEqual([0]);
    expect(getHealthHearts(-10, 100).health).toBe(0);
    expect(getHealthHearts(110, 100).health).toBe(100);
    language('en');
    const oneHit = renderToStaticMarkup(<LanguageProvider><HealthMeter hp={1} maxHp={1} /></LanguageProvider>);
    expect(oneHit.match(/class="heart-slot"/g)).toHaveLength(1);
    expect(oneHit).toContain('aria-valuenow="1"');
    expect(oneHit).toContain('aria-valuemax="1"');
  });

  it('flags critical below thirty percent and exposes precise health accessibly', () => {
    language('en');
    const atThirty = renderToStaticMarkup(<LanguageProvider><HealthMeter hp={45} maxHp={150} /></LanguageProvider>);
    expect(atThirty).toContain('role="progressbar"');
    expect(atThirty).toContain('aria-label="HEALTH"');
    expect(atThirty).toContain('aria-valuemax="150"');
    expect(atThirty).toContain('aria-valuenow="45"');
    expect(atThirty).toContain('aria-valuetext="45 / 150 HP"');
    expect(atThirty).toContain('title="45 / 150 HP"');
    expect(atThirty).not.toContain('critical');
    const critical = renderToStaticMarkup(<LanguageProvider><HealthMeter hp={44} maxHp={150} /></LanguageProvider>);
    expect(critical).toContain('critical');
    language('vi');
    expect(renderToStaticMarkup(<LanguageProvider><HeartRow hp={40} maxHp={100} /></LanguageProvider>)).toContain('aria-label="SỨC KHỎE"');
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
    const knight = renderToStaticMarkup(<LanguageProvider><HeroPicker value="knight" onChange={() => {}} /></LanguageProvider>);
    const wizard = renderToStaticMarkup(<LanguageProvider><HeroPicker value="wizard" onChange={() => {}} /></LanguageProvider>);
    expect(knight).toContain('>Melee</span>');
    expect(knight.match(/class="heart-slot"/g)).toHaveLength(7);
    expect(wizard).toContain('>Ranged</span>');
    expect(wizard.match(/class="heart-slot"/g)).toHaveLength(5);
    const oneHit = renderToStaticMarkup(<LanguageProvider><HeroPicker value="knight" onChange={() => {}} maxHp={1} /></LanguageProvider>);
    expect(oneHit.match(/class="heart-slot"/g)).toHaveLength(1);
    const help = renderToStaticMarkup(<LanguageProvider><GameHelp /></LanguageProvider>);
    expect(help).toContain('queued letters only attack within reach');
    expect(help).toContain('Bosses block your path');
    expect(help).toContain('Below 30% health');
    expect(help).not.toContain('Below 30 HP');
  });
});
