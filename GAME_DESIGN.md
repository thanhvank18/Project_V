# Zombie Vocabulary Survival: Game Design

Cập nhật: 25/10/2026. Giai đoạn: prototype local, tiếp tục tinh chỉnh theo phản hồi.

## Cách sử dụng tài liệu

Đọc cùng ART_DIRECTION.md và ANIMATION_SPEC.md trước khi làm việc. Quyết định mới của Product Owner có ưu tiên cao hơn tài liệu; cập nhật tài liệu khi có thay đổi được duyệt.

- **Đã chốt:** quyết định được người dùng đồng ý trong thảo luận.
- **Thử nghiệm:** giá trị hoặc cách thực hiện đề xuất, cần kiểm chứng bằng prototype.
- **Còn mở:** chưa được quyết định; không tự coi là yêu cầu đã duyệt.

Cập nhật 22/10/2026: sau khi duyệt bộ asset và yêu cầu tiếp tục bước tiếp theo, người dùng đã cho phép triển khai prototype local. Bản thử React + TypeScript + Phaser 4.2.1 hiện đã được tạo; phạm vi thực tế và cách chạy nằm trong README.md. Các phần sau ghi lại ý tưởng gốc; các thông số chưa chốt được thử nghiệm trong prototype, không mặc định là cân bằng cuối cùng. Chưa triển khai lên hosting.

## Tầm nhìn và vòng chơi

Learn English to Survive. Game 2D sinh tồn trên trình duyệt, ưu tiên desktop và bàn phím. Người chơi giải câu đố từ vựng để chiến đấu trong thời gian thực; zombie tiếp tục tiến khi người chơi suy nghĩ. Quyết định mới nhất của người dùng là **“hết từ điển là thắng”**: sinh tồn tiếp diễn trong toàn bộ bank từ điển đã tải, kết thúc tích cực khi bank đó được khám phá hết và không còn địch/đạn đang xử lý. Không giới hạn mục tiêu ở 240 từ prototype.

Vòng chơi: bắt đầu trận → đọc câu đố mới → chọn mục tiêu → nhập từ → bắn đạn chữ → hạ zombie/đánh Boss → nhận thưởng → tiếp tục sinh tồn. HP về 0 dẫn đến Game Over. Khi bộ từ mới thực sự cạn và không còn địch/đạn đang xử lý, trận kết thúc bằng trạng thái hoàn thành tích cực. Cả hai đều có tổng kết; không tự quay vòng từ đã gặp.

Mục tiêu là ghi nhớ từ, không chỉ gõ nhanh. Đối tượng tuổi, trình độ đầu vào và thời lượng mục tiêu mỗi trận còn mở. Mobile cần nghiên cứu riêng, chưa cam kết trải nghiệm bàn phím ảo.

## Các quyết định đã chốt

- Cute Zombie Arcade bằng pixel art; side-view, nhân vật bắt đầu ở giữa rồi di chuyển trái/phải, zombie từ hai phía.
- Dùng toàn bộ 42 nhân vật từ hai pack Tiny RPG Full trong `new_asset`: 9 anh hùng cho người chơi chọn, 33 nhân vật còn lại thuộc phe địch. Quyết định này thay thế các bộ nhân vật cũ; xem CHARACTER_ROSTER.md.
- Mỗi ký tự đúng tạo một viên đạn mang chính ký tự đó, bay từ nhân vật/vũ khí vào mục tiêu.
- Nhập sai gây kẹt đạn ngắn; phần đáp án đúng được giữ.
- Mọi địch không phải Boss khựng 300 ms sau mỗi lần đạn chữ có hiệu lực chạm trúng; lần trúng mới đặt lại đủ 300 ms, không có miễn khựng. Boss không khựng.
- Tab/Shift+Tab chọn mục tiêu; ký tự đúng đầu tiên khóa mục tiêu.
- Ô nhập cố định dưới màn hình, tiếp tục dùng sau mỗi lần hạ địch.
- HUD và nhãn câu đố không bị rung hoặc che bởi hiệu ứng.
- Mỗi từ và mọi đáp án thay thế của nó chỉ được đưa ra một lần xuyên suốt các trận; nhật ký lưu ngay lúc câu đố xuất hiện, không đợi hoàn thành hoặc kết thúc trận.

## Chọn nhân vật và đội hình quái vật — 25/10/2026

