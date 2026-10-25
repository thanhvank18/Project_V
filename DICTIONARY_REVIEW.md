# Kiểm duyệt từ điển — 2026-10-24-64589

> Lưu trữ kết quả của nguồn Wiktionary cũ. Từ ngày 25/10/2026, game dùng CSV trong `Dic`; các số liệu và bản sửa dưới đây không mô tả kho CSV hiện tại. Xem [DICTIONARY_SOURCES.md](DICTIONARY_SOURCES.md) và `public/vocabulary/csv-import-report.json` cho nguồn đang dùng. Bản sửa chính tả cũ chỉ hỗ trợ chuyển tiếp khóa lịch sử, không ghi đè nghĩa CSV.

Trạng thái: **Đang thực hiện, chưa hoàn tất toàn bộ từ điển**.

| Phạm vi | Số mục |
| --- | ---: |
| Kho nhập gốc | 64.589 |
| Đã đọc nghĩa/từ loại theo các khoảng ghi nhận | 64.589 |
| Chưa đọc trong các khoảng ghi nhận | 0 |
| Có bản sửa được áp dụng | 8.170 |
| Nghi vấn còn cần giải quyết | 39 |
| Headword sửa chính tả | 924 |
| Bản sai được gộp vào headword đã tồn tại | 507 |
| Mục xác nhận gắn nhầm ngôn ngữ hoặc không phải mục từ, đã loại có nguồn | 8 |
| Đáp án trong JSON sau biên tập | 64.074 |

Số đã đọc không đồng nghĩa đã xác minh mọi mục đều đúng: mục còn nghi vấn được liệt kê riêng. Một số lỗi đã biết được sửa ngoài khoảng đọc tuần tự; chúng được ghi trong bản sửa nhưng không làm tăng số đã đọc theo khoảng. Không dùng kiểm tra schema/regex để khai là đã duyệt ngữ nghĩa.

Các mục chưa giải quyết vẫn được giữ trong kho. Không bịa nghĩa để làm số nghi vấn về 0. Không thu nhỏ kho về bộ từ mẫu. Chỉ loại mục đã xác nhận sai nhãn ngôn ngữ hoặc không phải mục từ; mỗi trường hợp có lý do, nguồn và nghĩa gốc trong exclusions. Tổng số đáp án cũng giảm khi gộp bản sai chính tả vào từ đúng đã có; khóa lịch sử cũ được giữ và không phải đáp án được chấp nhận.

Bản sửa đầy đủ, nghĩa trước/sau, lý do và nguồn đối chiếu: [editorial-corrections.json](public/vocabulary/editorial-corrections.json). Nguồn và cách tái tạo: [DICTIONARY_SOURCES.md](DICTIONARY_SOURCES.md).

## Mục còn cần xác minh

Các mục dưới đây đã được đọc và tra cứu, nhưng chưa xác định đủ chắc nghĩa hoặc cách viết để chốt bản sửa. Chúng vẫn nằm trong kho game và chưa được tính là đã giải quyết.

