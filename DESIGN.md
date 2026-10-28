---
name: Zombie Vocabulary Survival
description: FantasyUI — sinh tồn bằng bàn phím trong giao diện pixel da, gỗ và vàng.
colors:
  app-bg: "#17110e"
  panel: "#281c17"
  game-shell: "#211710"
  game-stage: "#211a15"
  ink: "#f6e9cc"
  muted: "#c9b896"
  line: "#795438"
  accent: "#f4c76e"
  focus: "#ffe1a0"
  button-ink: "#fff1d0"
  button-hover-ink: "#fff4d9"
  text-button: "#e9d5ad"
  input-bg: "#170f0b"
  input-text: "#ffe2a0"
  input-border: "#aa8656"
  input-focus: "#ffdc91"
  input-placeholder: "#c7b591"
  jam-surface: "#391b15"
  jam-border: "#ed8664"
  jam-text: "#ffc0a3"
  field-bg: "#1a120f"
  field-border: "#8a6747"
  field-label: "#ecddbf"
  success: "#d2e5a2"
  error-surface: "#45231d"
  error-border: "#d78e77"
  error-text: "#ffe0ce"
  keycap-bg: "#3b2a1e"
  keycap-border: "#977449"
  keycap-text: "#f3e1ba"
typography:
  wordmark:
    fontFamily: "Bungee, sans-serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.02em"
  headline:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.3
  lobby-heading:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "clamp(15px, 1.55cqw, 21px)"
    fontWeight: 700
  create-heading:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "clamp(24px, 3vw, 32px)"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.85
  create-body:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.5
  label:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.5
  keyboard:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "10px"
    fontWeight: 600
  target-prompt:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "clamp(17px, 1.4cqw, 21px)"
    fontWeight: 700
  target-meaning:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "clamp(12px, 0.95cqw, 14px)"
    fontWeight: 400
    lineHeight: 1.3
  typing-input:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "clamp(18px, 1.4cqw, 22px)"
    fontWeight: 600
    letterSpacing: "0.04em"
  result-score:
    fontFamily: "Bungee, sans-serif"
    fontSize: "40px"
    fontWeight: 400
rounded:
  frame: "0"
  input: "2px"
  keycap: "2px"
spacing:
  gap-xs: "5px"
  gap-sm: "8px"
  gap-control: "10px"
  gap-md: "12px"
  gap-lg: "16px"
  gap-xl: "20px"
  gap-2xl: "24px"
  gap-3xl: "32px"
  modal-inset: "20px"
components:
  button-primary:
    backgroundColor: "transparent"
    textColor: "{colors.button-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.frame}"
    padding: "6px 16px"
  button-primary-hover:
    textColor: "{colors.button-hover-ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.frame}"
    padding: "6px 16px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.text-button}"
    typography: "{typography.label}"
    padding: "8px 2px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.frame}"
    width: "42px"
    height: "42px"
    padding: "0"
  input-frame:
    backgroundColor: "{colors.input-bg}"
    textColor: "{colors.input-text}"
    rounded: "{rounded.input}"
    padding: "0 12px"
  input-frame-jammed:
    backgroundColor: "{colors.jam-surface}"
    textColor: "{colors.jam-text}"
  create-field:
    backgroundColor: "{colors.field-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "10px 12px"
  game-wrap:
    backgroundColor: "{colors.game-shell}"
    rounded: "{rounded.frame}"
  modal:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.frame}"
    padding: "{spacing.modal-inset}"
    width: "min(600px, calc(100vw - 32px))"
---

# Design System: Zombie Vocabulary Survival

## Overview

**Creative North Star: "FantasyUI — da, gỗ và vàng"**