Menu cho chọn Archer, Armored Axeman, Knight, Knight Templar, Lancer, Priest, Soldier, Swordsman hoặc Wizard trước khi bắt đầu. Mặc định Soldier; lựa chọn lưu cùng cài đặt trình duyệt và áp dụng cho cả sinh tồn lẫn tập Boss. Mỗi anh hùng có animation/vũ khí, cách phóng chữ và kỹ năng hỗ trợ riêng theo CHARACTER_ROSTER.md. Kỹ năng tự tích theo ký tự đúng mới và tự kích khi đầy thanh, không chiếm thêm phím lúc gõ. HP/tốc độ/sát thương giải từ cơ bản giữ nguyên; kỹ năng tạo khác biệt về đẩy lùi, khống chế, đỡ đòn hoặc hồi phục.

Kỹ năng không cộng năng lượng từ gõ lại chữ đã credited, không tự giải/skip từ và không tạo kill/loot. Boss miễn đẩy/khựng/chậm/đóng băng; hiệu ứng vùng không xuyên khiên Tank để tác động quái bị che. Đẩy lùi giữ thứ tự địch và biên bản đồ. Pause dừng timer kỹ năng; trận mới reset năng lượng và buff, giữ nhân vật đã chọn.

33 ngoại hình phe địch được chia vào bốn vai trò gameplay đang có: 12 quái thường, 7 quái nhanh, 8 quái giáp, 6 Boss. Mỗi vai trò luân phiên hết danh sách ngoại hình, không lấy ngẫu nhiên có thể bỏ sót nhân vật. Chỉ tăng lượt ngoại hình khi spawn thành công; giữ lượt khi chơi lại trong cùng phiên. Đổi ngoại hình không tiêu thụ thêm RNG, không đổi xác suất spawn, từ vựng, khiên, số lớp giáp hoặc sát thương. Nhãn mục tiêu/Boss dùng tên nhân vật đang hiện.

## Bốn dạng câu đố

| Dạng | Ví dụ hiển thị | Đáp án |
|---|---|---|
| Scrambled Word | l / p / a / e / p | apple |
| Missing Letters | a p _ l e | apple |
| Vietnamese to English | Con voi | elephant |
| Meaning + Letter Hint | Nguy hiểm; d _ _ _ _ _ _ _ s | dangerous |

Luôn nhập toàn bộ từ, kể cả dạng thiếu chữ. Chỉ sinh câu đố có dữ liệu được kiểm tra: đúng số chữ, nghĩa, loại từ/ngữ cảnh và đáp án. Không dùng ví dụ sai số lượng ký tự trong tài liệu nguồn làm dữ liệu thật.

Nhãn trên địch và dock hiển thị nghĩa theo ngôn ngữ đã chọn cùng từ loại thay cho tên dạng bài: VI dùng nghĩa Việt, EN dùng định nghĩa Anh; đáp án luôn là từ tiếng Anh. Bốn cách tạo câu đố vẫn giữ nguyên. Trong mỗi nhãn/dock, nghĩa chỉ hiện một lần nếu đã là prompt; gợi ý chữ vẫn tách riêng khi có.

Mỗi câu đố có danh sách đáp án hợp lệ. Với từ đồng nghĩa, phải bổ sung ngữ cảnh/gợi ý hoặc chấp nhận các đáp án tương đương đã biên tập. Bộ kiểm tra prefix cần giữ mọi đáp án còn khớp với phần đã gõ, không khóa tùy tiện vào một đáp án duy nhất.

Không chọn mục tiêu có đáp án chính hoặc alias trùng bất kỳ đáp án đã gặp hay đang được giữ cho địch khác. Chuẩn hóa hoa/thường; prototype chỉ dùng từ đơn a–z. Nếu không đủ từ mới phù hợp thì hoãn sinh loại địch đó, không lấy lại từ đã gặp. Tank và Armored giữ trước đủ câu đố cho các lớp để không hết từ giữa trận đánh.

## Targeting và input

1. Tự chọn địch có thời gian dự kiến chạm người chơi ngắn nhất, không chỉ khoảng cách gần nhất.
2. Tab/Shift+Tab chuyển giữa các mục tiêu có thể chọn khi chưa khóa.
3. Ký tự đúng đầu tiên khóa mục tiêu; tự động chọn không giành mục tiêu đang gõ.
4. Backspace xóa ký tự cuối; xóa hết thì mở khóa. Gõ lại phần đã xác nhận không tạo thêm hiệu lực chiến đấu.
5. Hoàn thành từ chuyển ngay sang mục tiêu tiếp theo, không chờ animation chết.
6. Khi mục tiêu chạm người chơi: gây sát thương, bị đẩy lùi và giữ tiến độ câu đố. Sát thương, hồi chiêu tấn công và thời gian miễn thương còn cần cân bằng.

