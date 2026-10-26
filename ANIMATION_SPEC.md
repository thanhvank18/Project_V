# Zombie Vocabulary Survival: Animation Specification

Cập nhật: 25/10/2026. Nhân vật runtime dùng toàn bộ hai pack Tiny RPG Full: 42 nhân vật, 210 clip native và 1.265 khung hình. Nguồn và metadata ở `assets/native-catalog/`; đăng ký ở `src/game/characterCatalog.generated.json`. Các bộ nhân vật trước đây được giữ làm tư liệu, không nạp vào runtime. Mỗi anh hùng dùng vũ khí, kiểu phóng chữ và kỹ năng riêng theo yêu cầu mới.
Đọc cùng GAME_DESIGN.md và ART_DIRECTION.md.

## Nguyên tắc đã chốt

Một ký tự đúng tạo đạn mang ký tự đó. Đạn bay từ vũ khí/phép của anh hùng đến quái, va chạm có phản ứng rõ. Ký tự cuối kết liễu hoặc phá giáp/gây sát thương Boss. Sai gây kẹt đạn. Mỗi lần đạn chữ có hiệu lực chạm trúng đặt lại khựng 300 ms cho mọi địch không phải Boss; Boss không khựng.

Input không chờ animation bắn, trúng, chết hoặc ăn mừng. Ngoại lệ có chủ đích là thời gian kẹt đạn, pause và kết thúc trận. Không làm chậm toàn game để biểu diễn hit: đây là trạng thái riêng của từng zombie.

## Thông số thử nghiệm

| Thông số | Giá trị ban đầu | Trạng thái |
|---|---|---|
| Kẹt đạn | 300 ms | Cần playtest |
| Normal khựng | 300 ms | Theo phản hồi playtest 22/10/2026 |
| Runner khựng | 300 ms | Theo phản hồi playtest 22/10/2026 |
| Armored khựng | 300 ms | Theo phản hồi playtest 22/10/2026 |
| Boss khựng do đạn chữ | 0 ms | Quy tắc cố định |
| Miễn khựng sau khi kết thúc khựng | Không có | Mỗi lần trúng có hiệu lực đặt lại đủ 300 ms |
| Tốc độ cơ sở Runner | 33 px/giây | Tăng 1,5× từ 22 px/giây |
| Glyph đạn | 22 px → khoảng 40 px sau 450 px bay | Lớn theo quãng đường thực, có giới hạn |
| Cung đạn | 5 px | Nằm trong giới hạn 6 px; Reduced Motion 0 px |
| Hit shatter | 210 ms | Reduced Motion 115 ms, lõi/vết nứt gọn |
| Shake khi người chơi bị thương | 190 ms | Reduced Motion tắt |

Mỗi hit có hiệu lực đặt thời điểm hết khựng thành thời điểm va chạm +300 ms, kể cả khi đang khựng; không cộng thêm 300 ms vào thời gian còn lại. Không có cửa sổ miễn khựng. Chuỗi trúng có thể giữ địch đứng đến 300 ms sau hit cuối. Đạn gõ lại vị trí đã tính không gia hạn khựng. Giữ lại thời gian còn lại của telegraph/cooldown khi bị khựng, không gây đòn đánh ngay khi hết khựng. Elite/Reward chưa có trong prototype.

Các giá trị trên là thông số renderer/prototype hiện tại, còn cần playtest để cân chỉnh. Tốc độ hình đạn dùng tiến độ tăng tốc `0.36p + 0.64p²` với `p` tính từ firedAt/impactAt; thời gian va chạm do simulation quyết định. Mọi duration theo thời gian, không phụ thuộc FPS render.

## Chuỗi sự kiện đạn chữ

