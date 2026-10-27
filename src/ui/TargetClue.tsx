import { useEffect, useRef } from 'react';
import type { Snapshot } from '../game/types';
import { useLanguage } from './LanguageContext';

export function TargetClue({ target }: { target: Snapshot['target'] }) {
  const { t } = useLanguage();
  const meaning = useRef<HTMLParagraphElement>(null);
  const meaningIsPrompt = Boolean(target && target.prompt === target.meaning);

  useEffect(() => {
    // A new clue starts at its first line, even if the previous definition was scrolled.
    if (meaning.current) meaning.current.scrollTop = 0;
  }, [target?.id, target?.prompt, target?.meaning]);

  return <div className={`target-clue${meaningIsPrompt ? ' meaning-first' : ''}`}>
    <div className="target-prompt">
      {!meaningIsPrompt && <strong>{target?.prompt || t('Chuẩn bị cho đợt tiếp theo…')}</strong>}
      {target?.hint && <span>{target.hint}</span>}
    </div>
    {target && <p ref={meaning} className="target-meaning" tabIndex={0} role="region" aria-label={t('Nghĩa từ')} title={target.meaning}>{target.meaning}</p>}
  </div>;
}