Tank Bảo Hộ (còn gọi Tanker, cùng loại `tank`/Tank Boss hiện có) dựng khiên hướng về người chơi. Khi Tank còn sống, địch cùng phía nhưng xa người chơi hơn Tank được che chắn: không được tự chọn, chọn bằng Tab/Shift+Tab hoặc nhận phát bắn mới do nhập chữ. Phải hạ Tank để mở lại các mục tiêu phía sau. Đạn đã bắn trước khi bị che vẫn được bay đến và giải quyết va chạm theo mục tiêu/câu đố ban đầu.

Nhận phím qua một đầu mối. Không nhận auto-repeat thành nhiều phát bắn; xử lý composition/IME và focus có chủ đích, không tự tắt bộ gõ hệ điều hành. Khi đang chơi và vùng game có focus mới chiếm Tab/Backspace; menu vẫn dùng điều hướng bàn phím bình thường.

Mũi tên trái/phải điều khiển di chuyển; giữ phím để di chuyển, phím chữ vẫn chỉ dùng nhập từ (không dùng WASD). `playerX` khởi tạo 640, tốc độ 160 px/giây, giới hạn x=240–6160 trong thế giới dài 6400 px. Va chạm ngăn đi xuyên zombie. Pause, mất focus, về menu và chết phải xóa trạng thái giữ phím/dừng di chuyển; chỉ nhận lại khi người chơi thao tác tiếp. Ưu tiên mục tiêu, phía địch và hướng khiên Tank tính theo vị trí hiện tại của người chơi.

Thế giới là tuyến đường liên tục nhưng hữu hạn 6400 px, gồm phố cũ, công viên, ga bỏ hoang, bờ sông và nhà máy. Camera bám mượt người chơi trong viewport logic 1280×720 và chặn ở hai biên; địch sinh cục bộ từ hai phía quanh người chơi. Các vùng tái sử dụng pixel art hiện có cùng đạo cụ pixel dựng bằng mã. Tên gọi endless trong brief gốc không có nghĩa bản đồ kéo dài vô hạn hay bộ từ được tự quay vòng.

Gõ sai không chèn ký tự vào phần đúng, không cần Backspace. Kẹt đạn đề xuất 300 ms. Trong lúc kẹt, bỏ qua ký tự mới, không xếp hàng phát lại, không tăng lỗi hay kéo dài kẹt. Hiển thị trạng thái rõ. Zombie vẫn tiến.

Mất focus/chuyển tab tự tạm dừng; quay lại cần tiếp tục có chủ đích và đếm ngược ngắn. Esc tạm dừng. Mọi timer gameplay phải dừng cùng trận.

## Combat và chống khai thác

Tiến độ nhập xác nhận tức thời; đạn va chạm mới phát phản hồi trúng chữ và khựng. Lần va chạm cuối hoàn tất hạ địch/phá giáp/gây sát thương Boss.

Với mọi địch không phải Boss, mỗi va chạm chữ có hiệu lực đặt thời điểm hết khựng thành thời điểm trúng +300 ms. Không cộng dồn vào thời gian còn lại và không có cửa sổ miễn khựng; chuỗi trúng liên tiếp có thể giữ địch đứng cho đến 300 ms sau lần trúng cuối. Đạn gõ lại vị trí đã tính không gia hạn khựng. Boss miễn khựng ở mọi phase.

Địch đã nhận đủ đáp án chuyển sang trạng thái đang kết liễu và không còn gây sát thương. Việc phá giáp Boss cần bảo đảm event đạn cũ không tác động vào câu đố/phase mới.

Đạn có định danh mục tiêu, câu đố và vị trí ký tự. Hiệu lực chỉ được áp dụng một lần, kể cả Backspace, gõ lại, callback lặp hoặc đạn đến không đúng thứ tự. Cách điều phối đạn cuối và thời điểm đổi lớp giáp cần kiểm chứng trong prototype.

