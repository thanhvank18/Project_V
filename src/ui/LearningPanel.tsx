import { useLanguage } from './LanguageContext';
import { useEffect, useState, type ComponentType } from 'react';
import type { LearningReviewProps } from './LearningReview';

export function LearningPanel(props: LearningReviewProps) {
  const { t } = useLanguage();
  const [loaded, setLoaded] = useState<{ Component: ComponentType<LearningReviewProps> } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    setFailed(false);
    void import('./LearningReview').then(module => {
      if (!disposed) setLoaded({ Component: module.default });
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; };
  }, [attempt]);
  if (loaded) return <loaded.Component {...props} />;
  if (failed) return <div className="learning-load-error" role="status"><p>{t("Chưa tải được sổ từ. Kiểm tra kết nối và thử lại.")}</p><button className="text-button" onClick={() => setAttempt(value => value + 1)}>{t("Tải lại sổ từ")}</button></div>;
  return <p className="learning-load-state" role="status">{t("Đang mở sổ từ…")}</p>;
}
