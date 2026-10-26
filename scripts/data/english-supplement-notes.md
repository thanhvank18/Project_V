# Phạm vi bổ sung ngày 2026-10-26

`english-supplement.json` ghi lại phần được duyệt riêng trong nhóm mục từ chưa khớp nguồn tiếng Anh: 575 sửa chính tả, 150 cặp nghĩa Anh–Việt và 9 mục thiếu dấu nháy. 141 từ viết đúng chưa có trong kho cũ được bổ sung bằng nghĩa và từ loại đã đối chiếu. Các số này không có nghĩa toàn bộ 70 nghìn mục đã được kiểm chứng ngữ nghĩa.

Các sửa chính tả phải giữ lịch sử bằng `historyAliases`. Khi từ đúng đã có, gộp từ sai vào mục đúng; khi chưa có, dùng bản ghi song ngữ tương ứng trong `entries`. Không tạo một mục mới cho mỗi alias.

Việc kiểm tra nghĩa đã tránh được các ghép sai do chỉ nhìn hình thức chữ: `decamter` → `decameter` (10 mét), `commondo` → `commode` (tủ), `contradication` → `contraindication` (chống chỉ định), `itenerancy` → `iterancy` (sự lặp lại). Các đề xuất `aclimate` → `acclimate`, `trysin` → `trypsin`, `untraned` → `untrained` bị loại khỏi sửa tự động vì nghĩa nguồn không phù hợp.

## Trường hợp cần phân biệt trong các đợt tiếp theo

Những mục dưới đây được ghi riêng để phục vụ phân loại; **chưa áp dụng loại bỏ chúng trong supplement này**.

| Mục trong CSV | Phân loại đã xác minh | Dạng hoặc nguồn chính thức |
| --- | --- | --- |
| `adinfinitum` | Cụm từ bị nối liền, nghĩa “vô cùng” | [ad infinitum](https://en.wiktionary.org/wiki/ad_infinitum) |
| `intoto` | Cụm từ bị nối liền, nghĩa “toàn bộ” | [in toto](https://en.wiktionary.org/wiki/in_toto) |
| `protempore` | Cụm từ bị nối liền, nghĩa “tạm thời” | [pro tempore](https://en.wiktionary.org/wiki/pro_tempore) |
| `autocad` | Tên riêng của phần mềm, cần giữ cách viết AutoCAD nếu có nhóm thuật ngữ sản phẩm | [Autodesk AutoCAD](https://www.autodesk.com/products/autocad/overview.htm) |
| `quicktime` | Tên riêng của công nghệ/phần mềm Apple, không phải từ thông dụng mang nghĩa “thời gian nhanh” | [Apple QuickTime Player](https://support.apple.com/guide/quicktime-player/welcome/mac) |
| `ablins` | Từ Scots mang nghĩa “có lẽ”; không phải lỗi chính tả chỉ vì thiếu trong chỉ mục ngôn ngữ `en` | [Wiktionary: ablins](https://en.wiktionary.org/wiki/ablins) |

Nguồn hỗ trợ chính cho các định nghĩa là snapshot English Wiktionary/Kaikki được ghi SHA-256 trong JSON. Định nghĩa được viết lại ngắn gọn và ghép nghĩa Việt/từ loại theo từng mục; không lấy đại nghĩa đầu tiên của một từ đa nghĩa. `inscribableness` được kiểm tra thêm trong mục [inscribe của Collins](https://www.collinsdictionary.com/dictionary/english/inscribe). Những từ cổ như `iterance`/`iterancy` được ghi nhãn từ cổ ở cả hai ngôn ngữ.

`deferred` giữ những đề xuất chưa đủ bằng chứng; chúng không bị coi là vô nghĩa hay tự động loại khỏi kho. Cụ thể, bốn thuật ngữ kỹ thuật chưa có nguồn phù hợp là `anorthogenisis`, `bieqiuvalence`, `pseudobasidum`, `pseudogastreula`.