Từ dài không tự động gây tổng sát thương lớn hơn từ ngắn. Ngân sách sát thương theo câu đố/lớp giáp; đạn chữ biểu diễn tiến độ, không phải mỗi phím là một lượng sát thương cố định. Combo tăng theo từ hoàn thành liên tiếp không lỗi; sai làm mất combo. Công thức điểm và hệ số còn mở.

Phản hồi sai theo từng ký tự có nguy cơ khuyến khích dò đáp án. Đã chọn giữ phản hồi tức thời để phục vụ cảm giác chiến đấu; learning engine phải ghi lỗi, mức gợi ý và việc gõ lại, không đánh đồng hoàn thành có hỗ trợ với thuộc từ.

## Địch và Boss

Normal, Runner, Armored, Elite và Reward có silhouette và hành vi riêng; xem ART_DIRECTION.md. Prototype Armored có 2 lớp và giữ trước 2 từ mới khi sinh; nếu chỉ còn đủ từ cho Normal thì dùng Normal. Elite/Reward vẫn là concept ngoài prototype.

Tốc độ cơ sở Runner trong prototype tăng từ 22 lên 33 px/giây (1,5×); đây là đơn vị trên hệ tọa độ simulation, trước các điều chỉnh áp lực của trận.

Tank Boss là Boss đầu tiên: phá giáp → hung hãn/đập đất → cuồng nộ và kết liễu. Có cảnh báo, HP, Rage, telegraph và phần thưởng; không khựng bởi đạn chữ. Boss không xuất hiện chồng nhau. Spawn địch phụ phải nằm trong ngân sách áp lực chung.

Tank chỉ sinh khi giữ được 9 từ mới dài từ 7 ký tự trở lên, bao gồm từ Final Strike. Mọi từ trong chuỗi đều chưa từng xuất hiện; không ưu tiên lại từ đã gặp. Cơ chế khiên bảo vệ các địch phía sau cùng phía tồn tại đến khi Tank thực sự bị hạ, không kết thúc chỉ vì giáp vỡ hoặc đổi phase. Tăng sát thương có thể giúp bỏ qua lớp; từ giữ trước nhưng chưa đưa ra được giải phóng khi không còn cần, không ghi nhầm là đã gặp.

Các Boss sau: Summoner, Speed Boss, Mutation Boss, Memory King. Đây là concept chưa triển khai; không dùng ý tưởng ôn từ của Memory King để thay chính sách chỉ gặp mỗi từ một lần trong prototype hiện tại.

Các ngưỡng từng đề xuất trong brief: mini Boss 30 từ hoặc 60 giây; Boss 1 70 từ hoặc 2 phút; Boss 2 130 từ hoặc 4 phút; Boss 3 220 từ hoặc 7 phút; endless mỗi 100 từ hoặc khoảng 3 phút. **Chưa chốt và không phải cấu hình triển khai.** Còn cần xác định quan hệ mini Boss với Tank, cách chống kích hoạt lặp, cooldown và xử lý các ngưỡng đạt khi Boss đang hoạt động.

Rage tăng theo thời gian/lỗi và có thể giảm khi đúng; hệ số còn mở. Final Strike dùng một từ mới trong chuỗi 9 từ dài đã giữ trước, thất bại gây phản công thay vì mặc định Game Over. Thắng Boss tiếp tục sinh tồn khi còn từ mới. Prototype giữ phần thưởng riêng khi hạ Tank là +20 HP và +1000 điểm; vật phẩm dùng cùng lượt xét xác suất như các kill khác, không bảo đảm rơi.

Cập nhật theo phản hồi 22/10/2026: mỗi kill thực sự, bao gồm Tank, xét rơi một vật phẩm ngẫu nhiên. Mức khó nội bộ 1/2/3 của từ kết liễu tương ứng 15%/30%/45%; đây là mức do dự án biên soạn theo từ vựng/chính tả, không phải CEFR. Không thưởng theo mỗi 5 kill, theo từng phím hoặc khi chỉ phá lớp giáp. Mỗi loại tối đa 5; chỉ chọn trong các loại chưa đầy, không rơi thêm nếu cả bốn loại đã đầy. Mỗi trận prototype vẫn cấp một món mỗi loại để thử cơ chế.

Nhân vật bị thương có screen shake ngắn trên lớp thế giới. Khi HP dưới 30, thế giới lắc nhẹ và vignette nhịp chậm báo choáng; HP trở lại từ 30 trở lên thì xóa trạng thái này. HUD, input và nhãn câu đố giữ ổn định. Reduced Motion tắt shake và dao động, vẫn giữ tín hiệu nguy hiểm nhìn thấy.

