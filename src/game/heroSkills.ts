export type HeroAttackStyle = 'arrow' | 'axe' | 'sword' | 'holy-spear' | 'spear' | 'holy-light' | 'volley' | 'blade' | 'arcane';
export type HeroSkillVisualKind = 'pierce' | 'shockwave' | 'guard' | 'sanctuary' | 'lance' | 'heal' | 'volley' | 'repel' | 'frost';
export type HeroSkillEffect =
  | { kind: 'push-target'; distance: number }
  | { kind: 'stun-area'; radius: number; duration: number }
  | { kind: 'guard'; duration: number }
  | { kind: 'ward'; duration: number; reduction: number }
  | { kind: 'push-line'; distance: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'slow'; duration: number; factor: number }
  | { kind: 'repel'; radius: number; distance: number }
  | { kind: 'freeze-area'; radius: number; duration: number };

export interface HeroSkillDefinition {
  id: string;
  heroId: string;
  name: string;
  description: string;
  tactics: string;
  threshold: number;
  color: string;
  attackStyle: HeroAttackStyle;
  visualKind: HeroSkillVisualKind;
  effect: HeroSkillEffect;
}

/** Correct, newly credited letters charge skills. None applies word damage or solves a word. */
export const HERO_SKILLS: readonly HeroSkillDefinition[] = [
  { id: 'piercing-arrow', heroId: 'archer', name: 'Tên đẩy lùi', threshold: 6, color: '#b9e49a', attackStyle: 'arrow', visualKind: 'pierce',
    tactics: 'Giữ xa mục tiêu để tên đẩy lùi mạnh gấp đôi.',
    description: 'Đẩy lùi mục tiêu để giữ khoảng cách. Không tác động lên Boss.', effect: { kind: 'push-target', distance: 28 } },
  { id: 'axe-shockwave', heroId: 'armored-axeman', name: 'Chấn động rìu', threshold: 10, color: '#f4bd73', attackStyle: 'axe', visualKind: 'shockwave',
    tactics: 'Áp sát để chấn động rộng quanh mình, làm quái khựng 0,9 giây.',
    description: 'Làm khựng quái quanh mục tiêu trong 0,6 giây. Boss miễn nhiễm.', effect: { kind: 'stun-area', radius: 150, duration: 600 } },
  { id: 'knight-guard', heroId: 'knight', name: 'Khiên thép', threshold: 10, color: '#acc8f0', attackStyle: 'sword', visualKind: 'guard',
    tactics: 'Khi còn khiên, tiến về mục tiêu nhanh hơn 25%; chủ động chắn đòn rồi rút.',
    description: 'Chặn hoàn toàn một đòn đánh trong 8 giây. Khiên không cộng dồn.', effect: { kind: 'guard', duration: 8000 } },
  { id: 'holy-sanctuary', heroId: 'knight-templar', name: 'Vùng thánh bảo hộ', threshold: 12, color: '#ffe3a0', attackStyle: 'holy-spear', visualKind: 'sanctuary',
    tactics: 'Đứng trong vùng sáng tại chỗ kích hoạt để giữ giảm sát thương.',
    description: 'Giảm 35% sát thương nhận vào trong 3 giây.', effect: { kind: 'ward', duration: 3000, reduction: .35 } },
  { id: 'lance-drive', heroId: 'lancer', name: 'Thương phá trận', threshold: 8, color: '#d0e8e5', attackStyle: 'spear', visualKind: 'lance',
    tactics: 'Canh quái cùng một phía; đánh ở đầu tầm thương để tăng lực đẩy cả tuyến.',
    description: 'Đẩy lùi mạnh các quái trên đường tới mục tiêu. Không đẩy Boss.', effect: { kind: 'push-line', distance: 60 } },
  { id: 'restoring-light', heroId: 'priest', name: 'Ánh sáng hồi phục', threshold: 12, color: '#b8efd3', attackStyle: 'holy-light', visualKind: 'heal',
    tactics: 'Đứng yên ít nhất một giây trước khi đủ năng lượng để hồi 8HP thay vì 5HP.',
    description: 'Hồi 5 HP, tối đa 100 HP.', effect: { kind: 'heal', amount: 5 } },
  { id: 'pinning-volley', heroId: 'soldier', name: 'Loạt tên ghìm chân', threshold: 8, color: '#edce8f', attackStyle: 'volley', visualKind: 'volley',
    tactics: 'Vừa lùi khỏi mục tiêu vừa gõ để giữ hiệu ứng chậm ba giây thay vì hai.',
    description: 'Giảm 55% tốc độ di chuyển của mục tiêu trong 2 giây. Boss miễn nhiễm.', effect: { kind: 'slow', duration: 2000, factor: .45 } },
  { id: 'sword-repulse', heroId: 'swordsman', name: 'Vòng kiếm phản kích', threshold: 8, color: '#d7d8ff', attackStyle: 'blade', visualKind: 'repel',
    tactics: 'Đợi quái áp sát hai phía; đẩy trúng cho thêm 40% tốc độ rút lui trong 0,9 giây.',
    description: 'Vung kiếm đẩy lùi các quái ở gần bạn. Không đẩy Boss.', effect: { kind: 'repel', radius: 160, distance: 42 } },
  { id: 'arcane-frost', heroId: 'wizard', name: 'Vòng băng', threshold: 12, color: '#9ce3f2', attackStyle: 'arcane', visualKind: 'frost',
    tactics: 'Niệm phép từ xa để mở rộng vùng băng và giữ quái 1,2 giây.',
    description: 'Đóng băng quái quanh mục tiêu trong 1 giây. Boss miễn nhiễm.', effect: { kind: 'freeze-area', radius: 150, duration: 1000 } },
];

const byHero = new Map(HERO_SKILLS.map(skill => [skill.heroId, skill]));
export function getHeroSkill(heroId?: string): HeroSkillDefinition {
  return byHero.get(heroId ?? 'soldier') ?? byHero.get('soldier')!;
}
