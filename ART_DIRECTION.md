# Zombie Vocabulary Survival: Art Direction

Cập nhật: 25/10/2026. Theo yêu cầu mới, toàn bộ nhân vật runtime dùng hai pack Tiny RPG Full do người dùng cung cấp trong `new_asset`, gồm 9 anh hùng và 33 quái vật. Các bộ `mvp-v1`, `animation-v3`, `zoombie1` và các lần nhập pack Free trước đó là tư liệu cũ. Cảnh nền, UI, đạn chữ và các cơ chế đã chốt tiếp tục dùng trong prototype.
Đọc cùng GAME_DESIGN.md và ANIMATION_SPEC.md.

## Hướng đã chốt

**Cute Zombie Arcade, pixel art 2D, side-view phòng thủ hai phía.** Nhân vật nhỏ, đầu hơi lớn, biểu cảm rõ. Zombie ngộ nghĩnh nhưng vẫn gây áp lực bằng khoảng cách, tốc độ, số lượng và âm thanh. Tránh máu me dày đặc, hình ảnh quá trẻ con hoặc neon lấn át nội dung học.

Ưu tiên thị giác: câu đố và mục tiêu → nguy hiểm sắp tới → đạn chữ và nhân vật → trang trí. Phong cách pixel áp dụng thế giới và sprite; font đọc từ không bắt buộc là pixel.

## Màu sắc

Hướng màu được chọn; mã màu và độ tương phản cụ thể cần kiểm tra khi làm mockup.

| Vai trò | Hướng màu |
|---|---|
| Nền | Xanh than, xám xanh, chi tiết tương phản thấp |
| Nhân vật | Giữ palette gốc từng anh hùng Tiny RPG; viền chọn màu vàng ở menu |
| Quái vật | Giữ palette và silhouette riêng trong cả hai pack |
| Bảng câu đố | Khung FantasyUI vàng, nền da nâu tối, chữ trắng ngà; giữ kích thước gọn để không che chiến đấu |
| Nguy hiểm/lỗi | Đỏ san hô hoặc cam đỏ, kèm hình/âm báo |
| Phần thưởng | Xanh ngọc, kèm biểu tượng vật phẩm |

Không dùng màu làm dấu hiệu duy nhất. Hiệu ứng phát sáng nhỏ, không bloom qua chữ. Màu đạn tăng theo combo phải giữ khả năng phân biệt ký tự.

## Nhân vật chính

Chín anh hùng pixel art gốc gồm Archer, Armored Axeman, Knight, Knight Templar, Lancer, Priest, Soldier, Swordsman và Wizard. Menu hiển thị chân dung, tên tiếng Việt và dấu chọn. Soldier là lựa chọn mặc định; hình mẫu survivor áo vàng trước đây đã được thay thế.

Vũ khí và tư thế lấy từ animation gốc của từng nhân vật: cung, kiếm, rìu, thương hoặc phép thuật. Đạn chữ phát tại điểm vũ khí được khai báo cho từng nhân vật. Không có nạp đạn định kỳ; kẹt đạn vẫn là phản hồi cho nhập sai. Lật sprite khi đổi hướng nhưng không lật đạn chữ, nhãn hoặc UI.

Đạn chữ tăng tốc và lớn dần theo quãng đường bay, có giới hạn kích thước để vẫn đọc được. Vệt theo sau ngắn, cung cong không quá 6 px. Khi trúng, chữ vỡ thành mảnh góc cạnh phát sáng cyan/tím/vàng với vết nứt mảnh, gợi cảm giác phép thuật của Arcane; không phủ nhãn hoặc tạo chớp toàn màn hình. Timing và chiều đọc của glyph luôn theo va chạm thật.

## Quái vật hiện tại

Toàn bộ 33 nhân vật phe xấu ở CHARACTER_ROSTER.md dùng sprite gốc từ hai pack; ngoại hình luân phiên trong từng vai trò thường/nhanh/giáp/Boss. Không gán lại hình zombie cũ khi trúng đòn, chết hoặc chuyển phase. Silhouette và động tác nguyên bản của quái bay, quái cưỡi thú và quái chất lỏng được giữ nguyên. Những mô tả bên dưới là concept zombie ban đầu, đã được thay thế về hình ảnh; luật gameplay của bốn vai trò vẫn áp dụng.

| Loại | Silhouette/đạo cụ | Chuyển động chủ đạo |
|---|---|---|
| Normal | Đầu tròn lệch, áo công sở rách, một giày lớn | Lắc lư, tay vươn |
| Runner | Gầy, đồ thể thao, băng đô | Thân cúi thấp, bước ngắn nhanh; tốc độ cơ sở prototype 33 px/giây (tăng 1,5× từ 22) |
| Armored | Thân vuông, mũ bảo hộ, giáp biển báo | Nặng nề, giáp bung khi phá lớp |
| Elite | Cao, một tay biến dị nổi bật | Báo trước kỹ năng rõ; hành vi chưa chốt |
| Reward | Ba lô cứu thương lớn, phần thưởng nhìn thấy | Nhún nhảy; icon cạnh bảng chữ |

