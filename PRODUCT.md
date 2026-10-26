# Zombie Vocabulary Survival

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Phaser 4.2.1 + React + TypeScript, dùng Vite để phát triển và build frontend. Frontend hiện triển khai trên Vercel; backend Node.js trên Railway phục vụ từ điển và phòng co-op qua WebSocket. Mỗi phòng chạy một mô phỏng authoritative trên server; chế độ chơi riêng dùng engine cục bộ sau khi nạp từ điển.

## Product Purpose

Game 2D survival chơi riêng hoặc cùng bạn: nhớ từ vựng tiếng Anh và nhập đáp án để bắn zombie. Người dùng chốt “hết từ điển là thắng”: không giới hạn trận ở kho 240 từ mẫu, không tự lặp lại từ đã gặp, chiến thắng khi dùng hết kho từ điển của game và dọn sạch đợt cuối. Có tổng kết và xem lại từ sau trận. Learn English to Survive.

## Users

Người học tiếng Anh sử dụng bàn phím desktop; tuổi và mức CEFR cụ thể chưa chốt. Mobile không thuộc trải nghiệm chơi đầy đủ của prototype.

## Capabilities and Constraints

Bốn dạng câu đố; mỗi chữ đúng là một projectile; sai kẹt đạn; địch khựng ngắn trừ Boss. Side-view hai phía, di chuyển và khóa mục tiêu bằng bàn phím. Kỹ năng anh hùng có điều kiện vị trí; Boss và một số quái báo trước đòn đánh. Bản đồ có thùng nổ, cổng tương tác và vùng hồi máu hữu hạn. Hoàn thành từ chính xác, không dùng gợi ý tích momentum để tăng điểm và tốc độ di chuyển.

Phòng PIN 6 số chứa tối đa 4 người, mỗi người chọn một anh hùng khác nhau. Chỉ chủ phòng bắt đầu hoặc chơi lại; chỉ tham gia khi phòng còn ở sảnh. Mỗi người có HP, vị trí, ô nhập, vật phẩm và năng lượng riêng; điểm, số từ hoàn thành, độ khó và kết quả thuộc cả đội. Mục tiêu được giữ độc quyền ngay khi chọn. Người đã gục theo dõi đồng đội; chỉ khi cả đội gục mới thua. Mất kết nối nhả mục tiêu và dừng di chuyển nhưng nhân vật vẫn có thể bị tấn công; có 20 giây để kết nối lại trước khi ghế được trả lại. Có lựa chọn chơi một mình khi không kết nối được phòng.

Kho Anh–Việt hiện tại nhập từ Dic/English - Vietnamese.csv do người dùng cung cấp, lọc cho cách gõ một từ và giữ nghĩa/từ loại CSV. Không dùng bộ mẫu cũ ghi đè; nguồn và thống kê nhập nằm trong DICTIONARY_SOURCES.md. Từ điển được nạp và kiểm tra trước trận; co-op trao đổi thao tác và trạng thái với server trong chiến đấu. Lịch sử đã gặp giữ qua các lượt/tải lại trên cùng trình duyệt. Trong co-op, lịch sử của các thành viên được hợp lại trước trận, và từ mới xuất hiện được gửi cho cả phòng để lưu tại trình duyệt. Đây là kho hữu hạn có thể cập nhật, không tuyên bố bao gồm mọi từ tiếng Anh.

Sổ Từ đã gặp có tìm kiếm, lọc từ loại/bậc/yêu thích và phân trang 20 mục; tổng kết hỗ trợ xem lại từ của trận. Có nghĩa Việt, ví dụ song ngữ khi dữ liệu có sẵn, lưu yêu thích và đọc phát âm bằng khả năng của trình duyệt. Trạng thái đã gặp, chưa hoàn thành, có lỗi và hoàn thành chính xác được phân biệt; xem lại không tự đưa từ cũ vào pool trận mới.

Co-op hiện chạy một replica Railway, phòng nằm trong RAM và mất khi server deploy hoặc khởi động lại. Chưa có tài khoản, lưu tiến trình cloud, Redis hay leaderboard. Tiến trình và yêu thích lưu trên trình duyệt; khả năng tránh lặp sau tải lại phụ thuộc lưu trữ thành công, có thông báo khi lỗi.

## Brand Commitments

Cute Zombie Arcade, pixel art, nền thành phố xanh than và HUD đọc chữ rõ. Từ 25/10/2026, nhân vật dùng toàn bộ hai pack Tiny RPG Full trong new_asset: 9 anh hùng có thể chọn và 33 quái vật, giữ palette/animation gốc. Tài liệu nền: GAME_DESIGN.md, ART_DIRECTION.md, ANIMATION_SPEC.md và CHARACTER_ROSTER.md. Registry hiện tại ở src/game/characterCatalog.generated.json; các bộ nhân vật trước đó là tư liệu cũ.

Mỗi anh hùng có kiểu tấn công và kỹ năng riêng theo vũ khí/phép của mình. Kỹ năng tự tích bằng ký tự đúng mới; không tự giải từ hoặc dùng súng chung cho mọi nhân vật.

Nhân vật hiển thị ở 85% kích thước trước đó. Kho từ chia 10 bậc học ước lượng từ dễ đến khó và có bộ lọc từ loại/bậc trong sổ từ. Mỗi trận bắt đầu bậc 1; cứ 20 từ hoàn thành tăng một bậc, tối đa bậc 10. Trong co-op, tiến độ này tính theo số từ hoàn thành của cả đội. Lịch sử tránh lặp vẫn cộng dồn qua các trận; khi một bậc hết từ mới, chọn từ ở bậc khả dụng tiếp theo theo quy tắc trong GAME_DESIGN.md.

Menu giữ gọn, ưu tiên vào trận, phòng cùng bạn và chọn anh hùng; hướng dẫn chi tiết nằm trong Cách chơi. Các tính năng mới tiếp tục dùng thế giới pixel art, nền xanh than, chữ kem và nhấn vàng đã chốt.

## Accessibility & Inclusion

Chữ tiếng Việt có dấu rõ, điều khiển bàn phím, focus hiển thị, tùy chọn Reduced Motion và tắt âm thanh. Chơi riêng tạm dừng cả trận khi mất focus; trong co-op, Esc, mở bảng hoặc mất focus chỉ dừng điều khiển cá nhân, trận vẫn tiếp tục. Màn hình nhỏ hiển thị hướng dẫn dùng máy tính; chưa hỗ trợ chơi bằng bàn phím ảo. Đọc phát âm phụ thuộc hỗ trợ và giọng đọc của trình duyệt, có trạng thái khi không khả dụng. Không dùng màu hoặc âm thanh làm tín hiệu duy nhất.