## Học từ và dữ liệu

Nhật ký đã gặp được ghi ngay khi một câu đố được đưa ra, gồm đáp án chính và mọi alias chuẩn hóa của từ đó. Bỏ dở trận, về menu, khởi động trận mới hoặc tải lại không làm từ đã xuất hiện trở lại pool. Nhật ký v2 chia theo tiền tố đáp án để không ghi lại toàn bộ lịch sử từ điển ở mỗi lần gặp từ; dữ liệu v1 và các mục `progress.words` cũ được hợp nhất khi nạp. Từ chỉ được giữ trước cho lớp giáp/Boss chưa được ghi vào nhật ký cho đến khi thực sự thành câu đố.

Thống kê lượt gặp, hoàn thành, lỗi, thời gian trả lời và mức hỗ trợ của trận chỉ lưu khi trận kết thúc; nhật ký tức thời không tự tạo số điểm hay lượt hoàn thành. Sổ **Từ đã gặp** liệt kê toàn bộ từ đã xuất hiện, bao gồm từ chưa giải hoặc thuộc trận bỏ dở, có tìm theo từ/nghĩa đang hiển thị và phân trang 20 mục. Khi sổ đóng, các snapshot HUD không quét hoặc sắp xếp toàn bộ bank. Các trường lịch ôn cũ không được dùng để tự chọn từ yếu, đến hạn hay chèn lại từ trong gameplay; không có tỷ lệ 30% ưu tiên ôn.

Sau trận: thời gian, số zombie, score, combo tối đa, Accuracy, WPM và danh sách từ sai/chưa hoàn thành để đọc lại. Những từ này không tự xuất hiện lại trong trận sau. Menu giữ gọn, không đưa thống kê kho từ lên màn chọn nhân vật; Tập đấu Boss bị vô hiệu hóa nếu còn dưới 9 từ dài mới. Chỉ khi không còn từ mới trong kho song ngữ chơi được đã tải và địch/projectile hiện tại được xử lý xong, phát `vocabulary-complete` và báo thắng; không tái chế pool để kéo dài endless. Mục đang chờ kiểm tra ngoài kho chơi không tính vào điều kiện thắng. Phiên âm/ví dụ chỉ hiển thị khi có dữ liệu thật và khớp nghĩa đang dùng.

Vocabulary Engine độc lập engine game. Trước khi tạo App/cảnh chơi, nạp catalog từ API đã cấu hình hoặc `public/vocabulary/en-vi.json`, rồi áp dụng `public/vocabulary/english-definitions.json`. CSV người dùng cung cấp và bản nhập gốc được giữ nguyên; lớp riêng bổ sung định nghĩa Anh, sửa nghĩa/từ loại và lỗi chính tả đã xác nhận, ghi rõ mục bị loại hoặc cần kiểm tra tiếp. Frontend và backend dùng cùng quy tắc hợp nhất. 240 mục mẫu cũ không ghi đè nguồn này. Không đặt cap 240 và không gọi API bên ngoài theo từng spawn/kill. Nếu một trong các lớp dữ liệu tải lỗi hoặc không hợp lệ, hiện trạng thái lỗi và nút thử lại; không âm thầm dùng bộ nhỏ rồi tuyên bố hết từ điển.

Kho chơi được là tập song ngữ hữu hạn dùng chung cho VI/EN: một từ tiếng Anh viết thường a–z, 3–18 ký tự, nghĩa Việt không quá 120 ký tự và định nghĩa Anh không quá 240 ký tự. Mục thiếu định nghĩa Anh, còn vấn đề từ loại/nghĩa hoặc chưa đạt bộ lọc chất lượng được ghi lý do trong báo cáo và tách khỏi cả hai chế độ. Không bịa nghĩa để giữ đủ số từ, không coi đây là toàn bộ tiếng Anh hay Oxford/CEFR. CSV không có URL tra cứu từng từ nên không tự tạo `sourceUrl` cho nguồn đó. Ở dạng nghĩa → từ, gợi ý chữ phân biệt các đáp án có cùng nghĩa/từ loại/độ dài và chữ đầu/cuối. Nghĩa trên đầu zombie được rút gọn khi dài, còn dock mục tiêu giữ nghĩa đầy đủ. Toàn bộ dòng nguồn vẫn được giữ, kể cả cụm từ chưa phù hợp kiểu nhập hiện tại. Nguồn và quy trình nằm trong DICTIONARY_SOURCES.md và ENGLISH_DICTIONARY_SOURCES.md; số lượng và mục cần xử lý tiếp nằm trong public/vocabulary/english-definition-report.json. Kiểm tra tự động, đối chiếu nguồn và các sửa chữa có chủ đích không thay thế duyệt thủ công ngữ nghĩa toàn bộ kho.

