# Từ điển CSV hiện tại — 25/10/2026

Game dùng **`Dic/English - Vietnamese.csv` do người dùng cung cấp** làm nguồn từ vựng. Dữ liệu được chuyển thành `public/vocabulary/en-vi.json` trước khi chạy; không gọi dịch vụ dịch/từ điển trong trận. CSV là nguồn nghĩa và từ loại hiện tại, không bị 240 mục mẫu cũ ghi đè.

Bản nhập ngày 25/10/2026: **103.864 dòng nguồn → 70.696 đáp án duy nhất**, trong đó 55.245 từ dài ít nhất 7 ký tự phục vụ giáp/Boss. Có 2.840 mục chưa ghi từ loại trong nguồn. Toàn bộ dòng bị lọc vẫn có trong bản lưu và báo cáo; không chỉnh sửa file CSV gốc.

## Định dạng nguồn

File có BOM UTF-16LE, hai trường `english` và `vietnamese_analytics`. Phiên âm có thể nằm trong ngoặc vuông sau headword; dấu phẩy có thể xuất hiện trong phiên âm và phần nghĩa. Ký tự `|` phân tách nhãn từ loại, nghĩa và ví dụ. Không split toàn bộ dòng theo dấu phẩy hoặc coi mọi nội dung trong ngoặc vuông là phiên âm.

Importer chuẩn Unicode NFC. Từ loại và nghĩa được ghép trong cùng nhóm nguồn; không gán nghĩa động từ cho nhãn danh từ ở nhóm trước. CSV gốc được giữ nguyên; mọi dòng và quyết định nhập được lưu tại `assets/dictionary-csv/full-entries.jsonl.gz`.

## Phạm vi gameplay

- Chỉ đáp án một từ `a–z` dài 3–18 ký tự tương thích cách nhập hiện tại. Cụm từ, gạch nối, chữ số và mục ngoài phạm vi được thống kê riêng.
- Gỡ phiên âm khỏi headword; không tự dịch lại bằng AI hoặc sửa thành một từ khác để tăng số lượng.
- Chọn một nghĩa Việt đầy đủ tối đa 120 ký tự theo ranh giới nghĩa; không cắt dở định nghĩa. Với nhóm từ cơ bản có quy tắc nhận diện nghĩa quen thuộc, ưu tiên nghĩa đó khi chính CSV cung cấp, giữ đúng từ loại đi cùng; mọi lần đổi lựa chọn nghĩa được ghi trong báo cáo.
- Dùng từ loại thực có trong CSV. Mục có nghĩa rõ nhưng thiếu nhãn dùng **Chưa rõ từ loại**, không đoán thành danh từ.
- Gộp đáp án trùng; ưu tiên mục có từ loại đầy đủ hơn mục viết tắt/thiếu từ loại, rồi mục có phiên âm đầy đủ, sau đó giữ thứ tự nguồn. Không thêm biến thể làm alias đáp án. Mục chỉ dẫn chiếu hoặc thiếu nghĩa độc lập được báo rõ.
- Mỗi từ có bậc học 1–10 theo mức thông dụng tham khảo và độ phức tạp; ba nhóm loot gom bậc 1–3, 4–6, 7–10. Không dùng riêng độ dài để quyết định từ dễ, và không gọi đây là CEFR.

Số dòng nguồn, số đáp án dùng được, các nhóm loại trừ, mẫu đối chiếu và checksum nằm trong `public/vocabulary/csv-import-report.json` và `source-manifest.json`. Dùng CSV không có nghĩa mọi dòng tương thích kiểu nhập một từ, hoặc mọi nghĩa đã được biên tập thủ công.

Các trường hợp phục hồi cú pháp nguồn được ghi riêng trong báo cáo và bản lưu từng dòng. Bộ nhập bỏ chú thích phiên âm, biến tố và ví dụ khi chọn nghĩa; không lấy nhãn lĩnh vực đứng một mình làm định nghĩa. Lỗi dịch hoặc lỗi gõ vốn nằm trong nội dung CSV vẫn cần kiểm duyệt nội dung riêng.