1. Nhận key hợp lệ khi đang chơi và không kẹt.
2. So với các prefix đáp án còn hợp lệ của câu đố đang chọn.
3. Đúng: ghi nhận tiến độ ngay; phát clip tấn công native và tạo projectile có glyph đúng chiều đọc, bao quanh bằng tên/nhát chém/phép tương ứng anh hùng.
4. Projectile tăng tốc từ điểm phát đòn tới thân mục tiêu, glyph đúng chiều đọc và lớn dần theo quãng đường bay với kích thước có giới hạn; vệt ngắn theo sau, cung cong tối đa 6 px, không phủ UI.
5. Chạm: glyph vỡ thành mảnh góc cạnh phát sáng cyan/tím/vàng và vết nứt mảnh gợi Arcane, kèm hurt cục bộ; mọi địch không phải Boss nhận hit có hiệu lực đều đặt lại khựng 300 ms.
6. Đạn hoàn tất câu đố: chuyển death, break-armor hoặc boss-damage.
7. Input có thể đã ở mục tiêu kế tiếp; hiệu ứng cũ không được đổi target hoặc reset ô nhập mới.

Mỗi projectile mang shotId, targetId, challengeId, chỉ số tiến độ và mốc firedAt/impactAt trên simulation clock. Renderer kết thúc đúng shotId khi nhận hit để hình và tác động tới cùng một thời điểm. Event va chạm có tính idempotent. Không để đạn cũ bắn nhầm lớp giáp/phase mới. Đạn không xuyên qua sang zombie khác để gây hiệu lực ngoài câu đố đã khóa.

Khi Tank dựng khiên, chỉ ngăn chọn/bắn mới vào địch xa hơn phía sau cùng phía. Projectile đã phát vẫn hoàn tất theo shotId và mốc va chạm đã có; renderer không xóa hoặc chặn ngược các viên đang bay chỉ vì mục tiêu vừa được che.

Địch đang nhận đòn kết liễu bị vô hiệu damage lên người chơi ngay khi đáp án hoàn thành. Nếu mục tiêu/câu đố không còn hợp lệ khi đạn đến, chỉ kết thúc hiệu ứng, không gây tác động lên mục tiêu khác. Kiểm thử riêng gõ rất nhanh, đạn đến đảo thứ tự, restart, pause và chuyển Boss phase.

## Nhập sai và phục hồi

Sai → tiếng báo lỗi → giật hụt/hiệu ứng chữ lỗi → chỉ báo Kẹt đạn → sẵn sàng. “Kẹt đạn” giữ tên cơ chế cũ; nhân vật dùng vũ khí hoặc phép riêng, không gắn súng chung.

Giữ các chữ đúng. Không thêm chữ sai vào tiến độ. Trong 300 ms đề xuất, không tạo đạn, không queue ký tự và không cộng lỗi từ phím bị bỏ qua. Các lệnh pause vẫn phải hoạt động. Khi game bị pause, thời gian kẹt không trôi ngầm.

Phản hồi phục hồi phải vừa khoảng kẹt; không có phần animation tiếp tục khóa input ngoài timer. Không thêm reload định kỳ.

## Animation nhân vật

| Trạng thái | Ý đồ | Quy tắc |
|---|---|---|
| Idle | Thở/nhún rất nhẹ | Loop, không gây nhiễu đọc |
| Aim | Quay đúng phía, chuẩn bị vũ khí/phép | Chuyển nhanh theo mục tiêu |
| Move | Di chuyển trái/phải bằng phím mũi tên | 160 px/giây, x=240–6160 trong world 6400 px; không xuyên zombie, không chiếm phím chữ |
| Shoot | Clip tấn công native và hiệu ứng riêng của anh hùng | Có thể kích hoạt liên tiếp, không khóa phím |
| Jam / Clear | Giật hụt, chữ lỗi, phục hồi | Khớp timer kẹt |
| Hurt | Nhăn mặt/giật thân, screen shake ngắn | Không xóa tiến độ từ; chỉ rung lớp thế giới |
| Death | Khuỵu rồi ngã | Chuyển Game Over, dừng gameplay |
| Boss Defeat | Vui ngắn | Không khóa input khi trận còn tiếp tục |
| Vocabulary Complete | Ăn mừng hoàn thành bộ từ | Chỉ sau khi hết địch/đạn; dừng gameplay, không chạy Death hoặc tự sinh từ cũ |

Hiệu ứng projectile tách khỏi clip toàn thân; gõ nhanh không liên tục đưa clip về frame đầu hoặc làm mất feedback hurt. Chi tiết chín kiểu tấn công và ngưỡng kỹ năng nằm trong `CHARACTER_ROSTER.md`. Kỹ năng dùng clock trận, tạm dừng cùng simulation; Reduced Motion giữ tín hiệu tĩnh và fade. Burst kỹ năng sống tối đa 750 ms, giới hạn 12 burst và 6 điểm đích mỗi burst.