MVP dự kiến Normal/Runner/Armored. Elite/Reward chưa được đưa mặc định vào scope triển khai. Khi chết có thể ngã, rơi mũ, bung giáp; không để xác và mảnh vỡ che địch sống hoặc chữ.

## Boss

Boss bảo hộ luân phiên 6 nhân vật lớn từ catalog. Giữ native Idle/Walk/Attack/Hurt/Death cùng một tỉ lệ và điểm neo. Phase được thể hiện bằng tint, trạng thái/thanh Rage và hiệu ứng; không lắp lại giáp công nhân từ bộ Tank cũ.

Tank/Tanker là cùng Boss hiện có, không thêm archetype mới. Khiên quay về phía người chơi và biểu đạt rõ việc bảo vệ các địch ở phía sau Tank trên cùng một phía; hiệu lực che chắn tồn tại đến lúc Tank bị hạ. Nhãn từ dài từ 7 ký tự, kể cả đòn kết liễu, cần giữ cỡ chữ đọc được thay vì thu nhỏ theo độ dài.

Tank giữ trước 9 từ dài mới; Final Strike cũng là từ mới. Chỉ thay nội dung nhãn khi câu đố tương ứng được đưa ra, không hiển thị trước các từ đang giữ cho lớp sau. Armored dùng 2 từ mới; các lớp được bỏ qua nhờ tăng sát thương không tạo nhãn từ giả.

- Phase 1: palette gốc, bước chậm.
- Phase 2: tăng tín hiệu nguy hiểm; pose gốc lấy đà trước khi nện đất.
- Phase 3: tint cuồng nộ, nhãn phase/thanh Rage và tốc độ theo simulation; không che câu đố.
- Kết liễu: chạy trọn Death gốc của nhân vật đang hiện.

Boss sau MVP: Summoner mang ổ zombie nhỏ; Speed chân dài và tư thế lao thấp; Mutation có bộ phận biến đổi; Memory King mang sách/mảnh chữ. Đây là concept, chưa phải asset brief đầy đủ.

## Bối cảnh và góc nhìn

Nhân vật bắt đầu tại x=640, có thể di chuyển trái/phải bằng phím mũi tên trong vùng x=240–6160 của thế giới dài 6400 px; địch sinh cục bộ từ hai phía quanh người chơi. Tốc độ người chơi 160 px/giây, va chạm ngăn đi xuyên zombie. Camera bám mượt và chặn ở biên trong viewport 1280×720. Mặt/hướng khiên và đường bắn bám vị trí hiện tại của người chơi. Xếp chiều sâu khi cần; vị trí collider phải khớp cảm giác va chạm, không để sprite ở xa trông đã đụng người.

Tuyến đường prototype đi qua phố cũ, công viên, ga bỏ hoang, bờ sông và nhà máy, dùng lại pixel art hiện có cùng đạo cụ pixel dựng bằng mã để nhận biết từng vùng. Đây là thế giới hữu hạn 6400 px, không phải sinh địa hình vô hạn. Nghĩa địa, phòng thí nghiệm và hoang mạc vẫn là hướng phát triển sau. Parallax/thời tiết chỉ thêm khi không gây nhiễu đọc.

## Bố cục HUD đã thống nhất

```text
┌────────────────────────────────────────────────────┐
│ HP / Khiên          Thời gian          Score / Combo│
│              Boss HP / Rage khi có                  │
│                                                    │
│ [Câu đố]                             [Câu đố]       │
│ Zombie →          NHÂN VẬT           ← Zombie       │
│                                                    │
│          Câu đố của mục tiêu đang khóa              │
│                  Phần đã nhập ▏                     │
│           Tab: đổi mục tiêu · Esc: tạm dừng          │
└────────────────────────────────────────────────────┘
```

Nhãn nền đặc trên đầu zombie. Theo phản hồi playtest 22/10/2026, bỏ tên dạng câu hỏi như Xáo trộn/Điền từ; hiện từ loại theo nghĩa đang dùng (Danh từ, Động từ, Tính từ), câu đố và bản dịch tiếng Việt. Nghĩa chỉ xuất hiện một lần nếu đã là prompt; hint tách riêng khi có. Với bank từ điển lớn, nhãn đầu zombie rút gọn nghĩa dài bằng dấu ba chấm, dock mục tiêu giữ nghĩa đầy đủ. Mục nhập từ điển ở dạng Việt → Anh có gợi ý chữ đầu/cuối; không để gợi ý đè vào nghĩa. Mục tiêu có khung góc quanh nhãn và dấu ngắm dưới chân. Xếp nhãn lệch tầng, đường nối ngắn khi cần. Nếu quá tải thì giới hạn spawn/nhãn hoạt động, không thu nhỏ chữ vô hạn.

