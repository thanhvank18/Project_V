# Nguồn từ điển đang sử dụng

Từ ngày **25/10/2026**, game sử dụng file **English - Vietnamese.csv** trong thư mục `Dic`, do người dùng cung cấp.

- [Dữ liệu câu đố hiện tại](./en-vi.json)
- [Thông tin nguồn và checksum](./source-manifest.json)
- [Báo cáo chuyển đổi CSV](./csv-import-report.json)
- [Bảng từ theo từ loại và độ khó](./learning-levels.csv)

File chứa từ tiếng Anh, phiên âm, từ loại và nghĩa tiếng Việt. Quá trình nhập chuẩn hóa Unicode, tách phiên âm khỏi đầu mục, chọn một nghĩa phù hợp độ dài và gộp đáp án trùng. Chỉ các từ đơn `a–z` dài 3–18 ký tự được đưa vào cơ chế nhập hiện tại. Cụm từ/mục không phù hợp được thống kê trong báo cáo; CSV gốc giữ nguyên. Không tự dịch lại hoặc dùng bộ từ mẫu cũ ghi đè nghĩa CSV.

Nội dung CSV không kèm thông tin tác giả hoặc giấy phép. Game ghi nguồn là file cục bộ, không gán giấy phép hay liên kết Wiktionary cho dữ liệu này. Đây là ghi nhận xuất xứ hiện có, không phải chứng nhận mọi mục từ đã chính xác.

## Dữ liệu tham khảo xếp độ khó

Tần suất tiếng Anh lấy từ [FrequencyWords English 2018](https://github.com/hermitdave/FrequencyWords/tree/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018/en) của Hermit Dave, xây dựng từ OpenSubtitles2018. Nội dung danh sách được ghi công theo [CC BY-SA 4.0](./LICENSE-CC-BY-SA-4.0.txt). Dự án dùng dữ liệu tần suất để tạo 10 bậc nội bộ, bổ sung điều chỉnh theo độ phức tạp và nhãn nghĩa trong CSV. Đây không phải phân loại CEFR. Nguồn tần suất không cung cấp hoặc thay thế nghĩa Việt, và không xác định giấy phép của CSV người dùng cung cấp.

## Tư liệu nguồn trước

Bản game trước dùng Wiktionary tiếng Việt qua Kaikki/Wiktextract. Dữ liệu và bản sửa thuộc nguồn đó được ghi công cho những người đóng góp Wiktionary theo [CC BY-SA 4.0](./LICENSE-CC-BY-SA-4.0.txt). [Nhật ký biên tập cũ](./editorial-corrections.json) được giữ để đối chiếu và chuyển tiếp lịch sử chính tả; nghĩa cũ không ghi đè CSV hiện tại.

