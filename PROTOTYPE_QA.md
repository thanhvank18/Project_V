# Kiểm tra prototype — cập nhật 25/10/2026

## Âm thanh từ Sound và playlist — 25/10/2026

- **471/471 kiểm thử đạt, 26 suite**; TypeScript và production build Vite đạt. Trong đó 16 kiểm thử vòng đời audio, 6 kiểm thử metadata/MPEG/catalog/bản sao MP3 và 3 kiểm thử định tuyến sự kiện combat. Bao gồm hết bài và quay vòng, hết bài đồng thời pause/blur, pending play cũ, lỗi autoplay không lặp retry, tất cả bài lỗi, mute/seek, giới hạn voice và cleanup tải/giải mã.
- 12 nguồn được kiểm tra; bản game dùng 6 bài nhạc và 3 SFX. MP3 đóng gói có SHA giống nguồn, không tái mã hóa; không có byte/MPEG payload trùng nhau. Các file generic chưa xác định tình huống và bản Game Over thay thế vẫn giữ trong Sound.
- **Browser thật:** nhạc đầu Pixel Song3 có duration50,808s và paused=false khi bắt đầu trận. Không bấm chuyển bài; sau khi kết thúc tự nhiên, DOM media chuyển sang Song7, vị trí9,312s; Game Over dừng đúng bài đang nghe.
- **Vòng lặp thật:** chọn bài6 qua nút Bài tiếp theo, bắt đầu trận. Song27 tiến đến29,641/31,765s; lượt quan sát tiếp theo đang phát Song3 ở4,199s, chứng minh bài cuối tự quay lại bài đầu. Không sửa currentTime hoặc gọi engine trong DevTools.
- Pause giữ Song3 tại4,214s; tiếp tục qua countdown phát cùng bài từ vị trí đó, quan sát tiếp theo9,517s, không về0. Sau kiểm tra để trận tạm dừng và mở bảng âm thanh cho người dùng.
- UI: xác nhận 6 bài, chuyển bài, nhạc25→30→25%, hiệu ứng60→55→60%, master mute cập nhật cả nút và media.muted. Screenshot `.impeccable/review/audio-controls-20261025.png`. Bảng tại390×844 nằm trọn màn hình, controls đọc/bấm được; đã reset viewport về kích thước người dùng. Console warn/error rỗng trong lần xác minh cuối.
- Giới hạn: công cụ phiên này không hỗ trợ nghe trực tiếp audio input. Đã xác minh tải/giải mã/phát và lifecycle, chưa thẩm âm trực tiếp hay khẳng định toàn bộ sample cân bằng âm sắc bằng tai. Lựa chọn và mức gain khởi đầu ghi trong `AUDIO_SPEC.md`.

## CSV, phân bậc, kích thước và kỹ năng — 25/10/2026