Đổi VI/EN không tạo lịch sử mới. Khi sửa chính tả, đáp án cũ chuyển thành `historyAliases` của mục chuẩn: đã gặp khóa cũ thì mục sửa không xuất hiện lại, nhưng cách gõ sai không được chấp nhận khi trả lời. Mục tách khỏi kho chơi không xóa nhật ký cũ; nếu được sửa và đưa lại vào kho sau này, vẫn dùng lịch sử đã lưu.

## Ngôn ngữ

VI/EN đổi giao diện, tên hiển thị, nghĩa và nhãn từ loại trước trận; lựa chọn mặc định là VI và được lưu trên trình duyệt. `document.lang` theo ngôn ngữ hiện tại. Điều khiển ngắn nằm ở đầu trang, không thêm mô tả nguồn dài vào menu. Tiếng Anh dùng định nghĩa Anh thật từ lớp dữ liệu, không hiển thị nghĩa Việt dưới nhãn EN.

Chơi riêng cho phép đổi ở menu. Trong co-op, ngôn ngữ thuộc phòng: chủ phòng chọn khi ở sảnh, máy chủ xác nhận rồi các thành viên cùng dùng lựa chọn đó. Người mới vào kế thừa ngôn ngữ phòng; khách không tự đổi. Khóa điều khiển trong trận, khi đang kết nối/mất kết nối hoặc chờ xác nhận, tránh đổi nghĩa của câu đố đang giải. Khôi phục kết nối và chuyển chủ phòng giữ ngôn ngữ phòng hiện có.

## Độ khó

Theo quyết định 25/10/2026, độ khó từ vựng tăng theo **số từ hoàn thành trong trận**: 0–19 ở bậc 1, 20–39 ở bậc 2, 40–59 ở bậc 3, tiếp tục mỗi 20 từ đến tối đa bậc 10 từ mốc 180. Trận mới trở về bậc 1; nhật ký từ đã gặp vẫn giữ. Ký tự đúng, số kill, lịch sử trận trước hoặc chờ thời gian không tự tăng bậc.

Mỗi mục CSV có `learningLevel` 1–10 dựa trên tần suất tham khảo cùng độ dài và dấu hiệu chuyên ngành/cổ/viết tắt/thiếu từ loại trong nguồn. Đây là thang nội bộ, không phải CEFR. Ba nhóm loot 15%/30%/45% tương ứng bậc từ 1–3/4–6/7–10; bậc từ kết liễu quyết định nhóm, không lấy bậc tiến trình của người chơi.

Chọn từ chưa gặp ở bậc hiện tại trước, rồi bậc thấp hơn gần nhất; khi hết mới chuyển lên bậc còn từ. Kho bậc thấp cạn qua nhiều lần chơi không được tái chế để giả vờ bắt đầu dễ. HUD hiển thị bậc trận và tiến độ 20 từ, dock mục tiêu hiện bậc thật của từ. Sổ từ có bộ lọc từ loại và bậc, mặc định sắp dễ đến khó.

Tăng bậc chỉ ảnh hưởng lượt chọn từ tiếp theo. Không đổi câu đố đang nhìn thấy hoặc chuỗi từ đã giữ trước của quái giáp/Boss giữa chừng.

Boss sinh tồn chỉ xuất hiện khi giữ đủ 9 từ dài ở bậc hiện tại hoặc thấp hơn, tránh buộc người mới giải từ khó sớm; thiếu thì hoãn Boss. Chế độ tập Boss cho phép lấy từ dài cao hơn bậc và thông báo rõ. Mọi reservation vẫn có tính nguyên tử, giữ chính sách không lặp và thắng khi cạn toàn bộ kho. Nhịp spawn và giới hạn quái giữ cơ chế hiện có; không tăng tốc di chuyển chỉ vì đổi bậc từ.

## Phạm vi và kế hoạch

