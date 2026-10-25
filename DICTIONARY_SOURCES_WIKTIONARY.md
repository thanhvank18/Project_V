# Bộ từ điển offline Anh–Việt

Game dùng tập dữ liệu thực, tải sẵn trong `public/vocabulary/en-vi.json`. Nguồn là các mục **tiếng Anh** trong **Wiktionary tiếng Việt**, vì vậy `word` là đáp án tiếng Anh và `senses[].glosses` là nghĩa tiếng Việt. Không đảo chiều bộ từ tiếng Việt từ Wiktionary tiếng Anh.

## Nguồn và giấy phép

- [Kaikki: Tiếng Anh](https://kaikki.org/viwiktionary/Ti%E1%BA%BFng%20Anh/index.html) công bố 119.291 dạng từ ở bản được kiểm tra ngày 22/10/2026. Đây không phải số đáp án phù hợp cho game.
- [Raw Wiktextract](https://kaikki.org/viwiktionary/rawdata.html) là JSONL cho mọi ngôn ngữ, nghĩa bằng tiếng Việt; bản nén được tải từ [raw-wiktextract-data.jsonl.gz](https://kaikki.org/viwiktionary/raw-wiktextract-data.jsonl.gz).
- Bản dump: **2026-10-02**; ngày trích xuất: **2026-10-21**. Bản nén đã tải: **34.420.749 byte**.
- SHA-256 nguồn: `dcdaf93d642ae1d1c4d495b68d90eb572fac86d00281044cf804e0d98147a25e`.
- [Wiktionary tiếng Việt quy định CC BY-SA 4.0](https://vi.wiktionary.org/wiki/Wiktionary:Quy%E1%BB%81n_t%C3%A1c_gi%E1%BA%A3). Bản dữ liệu chuyển thể trong game cũng được phân phối theo **CC BY-SA 4.0**. Xem `public/vocabulary/attribution.md` và bản giấy phép đầy đủ `LICENSE-CC-BY-SA-4.0.txt`.
- Mỗi Word giữ `sourceUrl` trỏ tới mục từ Wiktionary gốc để ghi công, xem lịch sử tác giả và kiểm tra nghĩa. `source-manifest.json` lưu nguồn, checksum, thống kê và thông báo thay đổi.

## Quy tắc nhập

`scripts/import-dictionary.mjs` đọc từng dòng raw, không nạp cả 273 MB JSONL vào bộ nhớ. Giữ **tất cả mục đạt bộ lọc**, không giới hạn 240 hay một mốc số lượng tùy ý:

1. `lang_code === 'en'`; đáp án gốc viết thường `a–z`, dài 3–18 ký tự, không khoảng trắng/dấu gạch nối/chữ số. Không chuyển tên riêng viết hoa thành từ thường.
2. Chỉ danh từ (`noun`), động từ (`verb`), tính từ (`adj` → `adjective`).
3. Loại metadata của dạng biến thể, viết tắt, nghĩa cổ/lỗi thời, thiếu nghĩa, lỗi Lua và nhãn tục/xúc phạm; bổ sung danh sách nhỏ những từ tục rõ ràng bị thiếu nhãn trong nguồn. Đây không phải bộ kiểm duyệt độ tuổi toàn diện. Loại nghĩa chỉ dẫn chiếu như “Như…”, “Của…”, “Dạng viết khác…”, hoặc hướng dẫn chia động từ.
4. Chọn nghĩa hợp lệ đầu tiên theo thứ tự nguồn; với đường dẫn nghĩa lồng nhau, dùng nghĩa cuối. Nghĩa phải có dấu hiệu tiếng Việt trong phần nội dung, dài tối đa 120 ký tự. Không cắt cụt câu nghĩa. Chuẩn hóa khoảng trắng và dấu phân cách thừa đầu câu; lọc mã wiki/HTML còn sót và nghĩa lộ nguyên đáp án.
5. Mỗi đáp án chỉ một mục; giữ mục hợp lệ đầu tiên. Không thêm các dạng số nhiều/chia động từ vào `alternatives`.
6. Gán độ khó cơ học theo độ dài: 3–5 = 1, 6–8 = 2, 9–18 = 3. Đây là độ khó gõ của game, **không phải CEFR**. Category lấy từ loại.
7. Bộ 240 từ tự biên soạn của dự án được loader ưu tiên khi trùng đáp án. Tổng runtime vì vậy có thể khác số mục trong JSON nhập.

Không sao chép ví dụ trích dẫn, hình ảnh hoặc âm thanh. Phần nhập ban đầu dùng dữ liệu Wiktionary; từ ngày 24/10/2026, dự án có thêm lớp biên tập với trợ giúp của AI và đối chiếu nguồn từ điển/tài liệu chuyên ngành cho các mục chưa chắc. Đây không phải chứng nhận rằng toàn bộ kho đã chính xác. Các bản sửa và phạm vi thực sự đã đọc được ghi trong `public/vocabulary/editorial-corrections.json`.

## Kết quả bản nhập gốc, trước biên tập

| Chỉ số | Số lượng |
| --- | ---: |
| Bản ghi raw toàn bộ ngôn ngữ | 425.353 |
| Bản ghi tiếng Anh | 133.548 |
| Bản ghi qua bộ lọc, trước gộp | 74.462 |
| Đáp án duy nhất đã nhập | 64.589 |
| Từ dài ít nhất 7 ký tự | 50.844 |
| Danh từ / tính từ / động từ | 40.102 / 19.019 / 5.468 |
| Độ khó 1 / 2 / 3 | 7.249 / 23.845 / 33.495 |

Ví dụ: `dictionary` → “Từ điển.”; `environment` → “Môi trường, hoàn cảnh, những vật xung quanh.”; `astronomy` → “Thiên văn học.”; `responsibility` → “Trách nhiệm.”; `learn` → “Học, học tập, nghiên cứu, tìm hiểu.”

Đã kiểm tra schema, đáp án duy nhất, nguồn từng từ, giới hạn độ dài, mẫu nghĩa thường gặp và mẫu ngẫu nhiên. Bộ lọc là kiểm tra máy, không phải biên tập ngữ nghĩa 64.589 mục. Xem [DICTIONARY_REVIEW.md](DICTIONARY_REVIEW.md) và `source-manifest.json` để biết số mục đang dùng, phạm vi kiểm duyệt và phần chưa giải quyết. Điều kiện có dấu tiếng Việt cũng loại một số nghĩa đúng nhưng hoàn toàn không dấu.

## Lớp sửa nghĩa, từ loại và chính tả

- `editorial-corrections.json` lưu nghĩa/từ loại cũ (`before`), bản sửa (`after`), lý do, nguồn đối chiếu nếu có, các khoảng đã đọc và các nghi vấn chưa giải quyết. Không tính kiểm tra schema là kiểm duyệt ngữ nghĩa; không tự đánh dấu phần chưa đọc là đã duyệt.
- `scripts/dictionary-editorial.mjs` kiểm tra checksum nguồn và giá trị cũ của từng mục trước khi áp dụng. Nếu nguồn thay đổi, dừng để rà lại bản sửa, không âm thầm ghi đè. Category được cập nhật cùng POS; thống kê luôn tính lại từ dữ liệu cuối.
- Mục sai chính tả được chuyển sang headword đúng. Nếu headword đúng đã có, hai mục được gộp; vì vậy tổng đáp án có thể giảm. Đây là loại bản sao do lỗi chính tả, không phải cắt bỏ mục chưa kiểm chứng.
- `historyAliases` lưu headword cũ để từ đã gặp không xuất hiện lại sau khi sửa chính tả. Khóa cũ không trở thành đáp án được chấp nhận. Lịch sử điểm/trận không bị xóa; sổ từ dùng nghĩa mới và nhận biết khóa lịch sử cũ.
- Game hỗ trợ các nhãn từ loại bổ sung khi biên tập phát hiện trạng từ, giới từ, đại từ, liên từ, thán từ, từ hạn định hoặc số từ bị gán nhầm. Bộ lọc nguồn nhập ban đầu vẫn giữ ba loại cũ để bản gốc tái tạo được.
- Bộ 240 từ tự biên soạn đã được đọc lại nghĩa/từ loại trong đợt này; vẫn ghi đè các đáp án trùng từ điển nhập.

## Nhập lại và cập nhật

Yêu cầu Node.js 20 trở lên, không cần thư viện/API key:

```powershell
node scripts/import-dictionary.mjs --input C:/duong-dan/raw-wiktextract-data.jsonl.gz
node node_modules/vitest/vitest.mjs run scripts/import-dictionary.test.mjs
```

Lệnh nhập lại tự áp dụng `public/vocabulary/editorial-corrections.json` và xuất kèm bản sửa. Khi đang tiếp tục đợt kiểm duyệt hiện tại, tổng hợp checkpoint bằng:

```powershell
node scripts/build-dictionary-review.mjs
```

Lệnh này đọc snapshot bất biến và các `part-N-review.json` tại `.impeccable/review/dictionary-full-2026-10-24/`, kiểm tra checksum, rồi tạo lại JSON, manifest, bản sửa và báo cáo. Khi chuyển máy cần giữ thư mục checkpoint này để tiếp tục rà; bản sửa public đủ để tái tạo từ raw nguồn đã ghim.

Để tải nguồn trực tiếp, dùng `node scripts/import-dictionary.mjs --download`. URL upstream thay đổi nội dung theo lần cập nhật. Importer mặc định kiểm tra checksum đã ghim để **không ghi sai ngày snapshot cho một bản mới**; nếu nguồn đã đổi, dừng với lỗi checksum và giữ dữ liệu đang dùng. Khi chủ động nâng bản, kiểm tra ngày dump/trích xuất trên Kaikki, cập nhật `SOURCE`, `PINNED_SOURCE_SHA256`, thống kê và tài liệu. `--expected-sha256` cho phép kiểm tra một checksum mới đã xác minh.

Chỉ viết bộ đầu ra sau khi toàn bộ nguồn parse thành công. Raw tải về ở thư mục tạm, không đưa 273 MB raw vào repository. Game chỉ đọc JSON local khi khởi động; không gọi dịch vụ từ điển trong trận. Bản JSON, manifest, ghi công và giấy phép phải được đóng gói cùng nhau khi build/phân phối.