| Mục từ | Vấn đề còn lại |
| --- | --- |
| aclimate | Nghi headword/ghép sai; nghĩa phi khí hậu cần nguồn độc lập. |
| alfaliresistance | Có vẻ sai chính tả alkaliresistance; cần xác minh chuẩn viết liền của từ đích. |
| allocarpic | Nguồn gắn danh từ Tính tạo quả lai giống; hậu tố và nghĩa gợi tính từ, cần từ điển thực vật. |
| asynchron | Headword có vẻ dạng rút gọn chuyên ngành, cần kiểm tra tiếng Anh độc lập. |
| autophya | Nguồn xà cừ có thể thuật ngữ nhuyễn thể hiếm; cần kiểm chứng headword. |
| exulation | Nghĩa hớn hở trong nguồn có thể lỗi exultation. DOST xác nhận exulation trong Scots năm 1535 nghĩa lưu đày, nhưng chưa xác nhận nghĩa/headword tiếng Anh độc lập; không tự đổi sang exile hoặc exultation. |
| boxnote | Hộp ghi không rõ nghĩa, cần xác minh đây là headword hay tên sản phẩm. |
| cheattee | Có thể lỗi headword cheatee và đảo nghĩa người bị lừa thành kẻ lừa; cần nguồn. |
| chineet | Headword có thể lỗi Chinee; nghĩa chỉ người Hoa thiếu nhãn sắc thái, cần nguồn. |
| computerjack | Nghĩa sự khấu tặc điện toán không rõ nghĩa; cần xác minh headword và sense. |
| cragpit | Chưa xác minh được headword tiếng Anh độc lập và nghĩa hang động. Nguồn di sản chỉ chứng thực địa danh Cragpit Farm; crag pit trong địa chất là hố khai thác trầm tích, chưa đủ để đồng nhất. |
| deversion | Nghĩa nghi là diversion sai chính tả, nhưng chưa đủ chứng cứ để xác định chính xác. Tìm kiếm chủ yếu trả từ Latin deversio hoặc tự sửa thành demersion/diversion; không dùng các kết quả đó làm định nghĩa. |
| dipheser | Không tìm được nguồn tiếng Anh độc lập cho dipheser; nghĩa điện hai phân không rõ. Không tự thay bằng diphase chỉ vì giống chữ. |
| endamager | Anglo-Norman Dictionary chứng thực endamager là động từ tiếng Anglo-Norman, dẫn tiếng Anh endamage; chưa chứng thực đầu mục tiếng Anh endamager. Không tự đổi endanger vì nghĩa nguy hiểm cũng có thể là lỗi dịch. |
| epinytic | Chỉ tìm thấy các bảng thuật ngữ Anh–Việt lặp nghĩa nở ban đêm; không chứng thực được headword trong nguồn thực vật học tiếng Anh. Cả phỏng đoán epinyctic cũng chưa có nguồn. |
| esperantidist | Nguồn từ điển chuẩn xác nhận esperantist; chưa xác định esperantidist là biến thể hay lỗi. Các trang từ ngữ tự động cho etymology sai (Esperantido không nghĩa là người theo Esperanto), nên không dùng để xác nhận. |
| ethnicalism | Chỉ tìm thấy bản dịch Anh–Việt sao chép chủ nghĩa vô thần. Nghĩa ethnic cổ là ngoại giáo, không đồng nghĩa vô thần; chưa chứng thực chính đầu mục ethnicalism trong từ điển tiếng Anh độc lập. |
| evolutility | Không tìm được nguồn từ điển sinh học tiếng Anh xác nhận tính biến đổi cấu trúc. Kết quả trùng chủ yếu là nhãn phần mềm; không tự đổi evolutivity/evolvability khi chưa có căn cứ. |
| gadgete | Không nhận ra headword tiếng Anh chuẩn; nghĩa phụ tùng hỏng cần xác minh nguyên bản. |
| garder | Nghĩa thuốc thấm dầu không khớp một headword tiếng Anh phổ biến; cần xác minh nguồn. |
| glommy | Nghĩa giống chó xù Tây Ban Nha có vẻ không có cơ sở; giữ mục và cần kiểm chứng. |
| instament | Headword có vẻ hỏng từ instalment nhưng nghĩa trả tiền ngay, sản xuất kịp thời có thể nhầm just-in-time; chưa đủ căn cứ để đổi. |
| itenerancy | Có vẻ nhầm itinerancy nhưng nghĩa lặp lại lại thuộc iterance; cần xác minh trước khi chọn sửa headword hay nghĩa. |
| louded | Headword và nghĩa sai lầm không khớp; có thể sai loaded nhưng cần kiểm chứng. |
| melbow | Nghĩa cung tên làm tan chảy không có nghĩa rõ ràng; chưa xác định đây là headword hợp lệ hay lỗi chép. |
| memorance | Nghĩa màng giống membrane nhưng chưa xác minh memorance là từ cổ hay lỗi chép. |
| norocean | Nghĩa tiếng Ma rốc nhưng headword không rõ, có thể lỗi chép; chưa đủ căn cứ chuẩn hóa. |
| occulty | Nguồn danh từ sự huyền bí, có thể lỗi của occultity nhưng cần xác minh biến thể. |
| oxyopathy | Cần xác minh headword và liệu pháp oxy. |
| pantostomatic | Nghĩa chỉ Tíh từ; thuật ngữ sinh học hấp thụ khắp bề mặt. |
| paroccipitut | Nghi headword sai, nguồn mấu chẩm bên. |
| podeal | Nguồn cuống họng có thể sai thuộc chân/cuống, cần nguồn. |
| psammona | Nguồn gốc chỉ ghi số nhiều. Danh sách từ gốc Hy Lạp NJCL có psammona nhưng không định nghĩa hay xác nhận dạng số nhiều; không đủ phân biệt psammon với lỗi psammoma. |
| pterygiodus | Chưa xác định chắc đầu từ chuẩn: có thể lỗi pterygoidous hoặc một dạng chỉ có cánh khác. Không tự đổi sang một từ giải phẫu chỉ vì giống cách viết. |
| tanta | Nghĩa tantrum có thể là dạng số nhiều cũ; cần nguồn. |
| tweon | Nghĩa gấp đôi không khớp từ cổ tweón=nghi ngờ; chưa rõ headword dự định. |
| twinlex | Đèn chiếu ghép chưa tìm nguồn; giữ mục. |
| vasoiner | Có thể lỗi vasoinert nhưng chưa có nguồn headword hiếm. |
| weatherd | Chịu gió bão có thể headword weathered hoặc weatherly, cần nguồn. |

## Tiếp tục kiểm duyệt

Snapshot và checkpoint: `.impeccable/review/dictionary-full-2026-10-24/`.

- Phần 1: [0, 21529) trên 21529 mục.
- Phần 2: [0, 21530) trên 21530 mục.
- Phần 3: [0, 21530) trên 21530 mục.

Đọc các batch chưa duyệt bằng `node .impeccable/review/dictionary-full-2026-10-24/review-batch.mjs <part> <offset> <count>`, ghi checkpoint, rồi chạy `node scripts/build-dictionary-review.mjs`. Không khai phạm vi chưa đọc. Sau khi cập nhật dữ liệu, chạy các kiểm thử catalog, bản sửa và importer; chạy build khi thay đổi mã runtime.
