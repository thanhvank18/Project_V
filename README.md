# Project_V — Zombie Vocabulary Survival

React + TypeScript + Phaser 4.2.1. Giao diện tiếng Việt, học từ tiếng Anh bằng đạn chữ trong thế giới Cute Zombie Arcade. Chơi riêng hoặc co-op bằng phòng PIN tối đa 4 người. Frontend triển khai trên Vercel; Railway phục vụ từ điển và mô phỏng phòng qua WebSocket.

[Chơi ngay](https://project-v-swart.vercel.app) · [API health](https://projectv-production.up.railway.app/health) · [Hướng dẫn triển khai](DEPLOYMENT.md)

## Chạy trên máy

Yêu cầu Node.js 22.12+ và pnpm. Tại thư mục dự án:

```sh
pnpm install
pnpm build:api
pnpm start:api
```

Giữ terminal backend chạy ở cổng **3001**, rồi mở terminal thứ hai:

```sh
pnpm dev
```

Mở http://127.0.0.1:5174 (cổng cố định trong cấu hình Vite). Vite chuyển tiếp WebSocket `/api/rooms` tới backend local. Dùng máy tính, bàn phím và bộ gõ tiếng Anh. Nếu backend không sẵn sàng, có thể chọn chơi riêng trên máy. Trước khi mở game, ứng dụng nạp và kiểm tra từ điển cùng lịch sử đã chơi. Nếu tải từ điển thất bại, màn hình có nút **Thử lại**; không âm thầm chuyển sang bộ 240 từ để báo thắng sớm. Nút **Tập đấu Boss** chỉ bật khi còn ít nhất 9 từ mới dài từ 7 ký tự.

```sh
pnpm test
pnpm build
```

Build tĩnh nằm trong `dist/`. Không cần API key hoặc tài khoản để chơi. Font, sprite và hình nền được đóng gói cùng dự án. Khi `VITE_API_URL` để trống, game dùng `/vocabulary/en-vi.json`; khi có cấu hình, game tải từ điển từ API đó trước trận. Không gọi API dịch hoặc tải từng từ sau mỗi kill.

Muốn cả từ điển và phòng dùng một backend khác, đặt `VITE_API_URL=http://127.0.0.1:3001` hoặc origin HTTPS của API trong `.env.local`, rồi khởi động lại `pnpm dev`. Sau khi sửa engine/backend, chạy lại `pnpm build:api` và khởi động lại API; `pnpm build` cũng tạo bundle backend. Xem [DEPLOYMENT.md](DEPLOYMENT.md) cho Railway, Vercel và CORS.

Tiến trình vẫn lưu bằng localStorage/IndexedDB trên từng trình duyệt. Máy chủ giữ phòng và trận trong RAM, chưa có tài khoản, database hoặc đồng bộ tiến trình lâu dài giữa thiết bị.

Clone repository là đủ để cài và build bằng dữ liệu runtime đã đóng gói. Khóa bí mật, cache, gói nguồn và ZIP bị loại khỏi Git qua `.gitignore`. Các script nhập lại hoặc kiểm chứng xuất xứ có thể cần CSV/asset nguồn đã bị bỏ qua. Khi có CSV nguồn và cần thay dữ liệu, chạy `node scripts/import-csv-dictionary.mjs`; quy tắc nhập nằm trong [DICTIONARY_SOURCES.md](DICTIONARY_SOURCES.md).

## Bản thử đã có

- Phòng PIN 6 số, tối đa 4 người và không trùng anh hùng; chỉ chủ phòng bắt đầu/chơi lại, chỉ vào phòng khi ở sảnh. Mỗi phòng dùng **một engine authoritative trên server**: client gửi thao tác, không tự quyết sát thương hoặc chạy bốn thế giới riêng. Mục tiêu được giữ độc quyền ngay khi chọn, trước ký tự đầu tiên. HP, vị trí, input, vật phẩm và năng lượng riêng; số từ, điểm, độ khó và kết quả trận là của đội. Chỉ khi cả đội gục mới thua.
- Lịch sử từ đã gặp của mọi thành viên được hợp lại trước trận. Từ mới xuất hiện được gửi cho cả phòng để lưu tại trình duyệt, kể cả người đang gục. Mất kết nối nhả mục tiêu và dừng di chuyển; nhân vật vẫn bị tấn công. Có 20 giây để kết nối lại; sau đó ghế được trả lại.
- Kỹ năng 9 anh hùng có chiến thuật vị trí: Archer/Lancer giữ xa, Axeman/Swordsman áp sát, Knight tiến khi còn khiên, Templar đứng trong vùng bảo hộ, Priest đứng yên để hồi thêm, Soldier vừa lùi vừa bắn và Wizard niệm từ xa để mở rộng băng. Chỉ chữ đúng mới tích năng lượng; kỹ năng không tự giải từ.
- Boss báo trước đòn đập đất và, từ phase 2, luân phiên lao theo đường đã khóa. Điểm/vùng cảnh báo không đuổi theo người chơi trong thời gian lấy đà; chạy khỏi vùng để né. Boss vẫn miễn khựng, đóng băng và đẩy lùi; đòn diện rộng có thể trúng nhiều đồng đội.
- Đội hình có lính giáp chắn đồng đội phía sau, quái bắn xa khóa điểm trước khi bắn và quái triệu hồi có cảnh báo. Phá lớp giáp chắn sẽ mở mục tiêu phía sau; quái triệu hồi chỉ gọi tối đa hai con rồi chuyển sang bắn xa. Quân số vẫn bị giới hạn, không sinh quân vô hạn từ một triệu hồi sư.
- Bản đồ có thùng nổ dùng từ mới từ cùng WordDeck, cổng đóng/mở bằng **Enter** khi ở gần và ô nhập trống, vùng hồi máu cần đứng yên 2 giây để hồi 15HP, tối đa 3 lượt mỗi vùng. Thùng nổ đẩy, làm khựng và phá một lớp giáp; giữ nguyên từ chưa giải, không tự tính hoàn thành hay hạ quái.
- Từ hoàn thành không sai và không dùng gợi ý tăng momentum, tối đa 5 bậc: mỗi bậc thêm 10% điểm và 3% tốc độ di chuyển. Gõ sai giảm một bậc thay vì xóa hết đà; không hoàn thành từ mới đủ lâu thì đà giảm dần. Gõ lại chữ đã được tính không farm được lợi thế này.
- Nhạc nền từ `Sound/`: 6 bài phát lần lượt, hết danh sách quay về bài đầu. Pause giữ vị trí nghe; có bảng chuyển bài và âm lượng nhạc/hiệu ứng riêng. Hiệu ứng MP3 cho hạ quái, Boss đập đất và Game Over; xem [AUDIO_SPEC.md](AUDIO_SPEC.md).

- Nhân vật nhỏ hơn 15%, giữ nguyên pixel và animation gốc. Từ vựng được xếp 10 bậc theo mức thông dụng cùng độ phức tạp. Mỗi trận bắt đầu bậc 1, hoàn thành 20 từ tăng một bậc, tối đa bậc 10; lịch sử từ đã gặp vẫn giữ. Nếu hết từ mới ở bậc hiện tại, chọn bậc gần nhất còn từ. HUD và sổ từ hiển thị bậc; sổ có lọc từ loại và độ khó.

- Toàn bộ 42 nhân vật từ hai pack Tiny RPG Full: chọn 9 anh hùng trước trận, 33 quái luân phiên trong bốn vai trò thường/nhanh/giáp/Boss. Mỗi anh hùng có kiểu vũ khí/phép chữ và kỹ năng riêng tự tích bằng ký tự đúng mới. Lựa chọn được nhớ qua tải lại; xem [CHARACTER_ROSTER.md](CHARACTER_ROSTER.md) để biết kỹ năng và danh sách đầy đủ.
- Bốn dạng câu đố: xáo trộn, chữ thiếu, Việt → Anh, nghĩa + gợi ý. Bank runtime nhập từ Dic/English - Vietnamese.csv. Nghĩa và từ loại lấy từ CSV, không bị 240 mục mẫu cũ ghi đè; số từ lấy từ toàn bộ bank hợp lệ. Lịch sử theo đáp án được giữ khi đổi nguồn. Mỗi từ cùng các đáp án thay thế chỉ xuất hiện một lần trong và giữa các trận trên trình duyệt này; không tự chèn lại từ yếu hoặc đến lịch ôn.
- Tank/Tanker giữ trước 9 từ mới dài từ 7 ký tự cho cả trận Boss, gồm Final Strike; Armored giữ trước 2 từ mới. Từ giữ trước chỉ được ghi là đã gặp khi câu đố thực sự được đưa ra. Nếu tăng sát thương giúp bỏ qua lớp, các từ dự trữ chưa dùng được trả lại pool.
- Mỗi chữ đúng tạo projectile tăng tốc, glyph lớn dần có giới hạn theo quãng đường, vệt ngắn và cung cong tối đa 6 px. Glyph vỡ thành mảnh cyan/tím/vàng khi va chạm; hình và tác động dùng cùng shotId/firedAt/impactAt. Gõ sai kẹt súng 300 ms; phím trong thời gian kẹt bị bỏ qua.
- Mỗi hit chữ có hiệu lực đặt lại đủ 300 ms khựng cho mọi địch không phải Boss, không có miễn khựng. Boss không khựng; gõ lại vị trí đã tính không gia hạn khựng.
- Tab/Shift+Tab chọn mục tiêu; chữ đúng đầu tiên khóa ô nhập với từ đó, Backspace xóa hết để đổi. Trong co-op, quyền giữ mục tiêu bắt đầu ngay khi chọn và chỉ nhả khi đổi/bỏ mục tiêu hoặc hoàn tất lớp từ. Gõ lại vị trí đã được tính chỉ có hiệu ứng, không farm damage.
- Mũi tên trái/phải di chuyển người chơi; phím chữ vẫn nhập từ, không dùng WASD. Chơi riêng bắt đầu tại x=640, tốc độ cơ bản 160 px/giây trong vùng x=240–6160 và không đi xuyên zombie. Pause, mất focus, menu hoặc chết đều dừng di chuyển.
- Tuyến đường liên tục dài 6400 px qua phố cũ, công viên, ga bỏ hoang, bờ sông và nhà máy; camera bám mượt, chặn ở biên. Địch sinh từ hai phía quanh người chơi. Bản đồ hữu hạn, dùng pixel art hiện có cùng đạo cụ dựng bằng mã.
- Khiên Tank quay về người chơi và bảo vệ địch xa hơn phía sau cùng phía: chặn tự chọn, Tab/Shift+Tab và bắn chữ mới đến khi Tank chết. Đạn đã bắn vẫn hoàn tất. Ưu tiên mục tiêu và hướng che chắn tính theo vị trí hiện tại của người chơi.
- HP, điểm, combo, thời gian và bốn vật phẩm thử. Chơi riêng có pause/countdown và tự dừng khi mất focus. Trong co-op, **Esc, mở bảng hoặc mất focus chỉ dừng điều khiển cá nhân; trận và quái vẫn tiếp tục**.
- Mỗi kill, gồm Tank, xét rơi một vật phẩm với xác suất 15% / 30% / 45% theo mức khó nội bộ 1/2/3 của từ kết liễu, không phải CEFR. Chỉ chọn trong loại chưa đầy, tối đa 5 mỗi loại; không thưởng theo mỗi 5 kill hay chỉ phá giáp. Tank không bảo đảm rơi đồ, vẫn thưởng +20 HP và +1000 điểm.
- Nhãn hiển thị nghĩa tiếng Việt và từ loại thay tên dạng bài; bốn cách tạo câu đố giữ nguyên, nghĩa chỉ hiện một lần trong mỗi nhãn/dock. Nghĩa dài trên đầu zombie được rút gọn; dock mục tiêu giữ nghĩa đầy đủ. Dạng Việt → Anh của mục nhập từ điển có thêm gợi ý chữ đầu/cuối để hạn chế nhầm các từ cùng nghĩa.
- Khi bị thương, lớp thế giới rung ngắn. HP dưới 30 thêm lắc nhẹ và vignette báo choáng; hồi lên ít nhất 30 HP xóa choáng. HUD/input/nhãn ổn định; Reduced Motion tắt rung, dao động và cung đạn nhưng giữ timing gameplay.
- Nhật ký từ đã gặp lưu ngay khi câu đố được đưa ra, kể cả bỏ dở hoặc tải lại giữa trận; lịch sử `progress.words` cũ cũng được đưa vào danh sách đã gặp. Nhật ký v2 chia bucket theo tiền tố và di chuyển dữ liệu v1, tránh ghi lại toàn bộ lịch sử lớn ở mỗi từ. Điểm, accuracy/WPM và thống kê trận chỉ được lưu khi kết thúc trận. IndexedDB lưu tiến trình, localStorage giữ nhật ký tức thời và làm dự phòng; có thông báo khi không lưu được.
- Theo quyết định **“hết từ điển là thắng”**, chỉ khi mọi từ trong bank đã tải đều được gặp và địch/đạn còn lại đã xử lý xong, game mới báo hoàn thành tích cực. Không tự quay vòng bộ từ hoặc coi hết 240 mục tự biên soạn là hết từ điển. HP về 0 vẫn là kết thúc do bị hạ.
- Tắt âm thanh, giảm chuyển động, fullscreen, hướng dẫn và sổ **Từ đã gặp**. Sổ có tìm theo từ/nghĩa và phân trang **20 mục**, liệt kê cả từ chưa hoàn thành; thống kê cuối trận được hiển thị riêng với trạng thái đã gặp. Khi sổ đóng, cập nhật HUD không quét/sắp xếp lại toàn bộ bank.

Phím 1 hồi 25 HP; 2 đóng băng zombie 3 giây (không áp dụng Boss); 3 tăng sát thương phá giáp/Boss 6 giây; 4 gợi ý. Mỗi trận được cấp một món mỗi loại để kiểm thử.

## Kiến trúc

- `src/game/engine.ts`: simulation thuần TypeScript, nhận bank qua constructor, nguồn trạng thái duy nhất, timing theo clock trận.
- `src/game/wordDeck.ts`: index đáp án/alias, pool từ chưa gặp, từ giữ trước và bộ đếm cache; snapshot và kiểm tra cạn từ O(1), không quét từ điển ở mỗi frame/tick.
- `src/game/dictionary.ts` và `public/vocabulary/en-vi.json`: nạp và kiểm tra từ điển CSV đã đóng gói trước khi tạo App. Nguồn, giấy phép, bộ lọc và khả năng tái tạo được ghi trong [DICTIONARY_SOURCES.md](DICTIONARY_SOURCES.md).
- `backend/server.mjs`: HTTP từ điển, health check, gzip/ETag và CORS; `backend/rooms.mjs`: phòng PIN, WebSocket, phân quyền và tick engine chung. `scripts/build-api.mjs` gói engine cùng `ws` vào `backend/rooms.bundle.cjs` cho Docker; `vercel.json` dành cho frontend.
- `src/game/RoomClient.ts`: kết nối/phục hồi phòng, gửi ý định thao tác và nhận snapshot của chính người chơi; hỗ trợ chuyển sang chơi riêng khi không có backend.
- `src/game/partyState.ts`, `tacticalRules.ts`: trạng thái cá nhân co-op và quy tắc tương tác bản đồ; `engineParty.test.ts`/`engineTactics.test.ts` kiểm tra quyền giữ mục tiêu, đòn diện rộng, chủ đạn, đội hình và vật thể.
- `public/vocabulary/editorial-corrections.json`: bản sửa của nguồn Wiktionary cũ, giữ để tham khảo và chuyển tiếp khóa lịch sử; không ghi đè nghĩa CSV. [DICTIONARY_REVIEW.md](DICTIONARY_REVIEW.md) ghi tiến độ thực; từ sửa chính tả giữ khóa lịch sử cũ nhưng không chấp nhận cách gõ sai.
- `src/game/vocabulary.ts` và `wordBank.ts`: giữ bộ 240 mục mẫu cho test và các hàm tạo câu đố, không ghi đè CSV; `storage.ts`: thống kê cuối trận, nhật ký v2 theo tiền tố và di chuyển lịch sử cũ.
- `src/game/SurvivalScene.ts`: Phaser vẽ cảnh/sprite/đạn/feedback và phát snapshot giới hạn tần suất.
- `src/ui/App.tsx`: menu, HUD, nhập phím, dialog và lưu kết quả bằng React.
- `src/game/engine.test.ts`: regression cho combat, timer, Boss và lưu tiến trình.
- `src/game/vocabulary.test.ts`: kiểm tra dữ liệu từ, đáp án/alias không trùng và độ phủ từ dài.
- `src/game/storageSeen.test.ts`: nhật ký ghi ngay, reload giữa trận, alias, dữ liệu cũ, save chạy muộn và trường hợp trình duyệt chặn lưu.
- `src/game/characterCatalog.generated.json`: 42 nhân vật và 210 clip PNG native 100×100; `assets/native-catalog/` giữ nguồn/metadata. Các bộ nhân vật cũ là tư liệu, không nạp trong runtime.
- `src/game/heroSkills.ts`: định nghĩa 9 kiểu tấn công/kỹ năng; engine giải quyết hiệu lực, Scene và HeroAttackEffects vẽ phản hồi.
- `src/ui/HeroPicker.tsx`: chọn nhân vật, mô tả kỹ năng và radio dùng được bằng bàn phím.
- `public/character-review.html`: xem toàn bộ roster, đổi hướng và kiểm tra từng frame.
- `node scripts/prepare-assets.mjs`: sao chép lại đúng tập runtime từ bộ asset, không tạo hình mới.

Tài liệu nền tảng: `GAME_DESIGN.md`, `ART_DIRECTION.md`, `ANIMATION_SPEC.md`. Chi tiết giao diện hiện thực nằm trong `DESIGN.md`; tình trạng kiểm tra nằm trong `PROTOTYPE_QA.md`.

## Giới hạn hiện tại

Đây là prototype để đánh giá cảm giác gõ và chiến đấu. Co-op chạy **một replica Railway**, phòng nằm trong RAM và mất khi server deploy/khởi động lại; chưa có Redis hoặc khôi phục trận qua restart. Chưa có tài khoản, lưu tiến trình cloud hoặc leaderboard. Điện thoại hiển thị hướng dẫn mở bằng máy tính; chưa hỗ trợ bàn phím ảo.

Từ điển là bank hữu hạn đã lọc: từ tiếng Anh a–z dài 3–18 ký tự, nghĩa Việt không quá 120 ký tự, có nhãn “Chưa rõ từ loại” khi nguồn thiếu. Đây không phải toàn bộ tiếng Anh, Oxford 3000/5000 hoặc CEFR; mức khó là quy tắc nội bộ. Kiểm tra bộ nhập không đồng nghĩa đã duyệt ngữ nghĩa từng mục. Không lặp qua tải lại phụ thuộc nhật ký trình duyệt được lưu thành công; lỗi lưu có thông báo. Sổ và tổng kết hỗ trợ xem lại, không tự lặp từ để ôn. Sprite native giữ khung/timing gốc; cân bằng kỹ năng, Boss, vật thể và đội hình mới cần thêm playtest.