Ô nhập dưới giữa màn hình nhắc lại câu đố. Ký tự đúng ở ô nhập, không tự mở đáp án ẩn trên đầu zombie. Kẹt đạn hiện trạng thái và đếm ngắn tại ô nhập. HP có số; Rage và nguy hiểm không chỉ phân biệt màu. WPM/Accuracy/XP ưu tiên tổng kết.

Trước menu, có trạng thái nạp từ điển cục bộ; nếu thất bại, giữ thông báo lỗi và nút thử lại rõ ràng, không mở bộ nhỏ thay thế. Menu nêu số từ mới còn lại trên tổng bank thực tế đã tải, với trạng thái disabled và lý do khi không đủ 9 từ dài cho Tập đấu Boss. Sổ **Từ đã gặp** có ô tìm từ/nghĩa và phân trang 50 mục, hiển thị cả từ chưa hoàn thành; không đánh đồng “đã gặp” với “đã thuộc”. Theo quyết định “hết từ điển là thắng”, chỉ khi hết từ mới trong toàn bộ bank hữu hạn và không còn địch/đạn mới dùng trạng thái chiến thắng tích cực; không chạy hình người chơi chết hoặc gợi ý tự quay vòng từ. Quy mô từ điển không thay đổi palette, silhouette hoặc trọng tâm đọc chữ đã chốt.

## Typography và accessibility

- Prototype dùng Be Vietnam Pro cho câu đố, nghĩa và điều khiển; Bungee cho tiêu đề và điểm số. Giữ chữ dễ phân biệt, đủ dấu tiếng Việt; thông số chi tiết nằm trong DESIGN.md.
- Nhãn và input sắc nét ở kích thước hiển thị thực; không ép UI chữ xuống độ phân giải sprite.
- Không rung HUD, không hiệu ứng bay phủ nhãn/input; tránh flash toàn màn hình.
- Reduced Motion tắt rung, giảm hạt và chuyển động phụ mà giữ thông tin/trạng thái.
- Bị thương tạo rung ngắn ở lớp thế giới; HP dưới 30% máu tối đa thêm lắc nhẹ và vignette nhịp chậm. HUD/input/nhãn giữ nguyên vị trí; hồi lên ít nhất 30% máu tối đa xóa choáng. Reduced Motion không có shake, lắc thế giới hoặc nhịp dao động của vignette.
- Thanh âm lượng riêng cho nhạc và hiệu ứng là đề xuất; vẫn phải có feedback nhìn thấy khi tắt tiếng.
- Desktop là ưu tiên; màn hình nhỏ cần bố cục được kiểm tra riêng, không tự coi thu nhỏ canvas là mobile support hoàn chỉnh.

## Asset pipeline đề xuất

Khung runtime nhân vật là 100×100 px từ bộ split PNG không bóng, giữ nguyên byte hình và số khung native từng hành động. Thời lượng đọc từ tag Aseprite. Phaser hiển thị bằng nearest-neighbor và tỉ lệ/điểm neo cố định riêng từng nhân vật; không upscale PNG lên gấp nhiều lần. `assets/native-catalog/manifest.json` lưu nguồn và metadata; `src/game/characterCatalog.generated.json` là đăng ký runtime. Gallery `/character-review.html` cho xem toàn bộ 42 nhân vật, từng khung, cả hai hướng.

Cập nhật 25/10: kích thước hiển thị toàn bộ nhân vật giảm 15% bằng hệ số chung 0,85. Giữ tỉ lệ tương đối giữa các anh hùng/quái/Boss, điểm neo chân, pixel nguồn và physics. Điểm phát đòn, điểm chạm trên thân và bóng dưới chân dùng cùng tỉ lệ hiển thị.

Concept → khung chuẩn → palette → animation → kiểm tra alignment/alpha → texture atlas và metadata → tích hợp. Lưu nguồn chỉnh sửa bên cạnh bản xuất, tên frame nhất quán, pivot chân và điểm phát đòn rõ. Mọi asset ghi nguồn và quyền sử dụng; ảnh AI phải kiểm tra frame consistency thủ công.

Đạn chữ dùng font, không tạo spritesheet alphabet riêng mặc định. Atlas là cách đóng gói game 2D, không dùng định dạng pet Codex làm ràng buộc cho nhân vật game.

## Còn mở trước sản xuất

Prototype đã có hệ font/màu và bố cục trong DESIGN.md, cùng tuyến đường đầu tiên mô tả ở trên. Scale sprite, vùng an toàn nhãn, số nhãn tối đa, chất lượng âm thanh và độ hoàn thiện pose/animation vẫn cần đánh giá trước production; không mô tả bộ nháp này là art phát hành hoàn thiện.