Sprite và điểm phát glyph theo `playerX` hiện tại (khởi tạo 640); hướng ngắm/che chắn tính lại theo vị trí người chơi. Camera bám mượt vị trí đó và giới hạn ở biên world 6400 px; HUD/input/nhãn giữ ổn định trước rung và choáng. Pause, blur, menu và death dừng chuyển động, không giữ trạng thái phím mũi tên để tự chạy sau khi tiếp tục.

## Animation zombie

Walk/Run loop có nhịp khác nhau theo loại. Trúng chữ giật cục bộ nhẹ; trong khoảng khựng dừng tiến, không áp dụng slow motion lên địch khác. Không lùi zombie sau mọi viên đạn trừ khi có mechanic được duyệt.

### Chu kỳ di chuyển và hành động — cập nhật 25/10/2026

- **Tất cả 42 nhân vật** dùng PNG split 100×100 không bóng nguyên bản. Mỗi nhân vật có Idle, Move (Walk hoặc Flying), Attack, Hurt và Death; số khung và thời lượng theo tag Aseprite, không áp một số frame chung hoặc nội suy pose giả. Tọa độ trong canvas giữ nguyên; scale và origin cố định theo nhân vật giữa các action.
- Tỉ lệ hiển thị chung được nhân 0,85 theo phản hồi 25/10; áp dụng nhất quán cho Idle/Move/Attack/Hurt/Death và vị trí hiệu ứng. Không đổi số frame, thời lượng, pixel nguồn hoặc collision gameplay.
- **Chọn đòn đánh:** dùng đòn gốc phù hợp từng nhân vật; Soldier dùng Attack03 bắn cung, Demon A dùng Attack02, các lựa chọn khác được ghi trong metadata của từng nhân vật. Điểm tiếp xúc/nhả đòn được đối chiếu hình pose và khai báo bằng index từ 0.
- **Quái vật:** dùng appearanceId đã chọn lúc spawn xuyên suốt live/hurt/attack/death. Không đổi lại bộ zombie cũ sau hit hoặc khi đang fade. Boss giữ cùng ngoại hình qua cả ba phase, dùng tint và trạng thái Rage để báo mức nguy hiểm.
- Frame bước chân tiến theo quãng đường simulation: mỗi vòng tương ứng 14 px (Normal), 22 px (Runner), 12 px (Armored), 10 px (Tank). Không chạy chân tại chỗ khi pause, freeze, stun hoặc đang ra đòn. Các zombie bắt đầu khác pha để tránh bước đồng loạt.
- **Anh hùng** lấy đủ frame Walk gốc, chu kỳ theo quãng đường 84 px. Khi vừa di chuyển vừa nhập chữ, giữ bước chân và vẽ phản hồi vũ khí riêng; Hurt, Death và Jam có ưu tiên. Quay theo hướng di chuyển, giữ hướng khi dừng; ra đòn khi đứng yên quay theo phát đánh. Tự chọn mục tiêu không đổi hướng nhân vật. Thiếu animation riêng cho Jam/ăn mừng dùng Idle cùng nhân vật kết hợp feedback, không đổi sang skin cũ.
- **Attack** đọc `attackContactFrame`, `releaseFrame` và thời lượng từng frame. Địch co phần lấy đà theo windup thật, bắt đầu pose chạm đúng sự kiện `attack-impact`, hồi đòn 260 ms. Anh hùng phát glyph ngay khi key hợp lệ và dùng pose nhả đòn của vũ khí, không bắt nhập chờ hết lấy đà. Freeze/stun/pause giữ đồng hồ tương ứng; animation không tự gây damage.
- **Death** đặt lại angle/scale/vị trí nền trước khi phát clip, chạy hết thời lượng của từng loại, giữ 80 ms rồi fade 240 ms. Không cắt sớm animation chết của Boss hoặc để xác giữ tư thế giật/lao trước đó.