- Toàn bộ Vitest **446/446 pass, 23 suite**; TypeScript `tsc --noEmit` và production build Vite pass. Ba kiểm thử đọc toàn bộ PNG/nhập toàn bộ CSV có timeout riêng 20 giây để chịu được I/O Windows khi chạy song song; giữ nguyên mọi assertion. Lượt đầy đủ cuối cùng pass.
- Runtime dùng **70.696 đáp án duy nhất** từ 103.864 dòng CSV UTF-16LE. Đã phân loại toàn bộ bank theo từ loại và 10 bậc học, xuất `public/vocabulary/learning-levels.csv`. Bậc 1 có 452 từ. Nghĩa và từ loại lấy từ CSV; 5 từ bread, bridge, pen, school, snow được chọn lại nghĩa cơ bản đã có trong nguồn, kèm audit từng thay đổi. 70.691 mục khác giữ nguyên nghĩa/từ loại. Không dùng bộ 240 từ mẫu ghi đè CSV.
- Bộ nhập có 33 kiểm thử; bộ phân bậc có 18 kiểm thử. Bao gồm quoted field, dấu phẩy trong IPA, nhóm nghĩa/từ loại, dẫn chiếu, biến tố, mục trùng, phục hồi cú pháp, checksum nguồn và phân bậc theo tần suất/nghĩa được chọn. Archive chứa đủ 103.864 dòng, kể cả mục không dùng được.
- Regression engine/deck xác nhận các mốc 19/20, 39/40 và 179/180/181 từ; trận mới về bậc 1, lịch sử từ đã gặp không tăng bậc trận mới và không bị xóa. Gõ một phần, nhập sai, pause/freeze không tự cộng từ. Giữ chỗ từ Boss nguyên tử, ưu tiên từ ở bậc hiện tại rồi bậc thấp hơn, kiểm tra fallback và trường hợp kho 70.000 từ. Thắng khi cạn bank vẫn được kiểm tra ở tầng engine.
- 42 nhân vật native: 9 anh hùng, 33 quái, 210 clip và 1.265 frame. Tất cả displayScale nhân với 0,85; PNG, thời lượng native và collision giữ nguyên. Kiểm thử registry, gốc chân, kích thước, vị trí hiệu ứng và bộ xếp nhãn không chồng HUD. Chín kỹ năng có regression về tích chữ, chống farm, pause/reset, Boss miễn hiệu ứng kiểm soát và khiên Tank.
- **Browser đã kiểm tra lại từ lần tải sạch:** menu 9 anh hùng; Pháp sư hoàn thành demilune + wail được 230 điểm và kích Vòng băng ở 12 chữ; Cung thủ hoàn thành abduct được 110 điểm và kích Tên đẩy lùi. Gõ a → Backspace → a không tích chữ lần hai. Bất thường charge/score trong phiên HMR cũ không tái hiện ở lượt tải sạch; chưa khẳng định đã chơi trực tiếp toàn bộ 9 kỹ năng.
- **Chơi progression qua UI bằng phím thật:** trong một trận hoàn thành 22 từ, 3.950 điểm, 16 zombie. Từ thứ 19 vẫn bậc 1 và 19/20; từ thứ 20 chuyển bậc 2, 0/20. Từ cũ đang hiện giữ nguyên; mục tiêu mới Cung thủ xương hiển thị từ bậc 2. Nhân vật đã nhỏ hơn, nhãn trái nằm dưới HUD kỹ năng. Đã dùng hồi máu, đóng băng, di chuyển và pause/resume trong lượt kiểm tra.
- **Chơi lại:** về menu còn 70.499/70.696 từ mới (giữ 197 từ đã gặp); bắt đầu trận tiếp theo hiển thị bậc 1, 0/20, HP100 và điểm0. Không xóa lịch sử để kiểm tra. Sổ từ đã thử phối hợp tìm kiếm, từ loại và bậc: demilune/Chưa rõ từ loại/bậc10 cho đúng một mục; đổi sang bậc1 cho trạng thái rỗng chính xác.
- Server local hoạt động tại 127.0.0.1:5174. Watch-ignore cho CSV/archive/asset nguồn đã khắc phục luồng bị EBUSY trước đó; kiểm tra browser mới hoàn tất trên tab người dùng mở lại.
- **Giới hạn nội dung:** phân bậc là ước lượng dựa vào tần suất và nhãn nghĩa trong nguồn, không phải CEFR hay hiệu đính thủ công 70.696 nghĩa. Tần suất của từ có thể khác độ quen thuộc của nghĩa đang chọn; browser vẫn gặp last ở nghĩa khuôn giày và lot ở nghĩa rút thăm tại bậc1. Cần rà soát nghĩa cụ thể nếu muốn nâng độ chính xác học thuật. Chưa gõ hết từ điển bằng tay.

Ảnh trong `.impeccable/review/`: `learning-level-two-20261025.png` (đúng mốc20), `learning-level-two-target-20261025.png` (mục tiêu mới bậc2), `learning-new-run-reset-20261025.png` (trận mới bậc1 và kích thước nhân vật), `graded-collection-20261025.png` (bộ lọc sổ từ). Ảnh `csv-wizard-skill-20261025.png` và `csv-archer-skill-20261025.png` ghi lại kỹ năng trước lần thu nhỏ nhân vật.

## Lưu trữ kiểm tra ngày 23/10/2026

Các số liệu từ điển và asset dưới đây thuộc bản cũ; nguồn runtime hiện tại được ghi ở phần 25/10 phía trên.

## Tự động

