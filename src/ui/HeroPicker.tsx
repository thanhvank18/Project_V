import { useLanguage } from './LanguageContext';
import { Check } from 'lucide-react';
import { getHeroCharacter, HERO_CHARACTERS } from '../game/characterCatalog';
import { getHeroSkill } from '../game/heroSkills';
import { getHeroCombat } from '../game/heroCombat';

export function HeroPicker({ value, onChange, taken = [], disabled = false }: { value: string; onChange: (id: string) => void; taken?: readonly string[]; disabled?: boolean }) {
  const { t } = useLanguage();
  const selected = getHeroCharacter(value);
  const skill = getHeroSkill(selected.id);
  const combat = getHeroCombat(selected.id);

  return <fieldset className="hero-picker" aria-describedby="hero-picker-help">
    <legend>{t("Chọn nhân vật ")}<span>{HERO_CHARACTERS.length}{t(" anh hùng")}</span></legend>
    <div className="hero-grid">
      {HERO_CHARACTERS.map(hero => <label className={`hero-option ${taken.includes(hero.id) ? 'hero-taken' : ''}`} key={hero.id} title={taken.includes(hero.id) ? t("{0} đã có người chọn", [t(hero.label)]) : hero.name}>
        <input className="sr-only" type="radio" name="hero" value={hero.id} checked={hero.id === value} disabled={disabled || taken.includes(hero.id)} onChange={() => onChange(hero.id)} />
        <span className="hero-card">
          <img src={hero.portrait} alt="" draggable={false} />
          <span>{t(hero.label)}{taken.includes(hero.id) && <small>{t("Đã có người chọn")}</small>}</span>
          {hero.id === value && <Check className="hero-selected" size={14} aria-hidden="true" />}
        </span>
      </label>)}
    </div>
    <div className="hero-skill-description" aria-live="polite">
      <p className="hero-current"><strong>{t(skill.name)}</strong><span>{skill.threshold}{t(" chữ đúng")}</span></p>
      <p className="hero-combat-profile">{t('{0} · {1} HP', [t(combat.class === 'melee' ? 'Cận chiến' : 'Đánh xa'), combat.maxHp])}</p>
      <p id="hero-picker-help">{t(skill.description)}</p>
      <p className="hero-tactics">{t(skill.tactics)}</p>
    </div>
  </fieldset>;
}