Nguồn và metadata đóng gói nằm trong `assets/native-catalog/`; `node scripts/import-character-catalog.mjs --retained` tái tạo từ bản nguồn đã lưu, `node scripts/prepare-assets.mjs` xuất tập runtime. Trang `/character-review.html` cho xem toàn bộ 42 nhân vật/từng khung/cả hai hướng theo metadata thực. Bốn Death có khung cuối trống được giữ đúng nguồn: Black Knight C, Blood Monster B, Necromancer, Warlock; không tự vẽ thêm hoặc kéo dài xác. Kỹ năng anh hùng do simulation quyết định, renderer chỉ phát hiệu ứng theo sự kiện.

### Phản hồi địch tấn công người chơi — yêu cầu bổ sung 22/10/2026

Đặc tả sau đã được triển khai theo yêu cầu sau playtest; cú nện Boss đã được quan sát qua trình duyệt, phạm vi xác minh còn lại được ghi riêng trong `PROTOTYPE_QA.md`. Thay đổi này làm rõ hành động và điểm chạm, không đổi sát thương, HP, khoảng đánh, va chạm hoặc cân bằng gameplay.

Engine là nguồn quyết định thời điểm đòn đánh chạm qua sự kiện `attack-impact`. Renderer không suy ra đòn trúng chỉ từ animation, khoảng cách sprite hoặc callback tween. Windup theo trạng thái chuẩn bị đòn của simulation; phản hồi gây thương chỉ phát khi sự kiện tương ứng có **HP thực sự giảm**.

- **Zombie thường:** lấy đà ngắn, lao thân về phía người chơi; ở thời điểm chạm, hiện vệt móng vuốt và tia lóe tiếp xúc cục bộ. Khi đòn thật sự gây thương, nhân vật giật thân theo hướng bị đánh và hiện số sát thương bằng lượng HP đã mất. Recoil là độ lệch hình ảnh, không tự dời vị trí hay collider của người chơi.
- **Boss đập đất:** giơ tay/lấy đà rõ → nện xuống nền → vòng xung kích lan ra trong phạm vi **bán kính 300 đơn vị thế giới**, kèm nứt nền, mảnh vụn và bụi ngắn. Cú nện có rung cục bộ mạnh hơn đòn thường, nhưng không rung HUD, ô nhập hay nhãn câu đố. Hiệu ứng không gợi vùng sát thương rộng hơn phạm vi gameplay đã có.
- **Đập hụt:** nếu Boss thực sự nện đất khi người chơi đã ở ngoài tầm, vẫn phát va chạm nền, vết nứt, bụi và vòng xung kích tại Boss. Không phát vết chém lên người, số sát thương hay recoil gây thương nếu HP không giảm. Phân biệt phản hồi môi trường của cú nện với phản hồi người chơi bị đánh.
- **Vòng đời:** windup theo đồng hồ simulation; lunge và burst theo đồng hồ hình ảnh được giữ nguyên khi pause/countdown, resume không chạy bù thời gian. Burst tự hết hạn trong tối đa 820 ms và giữ tối đa 24 impact, dùng chung hai lớp Graphics. Reset/về menu dọn ngay hiệu ứng cũ; sau Game Over hiệu ứng còn lại kết thúc ngắn, không phát thêm đòn hoặc tác động trận mới. Phaser dọn lớp vẽ khi scene bị hủy.
- **Reduced Motion:** bỏ rung và chuyển động giật/lao phụ, giảm mảnh vụn/bụi và chuyển động lan; giữ dấu tiếp xúc, vùng đập và số sát thương dễ đọc. Thời điểm impact cùng kết quả damage giữ nguyên.

Death thể hiện toàn thân: ngã bật, rơi mũ hoặc tan hạt vừa phải. Armored phá giáp có mảnh văng ngắn, không ngăn nhập câu đố tiếp theo. Xác và mảnh vỡ phải được dọn, không giữ collider gây sát thương.

Armored giữ trước 2 từ mới, Tank giữ trước 9 từ dài mới. Chỉ tạo/đổi nhãn và đánh dấu đã gặp khi câu đố thực sự được đưa ra. Animation phá giáp hoặc sát thương tăng cường không được tự hiển thị hay ghi nhận các từ dự trữ đã bị bỏ qua.

## Boss

