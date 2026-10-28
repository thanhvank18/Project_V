import type { Challenge, ChallengeKind, Word } from './types';
import { ADDITIONAL_WORDS } from './wordBank';

/** Original, manually written prototype vocabulary. Difficulty is an authored game rating, not CEFR. */
export const WORDS: Word[] = [
  { id: 'apple', answer: 'apple', meaning: 'Quả táo', category: 'Thức ăn', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'bread', answer: 'bread', meaning: 'Bánh mì', category: 'Thức ăn', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'water', answer: 'water', meaning: 'Nước uống', category: 'Thức ăn', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'milk', answer: 'milk', meaning: 'Sữa', category: 'Thức ăn', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'rice', answer: 'rice', meaning: 'Gạo / cơm', category: 'Thức ăn', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'lemon', answer: 'lemon', meaning: 'Quả chanh vàng', category: 'Thức ăn', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'carrot', answer: 'carrot', meaning: 'Củ cà rốt', category: 'Thức ăn', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'orange', answer: 'orange', meaning: 'Quả cam', category: 'Thức ăn', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'cat', answer: 'cat', meaning: 'Con mèo', category: 'Động vật', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'dog', answer: 'dog', meaning: 'Con chó', category: 'Động vật', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'bird', answer: 'bird', meaning: 'Con chim', category: 'Động vật', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'fish', answer: 'fish', meaning: 'Con cá', category: 'Động vật', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'tiger', answer: 'tiger', meaning: 'Con hổ', category: 'Động vật', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'rabbit', answer: 'rabbit', meaning: 'Con thỏ', category: 'Động vật', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'horse', answer: 'horse', meaning: 'Con ngựa', category: 'Động vật', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'elephant', answer: 'elephant', meaning: 'Con voi', category: 'Động vật', partOfSpeech: 'noun', difficulty: 3 },
  { id: 'sun', answer: 'sun', meaning: 'Mặt trời', category: 'Thiên nhiên', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'moon', answer: 'moon', meaning: 'Mặt trăng', category: 'Thiên nhiên', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'star', answer: 'star', meaning: 'Ngôi sao', category: 'Thiên nhiên', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'rain', answer: 'rain', meaning: 'Mưa', category: 'Thiên nhiên', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'cloud', answer: 'cloud', meaning: 'Đám mây', category: 'Thiên nhiên', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'river', answer: 'river', meaning: 'Dòng sông', category: 'Thiên nhiên', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'forest', answer: 'forest', meaning: 'Khu rừng', category: 'Thiên nhiên', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'flower', answer: 'flower', meaning: 'Bông hoa', category: 'Thiên nhiên', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'book', answer: 'book', meaning: 'Quyển sách', category: 'Đồ vật', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'chair', answer: 'chair', meaning: 'Cái ghế', category: 'Đồ vật', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'table', answer: 'table', meaning: 'Cái bàn', category: 'Đồ vật', partOfSpeech: 'noun', difficulty: 1 },
  { id: 'window', answer: 'window', meaning: 'Cửa sổ', category: 'Đồ vật', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'pencil', answer: 'pencil', meaning: 'Bút chì', category: 'Đồ vật', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'school', answer: 'school', meaning: 'Trường học', category: 'Địa điểm', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'garden', answer: 'garden', meaning: 'Khu vườn', category: 'Địa điểm', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'bridge', answer: 'bridge', meaning: 'Cây cầu', category: 'Địa điểm', partOfSpeech: 'noun', difficulty: 3 },
  { id: 'happy', answer: 'happy', meaning: 'Vui vẻ', category: 'Tính từ', partOfSpeech: 'adjective', difficulty: 1 },
  { id: 'hungry', answer: 'hungry', meaning: 'Đói bụng', category: 'Tính từ', partOfSpeech: 'adjective', difficulty: 2 },
  { id: 'quiet', answer: 'quiet', meaning: 'Yên tĩnh', category: 'Tính từ', partOfSpeech: 'adjective', difficulty: 3 },
  { id: 'brave', answer: 'brave', meaning: 'Dũng cảm', category: 'Tính từ', partOfSpeech: 'adjective', difficulty: 2 },
  { id: 'yellow', answer: 'yellow', meaning: 'Màu vàng', category: 'Màu sắc', partOfSpeech: 'adjective', difficulty: 2 },
  { id: 'purple', answer: 'purple', meaning: 'Màu tím', category: 'Màu sắc', partOfSpeech: 'adjective', difficulty: 3 },
  { id: 'green', answer: 'green', meaning: 'Màu xanh lá', category: 'Màu sắc', partOfSpeech: 'adjective', difficulty: 1 },
  { id: 'walk', answer: 'walk', meaning: 'Đi bộ', category: 'Động từ', partOfSpeech: 'verb', difficulty: 1 },
  { id: 'sleep', answer: 'sleep', meaning: 'Ngủ', category: 'Động từ', partOfSpeech: 'verb', difficulty: 1 },
  { id: 'listen', answer: 'listen', meaning: 'Lắng nghe', category: 'Động từ', partOfSpeech: 'verb', difficulty: 3 },
  { id: 'learn', answer: 'learn', meaning: 'Học', category: 'Động từ', partOfSpeech: 'verb', difficulty: 2 },
  { id: 'write', answer: 'write', meaning: 'Viết', category: 'Động từ', partOfSpeech: 'verb', difficulty: 3 },
  { id: 'smile', answer: 'smile', meaning: 'Mỉm cười', category: 'Động từ', partOfSpeech: 'verb', difficulty: 2 },
  { id: 'friend', answer: 'friend', meaning: 'Người bạn', category: 'Con người', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'family', answer: 'family', meaning: 'Gia đình', category: 'Con người', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'doctor', answer: 'doctor', meaning: 'Bác sĩ', category: 'Con người', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'lantern', answer: 'lantern', meaning: 'Đèn lồng', category: 'Đồ vật', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'blanket', answer: 'blanket', meaning: 'Cái chăn', category: 'Đồ vật', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'village', answer: 'village', meaning: 'Ngôi làng', category: 'Địa điểm', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'pumpkin', answer: 'pumpkin', meaning: 'Quả bí ngô', category: 'Thức ăn', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'thunder', answer: 'thunder', meaning: 'Tiếng sấm', category: 'Thiên nhiên', partOfSpeech: 'noun', difficulty: 3 },
  { id: 'chicken', answer: 'chicken', meaning: 'Con gà', category: 'Động vật', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'morning', answer: 'morning', meaning: 'Buổi sáng', category: 'Thời gian', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'mountain', answer: 'mountain', meaning: 'Ngọn núi', category: 'Thiên nhiên', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'library', answer: 'library', meaning: 'Thư viện', category: 'Địa điểm', partOfSpeech: 'noun', difficulty: 2 },
  { id: 'journey', answer: 'journey', meaning: 'Chuyến hành trình', category: 'Di chuyển', partOfSpeech: 'noun', difficulty: 3 },
  { id: 'curious', answer: 'curious', meaning: 'Tò mò', category: 'Tính từ', partOfSpeech: 'adjective', difficulty: 3 },
  { id: 'careful', answer: 'careful', meaning: 'Cẩn thận', category: 'Tính từ', partOfSpeech: 'adjective', difficulty: 2 },
  ...ADDITIONAL_WORDS,
];

