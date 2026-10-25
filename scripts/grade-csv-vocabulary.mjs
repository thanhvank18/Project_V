/** Reproducible estimated learning levels; never translations or inferred POS. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const FREQUENCY_SOURCE = JSON.parse(readFileSync(new URL('../assets/dictionary-grading/frequency-source.json', import.meta.url), 'utf8'));
export const GRADING_METHOD = {
  version: 'frequency-sense-2',
  name: 'Estimated game learning levels from subtitle commonness and source-sense complexity',
  rankBands: [500, 1500, 3500, 7000, 12000, 20000, 35000, 50000],
  absentBaseLevel: 9,
  lootMapping: 'levels 1–3 => difficulty 1; 4–6 => 2; 7–10 => 3',
  basicSenseSelection: 'For the small authored starter set, prefer only an already present CSV sense matching both the basic-meaning guard and an allowed explicit source POS; audit every changed selection. Otherwise retain source meaning and apply a non-basic-sense floor where needed.',
  limitation: 'Heuristic ordering, not CEFR, a validated learning assessment, or a semantic review of every CSV definition. Frequency refers to the English token; explicit source labels and basic-sense guards adjust sense-level difficulty.',
  penalties: {
    technicalDomain: { add: 2, minimum: 4 }, subjectDomain: { add: 1, minimum: 3 },
    archaic: { add: 2, minimum: 7 }, literary: { add: 1, minimum: 5 }, slang: { add: 1, minimum: 4 },
    abbreviation: { add: 1, minimum: 6 }, affix: { add: 1, minimum: 7 }, unspecifiedPOS: { add: 1, minimum: 4 },
    knownStarterNonBasicSense: { add: 0, minimum: 4 },
    length: '10–13 letters adds 1 only when frequency base >=3; 14–18 adds 2. Common top-1500 tokens receive no length penalty.',
  },
};

export function parseFrequencyData(text) {
  const result = new Map(); let rank = 0;
  for (const line of text.trim().split(/\r?\n/u)) {
    rank++;
    const match = /^(\S+)\s+(\d+)$/u.exec(line);
    if (!match || Number(match[2]) <= 0) throw new Error(`Invalid frequency row ${rank}`);
    const word = match[1].toLowerCase();
    if (!result.has(word)) result.set(word, { rank, count: Number(match[2]) });
  }
  return result;
}

let defaultFrequency;
export function getDefaultFrequency() {
  if (!defaultFrequency) {
    const bytes = readFileSync(new URL('../assets/dictionary-grading/en_50k-2018.txt', import.meta.url));
    if (createHash('sha256').update(bytes).digest('hex') !== FREQUENCY_SOURCE.sha256) throw new Error('Frequency data checksum mismatch');
    defaultFrequency = parseFrequencyData(bytes.toString('utf8'));
    if (defaultFrequency.size !== FREQUENCY_SOURCE.entries) throw new Error('Frequency entry count mismatch');
  }
  return defaultFrequency;
}

// These small authored guards identify familiar BASIC senses, not replacement definitions.
// The original CSV meaning and POS are always retained, including when a guard does not match.
const STARTERS = {
  apple: /^quả táo(?:$|[,;])/u, water: /^nước(?:$|[,;])/u, learn: /^học(?:$|[,;])/u,
  cat: /^con mèo(?:$|[,;])/u, dog: /^chó(?:$|[,;])/u, bird: /^(?:con )?chim(?:$|[,;])/u,
  fish: /^cá(?:$|[,;])/u, horse: /^ngựa(?:$|[,;])/u, cow: /^bò(?: cái)?(?:$|[,;])/u,
  sheep: /^(?:con )?cừu(?:$|[,;])/u, elephant: /^con voi(?:$|[,;])/u, rabbit: /^(?:con )?thỏ(?:$|[,;])/u,
  banana: /^(?:quả chuối|cây chuối)(?:$|[,;])/u, orange: /^(?:cam|quả cam|cây cam)(?:$|[,;])/u,
  bread: /^bánh mì(?:$|[,;])/u, rice: /^(?:lúa|gạo|cơm)(?:$|[,;])/u, milk: /^sữa(?:$|[,;])/u,
  egg: /^trứng(?:$|[,;])/u, salt: /^muối(?:$|[,;])/u, meat: /^thịt(?:$|[,;])/u,
  fruit: /^quả(?:$|[,;])/u, flower: /^hoa(?:$|[,;])/u, tree: /^cây(?:$|[,;])/u,
  grass: /^cỏ(?:$|[,;])/u, leaf: /^lá(?: cây)?(?:$|[,;])/u, sun: /^mặt trời(?:$|[,;])/u,
  moon: /^mặt trăng(?:$|[,;])/u, rain: /^mưa(?:$|[,;])/u, snow: /^tuyết(?:$|[,;])/u,
  river: /^(?:dòng )?sông(?:$|[,;])/u, sea: /^biển(?:$|[,;])/u, mountain: /^núi(?:$|[,;])/u,
  school: /^trường(?: học| sở)?(?:$|[,;])/u, teacher: /^(?:thầy giáo|giáo viên)(?:$|[,;])/u, student: /^(?:sinh viên|học sinh(?: đại học)?)(?:$|[,;])/u,
  book: /^sách(?:$|[,;])/u, pen: /^bút(?:$|[,;])/u, pencil: /^bút chì(?:$|[,;])/u,
  paper: /^giấy(?:$|[,;])/u, table: /^(?:cái )?bàn(?:$|[,;])/u, chair: /^ghế(?:$|[,;])/u,
  house: /^nhà(?: ở)?(?:$|[,;])/u, door: /^cửa(?:$|[,;])/u, window: /^cửa sổ(?:$|[,;])/u,
  bed: /^(?:cái )?giường(?:$|[,;])/u, room: /^(?:buồng|phòng)(?:$|[,;])/u, road: /^(?:con )?đường(?:$|[,;])/u,
  bridge: /^(?:cái )?cầu(?:$|[,;])/u,
  car: /^(?:xe ô tô|ô tô|xe hơi)(?:$|[,;])/u, bus: /^xe (?:buýt|buyt)(?:$|[,;])/u,
  train: /^xe lửa(?:$|[,;])/u, bicycle: /^xe đạp(?:$|[,;])/u,
  red: /^(?:đỏ|màu đỏ)(?:$|[,;])/u, blue: /^(?:xanh|màu xanh)(?: |$|[,;])/u,
  green: /^(?:xanh|màu xanh)(?: |$|[,;])/u, yellow: /^(?:vàng|màu vàng)(?:$|[,;])/u,
  black: /^đen(?:$|[,;])/u, white: /^trắng(?:$|[,;])/u,
  happy: /^(?:sung sướng|vui sướng|vui lòng)(?:$|[,;])/u, sad: /^buồn(?: rầu| bã)?(?:$|[,;])/u,
  big: /^to(?:$|[,;])/u, small: /^nhỏ(?:$|[,;])/u,
  read: /^đọc(?:$|[,;])/u, write: /^viết(?:$|[,;])/u, speak: /^nói(?:$|[,;])/u,
  listen: /^nghe(?:$|[,;])/u, eat: /^ăn(?:$|[,;])/u, drink: /^(?:uống|đồ uống|thức uống)(?:$|[,;])/u,
  sleep: /^(?:ngủ|giấc ngủ|sự ngủ)(?:$|[,;])/u, walk: /^(?:sự )?đi bộ(?:$|[,;])/u,
};

export const BASIC_STARTER_WORDS = Object.keys(STARTERS);
const VERB_STARTERS = new Set(['learn', 'read', 'write', 'speak', 'listen', 'eat']);
const NOUN_OR_VERB_STARTERS = new Set(['drink', 'sleep', 'walk']);
const ADJECTIVE_STARTERS = new Set(['happy', 'sad', 'big', 'small']);
const COLOR_STARTERS = new Set(['red', 'blue', 'green', 'yellow', 'black', 'white']);
function validStarterPos(answer, partOfSpeech) {
  if (partOfSpeech === undefined) return true;
  if (VERB_STARTERS.has(answer)) return partOfSpeech === 'verb';
  if (NOUN_OR_VERB_STARTERS.has(answer)) return partOfSpeech === 'noun' || partOfSpeech === 'verb';
  if (ADJECTIVE_STARTERS.has(answer)) return partOfSpeech === 'adjective';
  if (COLOR_STARTERS.has(answer)) return partOfSpeech === 'noun' || partOfSpeech === 'adjective';
  return partOfSpeech === 'noun';
}
export function basicSenseMatches(answer, meaning, partOfSpeech) {
  const plain = meaning.normalize('NFC').toLowerCase().replace(/^(?:\([^)]*\)\s*)+/u, '').trim();
  return Object.hasOwn(STARTERS, answer) ? validStarterPos(answer, partOfSpeech) && STARTERS[answer].test(plain) : undefined;
}

function sourceSenseFlags(fullMeaning) {
  const labels = [...fullMeaning.normalize('NFC').toLowerCase().matchAll(/\(([^)]*)\)/gu)].map(match => match[1]).join(' | ');
  const technical = /giải ph[ẫẩ]u|y học|bệnh lý|sinh lý|toán|hoá học|hóa học|vật lý|cơ khí|điện tử|tin học|máy tính|kỹ thuật|quân sự|hàng hải|hàng không|pháp lý|kinh tế|nhiếp ảnh|đánh bài|trò chơi bài|bài brit|\becon\b|\btech\b/u.test(labels);
  return {
    labels, technical,
    subject: !technical && /động vật|sinh vật|thực vật|địa lý|địa chất|âm nhạc|thể dục|thể thao|tôn giáo|triết học|ngôn ngữ|ngữ pháp/u.test(labels),
    archaic: /từ cổ|nghĩa cổ|cổ ngữ|lỗi thời|ít dùng|không còn dùng/u.test(labels),
    literary: /thơ ca|văn chương|văn học/u.test(labels),
    slang: /từ lóng|tiếng lóng/u.test(labels),
  };
}

/** Choose only an already present, explicitly labelled CSV sense for a known basic headword. */
export function preferredBasicSourceSense(answer, senses) {
  if (!Object.hasOwn(STARTERS, answer)) return undefined;
  return senses.find(sense => {
    if (!sense.meaning || !basicSenseMatches(answer, sense.fullMeaning ?? sense.meaning, sense.partOfSpeech)) return false;
    const flags = sourceSenseFlags(sense.fullMeaning ?? sense.meaning);
    return !flags.technical && !flags.archaic && !flags.literary && !flags.slang;
  });
}