- TypeScript `tsc --noEmit`: pass.
- Vitest: tổng 137 kiểm thử đã pass — suite hiện có 125/125, sau đó 12/12 kiểm thử mới cho attack renderer chạy riêng; TypeScript kiểm tra lại cũng pass. Gồm 85 engine/storage, 16 seen-history storage, 5 word deck, 3 authored word-bank, 4 dictionary loader, 1 shipped catalog, 5 importer, 6 combat visuals và 12 attack effects. Bao gồm khóa mục tiêu, jam 300 ms, chống farm bằng Backspace, đạn có hiệu lực một lần, refresh khựng 300 ms không miễn khựng, Boss/Final Strike, freeze/telegraph, pause/countdown và Game Over.
- Loot: xác suất chính xác 15% / 30% / 45% theo ba mức độ khó tự biên soạn; chỉ roll khi hạ mục tiêu, không roll khi phá giáp, cap 5 và không thông báo nhặt giả khi đầy.
- Movement/world: tốc độ 160, bounds 240–6160, collision cả lúc chờ viên kết thúc chạm; đòn thường hủy khi ra khỏi tầm, đập đất Boss trong bán kính 300. Sinh và tái bố trí zombie ngoài màn hình theo vị trí người chơi, giữ HP/câu đố, không dịch chuyển Boss, mục tiêu đang khóa hoặc còn đạn đang bay.
- Targeting: Tank che mục tiêu xa hơn cùng phía, áp dụng auto/Tab/gõ; gỡ che chắn sau khi Tank chết. Từ Tank có ít nhất 7 ký tự ở mọi phase, kể cả Final Strike. Kho runtime có 64.594 đáp án duy nhất: 64.589 từ nhập từ Wiktionary, hợp nhất 240 từ tự biên soạn theo đáp án (5 từ bổ sung, các từ trùng giữ nghĩa tự biên soạn). Bộ mẫu vẫn dùng riêng trong các test nhỏ.
- Không lặp: chạy cạn kho với RNG thiên lệch và lịch sử `water` có 999 lỗi vẫn dùng đủ 239 từ còn lại, không gọi lại `water`. Kiểm tra qua restart/bỏ dở, đủ 9 từ mới của Tank, giữ chỗ chưa đánh dấu đã gặp, giải phóng từ chưa dùng khi boost/restart, hạ Armored thành Normal khi chỉ còn một từ. Hết kho chờ đạn cuối chạm và hết địch rồi báo hoàn tất; không sinh kill/loot giả.
- Seen journal: lưu ngay khi challenge xuất hiện, gồm đáp án chính và alias chuẩn hóa; reload giữa trận, hợp nhất lịch sử cũ và các bản lưu, giữ timestamp gặp đầu tiên, saveRun chậm không ghi đè từ vừa gặp; dữ liệu hỏng/bị chặn có cảnh báo chính xác.
- Kho lớn: kiểm tra 70.000 từ với 69.998 từ đã gặp, snapshot không quét lại toàn bộ kho và hai từ cuối dẫn đến chiến thắng chính xác. WordDeck giữ riêng các nhóm từ còn lại/từ dài, không lặp sau khi giải phóng từ đã giữ chỗ.
- Journal v2 chia bucket theo hai chữ đầu: khi thêm một từ chỉ đọc/ghi bucket liên quan; test 70.000 từ đã gặp xác minh giới hạn thao tác. Migration giữ journal v1 nếu chưa ghi xong v2, hợp nhất lần ghi tuần tự của tab khác và giữ cảnh báo khi một bucket chưa lưu được.
- Dictionary loader kiểm tra chính file JSON được giao, toàn bộ đáp án còn đủ sau hợp nhất, schema/nguồn/từ loại và từ trùng. Importer kiểm tra lọc mục từ, loại tham chiếu/biến thể, dedup và không thay file đích khi đầu vào lỗi. Các bản dịch trùng cùng gợi ý được lộ thêm ký tự phân biệt, kể cả ở câu điền chữ.
- Visual helpers: glyph tăng theo quãng đường đến khoảng 40 px, bay tới đúng điểm chạm và không vượt đích; khựng đúng nhịp; choáng tắt tại 30 HP, giảm chuyển động tắt dao động, biên độ được giới hạn.
- Attack impact: đòn thường/Runner/Armored và Boss phát sự kiện đúng lúc giải quyết đòn; Boss đánh hụt vẫn có impact nền nhưng damage bằng 0. Kiểm tra vị trí người chơi lúc chạm, bán kính 300, phase 1/3, khoảng bất tử, clamp sát thương chí mạng, đòn hủy do rời tầm/chết, freeze/pause và restart. Dừng actor tiếp theo sau đòn gây chết trong cùng tick để không có impact giả sau Game Over.
- Attack renderer không có giao diện: cả bốn loại địch giữ nguyên hình học ở cùng mốc đồng hồ (pause); Reduced Motion giữ vị trí tĩnh, chỉ fade; Boss hụt vẫn vẽ nền nhưng không phát burst tiếp xúc người. Reset/expiry không hồi sinh burst cũ; nạp 4.096 impact không làm tăng số surface hay khối lượng vẽ quá giới hạn. Các kiểm thử này không đánh giá thẩm mỹ pixel/sprite hoặc âm thanh thực tế.
- Persistence: fallback khi IndexedDB lỗi/timeout, trường hợp cả hai nơi lưu bị chặn, dữ liệu hỏng, chống lưu trùng, các lệnh lưu nối tiếp, cập nhật lịch sử cho trận chơi lại và lượt gặp chưa hoàn thành.
- Vite production build: pass. Phaser được tách thành chunk tải động; runtime art chỉ gồm 35 PNG trong public/art.