**Phạm vi prototype ban đầu (đã triển khai local, xem README.md):** một sân chơi, người sống sót, Normal/Runner, bốn dạng câu đố, đạn chữ, targeting, kẹt/khựng, HP/score/combo, Game Over và Tank đơn giản kiểm tra miễn khựng.

**Phạm vi hiện tại:** tuyến bản đồ liền mạch, 9 anh hùng có kỹ năng riêng, 33 ngoại hình quái trong các vai trò Normal/Runner/Armored/Tank, bốn dạng câu đố, sinh tồn đến khi bị hạ hoặc hết từ mới, Tank nhiều phase, độ khó cơ bản, lưu học từ và tổng kết. Reward/Elite có concept nhưng chưa mặc định thuộc MVP.

**Sau MVP:** các Boss khác, nhiều bản đồ, skin, XP/level, coins, achievements, daily challenge, tài khoản, đồng bộ và leaderboard. Không biến phần thưởng thành thay thế việc học.

## Kiến trúc đề xuất

Phaser + React + TypeScript là phương án được đề xuất sau so sánh với Three.js; prototype local sử dụng Phaser 4.2.1. Bộ skill Phaser 4 và phaser-gamedev cho Phaser 3 không được dùng lẫn API. Việc cài skill không phải quyết định phiên bản thư viện.

- Phaser: cảnh chiến đấu, HUD trong trận, animation, đạn chữ, âm thanh và va chạm.
- React: menu, settings, pause panel, tổng kết và kho từ; không render theo từng frame game.
- TypeScript thuần: Vocabulary/Learning Engine, luật combat, targeting, director và công thức điểm.
- Bank được nạp trước App rồi truyền vào `GameEngine` qua constructor. `WordDeck` index alias và pool chưa gặp/từ giữ trước; bộ đếm availability được cache, snapshot và kiểm tra cạn từ O(1), không quét bank lớn ở mỗi frame hoặc tick 10 ms.
- Bridge có kiểu dữ liệu: React gửi lệnh, Phaser phát sự kiện/snapshot; gameplay có một nguồn trạng thái chính.
- IndexedDB lưu thống kê cuối trận; localStorage lưu settings, nhật ký đã gặp tức thời v2 theo bucket tiền tố và dự phòng tiến trình. Di chuyển nhật ký v1 giữ lịch sử cũ; lỗi lưu được báo rõ vì có thể ảnh hưởng việc không lặp sau reload.
- Tách input, simulation và presentation; dùng thời gian theo delta/timer gameplay, không đếm frame.
- Pool đạn/particle khi cần; dọn listener, timer và asset khi restart/unmount.

Three.js không nằm trong stack 2D này. Frontend triển khai Vercel; backend Railway giữ API từ điển và phòng co-op theo yêu cầu ngày 26/10/2026. Không có tài khoản; lịch sử từ đã gặp được chia sẻ cho máy chủ phòng để tránh lặp từ cho cả đội.

## Tiêu chí nghiệm thu prototype sau này

- Gõ nhanh không mất phím ngoài thời gian kẹt được báo rõ; không cần click lại input.
- Tab, Backspace, restart và mất focus hoạt động nhất quán.
- Mũi tên trái/phải di chuyển đúng tốc độ/giới hạn, không xuyên zombie; pause/mất focus/menu/chết không giữ ngầm phím di chuyển. Targeting và khiên dùng playerX hiện tại.
- Nhãn không chồng, dấu tiếng Việt đủ, đạn không lật chữ khi bắn trái.
- Đạn cũ không tác động câu đố mới; gõ lại không tạo thêm hiệu lực.
- Mỗi lần trúng chữ có hiệu lực đặt lại khựng 300 ms cho địch không phải Boss; không có miễn khựng và Boss không khựng ở mọi phase.
- Tank chỉ dùng từ dài từ 7 ký tự, kể cả Final Strike; khiên chặn mọi đường chọn/bắn mới vào địch phía sau cùng phía đến khi Tank chết, còn đạn đã bắn vẫn được resolve.
- Mỗi kill chỉ xét rơi đồ một lần theo độ khó nội bộ và giới hạn kho; phá giáp hoặc mỗi 5 kill không tạo thưởng riêng.
- Rung khi bị thương và choáng dưới 30 HP không làm rung HUD/input/nhãn; hồi lên ít nhất 30 HP xóa choáng, Reduced Motion không dao động.
- Giáp, va chạm, damage và chuyển phase không bị tính lặp.
- Dữ liệu học đúng theo từ, khôi phục sau reload; không có số liệu học giả.
- Đáp án chính/alias không lặp trong hoặc giữa các trận; bỏ dở và reload vẫn giữ nhật ký đã gặp, bao gồm dữ liệu `progress.words` cũ.
- Tank giữ đủ 9 từ dài mới, Armored giữ 2; từ dự trữ chưa xuất hiện được trả lại pool khi không dùng, không ghi vào nhật ký.
- Hết từ mới chỉ hoàn thành sau khi hết địch/projectile; Tập đấu Boss cần 9 từ dài mới, không tự tái chế từ.

