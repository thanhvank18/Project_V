import type { Snapshot } from '../game/types';
import { useLanguage } from './LanguageContext';
import { getHealthHearts } from './healthHearts';
import './health-hearts.css';

export function HeartRow({ hp, maxHp, compact = false }: { hp: number; maxHp: number; compact?: boolean }) {
  const { t } = useLanguage();
  const { health, maximum, hearts } = getHealthHearts(hp, maxHp);
  const healthText = `${Math.ceil(health)} / ${maximum} HP`;
  return <div className={`heart-row${compact ? ' heart-row--compact' : ''}`} role="progressbar" aria-label={t('SỨC KHỎE')} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={health} aria-valuetext={healthText} title={healthText}>
    {hearts.map((fill, index) => <span className="heart-slot" key={index} data-fill={fill === 1 ? 'full' : fill === 0 ? 'empty' : 'partial'} aria-hidden="true">
      <img className="heart-sprite heart-empty" src="/assets/ui/fantasy/heart-empty.png" alt="" draggable={false} />
      <span className="heart-fill" style={{ width: `${Math.round(fill * 10000) / 100}%` }}><img className="heart-sprite" src="/assets/ui/fantasy/heart-full.png" alt="" draggable={false} /></span>
    </span>)}
  </div>;
}

export function HealthMeter({ hp, maxHp }: { hp: number; maxHp: number }) {
  const { t } = useLanguage();
  const { critical } = getHealthHearts(hp, maxHp);
  return <div className={`health-block${critical ? ' critical' : ''}`}>
    <div className="health-title"><span>{t('SỨC KHỎE')}</span></div>
    <HeartRow hp={hp} maxHp={maxHp} />
  </div>;
}

export function CombatStatus({ combat, hasTarget, active }: { combat: Snapshot['combat']; hasTarget: boolean; active: boolean }) {
  const { t } = useLanguage();
  if (!active || !hasTarget || combat?.class !== 'melee' || (combat.inRange && combat.queued === 0)) return null;
  const action = combat.approaching ? t('Đang áp sát') : !combat.inRange ? t(combat.queued > 0 ? 'Gõ tiếp để áp sát' : 'Gõ để áp sát') : '';
  const queue = combat.queued > 0 ? t('{0} chữ chờ', [combat.queued]) : '';
  return <p id="combat-status" className="combat-status" role="status" aria-live="polite">{[action, queue].filter(Boolean).join(' · ')}</p>;
}