export const PART_OF_SPEECH_LABELS: Record<Word['partOfSpeech'], string> = {
  noun: 'Danh từ', verb: 'Động từ', adjective: 'Tính từ',
  adverb: 'Trạng từ', preposition: 'Giới từ', pronoun: 'Đại từ', conjunction: 'Liên từ',
  interjection: 'Thán từ', determiner: 'Từ hạn định', numeral: 'Số từ',
  prefix: 'Tiền tố', suffix: 'Hậu tố', abbreviation: 'Viết tắt',
  unspecified: 'Chưa rõ từ loại',
};

export function lootChanceFor(word: Word): number {
  return { 1: .15, 2: .30, 3: .45 }[word.difficulty];
}

export const CHALLENGE_NAMES: Record<ChallengeKind, string> = {
  scramble: 'XẾP CHỮ', missing: 'ĐIỀN CHỮ', translate: 'VIỆT → ANH', hint: 'NGHĨA + GỢI Ý', fill: 'ĐIỀN TỪ',
};

export function answersFor(word: Word): string[] {
  return [...new Set([word.answer, ...(word.alternatives ?? [])].map((value) => value.toLowerCase()))];
}

export function historyKeysFor(word: Word): string[] {
  return [...new Set([...answersFor(word), ...(word.historyAliases ?? [])].map(value => value.trim().toLowerCase()))];
}

export function createChallenge(word: Word, kind: ChallengeKind, id: number, rng = Math.random): Challenge {
  if (word.customQuestion && word.customQuestion.type !== 'mixed') kind = word.customQuestion.type;
  const letters = [...word.answer];
  const hint = word.translationHint ?? letters.map((letter, index) => index === 0 || index === letters.length - 1 ? letter : '_').join(' ');
  let prompt = word.meaning;
  if (kind === 'fill') {
    prompt = word.customQuestion?.sentence ?? word.meaning;
  } else if (kind === 'scramble') {
    for (let index = letters.length - 1; index > 0; index--) {
      const other = Math.floor(Math.max(0, Math.min(0.999999, rng())) * (index + 1));
      [letters[index], letters[other]] = [letters[other], letters[index]];
    }
    if (letters.join('') === word.answer && new Set(letters).size > 1) {
      const other = letters.findIndex((letter) => letter !== letters[0]);
      [letters[0], letters[other]] = [letters[other], letters[0]];
    }
    prompt = letters.join(' / ');
  } else if (kind === 'missing') {
    const distinguishing = word.translationHint?.split(' ');
    prompt = letters.map((letter, index) => index % 2 === 1 && distinguishing?.[index] !== letter ? '_' : letter).join(' ');
  }
  return { id, word, kind, prompt, hint, credited: new Set(), mistakes: 0, assisted: false };
}
