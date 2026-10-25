/** Compile checked review checkpoints into a portable edition; never infer review coverage. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyEditorialCorrections } from './dictionary-editorial.mjs';

export async function buildReviewedDictionary(reviewDirectory, outputDirectory) {
  const read = async name => JSON.parse(await readFile(resolve(reviewDirectory, name), 'utf8'));
  const manifest = await read('review-manifest.json');
  const bytes = await readFile(resolve(reviewDirectory, 'original-en-vi.json'));
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.inputSha256) throw new Error('Review baseline checksum mismatch');
  const original = JSON.parse(bytes);
  if (original.words.length !== manifest.total) throw new Error('Review baseline count mismatch');
  const byAnswer = new Map(original.words.map(word => [word.answer, word]));
  const reviewed = new Set();
  const corrections = new Map();
  const exclusions = [];
  const unresolved = [];
  const parts = [];
  for (const part of manifest.parts) {
    let checkpoint;
    try { checkpoint = await read(`part-${part.part}-review.json`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; continue; }
    if (checkpoint.part !== part.part) throw new Error('Review part mismatch');
    const allowed = new Set(original.words.slice(part.start, part.end).map(word => word.answer));
    for (const [start, end] of checkpoint.reviewedRanges) {
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > part.count) throw new Error('Invalid review range');
      for (let i = start; i < end; i++) {
        const answer = original.words[part.start + i].answer;
        if (reviewed.has(answer)) throw new Error(`Overlapping review ranges: ${answer}`);
        reviewed.add(answer);
      }
    }
    for (const item of [...checkpoint.corrections, ...(checkpoint.headwordCorrections ?? [])]) {
      if (!allowed.has(item.answer) || !item.reason?.trim()) throw new Error(`Correction outside assigned part: ${item.answer}`);
      const word = byAnswer.get(item.answer);
      const patch = corrections.get(item.answer) ?? {
        answer: item.answer, before: { meaning: word.meaning, partOfSpeech: word.partOfSpeech }, after: {}, reason: '', references: [],
      };
      for (const key of ['meaning', 'partOfSpeech']) if (item[key] !== undefined && item[key] !== word[key]) patch.after[key] = item[key];
      if (item.replacement) patch.after.answer = item.replacement;
      patch.reason = [patch.reason, item.reason].filter(Boolean).join(' ');
      patch.references = [...new Set([...patch.references, ...(item.references ?? [])])];
      corrections.set(item.answer, patch);
    }
    for (const item of checkpoint.exclusions ?? []) {
      if (!allowed.has(item.answer)) throw new Error(`Exclusion outside assigned part: ${item.answer}`);
      const word = byAnswer.get(item.answer);
      exclusions.push({ ...item, before: { meaning: word.meaning, partOfSpeech: word.partOfSpeech } });
    }
    for (const item of checkpoint.unresolved ?? []) {
      if (!allowed.has(item.answer) || !item.issue?.trim()) throw new Error('Invalid unresolved item');
      unresolved.push({ part: part.part, ...item });
    }
    parts.push({ part: part.part, total: part.count, reviewedRanges: checkpoint.reviewedRanges });
  }
  const remaining = original.words.length - reviewed.size;
  const edition = {
    version: 1, revision: `2026-10-24-${reviewed.size}`, sourceSha256: original.source.sha256,
    baselineSha256: manifest.inputSha256, license: 'CC-BY-SA-4.0',
    method: 'AI-assisted linguistic review of the explicitly recorded ranges, with dictionary/reference lookup for selected uncertain entries. Automated schema checks are not semantic verification.',
    review: { total: original.words.length, inspected: reviewed.size, notYetInspected: remaining,
      unresolved: new Set(unresolved.map(item => item.answer)).size,
      status: remaining === 0 && unresolved.length === 0 ? 'complete' : 'in-progress', parts },
    corrections: [...corrections.values()].filter(patch => Object.keys(patch.after).length).sort((a, b) => a.answer.localeCompare(b.answer, 'en')),
    unresolved, exclusions,
  };
  const result = applyEditorialCorrections(original, edition);
  const output = `${JSON.stringify(result)}\n`;
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, 'editorial-corrections.json'), `${JSON.stringify(edition, null, 2)}\n`, 'utf8');
  await writeFile(resolve(outputDirectory, 'en-vi.json'), output, 'utf8');
  await writeFile(resolve(outputDirectory, 'source-manifest.json'), `${JSON.stringify({ version: 1, ...result.source, outputBytes: Buffer.byteLength(output) }, null, 2)}\n`, 'utf8');
  const format = value => value.toLocaleString('vi-VN');
  const report = `# Kiểm duyệt từ điển — ${edition.revision}

Trạng thái: **${edition.review.status === 'complete' ? 'Đã hoàn tất phạm vi kiểm duyệt' : 'Đang thực hiện, chưa hoàn tất toàn bộ từ điển'}**.

| Phạm vi | Số mục |
| --- | ---: |
| Kho nhập gốc | ${format(edition.review.total)} |
| Đã đọc nghĩa/từ loại theo các khoảng ghi nhận | ${format(edition.review.inspected)} |
| Chưa đọc trong các khoảng ghi nhận | ${format(edition.review.notYetInspected)} |
| Có bản sửa được áp dụng | ${format(edition.corrections.length)} |
| Nghi vấn còn cần giải quyết | ${format(edition.review.unresolved)} |
| Headword sửa chính tả | ${format(result.source.editorial.renamedHeadwords)} |
| Bản sai được gộp vào headword đã tồn tại | ${format(result.source.editorial.mergedHeadwords)} |
| Mục xác nhận gắn nhầm ngôn ngữ hoặc không phải mục từ, đã loại có nguồn | ${format(result.source.editorial.excludedEntries)} |
| Đáp án trong JSON sau biên tập | ${format(result.words.length)} |

Số đã đọc không đồng nghĩa đã xác minh mọi mục đều đúng: mục còn nghi vấn được liệt kê riêng. Một số lỗi đã biết được sửa ngoài khoảng đọc tuần tự; chúng được ghi trong bản sửa nhưng không làm tăng số đã đọc theo khoảng. Không dùng kiểm tra schema/regex để khai là đã duyệt ngữ nghĩa.

Các mục chưa giải quyết vẫn được giữ trong kho. Không bịa nghĩa để làm số nghi vấn về 0. Không thu nhỏ kho về bộ từ mẫu. Chỉ loại mục đã xác nhận sai nhãn ngôn ngữ hoặc không phải mục từ; mỗi trường hợp có lý do, nguồn và nghĩa gốc trong exclusions. Tổng số đáp án cũng giảm khi gộp bản sai chính tả vào từ đúng đã có; khóa lịch sử cũ được giữ và không phải đáp án được chấp nhận.

Bản sửa đầy đủ, nghĩa trước/sau, lý do và nguồn đối chiếu: [editorial-corrections.json](public/vocabulary/editorial-corrections.json). Nguồn và cách tái tạo: [DICTIONARY_SOURCES.md](DICTIONARY_SOURCES.md).

## Mục còn cần xác minh

${unresolved.length ? `Các mục dưới đây đã được đọc và tra cứu, nhưng chưa xác định đủ chắc nghĩa hoặc cách viết để chốt bản sửa. Chúng vẫn nằm trong kho game và chưa được tính là đã giải quyết.

| Mục từ | Vấn đề còn lại |
| --- | --- |
${unresolved.map(item => `| ${item.answer} | ${item.issue.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')} |`).join('\n')}` : 'Không còn mục được đánh dấu nghi vấn trong đợt rà soát này.'}

## Tiếp tục kiểm duyệt

Snapshot và checkpoint: \`.impeccable/review/dictionary-full-2026-10-24/\`.

${parts.map(part => `- Phần ${part.part}: ${part.reviewedRanges.map(([start, end]) => `[${start}, ${end})`).join(', ')} trên ${part.total} mục.`).join('\n')}

Đọc các batch chưa duyệt bằng \`node .impeccable/review/dictionary-full-2026-10-24/review-batch.mjs <part> <offset> <count>\`, ghi checkpoint, rồi chạy \`node scripts/build-dictionary-review.mjs\`. Không khai phạm vi chưa đọc. Sau khi cập nhật dữ liệu, chạy các kiểm thử catalog, bản sửa và importer; chạy build khi thay đổi mã runtime.
`;
  await writeFile(resolve(outputDirectory, '../../DICTIONARY_REVIEW.md'), report, 'utf8');
  return { ...edition.review, corrections: edition.corrections.length, playableWords: result.words.length,
    renamedHeadwords: result.source.editorial.renamedHeadwords, mergedHeadwords: result.source.editorial.mergedHeadwords,
    excludedEntries: result.source.editorial.excludedEntries };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildReviewedDictionary(resolve('.impeccable/review/dictionary-full-2026-10-24'), resolve('public/vocabulary'))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