Giao diện dùng atlas FantasyUI do người dùng cung cấp: da nâu tối, gỗ chạm, viền vàng pixel và chữ kem. Hướng này được chốt cho toàn game ngày 28/10/2026, thay hệ giao diện xanh than trước đó ở trang chủ, sảnh co-op, chọn anh hùng, HUD, dialog, sổ từ và Create Mode. Cảnh thành phố, nhân vật Tiny RPG và bản sắc Cute Zombie Arcade tiếp tục là nội dung chơi.

Cảnh chơi vẫn dẫn dắt trải nghiệm; khung và chất liệu giúp nhận ra điều khiển mà không lấn nội dung từ vựng. Atlas gốc là chuẩn hình ảnh của chrome; typography tiếng Việt, hành vi bàn phím và dữ liệu gameplay tiếp tục theo sản phẩm hiện có. Frontmatter ghi token đã triển khai; sidecar bổ sung ảnh khung, shadow, chuyển trạng thái và mẫu component. Hình học cắt ảnh và tích hợp nằm trong `FANTASY_UI.md`.

**Key Characteristics:**

- Khung pixel vàng, mặt da và nút gỗ tạo một ngôn ngữ chung từ sảnh đến Create Mode.
- Chữ kem và focus hổ phách nổi rõ trên nền nâu; phản hồi lỗi và thành công luôn đi cùng nội dung.
- HP của người chơi dùng tim đỏ từ atlas, giữ nguyên giá trị máu và sát thương của gameplay.
- Chơi trận cần bàn phím desktop; Create Mode có bố cục nhập liệu dùng được trên màn hình nhỏ.

## Colors

Bảng màu nâu ấm được lấy theo chất liệu FantasyUI và dùng xuyên suốt chrome HTML lẫn bảng nhãn trong Phaser. Đây là thay thế có chủ đích cho bảng màu giao diện cũ; các hiệu ứng phép, nhân vật và cảnh chơi vẫn giữ màu riêng của chúng.

### Primary

- **Vàng hổ phách** (`accent`): hành động, tiêu đề tạo bộ từ, điểm số và tín hiệu kỹ năng.
- **Kem trên gỗ** (`button-ink`): chữ nút chính trên ảnh gỗ có lớp tối bổ sung; hover làm sáng ảnh và chuyển chữ sang `button-hover-ink`.
- **Hổ phách focus** (`focus`): outline bàn phím của điều khiển. Focus ô nhập đáp án dùng `input-focus`, Create dùng `accent`.

### Secondary

- **Đỏ đất phản hồi** (`jam-surface`, `jam-border`, `jam-text`): kẹt đạn có nhãn và thanh thời gian. Form dùng `error-surface`, `error-border`, `error-text` cùng danh sách lỗi và liên kết đến trường cần sửa.
- **Lá sáng thành công** (`success`): trạng thái tạo bộ từ và sao chép liên kết; không thay cho thông báo bằng chữ.
- **Đỏ tim atlas**: chỉ sức khỏe người chơi. Màu nằm trong pixel gốc của ảnh, không áp tint CSS.

### Neutral

- **Nâu nền** (`app-bg`), **da tối** (`panel`), **gỗ sâu** (`game-shell`) và **nâu sân khấu** (`game-stage`): phân lớp ứng dụng, khung và vùng chơi.
- **Kem chữ** (`ink`), **cát chú thích** (`muted`), **đường đồng** (`line`): phân cấp thông tin và đường chia.
- **Hốc nhập tối** (`input-bg`, `field-bg`): mặt nhập đáp án và trường biên soạn; viền sáng đủ để nhận ra phạm vi tương tác.
- **Keycap gỗ** (`keycap-bg`, `keycap-border`, `keycap-text`): phím hướng dẫn nằm trong cùng chất liệu ấm.

**The Atlas Rule.** Dùng ảnh FantasyUI gốc cho các khung và nút đã định; không thay bằng gradient hoặc hình vẽ gần giống. Lớp tối trên nút gỗ được dùng để giữ chữ kem dễ đọc.

## Typography