## Trình duyệt Codex

### Hiệu ứng địch đánh người và Boss đập đất — 22–23/10/2026

- Đã quan sát trực tiếp bản mới ở chế độ tập Boss: giơ hai tay, vòng báo vùng đập co lại, sau đó nện xuống nền; xuất hiện chớp tại điểm nện, đá vụn/bụi, nứt nền và vòng xung kích lan ra. HUD, nhãn từ và ô gõ vẫn đứng yên, không bị hiệu ứng che mất nội dung.
- Cú đập hiển thị `−12 HP`, hero đỏ nhẹ/giật theo hướng đòn; HP 76 → 64 ở lần ghi ảnh và 64 → 52 ở cú tiếp theo. Khung windup, impact và recovery khác nhau rõ. Ảnh gốc: `.impeccable/review/slam-live-10.png` (windup), `slam-live-11.png` (impact), `slam-live-12.png` (recovery).
- Pause/resume qua UI giữ trận rồi tiếp tục có countdown; không tạo thêm đòn trong lúc tạm dừng. Đã kiểm tra độc lập mã lifecycle, giới hạn burst và lớp hiển thị, chưa thấy vấn đề P1/P2.
- Kiểm thử TypeScript, toàn bộ Vitest và production build được chạy lại thành công ngày 23/10. Server local đã chạy lại tại cổng 5174.
- Giới hạn xác minh: phiên browser cũ kết thúc sau gián đoạn; IAB mới không attach được và Edge không khả dụng. Vì vậy chưa xác minh trực quan bổ sung vệt cào thường, đập hụt và Reduced Motion trong phiên tiếp tục. Các kết quả damage/cancel/pause đã có regression engine; không xem kiểm thử không có giao diện là thay thế đánh giá hình ảnh.

### Chơi sinh tồn dài với từ điển lớn — 22/10/2026

- Chơi qua UI bằng phím thật đến Game Over: sống sót **4 phút 09 giây**, **5.210 điểm**, hoàn thành **26 từ**, hạ **19 zombie**, combo cao nhất **17**. Đã mở tổng kết trận.
- Hạ Tank qua đủ ba phase và hoàn thành Final Strike; đây là lần xác minh trọn trận Boss qua trình duyệt, bổ sung cho các kiểm thử engine trước đó.
- Di chuyển qua **Phố cũ → Công viên → Ga bỏ hoang** trong cùng trận. Chưa đi trọn tuyến tới Bờ sông và Nhà máy trong lượt này.
- Dùng hồi máu tại **25 → 50 HP** và **34 → 59 HP**. Lượt đầu đi qua ngưỡng thoát trạng thái nguy cấp dưới 30 HP.
- Có **một lần nhập sai**; UI làm tròn accuracy thành 100%. Không diễn giải con số hiển thị này là một trận không có lỗi.
- Phát hiện nội dung từ điển cần rà soát: `nicy` hiển thị nghĩa **“Nhuây kẹo que”** bất thường; `spinate` và `spinose` tạo tình huống đáp án gần nghĩa khó phân biệt. Đây là ghi nhận chất lượng nội dung, chưa khẳng định đã sửa trong lượt thử.
- Yêu cầu bổ sung sau lượt chơi: làm rõ cú đánh của zombie vào người chơi và đòn Boss đập đất. Đặc tả trong `ANIMATION_SPEC.md`; kết quả kiểm tra bản triển khai nằm ở mục hiệu ứng ngay phía trên.