- Entrance: cảnh báo và xuất hiện rõ; không che input hay giành focus.
- Hit: chớp/rung cục bộ lớp giáp, vẫn tiến và thi triển kỹ năng; không pause animation/timer di chuyển vì đạn chữ.
- Khiên: hướng về người chơi, bảo vệ địch phía sau cùng phía đến khi Tank chết; không tự tắt khi đổi phase hoặc phá giáp. Tanker chính là loại Tank Boss hiện có.
- Attack: giơ tay/chuẩn bị rõ trước khi gây damage; thời gian telegraph cần cân bằng với từ.
- Phase Transition: giữ native sprite, đổi tint/tín hiệu phase; không xóa đáp án đang gõ bất ngờ.
- Rage: dấu hiệu cơ thể và thanh Rage; không chỉ đổi màu hoặc flash liên tục.
- Final Strike: dùng từ mới dài ít nhất 7 ký tự trong chuỗi 9 từ đã giữ, không lặp từ cũ; nhấn mạnh viên cuối. Thất bại có phản công, không mặc định instant death.
- Death: phát trọn Death native của Boss; hủy hitbox tấn công/callback Boss cũ và giải phóng từ giữ trước chưa dùng. Sinh tồn tiếp tục nếu còn từ mới, không khóa nhập vì ăn mừng.

Boss có thể dừng theo choreography được thiết kế, nhưng không được khựng do chữ trúng. Thời gian entrance, transition và áp lực địch phụ cần thiết kế công bằng, chưa tự mặc định pause toàn trận.

Theo quyết định “hết từ điển là thắng”, chỉ khi toàn bộ bank từ điển cục bộ đã tải thực sự không còn từ mới, để địch và projectile hiện tại giải quyết xong rồi phát `vocabulary-complete`. Không dùng mốc 240 từ tự biên soạn làm điều kiện thắng. Trạng thái này dùng phản hồi chiến thắng tích cực, không chạy death của người chơi hoặc tự sinh lại từ cũ. Ghi nhật ký đã gặp diễn ra ở lúc đưa ra câu đố, độc lập với animation kết thúc hoặc lưu thống kê cuối trận.

## Combo, âm thanh và hiệu ứng

Combo tăng độ phong phú của vệt đạn, âm sắc và hiệu ứng kết liễu; không tăng particle vô hạn. Damage multiplier chưa chốt, không suy ra từ hiệu ứng đẹp hơn. Điểm nổi ưu tiên khi hoàn thành từ, tránh số damage mỗi ký tự gây rối.

Âm thanh có lớp shoot, impact, jam, hurt, death, combo và Boss warning. Gõ nhanh cần giới hạn âm thanh đồng thời để tránh quá lớn. Không đọc phát âm từ liên tục chồng lên chiến đấu; vị trí tính năng phát âm còn mở.

Bản âm thanh ngày 25/10/2026 dùng 6 bài pixel từ `Sound/`, chuyển theo sự kiện hết bài rồi lặp cả playlist. `Pixel Death` phát khi hạ quái, `Pixel Explosion` phát tại impact đập đất của Boss (không phát sớm ở windup), `Pixel Game Over` dành cho thua trận. Tín hiệu gõ chữ/va chạm/kỹ năng vẫn ngắn, giới hạn 8 voice, riêng chữ tối đa2. Pause giữ vị trí nhạc; volume nhạc/hiệu ứng và master mute được lưu. Nguồn, mapping, quy tắc lifecycle và giới hạn xác minh trong `AUDIO_SPEC.md`.

Nhân vật bị thương tạo camera shake ngắn ở lớp thế giới, không rung mỗi chữ. HP dưới 30 bật lắc thế giới nhẹ và vignette nhịp chậm báo choáng; HP từ 30 trở lên xóa hiệu ứng choáng. HUD, input và nhãn câu đố dùng lớp ổn định. Weather/parallax không cản đường đọc hoặc che projectile. Biên độ và thời lượng phản hồi tiếp tục được cân chỉnh trong renderer.

## Reduced Motion và hiệu năng

Tắt camera shake, lắc thế giới, dao động vignette và cung cong của đạn; giảm hạt và chuyển động phụ. Giữ tín hiệu nguy hiểm tĩnh, glyph đọc được và cùng mốc firedAt/impactAt/resolve của simulation: Reduced Motion không làm damage/khựng đến sớm hơn chế độ chuẩn.