**Display Font:** Bungee, fallback sans-serif. **Body Font:** Be Vietnam Pro, fallback sans-serif. Font bundle qua `@fontsource`: Bungee 400; Be Vietnam Pro 400, 500, 600 và 700. Không có font mono riêng.

Bungee giữ tên game, điểm số và đếm ngược. Be Vietnam Pro dùng cho nghĩa, hướng dẫn, phòng co-op, tên anh hùng, form và dialog để dấu tiếng Việt rõ trên chất liệu pixel. Ảnh pixel không buộc chữ nội dung dùng font pixel.

- Wordmark desktop 24 px; trên màn hình đến 760 px còn 22 px. Tiêu đề dialog 24 px, còn 21 px trên màn hình nhỏ.
- Tiêu đề sảnh và chọn anh hùng co theo chiều rộng sân khấu; tên trên portrait có giới hạn 10–13 px.
- Prompt desktop tối thiểu 17 px, ô nhập đáp án tối thiểu 18 px và cao tối thiểu 40 px; gợi ý 12 px. Giá trị `clamp()` tăng theo sân khấu.
- Create dùng thân bài 14 px, còn 13 px trên màn nhỏ; trường nhập ở màn đến 600 px dùng 16 px. Đoạn giới thiệu giới hạn 70ch, hướng dẫn CSV 75ch.
- Số thời gian, điểm, phân trang và thống kê dùng tabular numerals tại vùng đã khai báo.
- Nhãn Phaser dùng Be Vietnam Pro trên tọa độ canvas: descriptor 11 px, prompt 19 px, nghĩa 13 px, gợi ý 12 px. Nghĩa dài trên đầu quái rút gọn; dock giữ nghĩa đầy đủ trong vùng tối đa hai dòng có cuộn, không thu chữ để nhét mục từ.

**The Readable Vocabulary Rule.** Chữ nghĩa và ô nhập luôn là nội dung cần đọc trước; chất liệu khung không được che chữ, focus hoặc vùng cuộn.

## Layout

Ứng dụng rộng tối đa 1480 px với padding ngang 3,5%; header cao 96 px. Từ 761–1100 px, padding còn 2%, header 88 px và ẩn tagline. FantasyUI được import sau stylesheet nền nên các giá trị này thay bố cục chiều rộng desktop cũ.

Khung game dùng border ảnh 10 px, meta cao 32 px, footer 43 px và sân khấu tỷ lệ 16:9. Phaser giữ viewport logic 1280×720, scale FIT và căn giữa, camera bám người chơi trong thế giới đường phố hữu hạn dài 6400 px. Canvas và ảnh pixel giữ nearest-neighbor.

Sảnh đặt bên trái, cách trên 6%, trái 3%, rộng 44%, cao tối đa 90% và cuộn khi cần; khung có border 18 px và padding trong. Cột anh hùng nằm phải 3%, rộng 45%, cùng cao độ, chứa 9 portrait theo lưới 3×3 và thông tin kỹ năng bên dưới. PIN, danh sách người chơi, ô tham gia và nút bắt đầu nằm chung trong sảnh. Từ 761–1100 px, hai cột bắt đầu ở 5% và giảm kích thước khung/spacing để vừa cảnh.

Trong trận, HUD ở trên 3%, cách hai bên 2,5%; khối sức khỏe rộng 23%. Kỹ năng ở trên 15%, vật phẩm ở đáy trái. Dock nhập cách hai bên 25%, đáy 2%; desktop hẹp tăng rộng lên 52%. Boss có khung riêng ở phía trên. Nhãn quái được bố trí trong biên canvas, tránh các vùng HUD và giữ mục tiêu đang chọn.