### Từ điển lớn và điều kiện thắng

- Khởi động có trạng thái đang mở từ điển, menu hiển thị 64.594 từ Anh–Việt và 64.554 từ mới; giữ nguyên 40 từ đã gặp, 5 trận đã lưu và kỷ lục 3.550 của dữ liệu cũ.
- Chơi bằng phím thật với từ nhập `searcher`: hoàn thành, đạt 110 điểm và 1 zombie; mục tiêu tiếp theo `lapicide` hiển thị nghĩa và từ loại. Trong lượt thử có 4 từ mới xuất hiện, tổng đã gặp tăng 40 → 44.
- Về menu trước khi kết thúc trận rồi reload: vẫn còn 64.550 từ mới, sổ từ giữ 44/64.594 và số trận vẫn là 5. Tìm bằng nghĩa `dò tìm` trả về `searcher`, có liên kết tra từ gốc; tìm tiếng Anh sau reload cũng giữ mục này.
- Điều kiện thắng khi cạn kho và dọn hết địch/đạn kiểm tra ở tầng engine, gồm trường hợp kho lớn chỉ còn hai từ. Không tuyên bố đã gõ hết 64.594 từ bằng tay.
- Kho tải từ file đi cùng game, không gọi dịch vụ từ điển cho từng zombie. Sổ từ chia 50 mục/trang và chỉ tính danh sách khi mở. Nguồn cộng đồng được lọc tự động, chưa duyệt thủ công toàn bộ nghĩa/từ loại; chi tiết nguồn và giới hạn trong `DICTIONARY_SOURCES.md`.
- Ảnh menu: `.impeccable/review/dictionary-menu.png`; ảnh tìm từ sau reload: `.impeccable/review/dictionary-history.png`.

### Không lặp từ qua các lượt chơi — bản mẫu 240 từ trước khi mở rộng

- Menu khôi phục 32 từ từ lịch sử cũ, hiển thị còn 208/240 từ mới. Hoàn thành `helpful`, gặp thêm `describe` và `understand`, rồi về menu trước khi kết thúc trận: còn 205/240.
- Reload giữ nguyên 205/240. Sổ Từ đã gặp có đủ 35 mục, bao gồm ba từ của lượt bỏ dở; số trận vẫn là 5, không tạo thống kê trận giả.
- Lượt mới gặp `mushroom`, `scissors`, `friendly` thay cho các từ cũ. Đã nhập `mushroom` và `scissors` bằng phím thật, xác nhận score/kill/pickup và HP vẫn hoạt động. Sau lượt thử, menu còn 200/240 từ mới.
- Không có lỗi/warning console mới trong lần xác minh. Ảnh: `.impeccable/review/no-repeat-vocabulary.png`.
- Trạng thái cạn toàn bộ kho được kiểm tra bằng engine tests; không tiêu thụ hết lịch sử người dùng qua trình duyệt để dựng trường hợp này.

### Bổ sung gameplay và thế giới liên tục

Đã chơi bằng bàn phím thật qua UI, không sửa engine trong DevTools:

- Hoàn thành `milk`, `bird`, `thunder`: đạn chữ, score, zombie chết; sau `thunder` nhận thêm Gợi ý từ (1 → 2). Freeze giảm tồn kho và giữ zombie.
- Hoàn thành `sun`, `listen`, `pumpkin`, giữ phím phải và đi từ Phố cũ sang Công viên; camera cuộn, nền đường giữ cao độ, HUD/ô gõ đứng yên. Nhả phím dừng nhân vật; zombie chặn đường, Runner gây áp lực nhanh hơn.
- Boss dùng `mountain` (8 ký tự); hoàn thành làm HP Boss giảm 9 → 8. Khiên hướng về người chơi; zombie `doctor` phía sau có nhãn “Được Tank che chắn”. Tab xoay từ Tank `village` sang `listen` rồi về Tank, bỏ qua `doctor`.
- HP xuống 25: chỉ số đổi màu và hiệu ứng cảnh báo ở rìa cảnh. Dùng hồi máu đưa HP lên 50, cảnh báo nguy cấp tắt. HUD/nhãn/ô nhập không bị rung theo cảnh. Cảm giác chuyển động và độ khó vẫn cần người chơi đánh giá thêm.
- 390×844 sau cập nhật: gate yêu cầu máy tính/bàn phím vẫn hiển thị đúng; đo scrollWidth không tràn ngang. Đã khôi phục viewport trình duyệt sau kiểm tra.
- 1366×768: dock có nghĩa + từ loại và phím di chuyển nằm trọn viewport. Đã sửa nhãn Tank chồng thanh HP; review ảnh độc lập không còn lỗi P1/P2.
- Trang QA `.impeccable/review/world-preview.html` render cùng `createWorldBackdrop`: đã kiểm tra cả 5 vùng, nền/pavement nối cùng cao độ, không có lỗi console. Đây là trang kiểm tra riêng, không phải flow trong game. Chơi trực tiếp đã đi qua ranh giới Phố cũ/Công viên; chưa đi bộ trọn tuyến trong một trận.