export function lootDifficultyForLevel(level) { return level <= 3 ? 1 : level <= 6 ? 2 : 3; }

export function gradeWord(word, frequency = getDefaultFrequency(), fullMeaning = word.meaning) {
  const hit = frequency.get(word.answer);
  const index = hit ? GRADING_METHOD.rankBands.findIndex(end => hit.rank <= end) : -1;
  const baseLevel = index < 0 ? 9 : index + 1;
  let level = baseLevel;
  const reasons = [{ code: hit ? 'frequency-rank' : 'outside-frequency-top-50000', rank: hit?.rank ?? null, baseLevel }];
  const { labels, technical, subject, archaic, literary, slang } = sourceSenseFlags(fullMeaning);
  const penalize = (code, amount, minimum, detail) => { level = Math.max(minimum, level + amount); reasons.push({ code, add: amount, minimum, ...(detail ? { detail } : {}) }); };
  if (technical) penalize('technical-source-sense', 2, 4, labels);
  else if (subject) penalize('subject-labelled-source-sense', 1, 3, labels);
  if (archaic) penalize('archaic-or-rare-register', 2, 7, labels);
  else if (literary) penalize('literary-register', 1, 5, labels);
  if (slang) penalize('slang-register', 1, 4, labels);
  if (word.partOfSpeech === 'abbreviation') penalize('abbreviation', 1, 6);
  else if (['prefix', 'suffix'].includes(word.partOfSpeech)) penalize('affix', 1, 7);
  else if (word.partOfSpeech === 'unspecified') penalize('unspecified-source-pos', 1, 4);
  if (baseLevel >= 3 && word.answer.length >= 10) penalize('spelling-length', word.answer.length >= 14 ? 2 : 1, 1, `${word.answer.length} letters`);
  const guardMatch = basicSenseMatches(word.answer, fullMeaning, word.partOfSpeech);
  if (guardMatch === false) penalize('known-starter-non-basic-source-sense', 0, 4, 'Headword commonness does not establish this selected sense as a basic meaning');
  const basic = guardMatch === true && !technical && !archaic && !literary && !slang
    && !['unspecified', 'abbreviation', 'prefix', 'suffix'].includes(word.partOfSpeech);
  if (basic) { level = 1; reasons.push({ code: 'authored-basic-sense-guard', detail: 'Basic source sense matches the starter guard; no translation or POS changed' }); }
  const learningLevel = Math.max(1, Math.min(10, level));
  return { answer: word.answer, partOfSpeech: word.partOfSpeech, learningLevel, difficulty: lootDifficultyForLevel(learningLevel), frequencyRank: hit?.rank ?? null, frequencyCount: hit?.count ?? null, baseLevel, reasons };
}