Khi nhiều đạn, có thể giảm vệt/hạt và tái sử dụng object, nhưng không bỏ glyph hoặc event gameplay. Dọn tween/timer/listener khi đối tượng chết, scene restart hoặc game unmount. Không cho callback animation quyết định luật sống/chết độc lập simulation.

Từ điển được nạp và kiểm tra trước cảnh chơi; không thêm lượt gọi API theo animation spawn/kill hoặc hit. Trạng thái đang tải/lỗi tải có phản hồi riêng và nút thử lại; lỗi tải không được phát animation chiến thắng từ một bank nhỏ thay thế. `WordDeck` giữ bộ đếm cache để snapshot và kiểm tra hết từ không quét cả từ điển theo frame. Nhãn nghĩa dài được rút gọn, nghĩa đầy đủ nằm ở dock mục tiêu; mục nhập Việt → Anh có gợi ý chữ đầu/cuối rõ, không thêm chuyển động làm khó đọc.

## Checklist kiểm tra prototype

Bổ sung 26/10/2026: Boss dùng footprint khóa từ lúc lấy đà cho đập đất/lao tới; quái bắn xa báo vị trí đạn sẽ trúng. Đội hình có dấu vai trò riêng, phân biệt khiên bảo hộ với mục tiêu đang thuộc đồng đội. Thùng/cổng/vùng hồi phục gắn tọa độ thế giới, có trạng thái dùng hết/mở/đóng và tiến độ đứng hồi phục.

Đồng đội co-op dùng cùng sprite pack, có tên/màu/HP riêng. Sự kiện gắn playerId/sourceX để chữ bay từ đúng người; đòn của đồng đội không làm hero cục bộ quay hướng hoặc nhận hiệu ứng bị thương. Người hết HP giữ pose gục. Nhịp chiến đấu tăng nhẹ kích thước/vệt glyph và cao độ âm thanh; vẫn giữ giới hạn đọc chữ và Reduced Motion.

- Một phím đúng tạo đúng một phát có hiệu lực, glyph không lật.
- Đạn chạm tạo feedback đúng mục tiêu và thời điểm.
- Backspace/gõ lại/giữ phím không tạo hiệu lực lặp.
- Kẹt hiển thị rõ, không nối dài do spam phím, không có khóa ngầm sau timer.
- Mỗi hit có hiệu lực đặt lại khựng 300 ms, không có miễn khựng cho địch thường; Boss miễn khựng ở mọi phase.
- Khiên Tank hướng đúng người chơi, đạn đã phát vẫn hoàn tất; từ Tank/Final Strike dài ít nhất 7 ký tự.
- Glyph lớn dần có giới hạn, vệt ngắn/cung không quá 6 px và vỡ đúng thời điểm va chạm; không che nhãn/input.
- HP dưới 30 bật choáng và HP từ 30 trở lên xóa choáng; Reduced Motion tắt shake và mọi dao động.
- Zombie có lấy đà/lao thân, vệt móng vuốt và điểm tiếp xúc đúng `attack-impact`; recoil/số sát thương chỉ xuất hiện khi HP thực sự giảm, không dời collider.
- Boss đập đất có lấy đà, điểm nện, vòng xung kích giới hạn bán kính 300, nứt nền/bụi/mảnh vụn; đập hụt vẫn có hiệu ứng nền nhưng không có phản hồi người chơi bị thương giả.
- Pause/reset/Reduced Motion xử lý cả hiệu ứng địch tấn công mới; không để tween hoặc callback từ trận trước tồn tại.
- Gõ nhanh không phải chờ chết/phá giáp/ăn mừng.
- Pause và resume không làm projectile/timer nhảy cóc.
- UI không rung, tiếng Việt không mất dấu, hiệu ứng không phủ câu đố.
- Reduced Motion giữ nguyên kết quả và thời gian gameplay.
- Đổi nhãn mới mới ghi nhận đã gặp; từ dự trữ chưa hiển thị không bị tiêu thụ bởi animation. Hết bộ từ đợi địch/đạn kết thúc và báo hoàn thành, không chạy death giả hay tự lặp pool.
