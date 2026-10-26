import { Check } from 'lucide-react';
import { getHeroCharacter, HERO_CHARACTERS } from '../game/characterCatalog';
import { getHeroSkill } from '../game/heroSkills';

export function HeroPicker({ value, onChange, taken = [], disabled = false }: { value: string; onChange: (id: string) => void; taken?: readonly string[]; disabled?: boolean }) {
  const selected = getHeroCharacter(value);
  const skill = getHeroSkill(selected.id);

  return <fieldset className="hero-picker" aria-describedby="hero-picker-help">
    <legend>Chọn nhân vật <span>{HERO_CHARACTERS.length} anh hùng</span></legend>
    <div className="hero-grid">
      {HERO_CHARACTERS.map(hero => <label className={`hero-option ${taken.includes(hero.id) ? 'hero-taken' : ''}`} key={hero.id} title={taken.includes(hero.id) ? `${hero.label} đã có người chọn` : hero.name}>
        <input className="sr-only" type="radio" name="hero" value={hero.id} checked={hero.id === value} disabled={disabled || taken.includes(hero.id)} onChange={() => onChange(hero.id)} />
        <span className="hero-card">
          <img src={hero.portrait} alt="" draggable={false} />
          <span>{hero.label}{taken.includes(hero.id) && <small>Đã có người chọn</small>}</span>
          {hero.id === value && <Check className="hero-selected" size={14} aria-hidden="true" />}
        </span>
      </label>)}
    </div>
    <div className="hero-skill-description" aria-live="polite">
      <p className="hero-current"><strong>{skill.name}</strong><span>{skill.threshold} chữ đúng</span></p>
      <p id="hero-picker-help">{skill.description}</p>
      <p className="hero-tactics">{skill.tactics}</p>
    </div>
  </fieldset>;
}
