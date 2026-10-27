# Nhân vật và kỹ năng — 25/10/2026

Quyết định hiện tại: dùng toàn bộ 42 nhân vật trong hai pack Tiny RPG Full tại `new_asset`. Chín nhân vật phe thiện cho người chơi chọn trước trận; 33 nhân vật còn lại là quái vật. Hình gốc và animation native thay thế các bộ nhân vật cũ trong runtime. Mỗi anh hùng có vũ khí, kiểu tấn công và kỹ năng riêng.

## Chín anh hùng

| Nhân vật nguồn | Tên trong game | Kiểu ra đòn | Kỹ năng tự động | Chữ đúng mới cần tích |
|---|---|---|---|---|
| Archer | Cung thủ | Tên chữ | Tên đẩy lùi: đẩy mục tiêu 28 đơn vị | 6 |
| Armored Axeman | Chiến binh rìu | Lưỡi rìu chữ | Chấn động rìu: khựng 0,6 giây trong vùng 150 quanh mục tiêu | 10 |
| Knight | Hiệp sĩ | Nhát kiếm | Khiên thép: chặn một đòn, tồn tại tối đa 8 giây | 10 |
| Knight Templar | Hiệp sĩ dòng Đền | Thánh thương | Vùng thánh bảo hộ: giảm 35% damage nhận trong 3 giây | 12 |
| Lancer | Thương thủ | Mũi thương | Thương phá trận: đẩy tối đa 60 đơn vị các quái trên đoạn tới mục tiêu | 8 |
| Priest | Tu sĩ | Ánh sáng thánh | Ánh sáng hồi phục: hồi 5 HP, tối đa 100 | 12 |
| Soldier | Người lính | Loạt tên chữ | Loạt tên ghìm chân: giảm 55% tốc độ mục tiêu trong 2 giây | 8 |
| Swordsman | Kiếm sĩ | Đường kiếm vòng | Vòng kiếm phản kích: đẩy tối đa 42 đơn vị các quái trong vùng 160 quanh người chơi | 8 |
| Wizard | Pháp sư | Phép chữ | Vòng băng: đóng băng 1 giây trong vùng 150 quanh mục tiêu | 12 |

Khoảng cách tính theo đơn vị thế giới của simulation; UI mô tả bằng phạm vi tương đối. Tốc độ cơ bản và sát thương giải từ giữ nguyên. Không có phím kích kỹ năng riêng: ký tự đúng mới đã tung đòn cộng một năng lượng, đầy thanh tự kích rồi bắt đầu tích lượt kế tiếp. Nhập sai, phím bị bỏ qua lúc kẹt, chữ chưa tung trong hàng chờ và gõ lại chỉ số ký tự đã credited không cộng năng lượng.

Cập nhật 27/10/2026: Armored Axeman, Knight, Knight Templar, Lancer, Swordsman là cận chiến với 150 HP. Kiếm/rìu có tầm 120 px; hai anh hùng dùng thương có tầm 160 px; cộng 100 px khi đánh thân Boss. Archer, Priest, Soldier, Wizard đánh xa với 100 HP. Gõ đúng cho cận chiến tự áp sát, giữ chữ chờ và chỉ tung trong tầm; phím di chuyển ngắt áp sát để rút lui. Quái thường cho đi xuyên, Boss chặn. Đây là thông số cân bằng ban đầu trong `src/game/heroCombat.ts`, không phải cân bằng đã xác nhận qua chơi dài hạn. Thương thủ tăng lực đẩy 1,5 lần khi ra đòn ở khoảng cách từ 120 px trong tầm thương.

Boss miễn đẩy, khựng, làm chậm và đóng băng. Kỹ năng vùng chỉ tác động mục tiêu có thể nhắm, không xuyên qua khiên bảo hộ của Tank. Đẩy lùi bị giới hạn bởi biên bản đồ và thứ tự địch, không đưa chúng xuyên qua nhau. Các kỹ năng không tự giải, bỏ qua hoặc gây damage từ vựng, không tạo kill/loot. Khiên Hiệp sĩ chỉ chặn một đòn, không cộng dồn; đòn bị chặn không phát player-hurt/rung màn hình.

Chọn nhân vật được lưu trong `zvs-settings-v1.heroId`; mặc định Soldier nếu ID thiếu, cũ hoặc thuộc phe địch. Đổi được ở menu/kết thúc trận; chơi lại dùng lựa chọn đã lưu nhưng reset năng lượng và hiệu lực kỹ năng. Pause/countdown đóng băng thời gian kỹ năng.

## 33 quái vật

| Vai trò gameplay | Số lượng | Nhân vật nguồn |
|---|---:|---|
| Thường | 12 | Necromancer, Orc, Skeleton, Skeleton Archer, Slime, Demon_C, Demoness_A, Demoness_B, Eyeball Monster, Ghostfire, Lava Slime, Warlock |
| Nhanh | 7 | Bat, Orc rider, Werewolf, Demon_A, Demon_E, Hellbat, Hellhound |
| Giáp | 8 | Armored Orc, Armored Skeleton, Elite Orc, Greatsword Skeleton, Black Knight_A, Black Knight_B, Black Knight_C, Demon_B |
| Boss bảo hộ | 6 | Werebear, Blood Monster_A, Blood Monster_B, Demon_D, Flame Golem, Minotaur |

Mỗi pool luân phiên ngoại hình sau spawn thành công và giữ lượt qua chơi lại trong cùng phiên. Ngoại hình không thêm lần gọi RNG, không đổi stats/spawn của bốn vai trò. Mọi quái có thể xuất hiện; game không chỉ chọn một mẫu cố định của mỗi loại. `appearanceId` tồn tại suốt lúc sống, trúng đòn, đánh và chết.

## Nguồn và tái tạo

- Pack 01: `Tiny RPG Character Asset Pack 01 v2.0 -Full 22 Characters` — 22 nhân vật.
- Pack 02: `Tiny RPG Character Asset Pack 02 v1.01-Full 20 Characters` — 20 nhân vật; thư mục con tên không có `v1.01`.
- Nguồn PNG split không bóng và Aseprite đã lưu tại `assets/native-catalog/<id>/source/`.
- Metadata từng clip, hash nguồn, duration, contact/release frame, bounds và origin: `assets/native-catalog/<id>/metadata.json`.
- `scripts/import-character-catalog.mjs` nhập từ pack; `--retained` tái tạo từ nguồn đã lưu. `scripts/prepare-assets.mjs` xuất public art.
- `src/game/characterCatalog.generated.json` chứa 42 nhân vật, 210 clip; `src/game/heroSkills.ts` là nguồn thông số kỹ năng.
- `/character-review.html` xem đủ roster và các clip đứng, đi/bay, đánh, trúng đòn, chết; có dừng, bước từng khung và đổi hướng.

Giữ PNG native 100×100, tổng 1.265 khung; không nội suy, vẽ lại hoặc upscale file. Phaser scale nearest-neighbor khi vẽ; texture giải mã của các clip nhân vật khoảng 48,26 MiB. Khung Death cuối trống vốn có trong nguồn được giữ nguyên.

Theo phản hồi 25/10, facade runtime nhân `displayScale` với 0,85 để tất cả nhân vật nhỏ hơn 15%. Metadata gốc và PNG giữ nguyên; điểm neo và hiệu ứng bám theo tỉ lệ mới.
