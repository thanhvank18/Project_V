---
name: Zombie Vocabulary Survival
description: Cute Zombie Arcade — học từ tiếng Anh qua một trận sinh tồn bằng bàn phím.
colors:
  app-bg: "#101b24"
  panel: "#182832"
  game-shell: "#15242e"
  game-stage: "#172a32"
  ink: "#f5eedc"
  muted: "#b5c6c9"
  line: "#3e5660"
  accent: "#ffc35a"
  accent-hover: "#ffd487"
  button-ink: "#252919"
  secondary: "#253a43"
  secondary-hover: "#344a51"
  focus: "#77ddc6"
  input-bg: "#0c1c27"
  input-text: "#9aecd1"
  jam-surface: "#38252b"
  jam-border: "#ef9484"
  jam-text: "#ffad99"
typography:
  display:
    fontFamily: "Bungee, sans-serif"
    fontSize: "clamp(32px, 5.5cqw, 76px)"
    fontWeight: 400
    lineHeight: 1.17
    letterSpacing: "-0.025em"
  wordmark:
    fontFamily: "Bungee, sans-serif"
    fontSize: "25px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.02em"
  headline:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.85
  menu-body:
    fontFamily: "'Be Vietnam Pro', sans-serif"
    fontSize: "clamp(12px, 1.2cqw, 17px)"
    fontWeight: 400
    lineHeight: 1.8
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
  keycap: "3px"
  input: "4px"
  item: "5px"
  control: "6px"
  typing-dock: "7px"
  brand: "8px"
  game-wrap: "9px"
  modal: "10px"
spacing:
  gap-xs: "5px"
  gap-sm: "8px"
  gap-control: "10px"
  gap-md: "12px"
  gap-lg: "16px"
  gap-xl: "20px"
  gap-2xl: "24px"
  gap-3xl: "32px"
  modal-inset: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.button-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "#dce4d8"
    typography: "{typography.label}"
    padding: "8px 2px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    width: "38px"
    height: "38px"
    padding: "0"
  input-frame:
    backgroundColor: "{colors.input-bg}"
    textColor: "{colors.input-text}"
    rounded: "{rounded.input}"
    padding: "0 12px"
  input-frame-jammed:
    backgroundColor: "{colors.jam-surface}"
    textColor: "{colors.jam-text}"
  game-wrap:
    backgroundColor: "{colors.game-shell}"
    rounded: "{rounded.game-wrap}"
  modal:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.modal}"
    padding: "{spacing.modal-inset}"
    width: "min(600px, calc(100vw - 32px))"
---

# Design System: Zombie Vocabulary Survival

## Overview

**Creative North Star: "Cute Zombie Arcade"**

Thành phố xanh than, survivor áo vàng cam và zombie xanh rêu/tím tạo thế giới pixel-style đã chốt trong `ART_DIRECTION.md`. Cảnh chơi là nội dung chính ngay viewport đầu; giao diện HTML đặt quanh và trên cảnh để đọc nghĩa, nhập đáp án, theo dõi trận đấu và xem lại từ đã gặp.

Tài liệu ghi nhận prototype chạy cục bộ từ `src/ui/styles.css`, `src/ui/App.tsx`, `src/main.tsx` và `src/game/SurvivalScene.ts`. Frontmatter giữ token trích từ giao diện hiện tại; `.impeccable/design.json` bổ sung shadow, motion, breakpoint và mẫu component. Các ramp màu trong sidecar chỉ phục vụ xem bảng màu, không phải màu đã áp dụng trong ứng dụng.

**Key Characteristics:**

- Pixel art dẫn dắt không khí; chữ tiếng Việt và điều khiển dùng HTML rõ nét.
- Vàng cam đánh dấu hành động chính và điểm số; teal làm nổi chữ đã nhập và focus.
- Panel tối, viền rõ và góc bo nhỏ giữ nhịp arcade mà vẫn dễ đọc.
- Trải nghiệm chơi dành cho bàn phím desktop; màn hình nhỏ hiển thị hướng dẫn mở trên máy tính.

## Colors

Bảng màu kết hợp nền xanh than, chữ kem ấm và phản hồi xanh mint/cam hồng.

### Primary