## Giữ tiến trình

Lịch sử và kết quả lưu theo đáp án chuẩn hóa, không theo dòng CSV hay ID nguồn cũ. Từ trùng giữa hai nguồn vẫn được nhận biết là đã gặp. Khóa sửa chính tả cũ chỉ giữ làm `historyAliases` khi không xung đột đầu mục CSV; không trở thành đáp án hợp lệ hoặc ghi đè nghĩa CSV. Không xóa localStorage/IndexedDB khi cập nhật.

Game dùng toàn bộ bank hợp lệ sau nhập; điều kiện thắng vẫn là hết từ mới rồi dọn sạch địch/đạn còn lại. Gợi ý cho câu Việt → Anh độc lập với việc có liên kết nguồn, tránh mất hint khi dùng từ điển cục bộ.

## Phân loại từ loại và độ khó

Toàn bộ mục được nhập đều đi qua bước xếp bậc, bao gồm mục chưa xác định từ loại. Từ loại vẫn lấy từ nhóm nghĩa CSV; trường hợp không có nhãn rõ giữ “Chưa rõ từ loại”, không đoán dựa trên đuôi từ. Bậc tham khảo tần suất tiếng Anh từ FrequencyWords, có điều chỉnh theo độ dài và các nhãn chuyên ngành, cổ, viết tắt, thiếu từ loại. Một số từ cơ bản có nghĩa tương ứng rõ được đưa về nhóm khởi đầu; không thay bản dịch bằng bộ từ mẫu.

Nguồn tần suất là [FrequencyWords English 2018](https://github.com/hermitdave/FrequencyWords/tree/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018/en) của Hermit Dave, tổng hợp từ OpenSubtitles2018. Nội dung danh sách được tác giả ghi CC BY-SA 4.0; mã nguồn MIT. Dự án giữ dữ liệu và provenance riêng trong `assets/dictionary-grading/`. Tần suất phụ đề chỉ là tín hiệu xếp bậc; từ không nằm trong top 50.000 được ghi là không có dữ liệu, không tự gán thứ hạng giả. Giấy phép này áp dụng nguồn tần suất, không xác định giấy phép của CSV nghĩa Việt.

Tiến trình học bắt đầu lại ở bậc 1 mỗi trận, tăng sau 20 từ hoàn thành, tối đa 10 bậc; không xóa lịch sử từ. Khi nhóm dễ đã hết từ mới, ưu tiên nhóm gần nhất còn từ. Từ dài dành cho tập Boss có thể vượt bậc và được thông báo trong game.

`public/vocabulary/learning-levels.csv` là bảng toàn bộ từ đã phân loại, sắp theo bậc → từ loại → đáp án, có lý do xếp bậc. `assets/dictionary-grading/word-grades.jsonl.gz` giữ bản audit chi tiết; `csv-import-report.json` tổng hợp số từ theo từng bậc và từ loại. File gốc trong `Dic` không bị sửa.

## Nguồn và ghi công

CSV không kèm tác giả hoặc giấy phép trong nội dung cung cấp. Metadata ghi xuất xứ cục bộ và checksum; không gán Wiktionary/Kaikki, CC BY-SA hoặc liên kết tra từ giả cho mục CSV. UI chỉ hiện liên kết từng từ khi có URL hợp lệ.

Tư liệu/giấy phép Wiktionary và bản sửa cũ được giữ cho nguồn trước, xem `DICTIONARY_SOURCES_WIKTIONARY.md`. Chúng không xác định giấy phép hoặc nghĩa của CSV mới.

## Tái tạo

```powershell
node scripts/import-csv-dictionary.mjs
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
```

Importer xuất JSON runtime cùng báo cáo. Vite bỏ theo dõi thư mục nguồn `Dic` để tránh lỗi Windows khóa file; JSON runtime vẫn được phục vụ bình thường. Game kiểm tra JSON trước khi mở menu; dữ liệu lỗi hiện nút thử lại, không tự quay về bộ 240 từ mẫu.

