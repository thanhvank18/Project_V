# Hiệu năng và chuyển động — 28/10/2026

## Các nguyên nhân đã xác nhận

- Server bước mỗi 25 ms và gửi trạng thái mỗi hai bước, khoảng 20 Hz. Trước đây `RoomClient` gán thẳng tọa độ nhận được vào sprite: canvas có thể đạt 60 FPS nhưng vị trí chỉ đổi 20 lần/giây.
- `worldBackdrop` giữ 4.044 hình chữ nhật và 14 đường trong một Graphics cho toàn bộ đường dài 6.400 px. Command buffer được xử lý lại khi render dù phong cảnh không thay đổi.
- Phaser 4.2.1 `TextStyle.setColor` không kiểm tra màu cũ. Gọi nó mỗi frame cho nhãn đồng đội/quái làm rasterize và cập nhật texture kể cả khi màu không đổi.

## Thay đổi

- Nội suy tuyến tính tọa độ hiển thị trong 50 ms giữa các gói mạng. HP, target, command, shot/impact và `snapshot.playerX` vẫn là trạng thái server. Không ngoại suy nếu thiếu gói. Spawn, chết, bắt đầu/kết thúc trận, reconnect và bước lao tức thời của Boss được cập nhật ngay. Đồng hồ hiển thị không lùi khi gói thường đến sớm.
- Phong cảnh tĩnh được dựng một lần vào năm RenderTexture tối đa 1.280×720, khoảng 17,6 MiB màu RGBA chưa tính overhead GPU. Chỉ hiện các mảng trong khung nhìn. Nhãn địa danh giữ riêng để đổi ngôn ngữ. Vẽ lại khi WebGL khôi phục; hủy nguồn và listener cùng scene.
- Chỉ đổi màu nhãn khi màu thực sự thay đổi. Memo hóa hàng tim với props HP/maxHP và giảm các lần đọc snapshot không cần thiết trong input React.
- Giữ nguyên hiệu ứng, sprite, luật damage, tần số server và bộ FantasyUI.

## Cách đo

Mở game với `?perf=1` để hiện bộ đo tùy chọn. Không có tham số này thì không tạo listener/bộ đệm đo. Bộ đo cập nhật chữ tối đa một lần/giây, dùng cửa sổ tối đa 180 frame đang được focus:

- FPS và frame p95 từ `game.loop.rawDelta`, không dùng delta đã làm mượt.
- CPU từ `prestep` đến `postrender`: gồm update và gửi lệnh vẽ của Phaser, **không** bao gồm thời gian GPU hoàn tất hay toàn bộ React/DOM.
- `>25 ms` đếm frame chậm trong cửa sổ. Khi cửa sổ mất focus/ẩn thì bỏ mẫu và bắt đầu lại lúc quay về.

Không chạy build/test cùng lúc khi so sánh. Giữ cùng trình duyệt, kích thước cửa sổ, số quái và cảnh chơi; đo cả chạy, gõ, Boss và sau vài phút chơi. Bộ đo không gửi dữ liệu ra ngoài.

## Bằng chứng kiểm tra

- Lượt local trước khi cache nền: 4 quái, 60,0 FPS, frame p95 16,8 ms, CPU trung bình 1,90 ms/p95 2,70 ms.
- Lượt local sau thay đổi, đã chạy sang Công viên: 4 quái, 60,0 FPS, frame p95 16,8 ms, CPU trung bình 1,17 ms/p95 1,90 ms, 0/180 frame trên 25 ms.
- Đây là các mẫu ngắn, khác vị trí bản đồ; không phải benchmark kiểm soát để công bố phần trăm tăng tốc. Có mẫu thấp hơn nhiều trong lúc build/HMR nên không dùng các mẫu đó để kết luận cải thiện. Không bảo đảm 60 FPS trên mọi máy hoặc khi quái đông.
- Tests bảo vệ nội suy/authority, Boss charge, vòng đời phòng, cache/culling/khôi phục texture và nhãn chữ. Browser đã kiểm tra chạy qua vùng bản đồ, nhập từ và giữ hình FantasyUI.

Nếu còn spike khi bắn liên tục, bước điều tra tiếp theo là cấp phát/hủy texture chữ và garbage collection; chưa thay bằng pooling khi chưa có phép đo xác nhận.