export function classifyWords(words, options = {}) {
  const frequency = options.frequency ?? getDefaultFrequency();
  const byLevel = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index + 1, 0]));
  const byLevelAndPartOfSpeech = {}; const reasonCounts = {};
  let frequencyMatches = 0; let starterOverrides = 0;
  const grades = words.map(word => {
    const grade = gradeWord(word, frequency, options.fullMeanings?.get(word.answer) ?? word.meaning);
    if (grade.frequencyRank !== null) frequencyMatches++;
    byLevel[grade.learningLevel]++;
    const pos = byLevelAndPartOfSpeech[grade.learningLevel] ??= {};
    pos[grade.partOfSpeech] = (pos[grade.partOfSpeech] ?? 0) + 1;
    for (const reason of grade.reasons) { reasonCounts[reason.code] = (reasonCounts[reason.code] ?? 0) + 1; if (reason.code === 'authored-basic-sense-guard') starterOverrides++; }
    return { ...grade, meaning: word.meaning, ...(options.sourceRows?.has(word.answer) ? { sourceRow: options.sourceRows.get(word.answer) } : {}) };
  });
  const byAnswer = new Map(grades.map(grade => [grade.answer, grade]));
  return {
    words: words.map(word => ({ ...word, learningLevel: byAnswer.get(word.answer).learningLevel, difficulty: byAnswer.get(word.answer).difficulty })),
    grades: grades.sort((a, b) => a.learningLevel - b.learningLevel || a.partOfSpeech.localeCompare(b.partOfSpeech, 'en') || a.answer.localeCompare(b.answer, 'en')),
    stats: { words: words.length, frequencyMatches, outsideTop50000: words.length - frequencyMatches, starterOverrides, byLevel, byLevelAndPartOfSpeech, reasonCounts },
    method: GRADING_METHOD, frequencySource: FREQUENCY_SOURCE,
  };
}