- **Vàng survivor** (`accent`): nút bắt đầu/chơi tiếp, điểm số, phần nhấn của tiêu đề và một số biểu tượng. `accent-hover` làm sáng nút chính khi trỏ chuột; `button-ink` giữ chữ tối trên nền vàng.

### Secondary

- **Mint thao tác** (`focus`, `input-text`): vòng focus của điều khiển và đáp án đang nhập. Khung nhập có thêm viền và glow khi focus, không chỉ đổi màu chữ.
- **Cam hồng kẹt đạn** (`jam-border`, `jam-text`, `jam-surface`): đổi viền, nền, nhãn “KẸT ĐẠN” và thanh thời gian của ô nhập. Các biến thể ấm khác dùng cho HP, Boss và thông báo chiến đấu trong mã cảnh.

### Neutral

- **Xanh than ứng dụng** (`app-bg`): nền ngoài khung game; `game-shell` và `game-stage` phân lớp phần meta/footer và sân khấu.
- **Mặt panel** (`panel`): dialog và bề mặt nội dung. `secondary`/`secondary-hover` là mặt nút phụ.
- **Kem chữ** (`ink`), **xám xanh chú thích** (`muted`) và **viền xanh xám** (`line`): phân cấp nội dung, nhãn phụ và ranh giới.
- **Nền ô nhập** (`input-bg`): bề mặt sâu hơn panel để tập trung vào đáp án.

## Typography

**Display Font:** Bungee, fallback sans-serif. **Body Font:** Be Vietnam Pro, fallback sans-serif. Font bundle qua `@fontsource`: Bungee 400; Be Vietnam Pro 400, 500, 600 và 700. Không có font mono riêng.

Bungee dùng cho tên game, điểm số và đếm ngược. Màn bắt đầu hiện tập trung vào điều khiển và lựa chọn anh hùng. Tiêu đề dialog dùng Be Vietnam Pro đậm, cùng họ với nghĩa từ, hướng dẫn, nút và sổ từ để giữ dấu tiếng Việt rõ.

- `display` co theo chiều rộng container sân khấu (`cqw`); `wordmark` dành cho header; `result-score` dùng trong tổng kết.
- `headline` dành cho dialog. `body` mô tả đoạn trong dialog; `display` và `menu-body` là token còn từ phiên bản menu có tiêu đề/đoạn giới thiệu trước đây.
- `button`, `label` và `keyboard` mô tả điều khiển thường dùng. Token `target-prompt` và `typing-input` ghi giá trị desktop sau override cuối stylesheet.
- Trên desktop, prompt chính giữ tối thiểu 17 px, input 18 px, gợi ý 12 px, nhãn loại địch/trạng thái nhập 11 px và chỉ dẫn phím/nhãn HUD 10 px. Các giá trị `clamp()` vẫn tăng theo sân khấu trong giới hạn đã định.
- Số thời gian, HP, kỷ lục và thống kê dùng tabular numerals ở những vùng đã khai báo trong CSS.
- Nhãn câu đố trong Phaser dùng Be Vietnam Pro: mô tả/từ loại 11 px, câu đố 19 px, nghĩa 13 px, gợi ý 12 px trên hệ tọa độ canvas; chữ co cùng canvas khi hiển thị. Nhãn “Được Tank che chắn” dùng chữ 11 px cùng biểu tượng khiên. Nghĩa dài được rút gọn trên đầu zombie, còn dock mục tiêu giữ nghĩa đầy đủ bằng token `target-meaning`; không thu nhỏ font để nhét toàn bộ mục từ.

## Layout

Trên desktop (từ 761 px), khung ứng dụng căn giữa với padding ngang 24 px, header 84 px và chiều rộng tối đa `min(1440px, calc((100svh - 220px) * 16 / 9 + 48px))`. Công thức giới hạn chiều rộng theo cả chiều cao viewport để khung game và dock nhập vừa màn hình laptop. Override này nằm cuối stylesheet, thay thế các max-width/header/padding desktop khai báo trước đó, kể cả nhánh từ 1600 px.

Khung game gồm meta 37 px, sân khấu tỷ lệ 16:9 và footer 46 px. Phaser dùng viewport logic 1280×720, scale FIT và căn giữa, nhìn vào thế giới đường phố hữu hạn dài 6400 px. Camera bám mượt người chơi, chặn ở hai biên; các vùng phố cũ, công viên, ga bỏ hoang, bờ sông và nhà máy dùng pixel art hiện có cùng đạo cụ pixel dựng bằng mã. Canvas và ảnh vật phẩm dùng `image-rendering: pixelated`. Page footer desktop có padding 16 px phía trên và 18 px phía dưới.

