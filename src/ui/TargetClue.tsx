import { useEffect, useRef } from 'react';
import type { Snapshot } from '../game/types';
import { useLanguage } from './LanguageContext';

export function TargetClue({ target }: { target: Snapshot['target'] }) {
  const { t } = useLanguage();
  const meaning = useRef<HTMLParagraphElement>(null);
  const sentence = useRef<HTMLDivElement>(null);
  const meaningIsPrompt = Boolean(target && target.prompt === target.meaning);

  useEffect(() => {
    // A new clue starts at its first line, even if the previous definition was scrolled.
    if (meaning.current) meaning.current.scrollTop = 0;
    if (sentence.current) sentence.current.scrollTop = 0;
  }, [target?.id, target?.prompt, target?.meaning]);

  if (target?.type === 'fill') return <div className="target-clue fill-clue">
    <div ref={sentence} className="target-sentence" tabIndex={0} role="region" aria-label={t('Câu điền chỗ trống')} title={target.prompt}>{target.prompt}</div>
    <div className="fill-clue-bottom"><p ref={meaning} className="target-meaning" tabIndex={0} role="region" aria-label={t('Nghĩa từ')} title={target.meaning}>{meaningIsPrompt ? '' : target.meaning}</p>{target.hint && <span>{target.hint}</span>}</div>
  </div>;
  return <div className={`target-clue${meaningIsPrompt ? ' meaning-first' : ''}`}>
    <div className="target-prompt">
      {!meaningIsPrompt && <strong>{target?.prompt || t('Chuẩn bị cho đợt tiếp theo…')}</strong>}
      {target?.hint && <span>{target.hint}</span>}
    </div>
    {target && <p ref={meaning} className="target-meaning" tabIndex={0} role="region" aria-label={t('Nghĩa từ')} title={target.meaning}>{target.meaning}</p>}
  </div>;
}
