import { Check } from 'lucide-react';
import { getHeroCharacter, HERO_CHARACTERS } from '../game/characterCatalog';
import { getHeroSkill } from '../game/heroSkills';

export function HeroPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const selected = getHeroCharacter(value);
  const skill = getHeroSkill(selected.id);

  return <fieldset className="hero-picker" aria-describedby="hero-picker-help">
    <legend>Chọn nhân vật <span>{HERO_CHARACTERS.length} anh hùng</span></legend>
    <div className="hero-grid">
      {HERO_CHARACTERS.map(hero => <label className="hero-option" key={hero.id} title={hero.name}>
        <input className="sr-only" type="radio" name="hero" value={hero.id} checked={hero.id === value} onChange={() => onChange(hero.id)} />
        <span className="hero-card">
          <img src={hero.portrait} alt="" draggable={false} />
          <span>{hero.label}</span>
          {hero.id === value && <Check className="hero-selected" size={14} aria-hidden="true" />}
        </span>
      </label>)}
    </div>
    <div className="hero-skill-description" aria-live="polite">
      <p className="hero-current"><strong>{skill.name}</strong><span>{skill.threshold} chữ đúng</span></p>
      <p id="hero-picker-help">{skill.description}</p>
    </div>
  </fieldset>;
}