Màn bắt đầu giữ cụm điều khiển bên trái (cách trái 6%, cách trên 40%): nút Bắt đầu sinh tồn cùng Tập đấu Boss và Cách chơi. Bên phải là lưới chọn 9 anh hùng. Menu đã bỏ tiêu đề, khẩu hiệu, số lượng từ, đoạn quảng bá và dải `menu-bottom` để cảnh chơi có khoảng thở. Quy tắc học và hướng dẫn chi tiết nằm trong Cách chơi. Khi chơi, HUD bám trên; dock nhập nằm giữa đáy, chiếm 50% chiều ngang; vật phẩm nằm góc trái đáy. Boss HUD nằm giữa phía trên. Nhãn địch được giữ trong biên canvas và bố trí theo tầng để hạn chế đè nhau.

Các khoảng cách dùng nhiều là 8, 10, 12, 16, 20, 24 và 32 px; overlay dùng thêm `%` và `cqw` để giữ vị trí theo cảnh. Dialog giới hạn cao 85vh; sổ từ có cuộn riêng (340 px, danh sách trong tổng kết 180 px).

- **Từ 1600 px:** chữ meta/footer tăng nhẹ; giới hạn chiều rộng và header vẫn theo override desktop nêu trên.
- **Đến 1100 px:** ẩn tagline, giảm khoảng cách menu và tăng bề rộng dock nhập lên 52%; override desktop tiếp tục giữ padding 24 px và header 84 px.
- **Đến 760 px:** padding ngang 16 px, header 84 px; ẩn kỷ lục và nút giảm chuyển động, rút gọn nút bộ từ thành biểu tượng. Sân khấu đổi thành 4:5, cao tối đa 620 px, hiển thị thông báo cần bàn phím desktop. Menu, HUD và điều khiển trận bị ẩn. Đây là cổng thông tin cho màn hình nhỏ, chưa có luồng chơi bằng cảm ứng.
- **Dialog trên màn hình nhỏ:** padding 20 px, tiêu đề 21 px; hướng dẫn một cột, thống kê ba cột, nút tổng kết xếp dọc.
- **Toàn màn hình:** sân khấu chiếm viewport; canvas tiếp tục FIT. Nút thoát 44×44 px nằm bên trong sân khấu (cách phải 3%, đáy 4%) để vẫn truy cập được khi footer ngoài vùng fullscreen bị ẩn. Nếu trình duyệt không cho fullscreen, bố cục thường được giữ.

## Elevation & Depth

Chiều sâu đến từ mặt nền tối, viền 1 px và shadow cục bộ. Menu dùng gradient tối từ trái sang phải để điều khiển tách khỏi tranh thành phố. Dock nhập và nút có shadow nhẹ; dialog có shadow rộng và backdrop tối. Không có backdrop blur trong giao diện hiện tại.

Giá trị shadow chính xác nằm trong `extensions.shadows` của sidecar: nút chính (`primary-button`), khung game (`game-wrap`), dock nhập (`typing-dock`), vật phẩm (`inventory-item`) và dialog (`modal`). Token `menu-note` còn từ menu trước đây. Focus là một trạng thái điều khiển riêng.

## Shapes

Góc bo nhỏ là ngôn ngữ chính: keycap 3 px, ô nhập 4 px, vật phẩm 5 px, nút 6 px, dock 7 px, dấu hiệu thương hiệu 8 px, khung game 9 px, dialog 10 px. Viền mảnh tạo ranh giới trên nền tối. Keycap có viền đáy 2 px; dấu hiệu thương hiệu xoay nhẹ −5°. Chấm trạng thái là hình tròn nhỏ, đi cùng chữ trạng thái.

## Components

### Buttons and keyboard focus

Nút chính màu vàng, nút phụ có mặt xanh tối và viền, nút chữ dùng cho hướng dẫn/bộ từ. Nút thường có chiều cao tối thiểu 46 px; nút icon mặc định 38×38 px. Nút bắt đầu là biến thể co theo `cqw`. Các kích thước icon nhỏ hơn trong footer và màn hình nhỏ là giá trị hiện hành, không phải tuyên bố đạt tiêu chuẩn kích thước chạm.