- **Đến 760 px:** ứng dụng có padding 12 px; header cao tự động, tối thiểu 88 px; sân khấu chuyển 4:5 và giữ thông báo cần máy tính. Menu, HUD và điều khiển trận bị ẩn. Đây chưa phải chế độ chơi cảm ứng.
- **Dialog nhỏ:** padding trong 14 px, border ảnh 16 px, cao tối đa `calc(100dvh - 24px)`; nội dung dài cuộn trong dialog.
- **Create Mode:** rộng tối đa 1160 px, padding 32 px. Form dùng khung 16 px, padding 24 px; thông tin chung ba cột, câu hỏi dùng lưới để soạn nhiều trường. Các mốc 1050/800/600 px giảm số cột. Đến 600 px, padding ngoài 14 px, khung 12 px, câu hỏi xếp thành nhiều hàng có thứ tự rõ; nút xuất bản chiếm đủ chiều rộng.
- **Thanh xuất bản:** bám đáy vùng cuộn, dùng mặt da đặc và padding theo safe-area; không dùng nền trong suốt khiến chữ phía sau xuyên qua.
- **Toàn màn hình:** sân khấu chiếm viewport; canvas tiếp tục FIT và giữ nút thoát trong sân khấu. Nếu fullscreen không được phép, giữ bố cục thường.

Nhịp khoảng cách chính là 8, 10, 12, 16, 20, 24 và 32 px. Border ảnh là phần kích thước riêng cần tính khi đặt padding và vùng nội dung.

## Elevation & Depth

Chiều sâu đến từ pixel sáng/tối có sẵn trong atlas, mặt da và bóng nâu tối cục bộ. Sảnh phủ lớp tối nâu lên cảnh để giữ đọc tốt; dialog dùng backdrop tối đặc, không blur. Portrait và ô vật phẩm không có shadow CSS riêng.

Shadow đã triển khai được ghi trong sidecar: nút gỗ (`0 5px 12px #08040255`), khung game (`0 16px 40px #05030280`), dock (`0 6px 16px #08040360`), dialog (`0 20px 65px #060301b3`) và form Create (`0 14px 35px #09060466`). Focus input có viền sáng và bóng 1 px, là trạng thái tương tác.

## Shapes

Khung atlas dùng góc vuông CSS; đường viền vàng pixel giữ hình khối của nguồn qua nine-slice. Input, keycap và bộ chọn ngôn ngữ chỉ bo nhẹ 2 px. Brand mark dùng slot atlas, không xoay. Viền nguồn và border hiển thị độc lập: panel thường slice 20 px nhưng hiển thị border 8–22 px tùy vai trò. Không kéo giãn nguyên ảnh khung để thay nine-slice.

## Components

### Buttons and keyboard focus

Nút chính là gỗ chạm có lớp tối để chữ kem rõ. Nút phụ và nút icon dùng ảnh da tối. Nút thường cao tối thiểu 46 px, padding 6×16 px; icon mặc định 42×42 px. Trong Create, nút và icon tối thiểu 44 px; footer game có biến thể icon 32 px, không coi đó là kích thước chạm chuẩn.

Hover làm sáng 1,15 lần trong 130 ms; active giảm độ sáng còn 0,85; disabled giảm opacity còn 0,55 và thêm grayscale. Focus-visible dùng outline 3 px, offset 3 px, tách biệt với selected. Nút chữ giữ cách diễn đạt tác vụ; điều khiển icon có tên truy cập. VI/EN có trạng thái `aria-pressed` và nền nâu sáng khi chọn.

### Lobby and hero slots

Phòng hiển thị PIN, danh sách tối đa bốn người, ô tham gia và phản hồi bằng chữ. Chủ phòng giữ quyền bắt đầu; các trạng thái kết nối và quyền thao tác tiếp tục theo logic sản phẩm. Radio chọn 9 anh hùng hỗ trợ bàn phím, tên và dấu check. Slot vàng ở trạng thái thường đổi sang ảnh slot đỏ khi chọn; focus hổ phách độc lập với lựa chọn. Anh hùng đã có người chọn giảm bão hòa và có trạng thái giải thích.

