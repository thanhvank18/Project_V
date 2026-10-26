import sourceExamples from './reviewExamples.generated.json';
import type { Word } from './types';

export interface ReviewExample { english: string; vietnamese: string; source: 'csv' | 'authored' }
type BoundExample = Omit<ReviewExample, 'source'> & Pick<Word, 'meaning' | 'partOfSpeech'>;
const source = sourceExamples as Record<string, BoundExample>;

/** Original short sentences, guarded by the exact current sense rather than spelling alone. */
const authored: Record<string, [Word['partOfSpeech'], string, string, string]> = {
  apple: ['noun', 'quả táo', 'I eat an apple every day.', 'Tôi ăn một quả táo mỗi ngày.'],
  book: ['noun', 'sách', 'This book is easy to read.', 'Cuốn sách này dễ đọc.'],
  cat: ['noun', 'con mèo', 'The cat is sleeping on the chair.', 'Con mèo đang ngủ trên ghế.'],
  dog: ['noun', 'chó', 'Our dog likes to play outside.', 'Chó của chúng tôi thích chơi ở ngoài.'],
  water: ['noun', 'nước', 'Please drink some water.', 'Hãy uống một ít nước.'],
  family: ['noun', 'gia đình, gia quyến', 'My family lives near the park.', 'Gia đình tôi sống gần công viên.'],
  friend: ['noun', 'người bạn', 'My friend is waiting outside.', 'Bạn tôi đang đợi ở bên ngoài.'],
  food: ['noun', 'đồ ăn, thức ăn, món ăn', 'The food smells very good.', 'Thức ăn có mùi rất thơm.'],
  school: ['noun', 'trường học, học đường', 'Our school has a big library.', 'Trường chúng tôi có một thư viện lớn.'],
  house: ['noun', 'nhà ở, căn nhà, toà nhà', 'Their house has a small garden.', 'Nhà của họ có một khu vườn nhỏ.'],
  health: ['noun', 'sức khoẻ', 'Walking is good for your health.', 'Đi bộ tốt cho sức khỏe của bạn.'],
  help: ['noun', 'sự giúp đỡ, sự cứu giúp, sự giúp ích', 'Thank you for your help.', 'Cảm ơn sự giúp đỡ của bạn.'],
  music: ['noun', 'nhạc, âm nhạc', 'I listen to music after work.', 'Tôi nghe nhạc sau giờ làm việc.'],
  morning: ['noun', 'buổi sáng', 'The air is cool in the morning.', 'Không khí mát mẻ vào buổi sáng.'],
  night: ['noun', 'đêm, tối, cảnh tối tăm', 'We can see the stars at night.', 'Chúng ta có thể nhìn thấy các vì sao vào ban đêm.'],
  sleep: ['noun', 'giấc ngủ; sự ngủ', 'A good sleep helps me feel better.', 'Một giấc ngủ ngon giúp tôi thấy khỏe hơn.'],
  thanks: ['noun', 'lời cảm ơn, sự cảm ơn', 'Please accept my thanks for your help.', 'Xin nhận lời cảm ơn của tôi vì sự giúp đỡ của bạn.'],
  someone: ['pronoun', 'một người nào đó, có người ((cũng) somebody)', 'Someone is knocking at the door.', 'Có người đang gõ cửa.'],
  once: ['adverb', 'một lần', 'I have visited that city once.', 'Tôi đã đến thành phố đó một lần.'],
  crazy: ['adjective', 'quá say mê', 'She is crazy about football.', 'Cô ấy rất say mê bóng đá.'],
  run: ['noun', 'sự chạy', 'I went for a run this morning.', 'Tôi đi chạy bộ sáng nay.'],
  read: ['verb', 'đọc', 'I read a book before bed.', 'Tôi đọc sách trước khi đi ngủ.'],
  write: ['verb', 'viết', 'Please write your name here.', 'Hãy viết tên của bạn ở đây.'],
  eat: ['verb', 'ăn; (từ mỹ,nghĩa mỹ) ăn cơm', 'We eat dinner together every day.', 'Chúng tôi ăn tối cùng nhau mỗi ngày.'],
  drink: ['noun', 'đồ uống, thức uống', 'Would you like a cold drink?', 'Bạn có muốn một đồ uống lạnh không?'],
  big: ['adjective', 'to, lớn', 'There is a big tree outside.', 'Có một cây lớn ở bên ngoài.'],
  small: ['adjective', 'nhỏ, bé, chật', 'I live in a small town.', 'Tôi sống ở một thị trấn nhỏ.'],
  short: ['adjective', 'ngắn, cụt', 'We took a short break.', 'Chúng tôi nghỉ một lát ngắn.'],
  long: ['adjective', 'dài (không gian, thời gian); xa, lâu', 'It was a long journey.', 'Đó là một hành trình dài.'],
  young: ['adjective', 'trẻ, trẻ tuổi, thiếu niên, thanh niên', 'The young artist painted a bird.', 'Người họa sĩ trẻ vẽ một con chim.'],
  old: ['adjective', 'già', 'The old man walks slowly.', 'Ông lão đi bộ chậm rãi.'],
  new: ['adjective', 'mới, mới mẻ, mới lạ', 'I have a new notebook.', 'Tôi có một quyển vở mới.'],
  good: ['adjective', 'tốt, hay, tuyệt', 'That is a good idea.', 'Đó là một ý hay.'],
  happy: ['adjective', 'vui sướng, vui lòng (một công thức xã giao)', 'I am happy to help you.', 'Tôi rất vui được giúp bạn.'],
  always: ['adverb', 'luôn luôn, lúc nào cũng, bao giờ cũng, mãi mãi, hoài', 'She always arrives on time.', 'Cô ấy luôn đến đúng giờ.'],
  never: ['adverb', 'không bao giờ, không khi nào', 'I never drink coffee at night.', 'Tôi không bao giờ uống cà phê vào ban đêm.'],
  because: ['conjunction', 'vì, bởi vì', 'We stayed home because it rained.', 'Chúng tôi ở nhà vì trời mưa.'],
  while: ['noun', 'lúc, chốc, lát', 'Please wait here for a while.', 'Hãy đợi ở đây một lát.'],
  work: ['noun', 'sự làm việc; việc, công việc, công tác', 'I have some work to finish.', 'Tôi có một ít công việc cần hoàn thành.'],
};

export function exampleForWord(word: Word): ReviewExample | undefined {
  const custom = authored[word.answer];
  if (custom && custom[0] === word.partOfSpeech && custom[1] === word.meaning) {
    return { english: custom[2], vietnamese: custom[3], source: 'authored' };
  }
  const example = source[word.answer];
  if (!example || example.partOfSpeech !== word.partOfSpeech || example.meaning !== word.meaning) return undefined;
  return { english: example.english, vietnamese: example.vietnamese, source: 'csv' };
}
