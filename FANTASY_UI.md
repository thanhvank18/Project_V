# FantasyUI — tích hợp toàn game

Ngày cập nhật: 28/10/2026. Giao diện được thay theo atlas do người dùng cung cấp; chuẩn token và quy tắc thị giác ở [DESIGN.md](DESIGN.md).

## Phạm vi

| Bề mặt | Cách dùng FantasyUI | Nguồn triển khai |
| --- | --- | --- |
| Header, VI/EN, liên kết bộ từ, trang nạp/lỗi | Chữ kem, nền nâu, slot thương hiệu, nút gỗ/da, focus hổ phách | `src/ui/fantasy-ui.css`, `src/main.tsx` |
| Trang chủ và sảnh co-op | Khung vàng chứa PIN, roster, tham gia và bắt đầu; giữ thông báo kết nối/quyền thao tác | `src/ui/fantasy-ui.css` |
| Chọn 9 anh hùng | Slot vàng, slot đỏ khi chọn, check và focus riêng; kỹ năng có preview tim đầy | `src/ui/HeroPicker.tsx`, `src/ui/fantasy-ui.css` |
| HUD người chơi | Tim, điểm, thời gian, kỹ năng, bậc, dock nhập, ô vật phẩm và tương tác dùng cùng palette | `src/ui/CombatFeedback.tsx`, `src/ui/health-hearts.css`, `src/ui/fantasy-ui.css` |
| Boss và nhãn trong canvas | Boss giữ thanh HP riêng; nhãn quái/vật thể dùng panel da NineSlice | `src/game/SurvivalScene.ts`, `src/ui/fantasy-ui.css` |
| Pause, hướng dẫn, âm thanh, tổng kết, sổ từ | Dialog khung vàng; mặt tối, chữ kem, trạng thái có nội dung và điều khiển bàn phím | `src/ui/fantasy-ui.css` |
| Create Mode và kết quả chia sẻ | Form/nhận lỗi/thành công dùng viền vàng, da lặp, input tối và nút dùng chung | `src/ui/create-mode.css`, `src/ui/fantasy-ui.css` |
| Màn hình nhỏ | Trang game giữ cổng hướng dẫn desktop; Create dùng bố cục responsive để soạn/chia sẻ | CSS responsive của hai stylesheet |

Cảnh phố, ảnh nhân vật, hiệu ứng phép và toàn bộ luật gameplay giữ nguồn hiện có. FantasyUI thay chrome và cách trình bày sức khỏe; không đổi cân bằng HP, sát thương, hồi máu, vật phẩm, điều kiện thắng hay backend.

## Atlas và nguồn ảnh

- Atlas gốc: `UI/FantasyUI/FantasyUI/fantasy.png`, kích thước 1024×1560.
- 23 PNG đã cắt: `public/assets/ui/fantasy/`; URL runtime: `/assets/ui/fantasy/`.
- [manifest.json](public/assets/ui/fantasy/manifest.json) là nguồn chuẩn cho từng crop integer `x/y/width/height` và inset `nineSlice`.
- [README.md](public/assets/ui/fantasy/README.md) ghi cách render, xuất xứ và tình trạng giấy phép.
- Crop giữ RGBA, màu và transparency gốc, không resampling hoặc tô lại. Mỗi PNG có metadata xuất xứ của atlas/crop, ghi rõ không phải ảnh được AI tạo.
- Gói được người dùng cung cấp nhưng thư mục không có văn bản giấy phép. Bản nhập không tự gán public domain hay một giấy phép mới.
- `__MACOSX` và các ảnh `DragonHpBar*.png` không được nhập cho giao diện dùng tim.

## Khung và nine-slice

Inset nguồn được đo bằng pixel của ảnh; độ dày border CSS là kích thước hiển thị, không bắt buộc bằng inset. Giữ text padding nằm bên trong border; dùng `image-rendering: pixelated` cho portrait, tim và ảnh pixel.

| Nhóm ảnh | Kích thước nguồn | Inset nguồn | Dùng trong bản hiện tại |
| --- | --- | --- | --- |
| `panel-gold.png` | 76×93 | 20 | Sảnh, dialog, khối nạp, viền Create |
| `panel-wide.png` | 112×78 | 20 | Khung game, dock nhập, kỹ năng, Boss |
| `slot-gold.png` | 76×78 | 20 | Portrait thường, brand, vật phẩm |
| `slot-selected.png` | 76×94 | 20 | Portrait đã chọn |
| `button-dark.png` | 92×36 | 6 | Nút phụ/icon, nhãn canvas, tương tác |
| `button-wood.png` | 119×35 | 8 | Nút chính |
| `leather-tile.png` | 32×32 | Không | Mặt lặp trong Create và thanh xuất bản |
| `heart-full.png`, `heart-empty.png` | 18×15 | Không | Hiển thị HP và preview |
| `heart-half.png` | 18×15 | Không | Có trong gói cắt; phần đầy runtime dùng clipping liên tục |

Các biến thể panel đỏ/tím/vuông/ornate, gỗ, parchment, nút gỗ lớn và gem có trong manifest để lưu nguồn; không coi việc có asset là bằng chứng mọi ảnh đều đang xuất hiện trên UI.