Phần kỹ năng bên dưới dùng panel ngang, hiện kiểu cận chiến/đánh xa cùng hàng tim đầy của máu tối đa. Lựa chọn được nhớ theo hành vi hiện có. Kỹ năng vẫn tự tích bằng ký tự đúng mới; skin không thêm phím tranh chấp với đáp án.

### Health hearts

Sức khỏe người chơi được hiển thị bằng `HeartRow`, dùng ảnh tim đầy phủ lên tim rỗng và clip theo giá trị thực. Số ô tim là `max(1, floor(maxHP / 20))`: 100 HP có 5 tim; 150 HP có 7 tim; chế độ một hit với maxHP 1 có 1 tim. Mỗi tim chứa cùng tỷ lệ của cả thanh máu, nên 7 tim ở 150 HP tương ứng khoảng 21,43 HP/tim. Không đổi máu tối đa, sát thương hay hồi máu để làm tròn hình.

HUD không hiện số HP thường trực; tooltip và `role="progressbar"` giữ giá trị chính xác cho công cụ trợ năng. Tim con mang `aria-hidden`, ảnh có alt rỗng. Hàng preview trong chọn anh hùng dùng cùng component, cỡ 18 px; trong HUD dùng `clamp(17px, 2.1cqw, 28px)`. Dưới 30% máu, nhãn sức khỏe đổi màu và phản hồi nguy hiểm hiện có tiếp tục hoạt động. Công thức đầy đủ và ví dụ nằm trong `FANTASY_UI.md`.

### Typing dock and combat HUD

Dock dùng panel ngang; ô nhập nằm trong mặt tối có viền vàng nâu. Kẹt đạn dùng đỏ đất, nhãn “KẸT ĐẠN” và thanh thời gian. Các nhãn cùng prompt, nghĩa, từ loại, gợi ý tiếp tục theo VI/EN; không lặp nghĩa nếu nghĩa đã là prompt. Đổi mục tiêu hoặc câu đố đưa vùng nghĩa cuộn về đầu; input nằm ngoài vùng cuộn.

Input HTML có label và `readOnly`, nhận nội dung từ engine xử lý bàn phím. `Tab`/`Shift + Tab` đổi mục tiêu trước khi khóa, chữ đúng đầu tiên khóa mục tiêu; `Backspace` xóa, xóa hết mở khóa. Mũi tên trái/phải di chuyển; `1`–`4` dùng vật phẩm; `Esc` dừng điều khiển/tạm dừng theo chế độ. Skin không đổi luật chiến đấu, target reservation, vật phẩm, điểm hay lịch sử từ.

Nhãn quái và vật thể trong Phaser dùng NineSlice từ `button-dark.png`, chữ kem và gợi ý vàng. HP Boss tiếp tục là thanh riêng với phase/cuồng nộ; hàng tim dành cho sức khỏe người chơi. HUD giữ tiến độ bậc và số từ, kỹ năng cùng thời gian còn lại. Thông báo chiến đấu có vùng `aria-live`; các tín hiệu hình ảnh vẫn đi cùng tên/trạng thái.

### Dialogs and seen vocabulary

Dialog HTML gốc mở bằng `showModal()`, có tiêu đề và nút đóng, dùng khung vàng cùng backdrop nâu tối. Bao phủ pause, hướng dẫn, âm thanh, tổng kết, sổ từ và các trạng thái nạp/lỗi bộ từ. Chơi riêng tạm dừng cả trận khi mất focus; co-op chỉ dừng điều khiển cá nhân, trận vẫn tiếp tục. Nội dung hướng dẫn phải giữ khác biệt này.

Sổ Từ đã gặp có tìm kiếm, lọc từ loại/bậc/yêu thích, phân trang 20 mục và empty state. Trạng thái đã gặp, chưa hoàn thành, lỗi và hoàn thành chính xác phải được phân biệt; không diễn đạt “đã gặp” thành “đã thuộc”. Ví dụ và nghĩa theo dữ liệu/ngôn ngữ được hỗ trợ, phát âm có trạng thái không khả dụng. Xem lại không tự đưa từ cũ vào pool trận mới.