## Chiến thuật và co-op — 26/10/2026

Chín anh hùng giữ vũ khí/kỹ năng riêng và có lợi thế vị trí (giữ xa, đứng gần, xuyên hàng, bảo hộ tại chỗ hoặc hỗ trợ hồi phục). Phần mô tả chiến thuật nằm dưới chọn hero. Kỹ năng không tự giải từ chưa gõ.

Boss có ba giai đoạn theo số lớp giáp còn lại. Từ giai đoạn hai, luân phiên đập đất và lao theo đoạn đường đã khóa lúc lấy đà. Bóng/vùng báo trước cùng mốc simulation cho phép né thật; Boss miễn khựng. Quái bổ sung vai trò khiên, bắn xa và triệu hồi, xuất hiện theo đội hình với giới hạn số lượng. Quái triệu hồi tối đa hai lượt; không tạo bầy vô hạn vượt giới hạn.

Thùng nổ xuất hiện sau sáu từ hoàn thành, dùng một từ mới từ cùng kho, chọn bằng Enter ở gần rồi gõ. Vụ nổ đẩy lùi/làm khựng và phá bớt giáp, không tự ghi hoàn thành từ quái khác. Enter cũng đóng/mở cổng gần khi input trống; cổng chặn quái thường, Boss có thể phá. Điểm hồi phục cần đứng trong vùng hai giây, hồi 15 HP/lần, ba lượt dùng.

Chuỗi từ chính xác tích Nhịp chiến đấu tối đa năm bậc, tăng điểm và tốc độ di chuyển có giới hạn. Gõ sai giảm một bậc; ngừng hoàn thành từ đủ lâu làm nhịp giảm dần. Hiệu ứng chữ và âm thanh tăng vừa phải theo nhịp; không làm khó đọc.

Tổng kết chọn ba từ thật sự đã gặp, ưu tiên từ cần xem lại và, trong VI, ví dụ khớp nghĩa/từ loại. Ví dụ lấy đúng nhánh nghĩa trong CSV hoặc câu ngắn biên soạn có guard nghĩa/từ loại. Các ví dụ hiện gắn với nghĩa Việt; chế độ EN tạm ẩn ví dụ cho đến khi có dữ liệu gắn chính xác với định nghĩa Anh đang dùng. Từ không có ví dụ phù hợp vẫn hiện nghĩa, không tạo câu máy móc. Kết quả trận EN chỉ nối lại mục từ khi đáp án và định nghĩa khớp dữ liệu song ngữ; không gán một nghĩa khác để lấp tổng kết. Sổ từ có nghe phát âm tiếng Anh qua giọng trình duyệt, yêu thích và bộ lọc; yêu thích/ôn lại không đưa từ vào lại pool chơi.

Mỗi lần vào có phòng riêng với PIN sáu số; nhập PIN để vào sảnh người khác. Tối đa bốn người, không chọn cùng hero. Chủ phòng bắt đầu và có thể mở lại sảnh sau trận. Cùng một thế giới/quái/kho từ/điểm đội; HP, vị trí, input, vật phẩm và kỹ năng theo từng người. Từ được giữ độc quyền ngay khi chọn, nhả khi hoàn thành lớp từ/đổi mục tiêu/mất kết nối/rời phòng. Người hết HP chờ đồng đội; thua khi cả đội hết HP. Lịch sử tránh lặp của đội là hợp lịch sử thành viên; từ mới xuất hiện được lưu cho tất cả.
- Reduced Motion giữ nguyên luật và thời gian gameplay.
- Đo hiệu năng trên thiết bị/browser mục tiêu sau khi xác định cấu hình; không cam kết FPS khi chưa đo.
