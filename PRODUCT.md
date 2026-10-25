# Zombie Vocabulary Survival

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Phaser + React + TypeScript, đề xuất đã được tiếp tục triển khai theo yêu cầu người dùng. Prototype chọn Phaser 4.2.1 để dùng bộ skill Phaser 4 đã cài, Vite để chạy cục bộ. Không triển khai hosting trong giai đoạn này.

## Product Purpose

Game 2D survival với các đợt zombie liên tục: nhớ từ vựng tiếng Anh và nhập đáp án để bắn zombie. Người dùng chốt “hết từ điển là thắng”: không giới hạn trận ở kho 240 từ mẫu, không tự lặp lại từ đã gặp, chiến thắng khi dùng hết kho từ điển của game và dọn sạch đợt cuối. Có tổng kết sau trận. Learn English to Survive.

## Users

Người học tiếng Anh sử dụng bàn phím desktop; tuổi và mức CEFR cụ thể chưa chốt. Mobile không thuộc trải nghiệm chơi đầy đủ của prototype.

## Capabilities and Constraints

Bốn dạng câu đố; mỗi chữ đúng là một projectile; sai kẹt đạn; địch khựng ngắn trừ Boss. Side-view hai phía, khóa mục tiêu bằng bàn phím. Kho Anh–Việt hiện tại nhập từ Dic/English - Vietnamese.csv do người dùng cung cấp, lọc cho cách gõ một từ và giữ nghĩa/từ loại CSV. Không dùng bộ mẫu cũ ghi đè; nguồn và thống kê nhập nằm trong DICTIONARY_SOURCES.md. Nạp dữ liệu local trước trận, không gọi API trong chiến đấu. Lịch sử đã gặp giữ qua các lượt/tải lại trên cùng trình duyệt. Không tài khoản hoặc leaderboard. Đây là kho hữu hạn có thể cập nhật, không tuyên bố bao gồm mọi từ tiếng Anh.

## Brand Commitments

Cute Zombie Arcade, pixel art, nền thành phố xanh than và HUD đọc chữ rõ. Từ 25/10/2026, nhân vật dùng toàn bộ hai pack Tiny RPG Full trong new_asset: 9 anh hùng có thể chọn và 33 quái vật, giữ palette/animation gốc. Tài liệu nền: GAME_DESIGN.md, ART_DIRECTION.md, ANIMATION_SPEC.md và CHARACTER_ROSTER.md. Registry hiện tại ở src/game/characterCatalog.generated.json; các bộ nhân vật trước đó là tư liệu cũ.

Mỗi anh hùng có kiểu tấn công và kỹ năng riêng theo vũ khí/phép của mình. Kỹ năng tự tích bằng ký tự đúng mới; không tự giải từ hoặc dùng súng chung cho mọi nhân vật.

Nhân vật hiển thị ở 85% kích thước trước đó. Kho từ chia 10 bậc học ước lượng từ dễ đến khó và có bộ lọc từ loại/bậc trong sổ từ. Mỗi trận bắt đầu bậc1; cứ 20 từ hoàn thành tăng một bậc, tối đa bậc10. Lịch sử tránh lặp vẫn cộng dồn qua các trận; khi một bậc hết từ mới, chọn từ ở bậc khả dụng tiếp theo theo quy tắc trong GAME_DESIGN.md.

## Accessibility & Inclusion

Chữ tiếng Việt có dấu rõ, bàn phím, focus hiển thị, pause khi mất focus, tùy chọn Reduced Motion và tắt âm thanh. Không dùng màu làm tín hiệu duy nhất.