Hover đổi màu trong 150 ms với easing `ease`. Focus-visible trên nút/liên kết dùng outline mint 3 px, offset 4 px. Điều khiển disabled giảm opacity còn 0,5; vật phẩm rỗng còn 0,42. Nút icon có nhãn truy cập; nút giảm chuyển động có `aria-pressed`.

### Typing dock and combat HUD

Dock và nhãn địch hiển thị nghĩa tiếng Việt cùng từ loại thay tên dạng bài, kèm loại địch, trạng thái khóa, prompt/gợi ý và đáp án tại vị trí phù hợp. Bốn cách tạo câu đố (xáo trộn, chữ thiếu, Việt → Anh, nghĩa + gợi ý) giữ nguyên; trong mỗi nhãn/dock không lặp nghĩa nếu nghĩa đã là prompt. Nhãn đầu zombie rút gọn nghĩa dài bằng dấu ba chấm; dock của mục tiêu đang chọn hiển thị đầy đủ. Mục nhập từ điển ở dạng Việt → Anh có thêm gợi ý chữ đầu/cuối để giảm nhầm các từ cùng nghĩa; 240 mục tự biên soạn giữ hành vi gợi ý đã chốt. Input HTML có label, `readOnly` và nhận giá trị từ engine; sự kiện bàn phím trên sân khấu xử lý ký tự. Focus của input thể hiện qua viền/glow của khung bao. Input có chiều cao tối thiểu 40 px trên desktop; chỉ dẫn dưới ô nhập được phép xuống dòng.

`Tab`/`Shift + Tab` đổi mục tiêu trước khi khóa; chữ đúng đầu tiên khóa mục tiêu. `Backspace` xóa, xóa hết mở khóa; `1`–`4` dùng vật phẩm; `Esc` tạm dừng. Mũi tên trái/phải di chuyển, còn phím chữ dành cho nhập từ. Người chơi bắt đầu x=640, đi 160 px/giây trong vùng x=240–6160 của world 6400 px, xuyên quái thường nhưng không xuyên Boss; pause/blur/menu/chết dừng trạng thái di chuyển. Khung kẹt đạn có nhãn và thanh thời gian bên cạnh màu phản hồi. HUD có HP, thời gian, điểm và combo; Boss bổ sung HP, phase và cuồng nộ. Thông báo combat là vùng `aria-live="polite"`, còn canvas được đánh dấu `aria-hidden`.

Tank/Tanker là cùng Tank Boss hiện có: giữ trước 9 từ mới dài ít nhất 7 ký tự, kể cả Final Strike; Armored giữ trước 2 từ mới. Chỉ hiện câu đố đang dùng; từ dự trữ chưa xuất hiện được trả lại pool nếu tăng sát thương giúp bỏ qua lớp. Khiên hướng về vị trí người chơi hiện tại, bảo vệ các địch xa hơn ở cùng phía và chặn tự chọn/Tab/phát bắn chữ mới vào chúng đến khi Tank chết; đạn đã phát vẫn hoàn tất. Nhãn che chắn phải đi cùng tín hiệu hình ảnh, không chỉ đổi màu. Runner có tốc độ cơ sở 33 px/giây (1,5× từ 22).

Mọi hit chữ có hiệu lực đặt lại khựng 300 ms cho địch không phải Boss, không có miễn khựng; Boss không khựng. Hướng dẫn vật phẩm ghi đúng xác suất mỗi kill theo mức khó nội bộ 1/2/3: 15%/30%/45%, không phải CEFR; kho tối đa 5 mỗi loại và chỉ chọn loại chưa đầy. Không có thưởng mỗi 5 kill hoặc vật phẩm Boss bảo đảm. Tank vẫn thưởng +20 HP/+1000 điểm, mỗi trận vẫn bắt đầu với một món mỗi loại.

### Dialogs and seen vocabulary

Dialog HTML gốc mở bằng `showModal()` và có tiêu đề cùng nút đóng. Pause giữ từ đang nhập/vật phẩm; mất focus cửa sổ, ẩn trang hoặc focus rời sân khấu đều gọi pause. Help và bộ từ mở sau khi pause trận; đóng chúng đưa người chơi về màn pause nếu trận đang dừng. Tiếp tục đi qua đếm ngược 2 giây; khi trở lại trạng thái chơi, focus về ô nhập.