Ảnh mới: `tank-shield-update.png`, `low-health-update.png`, `world-overview.png`, `mobile-update.png` trong `.impeccable/review/`.

### Kiểm tra nền tảng trước đó

Đã thực hiện qua UI thật, không sửa trạng thái engine bằng DevTools:

- Boot, font tiếng Việt, city background, survivor, zombie và Tank hiển thị; không có lỗi/warning console trong lần kiểm tra.
- Bắn từng phím để hoàn thành `moon`, `window`, `write`, `bridge`; thấy projectile ký tự, score, số từ, zombie chết và Boss giảm HP.
- Nhập sai hiện KẸT ĐẠN; chữ đúng đầu khóa mục tiêu; Tab khi khóa giữ mục tiêu; xóa rồi nhập lại hoạt động.
- Dùng freeze giảm tồn kho từ 1 xuống 0; dùng hint hiện gợi ý và đánh dấu có hỗ trợ.
- Escape mở dialog pause; resume có countdown và tự trả focus về `word-input`.
- Trận Boss không nhập thêm dẫn đến Game Over sau 55 giây simulation: 110 điểm, 1 từ hoàn thành, 100% accuracy cho các phím đã nhập, danh sách từ chưa hoàn thành.
- Về menu, reload, mở sổ từ: giữ kỷ lục 110, 1 trận/1 từ và danh sách ôn `walk`, `cat`, `water`.
- Help, bật/tắt âm thanh, toggle giảm chuyển động, vào fullscreen và nút thoát bên trong fullscreen hoạt động.
- 1366×768: HUD và ô gõ cùng nằm trong viewport; đáy dock đo được y653,56. Font hướng dẫn tối thiểu 10px, heading mục tiêu 11px. Không tràn ngang.
- 390×844: thông báo dùng máy tính/bàn phím, sổ từ và hướng dẫn còn truy cập được; không tràn ngang.

Ảnh QA: `.impeccable/review/user-1366.png`, `desktop.png`, `mobile.png`, `summary.png`.

## Review và giới hạn

Review độc lập đã xác nhận khung chơi vừa chiều cao laptop, nhãn Boss không chồng HP và hướng dẫn di chuyển không chồng dock. Code review phát hiện lỗi có thể đi xuyên Tank khi hoàn thành liên tiếp các lớp giáp; đã sửa và bổ sung regression giữ phím phải qua 7 lớp, Tank vẫn chặn đường. Các lỗi pickup/lưu trữ của bản trước cũng có regression.

Ba phase và Final Strike đã được hoàn tất bằng phím thật trong lượt sinh tồn 4 phút 09 giây; miễn khựng của Boss và các lỗi lưu trữ còn có kiểm thử ở tầng engine/storage. Chưa kiểm tra ma trận Chrome/Firefox/Safari, máy cấu hình thấp hoặc thiết bị di động có bàn phím vật lý. Âm thanh đã kiểm tra control/unlock trong mã, chưa đánh giá chất lượng bằng nghe. Cần tiếp tục rà soát nghĩa từ nhập và playtest để chốt độ khó, thời gian phản hồi; không coi bộ thông số prototype là cân bằng phát hành. Hiệu ứng zombie đánh người chơi và Boss đập đất được yêu cầu sau lượt thử này chưa có xác minh trình duyệt ở mục QA trên.

Máy chủ kiểm tra local dùng http://127.0.0.1:5174 trong phiên này. Chạy `pnpm dev` ở phiên sau sẽ in địa chỉ đang khả dụng; dữ liệu trình duyệt gắn theo origin/cổng.
