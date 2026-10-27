import { Heart } from 'lucide-react';
import type { Snapshot } from '../game/types';
import { useLanguage } from './LanguageContext';

export function HealthMeter({ hp, maxHp }: { hp: number; maxHp: number }) {
  const { t } = useLanguage();
  const health = Math.max(0, Math.min(maxHp, hp));
  const percentage = health / maxHp * 100;
  return <div className={`health-block ${percentage < 30 ? 'critical' : ''}`}>
    <div className="health-title"><Heart size={17} fill="currentColor" /><span>{t('SỨC KHỎE')}</span><strong>{Math.ceil(health)}<small>/{maxHp}</small></strong></div>
    <div className="health-track" role="progressbar" aria-label={t('SỨC KHỎE')} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={Math.ceil(health)}><span style={{ width: `${percentage}%` }} /></div>
  </div>;
}

export function CombatStatus({ combat, hasTarget, active }: { combat: Snapshot['combat']; hasTarget: boolean; active: boolean }) {
  const { t } = useLanguage();
  if (!active || !hasTarget || combat?.class !== 'melee' || (combat.inRange && combat.queued === 0)) return null;
  const action = combat.approaching ? t('Đang áp sát') : !combat.inRange ? t(combat.queued > 0 ? 'Gõ tiếp để áp sát' : 'Gõ để áp sát') : '';
  const queue = combat.queued > 0 ? t('{0} chữ chờ', [combat.queued]) : '';
  return <p id="combat-status" className="combat-status" role="status" aria-live="polite">{[action, queue].filter(Boolean).join(' · ')}</p>;
}