Ứng dụng có trạng thái nạp từ điển trước khi tạo App/cảnh chơi. Nếu nguồn JSON đã cấu hình không tải hoặc kiểm tra được, hiển thị lỗi và nút **Thử lại**, không âm thầm dùng bộ 240 từ để báo hoàn thành sớm. Bộ từ mẫu không ghi đè nghĩa nguồn; số lượng từ không đặt lên menu. Đây là từ điển chơi được hữu hạn đã lọc, không dùng cách gọi “toàn bộ tiếng Anh”. Tập đấu Boss bị vô hiệu hóa khi còn dưới 9 từ dài mới, kèm lý do; không gợi ý vẫn có thể vào Boss hoặc tự lặp từ đã dùng.

Sổ **Từ đã gặp** liệt kê mọi từ đã được đưa ra, kể cả chưa hoàn thành hoặc thuộc trận bỏ dở. Có ô tìm theo từ/nghĩa, phân trang 50 mục, nút trước/sau và trạng thái không tìm thấy riêng với sổ trống. Danh sách chỉ lọc/sắp xếp khi mở sổ hoặc thay dữ liệu/từ khóa; khi đóng, snapshot HUD không quét toàn bộ bank ở tần suất 10 Hz. Nhật ký `zvs-seen-words-v2:` chia bucket theo tiền tố, ghi đồng bộ lúc câu đố xuất hiện mà không tuần tự hóa lại cả từ điển. Migration đọc nhật ký v1 và `progress.words` cũ, giữ đáp án chính/alias đã chuẩn hóa; thống kê hoàn thành/lỗi/điểm chỉ lưu khi trận kết thúc. Nhãn phải phân biệt “đã gặp” với “đã hoàn thành”, không diễn đạt thành chứng nhận đã thuộc từ.

Tổng kết hiển thị điểm, số zombie, từ hoàn thành, độ chính xác, WPM, combo cao nhất và tối đa 10 từ sai/chưa hoàn thành để đọc lại. Trận sau chỉ dùng từ chưa gặp, không tự chèn từ yếu hoặc đến lịch ôn. Theo quyết định **“hết từ điển là thắng”**, chỉ khi toàn bộ bank đã tải không còn từ mới và địch/projectile còn lại giải quyết xong mới hiển thị chiến thắng; không dùng mốc 240, không trình bày như chết và không tự tái chế bộ từ. Lỗi lưu nhật ký được báo rõ vì có thể ảnh hưởng chính sách không lặp sau reload. Bộ đếm từ dùng cache của WordDeck, không quét bank theo frame.

### Motion and sound controls

Glyph đạn tăng tốc, lớn dần có giới hạn theo quãng đường, vệt ngắn và cung cong tối đa 6 px; khi trúng vỡ thành mảnh góc cạnh cyan/tím/vàng phát sáng cùng vết nứt mảnh gợi Arcane. Renderer dùng shotId và firedAt/impactAt của simulation để hình chạm đúng lúc có hiệu lực; không kéo dài hình bay bằng một timer độc lập sau hit.

Khi người chơi bị thương, lớp thế giới rung ngắn. HP dưới 30% máu tối đa thêm lắc thế giới nhẹ và vignette nhịp chậm; HP từ 30% máu tối đa trở lên xóa choáng. HUD, input và nhãn câu đố ổn định để tiếp tục đọc/gõ.

Tùy chọn giảm chuyển động khởi tạo từ lựa chọn đã lưu hoặc `prefers-reduced-motion`; khi bật, CSS tắt animation/transition. Phaser tắt screen shake, lắc thế giới, dao động vignette và cung cong của glyph; giảm bụi/va chạm, chuyển động chữ nổi và alpha muzzle flash. Tín hiệu nguy hiểm tĩnh cùng timing simulation được giữ. Nút âm thanh và lựa chọn này lưu trong trình duyệt. Tắt âm thanh không thay thế các tín hiệu nhìn thấy.

### Character selection and skills — 25/10/2026

