# Âm thanh — Zombie Vocabulary Survival

## Nguồn và lựa chọn

Nhạc và một số tín hiệu lấy từ 12 MP3 người dùng cung cấp trong `Sound/`; combat dùng 32 mẫu chọn từ `Sound/Helton Yan's Pixel Combat - Single Files/`. Giữ nguyên file nguồn; bản dùng trong game nằm ở `public/audio/`. Các manifest ghi tên nguồn, SHA-256, thời lượng và cách xử lý. Không tự gán giấy phép hoặc đường dẫn tác giả khi file không có metadata này.

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
| lumora_studios-pixel-explosion-319166.mp3 | Bản cũ còn lưu trong catalog nguồn; combat mới thay bằng Bass Hit/Thud | 0,47 giây |
| lumora_studios-pixel-game-over-319170.mp3 | Thua trận | 2,48 giây |

Combat mới dùng các nhóm sau, có 2–4 biến thể mỗi nhóm và tránh lặp lại ngay cùng mẫu:

| Tình huống | Nhóm nguồn |
| --- | --- |
| Kiếm / giáo | Sword Slash, Bit Sword |
| Rìu | Homerunner |
| Cung / phát bắn | High Whoosh |
| Phép thường | Water Bolt |
| Đỡ đòn | Sword Parry, Sword Deflect |
| Hồi máu / thánh vực | Simple Heal, Healing Gusts |
| Băng | Glassy Sprites |
| Loạt tên của Người lính | Thousand Needles |
| Va chạm với quái | Smack, gain thấp |
| Người chơi bị thương | Smack, Strong Smack |
| Boss đập đất | Bass Hit, Thud |
| Gõ sai | Denied |

Giữ tín hiệu tổng hợp cho nhặt đồ, các kỹ năng không có mẫu riêng và chiến thắng; chúng cũng là fallback nếu sample tải lỗi. Không phát nhạc Game Over cho chiến thắng. Hai file `pixel-sound-effect-2/4` tên chung và bản Game Over của Alphix chưa được gán; nguồn vẫn được giữ. Lựa chọn dựa trên tên file/chức năng và phân tích PCM. Phiên công cụ không hỗ trợ nghe trực tiếp để đánh giá âm sắc; không ghi nhận đây là một lần thẩm âm hoàn chỉnh.

## Phát và điều khiển

- Một phần tử HTMLAudio phát nhạc dạng stream, không giải mã toàn bộ playlist thành PCM trước khi chơi. Chuyển bài theo sự kiện `ended`, không dùng thời lượng ước đoán để đặt timer.
- Một AudioContext cho các hiệu ứng ngắn. Chuẩn bị các sample sau tương tác đầu tiên, không chặn trận; các cue dùng chung URL chỉ giải mã một lần. Nếu chưa sẵn sàng thì phát tín hiệu tổng hợp ngay thay vì xếp hàng tiếng trúng đòn muộn. Chỉ mở âm thanh sau tương tác bàn phím/con trỏ; lỗi autoplay được chờ lần tương tác tiếp theo, không thử lại liên tục mỗi frame.
- Âm lượng mặc định: nhạc 25%, hiệu ứng 60%; từng sample còn có gain riêng. Nút tắt âm thanh điều khiển cả hai. Các mức được lưu cùng settings cũ, không ảnh hưởng lịch sử từ.
- Bảng **Nhạc và âm thanh** có tên bài, vị trí trong playlist, trạng thái, nút **Bài tiếp theo** và hai thanh âm lượng. Mở bảng trong trận sẽ pause; bài chọn phát khi tiếp tục.
- Tối đa 8 hiệu ứng đồng thời, nhóm đòn gõ chữ có giới hạn riêng; có khoảng cách tối thiểu theo loại để tránh dồn tiếng. Bị thương/đòn Boss được ưu tiên hơn tiếng gõ và va chạm nhỏ. Âm thanh được phát từ sự kiện simulation đã giải quyết, không từ frame animation và không tạo damage. Co-op chọn tiếng theo anh hùng thực hiện đòn.
- Nếu tải/giải mã một hiệu ứng thất bại, dùng tín hiệu tổng hợp ngắn. Bài nhạc lỗi được bỏ qua, dừng thử khi hết bài khả dụng; game vẫn hoạt động. Unmount/shutdown hủy listener, media, voice và yêu cầu tải đang chờ.
- `Phaser` tiếp tục cấu hình `noAudio: true` vì trình điều khiển này sở hữu một AudioContext riêng như kiến trúc trước; không tạo thêm SoundManager/context thứ hai.

## Tái tạo asset

Chạy `node scripts/import-audio-assets.mjs` sau khi cập nhật lựa chọn nguồn trong script. Script xuất catalog TypeScript/JSON, các bản MP3 dùng trong game và `public/audio/audio-manifest.json`; không thay nội dung MP3 nguồn. Preview từ các đoạn MPEG frame đầu nằm trong `.impeccable/review/audio-preview.mp3`, thứ tự đoạn ở JSON cùng tên.

Kết quả kiểm tra runtime và browser được ghi trong `PROTOTYPE_QA.md`.

### Bộ combat Helton Yan

Chạy `python scripts/import-combat-audio.py` với NumPy để tái tạo 32 WAV và `combatAudioCatalog.generated.json`. `public/audio/combat-manifest.json` lưu nguồn, hash trước/sau, vùng trim, gain và thời lượng. Tổng dung lượng 2.533.076 byte (~2,42 MiB); không đóng gói toàn bộ 2.100 WAV gốc.

Nguồn PCM24 stereo 96 kHz được chuyển thành mono PCM16 48 kHz qua FIR chống alias 255 taps. Cắt khoảng lặng, giới hạn đuôi theo loại đòn, fade đầu 1 ms/cuối 30 ms và giới hạn peak -3 dBFS để tránh click/clipping. Không chỉnh sửa file nguồn, không thay playlist. Importer MP3 cũ độc lập với catalog combat nên chạy lại không xóa lựa chọn mới.