Ví dụ khung sảnh:

```css
border: 18px solid transparent;
border-image: url('/assets/ui/fantasy/panel-gold.png') 20 fill / 18px;
```

Trong Create, border vàng không dùng `fill`; mặt trong là `#281c17` cộng `leather-tile.png` lặp, `background-clip: padding-box`. Nút gỗ giữ border nguồn 8 px; lớp nền gỗ có một lớp tối bán trong suốt `#1b0c0370` để chữ `#fff1d0` đọc rõ. Kỹ thuật này làm tối mặt nút lúc render, không sửa file PNG gốc.

Phaser preload `button-dark.png` dưới key `fantasy-label-panel`. Nhãn quái thường/vật thể là 238×106, Boss 260×106; `this.add.nineslice(...)` dùng inset 6 px cả bốn phía. Các text/plate phủ phía trên vẫn nhận trạng thái mục tiêu, gợi ý và phản hồi của game.

## Nạp tài nguyên và thứ tự CSS

`src/main.tsx` import `styles.css` trước `fantasy-ui.css` để FantasyUI ghi đè các token/chrome cũ. `HeartRow` import `health-hearts.css` từ `CombatFeedback.tsx`; Create Mode được lazy-load cùng stylesheet của nó. Tài nguyên HTML/CSS được trình duyệt nạp từ URL tĩnh dùng chung và cache theo cơ chế thông thường.

Nhãn canvas được đưa vào `SurvivalScene.preload()` bằng `this.load.image(LABEL_PANEL_KEY, '/assets/ui/fantasy/button-dark.png')` trước khi tạo NineSlice. Giữ URL, key preload và asset manifest đồng bộ nếu chuyển thư mục. HTML preview trong sidecar nhúng bản PNG gốc dưới dạng data URL để không phụ thuộc origin của trang xem mẫu.

## Công thức sức khỏe

Hàm thuần `src/ui/healthHearts.ts:getHealthHearts` chuẩn hóa đầu vào rồi tạo phần đầy cho từng ô:

```text
maximum = maxHp hữu hạn và > 0 ? maxHp : 1
health = hp hữu hạn ? clamp(hp, 0, maximum) : 0
count = max(1, floor(maximum / 20))
filled = health / maximum * count
fill[i] = clamp(filled - i, 0, 1), i = 0 .. count - 1
critical = health / maximum < 0.30
```

| HP hiện tại / tối đa | Số ô | Phần đầy |
| --- | --- | --- |
| 100 / 100 | 5 | 5 tim đầy |
| 50 / 100 | 5 | 2 đầy, 1 nửa, 2 rỗng |
| 150 / 150 | 7 | 7 tim đầy |
| 140 / 150 | 7 | 6 đầy, tim cuối đầy khoảng 53,33% |
| 1 / 1 | 1 | 1 tim đầy trong chế độ một hit |
| 0 / 150 | 7 | 7 tim rỗng |

Số tim làm tròn xuống theo yêu cầu 150 HP → 7 tim. Vì vậy mỗi tim là một phần bằng nhau của pool máu; không được giả định mọi tim luôn bằng đúng 20 HP. Chỉ lớp hiển thị dùng phép tính này. HP thật, maxHP và các phép tính damage/heal của engine giữ nguyên.

Mỗi ô vẽ tim rỗng phía dưới, phủ tim đầy ở trên rồi clip bề rộng bằng `fill[i]`. Bề rộng CSS làm tròn tới 0,01%; không làm tròn thành nửa tim. Ảnh tim giữ hình gốc với `object-fit: contain` trong ô vuông.

## Trợ năng và trạng thái

`HeartRow` có `role="progressbar"`, tên “SỨC KHỎE” theo ngôn ngữ, `aria-valuemin=0`, `aria-valuemax=maximum` và `aria-valuenow=health`. Tooltip và `aria-valuetext` đọc `ceil(health) / maximum HP`. Không hiện con số HP cố định bên cạnh hàng tim. Các ô con là trang trí `aria-hidden`, ảnh alt rỗng để tránh đọc lặp.

HUD dùng tim cỡ `clamp(17px, 2.1cqw, 28px)`; preview chọn anh hùng dùng 18 px với khoảng cách 2 px. Hàng tim có thể xuống dòng. Phần đầy chuyển độ rộng trong 150 ms; `prefers-reduced-motion` và lựa chọn giảm chuyển động tắt chuyển động theo CSS hiện hành.

Focus hổ phách hiển thị riêng với checked/selected. Lỗi form, kẹt đạn, quyền chủ phòng, mất kết nối và kết quả tạo bộ từ phải giữ nội dung bằng chữ. Không dùng skin để thay đổi khả năng bàn phím hoặc luồng pause riêng/co-op.

## Nguồn kiểm tra

CSS và component hiện tại là chuẩn triển khai. Ảnh trong `.impeccable/review/` là mốc review tại thời điểm chụp; ảnh trước lần sửa contrast nút gỗ không thay giá trị màu/lớp nền cuối trong CSS. Tài liệu này ghi cách tích hợp, không tự chứng minh mọi luồng đã được kiểm thử.