Kích thước nhân vật trong sân chơi giảm 15%, cùng một hệ số cho hero/quái/Boss; điểm neo chân và hiệu ứng cùng tỉ lệ. Nhãn quái xếp trên hai hàng, tránh vùng HUD kỹ năng và Boss, giữ nhãn mục tiêu đang chọn.

Khi đang chơi, thanh thông tin phía trên sân chơi giữ **BẬC 1/10** và tiến độ **0/20 từ**, cập nhật bằng từ hoàn thành trong trận. Tên bậc thông báo nhẹ qua `aria-live` khi đổi, thanh progress có nhãn và giá trị; không thêm hiệu ứng nhấp nháy. Chữ 11px và đường progress 4px, bo 2px giữ kiểu HUD gọn đang dùng; màu lấy từ ink/muted/accent hiện tại. Bậc thật của từ nằm cạnh từ loại ở dock mục tiêu. Quy tắc trận mới bắt đầu dễ và mỗi 20 từ tăng bậc được giải thích trong Cách chơi.

Sổ từ có hai select gốc cho từ loại và bậc khó; nhãn, focus và empty state rõ ràng, sắp từ dễ đến khó trước thứ tự chữ cái. Bộ lọc chỉ tác động danh sách đã gặp, không đổi pool gameplay hoặc làm lộ từ chưa gặp. Trên màn hẹp, hai select xếp dọc.

Menu giữ cụm bắt đầu ở cột trái, tại 40% chiều cao sân khấu, và radio chọn 9 anh hùng dạng lưới 3×3 ở phải. Ảnh portrait native dùng nearest-neighbor, mỗi lựa chọn có tên và dấu check; viền vàng cùng trạng thái checked báo lựa chọn, focus xanh ngọc độc lập. Native radio hỗ trợ Tab và phím mũi tên. Mô tả kỹ năng cùng số chữ cần tích nằm dưới lưới, không thêm hộp thoại xác nhận. Lựa chọn được nhớ khi tải lại.

HUD thêm tên kỹ năng, số chữ đúng/threshold và thanh progress dưới HP. Kỹ năng tự kích, không thêm phím lấy mất ký tự nhập từ. Hiệu lực kéo dài có số giây còn lại. Hiệu ứng vũ khí và kỹ năng nằm ở lớp thế giới, chừa khoảng giữa cho glyph; Reduced Motion giữ dấu hiệu tĩnh và fade. Xem CHARACTER_ROSTER.md cho đủ chín khả năng.

Footer khung game giữ Hướng dẫn và Toàn màn hình; tên nguồn từ điển cùng liên kết nguồn đã được bỏ khỏi footer. Xuất xứ và báo cáo vẫn nằm trong tài liệu nguồn cùng `public/vocabulary/attribution.md`. Page footer chỉ giữ ghi chú prototype và tiến trình lưu trên trình duyệt, đã bỏ khẩu hiệu.

## Do's and Don'ts

### Do

- **Do** giữ nhân vật, pixel art và thế giới Cute Zombie Arcade đã chốt trong `ART_DIRECTION.md`.
- **Do** dùng Be Vietnam Pro cho nghĩa từ, hướng dẫn và điều khiển; dành Bungee cho các điểm nhấn arcade đã triển khai.
- **Do** giữ prompt và ô nhập nổi bật, dùng nhãn/chữ cùng tín hiệu màu cho trạng thái chiến đấu.
- **Do** giữ thao tác bàn phím, focus hiển thị, pause khi mất focus và tùy chọn giảm chuyển động khi mở rộng giao diện.
- **Do** mô tả đúng phạm vi prototype cục bộ và tiến trình được lưu trong trình duyệt.

### Don't

- **Don't** thay màn chơi bằng landing page marketing khi yêu cầu chỉ là hoàn thiện nguyên mẫu này.
- **Don't** che cảnh bằng panel blur/glass hoặc thay thế hệ màu/art đã chốt khi chưa có yêu cầu redesign.
- **Don't** mô tả cổng thông tin màn hình nhỏ thành chế độ chơi mobile hoàn chỉnh.
- **Don't** dùng trạng thái màu hoặc âm thanh làm cách duy nhất để báo lỗi, khóa mục tiêu hay kẹt đạn.
- **Don't** biến việc trích token và ghi tài liệu thành tuyên bố đã đạt chứng nhận accessibility hoặc chất lượng sản phẩm.
