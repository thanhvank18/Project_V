# Âm thanh — Zombie Vocabulary Survival

## Nguồn và lựa chọn

Âm thanh lấy từ 12 MP3 người dùng cung cấp trong `Sound/`. Giữ nguyên file nguồn; bản dùng trong game nằm ở `public/audio/`. Manifest ghi tên nguồn, SHA-256, thời lượng đo từ MPEG frames và lý do chọn/bỏ. Không tự gán giấy phép hoặc đường dẫn tác giả khi file không có metadata này.

Playlist chạy theo thứ tự:

| Bài | Thời lượng |
| --- | ---: |
| Pixel Song 3 | 50,81 giây |
| Pixel Song 7 | 34,93 giây |
| Pixel Song 12 | 31,76 giây |
| Pixel Song 16 | 50,73 giây |
| Pixel Song 21 | 60,32 giây |
| Pixel Song 27 | 31,76 giây |

Cả 6 bài có MPEG payload khác nhau. Khi bài kết thúc, chuyển sang bài kế; hết bài 27 thì quay lại bài 3, tiếp tục vô hạn trong lúc chơi. Không lặp riêng một bài. Khi pause, đếm ngược, về menu, kết thúc trận hoặc mất focus, nhạc dừng và giữ vị trí. Trận tiếp theo tiếp tục vị trí đang nghe; tải lại trang bắt đầu playlist từ đầu.

Hiệu ứng dùng từ thư mục:

| File nguồn | Tình huống | Thời lượng |
| --- | --- | ---: |
| freesound_community-pixel-death-66829.mp3 | Hạ quái | 1,99 giây |
| lumora_studios-pixel-explosion-319166.mp3 | Boss đập đất, kể cả khi người chơi né được | 0,47 giây |
| lumora_studios-pixel-game-over-319170.mp3 | Thua trận | 2,48 giây |

Giữ các tín hiệu tổng hợp ngắn cho chữ, va chạm, kẹt đòn, bị thương, nhặt đồ, kỹ năng và thắng kho từ. Không phát nhạc Game Over cho chiến thắng. Hai file `pixel-sound-effect-2/4` tên chung và bản Game Over của Alphix chưa được gán; nguồn vẫn được giữ. Lựa chọn hiện dựa trên tên file/chức năng và thời lượng. Phiên công cụ không hỗ trợ nghe trực tiếp để đánh giá âm sắc; không ghi nhận đây là một lần thẩm âm hoàn chỉnh.

## Phát và điều khiển

- Một phần tử HTMLAudio phát nhạc dạng stream, không giải mã toàn bộ playlist thành PCM trước khi chơi. Chuyển bài theo sự kiện `ended`, không dùng thời lượng ước đoán để đặt timer.
- Một AudioContext cho các hiệu ứng ngắn. Chuẩn bị 3 sample ngắn sau tương tác đầu tiên, không chặn trận; nếu chưa sẵn sàng thì phát tín hiệu tổng hợp ngay thay vì xếp hàng tiếng trúng đòn muộn. Chỉ mở âm thanh sau tương tác bàn phím/con trỏ; lỗi autoplay được chờ lần tương tác tiếp theo, không thử lại liên tục mỗi frame.
- Âm lượng mặc định: nhạc 25%, hiệu ứng 60%; từng sample còn có gain riêng. Nút tắt âm thanh điều khiển cả hai. Các mức được lưu cùng settings cũ, không ảnh hưởng lịch sử từ.
- Bảng **Nhạc và âm thanh** có tên bài, vị trí trong playlist, trạng thái, nút **Bài tiếp theo** và hai thanh âm lượng. Mở bảng trong trận sẽ pause; bài chọn phát khi tiếp tục.
- Tối đa 8 hiệu ứng đồng thời, riêng tiếng chữ tối đa 2; có khoảng cách tối thiểu theo loại để tránh dồn tiếng. Âm thanh được phát từ sự kiện simulation đã giải quyết, không từ frame animation và không tạo damage.
- Nếu tải/giải mã một hiệu ứng thất bại, dùng tín hiệu tổng hợp ngắn. Bài nhạc lỗi được bỏ qua, dừng thử khi hết bài khả dụng; game vẫn hoạt động. Unmount/shutdown hủy listener, media, voice và yêu cầu tải đang chờ.
- `Phaser` tiếp tục cấu hình `noAudio: true` vì trình điều khiển này sở hữu một AudioContext riêng như kiến trúc trước; không tạo thêm SoundManager/context thứ hai.

## Tái tạo asset

Chạy `node scripts/import-audio-assets.mjs` sau khi cập nhật lựa chọn nguồn trong script. Script xuất catalog TypeScript/JSON, các bản MP3 dùng trong game và `public/audio/audio-manifest.json`; không thay nội dung MP3 nguồn. Preview từ các đoạn MPEG frame đầu nằm trong `.impeccable/review/audio-preview.mp3`, thứ tự đoạn ở JSON cùng tên.

Kết quả kiểm tra runtime và browser được ghi trong `PROTOTYPE_QA.md`.