Tổng kết và trạng thái chiến thắng/thua giữ hành vi gameplay; từ điển hữu hạn được tải và kiểm tra trước trận. Lỗi tải có nút thử lại và thông báo; không thay nội dung sản phẩm bằng tuyên bố hoặc số lượng mới. Nguồn, giấy phép, lịch sử từ và giới hạn hạ tầng nằm trong tài liệu sản phẩm tương ứng.

### Create Mode and shared decks

Form, trang thành công, liên kết chia sẻ cùng trạng thái nạp/lỗi của bộ từ chung dùng cùng bảng màu và nút FantasyUI. Form là mặt da lặp với viền vàng; trường nhập tối có label rõ, select gốc, textarea co dãn và focus. Lỗi hiển thị trong vùng đỏ đất, có liên kết đưa tới trường lỗi; màu viền `aria-invalid` bổ sung cho nội dung.

Giữ luồng biên soạn/nhập CSV, phân trang, tạo bộ từ và sao chép liên kết đang có. Chỉ xác nhận thành công từ kết quả thật; hiển thị quy tắc, thời hạn và trạng thái tải theo dữ liệu trả về. Màn hình nhỏ hỗ trợ soạn và chia sẻ bộ từ, còn trải nghiệm chơi vẫn cần bàn phím desktop.

### Motion and sound controls

Hover của chrome nhẹ, không làm chuyển vị trí điều khiển. Phần đầy tim chuyển độ rộng trong 150 ms; tắt transition khi bật giảm chuyển động. HUD, input và nhãn câu đố đứng yên khi hiệu ứng bị thương rung lớp thế giới.

Tùy chọn giảm chuyển động lấy từ lựa chọn đã lưu hoặc `prefers-reduced-motion`; CSS tắt animation/transition, Phaser giảm hiệu ứng thế giới theo cơ chế hiện có và giữ timing simulation cùng tín hiệu tĩnh. Âm thanh và giảm chuyển động lưu trong trình duyệt. Tắt âm không làm mất thông báo bằng hình/chữ.

## Do's and Don'ts

### Do

- **Do** dùng FantasyUI gốc cho chrome toàn game, giữ nhân vật và cảnh pixel theo tài liệu art hiện có.
- **Do** dùng Be Vietnam Pro cho nghĩa từ, hướng dẫn và điều khiển; dành Bungee cho điểm nhấn đã triển khai.
- **Do** dùng nine-slice đúng inset nguồn, giữ padding chữ bên trong và kiểm tra khung tại kích thước nhỏ.
- **Do** giữ HP thực và tỷ lệ đầy liên tục; 100 HP là 5 tim, 150 HP là 7 tim.
- **Do** giữ focus, thao tác bàn phím, phản hồi bằng chữ và chế độ giảm chuyển động.
- **Do** giữ Create Mode dùng được trên màn hình nhỏ và mô tả đúng giới hạn chơi desktop.

### Don't

- **Don't** trộn lại chrome xanh than cũ vào các bề mặt FantasyUI đã thay.
- **Don't** tô lại hoặc nội suy mờ ảnh atlas; không dùng ảnh trang trí để thay label hay trạng thái truy cập.
- **Don't** làm tròn gameplay HP hoặc đổi sát thương chỉ để khớp số tim.
- **Don't** dùng màu hoặc âm thanh làm tín hiệu duy nhất cho lỗi, khóa mục tiêu hay kẹt đạn.
- **Don't** mô tả màn hình nhỏ thành chế độ chơi cảm ứng đầy đủ.
- **Don't** coi tài liệu hoặc mẫu component là bằng chứng đã đạt chứng nhận accessibility hay kiểm thử toàn sản phẩm.
