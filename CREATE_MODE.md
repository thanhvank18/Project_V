# Create Mode — bộ từ do người chơi tạo

Create Mode cho phép nhập từ trực tiếp hoặc tải CSV, tạo một link dùng trong **24 giờ kể từ lúc tạo**. Người nhận link chơi với đúng bộ câu hỏi đó; không trộn vào kho từ điển chính. Có thể chơi riêng hoặc vào cùng phòng PIN để co-op tối đa 4 người.

## Tạo và chia sẻ

1. Từ màn bắt đầu, chọn **Tạo bộ câu hỏi**. Có thể mở trực tiếp `/?create=1`.
2. Nhập tên bộ từ, chọn ngôn ngữ của nghĩa/câu hỏi và **Luật sinh tồn**. Ngôn ngữ là Việt hoặc Anh; đáp án luôn là một từ tiếng Anh.
3. Nhập đáp án, nghĩa, từ loại, bậc và dạng câu hỏi. **Thêm câu hỏi** tạo dòng mới; nút thùng rác xóa dòng. Danh sách chia 10 câu mỗi trang.
4. Hoặc chọn **Tải mẫu CSV**, sửa mẫu và **Nhập CSV**. Các dòng nhập được thêm vào danh sách hiện tại; dòng hoàn toàn trống trong bản nháp được bỏ qua khi nhập. File có lỗi bị từ chối toàn bộ, kèm số dòng; bản nháp hiện tại được giữ.
5. Chọn **Tạo link chơi**. Nếu dữ liệu chưa hợp lệ, bấm lỗi để chuyển đến dòng cần sửa. Đáp án trùng được báo lỗi, không tự loại hoặc đổi nghĩa.
6. Sao chép link trên màn thành công, hoặc chọn **Chơi bộ từ này**. Nếu trình duyệt không cho sao chép tự động, ô link được chọn để sao chép thủ công.

Link có dạng `https://<game>/?deck=<id>`. Mọi người có link đều mở được bộ từ, không cần tài khoản. Trước khi vào sảnh, người chơi phải nhập hoặc xác nhận **tên dài 1–24 ký tự**. Tên được chuẩn hóa Unicode NFC, bỏ khoảng trắng thừa và từ chối ký tự điều khiển/định dạng ẩn. Trình duyệt có thể nhớ tên cho lần sau nhưng vẫn hiện bước xác nhận khi mở link. Tên là nhãn hiển thị công khai với người có link, không phải tài khoản hay danh tính duy nhất; nhiều người có thể dùng cùng tên.

Để chơi **cùng một trận**, mọi người mở cùng link bộ từ rồi nhập PIN phòng của host. Chỉ gửi link sẽ mở bộ từ, không tự ghép tất cả người nhận vào một phòng.

Ngôn ngữ nội dung do người tạo chọn và được cố định khi chơi bộ đó. Game không tự dịch nội dung do host nhập. Mẫu CSV tải xuống dùng nghĩa theo ngôn ngữ đã chọn. Nút VI/EN trong trình tạo đổi ngôn ngữ giao diện; trường ngôn ngữ bộ từ là lựa chọn riêng.

**Luật sinh tồn** áp dụng cho toàn bộ bộ từ, cả chơi riêng và co-op:

- **Máu bằng trái tim** (mặc định): cận chiến 150 HP, đánh xa 100 HP, hồi máu theo giới hạn của anh hùng như game chính.
- **Một chạm là chết**: mọi anh hùng có 1 HP; bất kỳ đòn từ quái hoặc Boss thực sự gây sát thương đều hạ người chơi. Hồi máu không thể vượt 1 HP. Trong co-op, người bị hạ theo dõi đồng đội và đội chỉ thua khi tất cả đã gục.

Luật được chọn trên web, không nằm trong từng dòng CSV, và được giữ nguyên khi chia sẻ link. Bộ cũ không có trường luật dùng mặc định **Máu bằng trái tim**. API nhận `damageMode: "health"` hoặc `damageMode: "one-hit"`.

## Dữ liệu và dạng câu hỏi

Mỗi bộ có **1–500 câu**, tên dài 1–80 ký tự. Mỗi đáp án chỉ gồm **1–18 chữ cái a–z**, không có khoảng trắng, số, dấu gạch nối hoặc dấu câu; chữ hoa được chuẩn hóa thành chữ thường. Đáp án không được trùng trong cùng bộ. Đây là giới hạn của cơ chế gõ một từ hiện tại, không hỗ trợ trả lời cả câu.

| Giá trị `type` | Trong giao diện | Cách chơi |
| --- | --- | --- |
| `mixed` | Trộn các dạng | Game chọn trong các dạng câu đố từ vựng hiện có. |
| `translate` | Đoán từ qua nghĩa | Đọc nghĩa/định nghĩa rồi gõ đáp án. |
| `missing` | Điền chữ thiếu | Xem mẫu chữ thiếu, gõ lại cả từ. |
| `scramble` | Xếp chữ | Sắp xếp các chữ bị xáo trộn bằng cách gõ cả từ. |
| `fill` | Điền từ vào câu | Đọc câu có chỗ trống, gõ từ cần điền. |

Với `fill`, trường `sentence` cần đúng **một `___`**, tức 3 dấu gạch dưới, cùng ngữ cảnh trước hoặc sau. Ví dụ đáp án `apple`, câu `I eat an ___ every day.` Người chơi chỉ gõ `apple`. Nghĩa có thể để trống ở dạng này; các dạng khác cần nghĩa/định nghĩa. Giới hạn nghĩa 400 ký tự, câu 300 ký tự.

`level` là bậc game 1–10: 1 dễ nhất, 10 khó nhất; không phải chứng nhận CEFR. Host tự đặt bậc phù hợp. Mỗi trận bắt đầu ở bậc thấp; engine ưu tiên bậc phù hợp còn từ trong bộ.

## Mẫu CSV

Mẫu tải từ web có UTF-8 BOM để giữ dấu tiếng Việt khi mở bằng phần mềm bảng tính. Giữ tiêu đề cột và lưu dưới dạng CSV UTF-8, phân cách bằng dấu phẩy. Thay các dòng ví dụ bằng bộ từ muốn chơi; các dòng ví dụ còn lại cũng sẽ được nhập.

```csv
answer,meaning,partOfSpeech,level,type,sentence
apple,Quả táo,noun,1,mixed,
happy,Vui vẻ,adjective,1,translate,
water,Nước,noun,1,fill,I drink ___ every day.
book,Quyển sách,noun,1,missing,
garden,Khu vườn,noun,2,scramble,
```

| Cột | Quy tắc |
| --- | --- |
| `answer` | Bắt buộc có cột và đáp án hợp lệ trên từng dòng. |
| `meaning` | Nghĩa Việt hoặc định nghĩa Anh theo ngôn ngữ bộ; bắt buộc trừ dạng `fill`. |
| `partOfSpeech` | Từ loại; để trống mặc định `unspecified`. |
| `level` | Số nguyên 1–10; để trống mặc định 1. |
| `type` | Một trong 5 giá trị ở bảng trên; để trống mặc định `mixed`. |
| `sentence` | Bắt buộc với `fill`; để trống với các dạng khác. |

Từ loại hỗ trợ: `noun`, `verb`, `adjective`, `adverb`, `preposition`, `pronoun`, `conjunction`, `interjection`, `determiner`, `numeral`, `prefix`, `suffix`, `abbreviation`, `unspecified`.

Nếu ô chứa dấu phẩy, dấu ngoặc kép hoặc xuống dòng, phần mềm bảng tính cần đặt ô trong ngoặc kép; dấu `"` bên trong viết thành `""`. File nhập tối đa 1 MB. Bộ từ đã tạo không có luồng sửa tại link cũ; muốn thay nội dung, tạo bộ mới và chia sẻ link mới.

## Chơi lại và hết hạn

Mỗi trận dùng các từ của bộ đó một lần. Có thể chơi lại toàn bộ bộ câu hỏi khi còn hạn. Lịch sử từ đã gặp của bộ tự tạo chỉ giữ trong phiên chơi, không đánh dấu từ đã gặp hoặc thay đổi tiến trình từ điển chính. Kết quả trận đủ điều kiện được lưu vào bảng danh vọng chung của link, độc lập với tiến trình game chính.

### Bảng danh vọng của link

Có thể xem bảng danh vọng trước khi nhập tên, từ sảnh hoặc sau khi kết thúc trận. Bảng giữ **50 lượt chơi đơn** và **50 lượt co-op** có thứ hạng cao nhất, tách thành hai chế độ. Mỗi dòng là một **lượt chơi**, không phải điểm cao nhất của một tài khoản; chơi lại có thể tạo thêm một dòng. Lượt co-op ghi tên các thành viên lúc bắt đầu và **điểm chung của đội**, kể cả khi thành viên mất kết nối trong trận.

Thứ tự xếp hạng lần lượt là điểm giảm dần, số từ hoàn thành giảm dần, độ chính xác giảm dần, thời gian trận ngắn hơn, thời điểm hoàn thành sớm hơn; UUID của lượt là khóa phụ cuối cùng khi mọi chỉ số bằng nhau. Hai bảng đơn/co-op được tính riêng để tránh so điểm của một người với cả đội.

Backend tự lấy điểm và chỉ số từ trận sinh tồn đã kết thúc; client không gửi điểm tự khai. Kết quả được lưu bất đồng bộ để không chặn mô phỏng game và dùng UUID để tránh ghi trùng khi thử lại. Giao diện báo đang lưu, đã lưu hoặc chưa lưu được. **Chơi ngoại tuyến** và **luyện Boss** vẫn dùng được khi có sẵn nội dung nhưng không được xếp hạng. Lượt chưa kết thúc không được ghi danh.

Thời hạn lấy từ máy chủ, không gia hạn khi tải lại trang hay chơi lại. **Bảng danh vọng hết hạn và bị xóa cùng bộ từ**, không có thời hạn riêng cho từng lượt. Đến hạn, API từ chối tải, phòng đang dùng bộ hết hạn bị đóng và frontend dừng lượt chơi. Nội dung bị loại khỏi bộ nhớ chơi được ngay khi phát hiện hết hạn; tiến trình dọn file chạy mỗi 60 giây và lúc máy chủ khởi động. Vì vậy link ngừng dùng tại mốc 24 giờ, còn xóa file vật lý có thể muộn hơn một chu kỳ dọn khi server đang chạy.

## Lưu trữ trên Railway

Bộ từ và bảng danh vọng được lưu chung trong JSON bằng backend, không chỉ trong RAM. Mỗi cập nhật kết quả dùng ghi file tạm rồi đổi tên nguyên tử; lỗi ghi không thay thế bảng đang có. Bộ từ cũ chưa có bảng danh vọng vẫn mở được với bảng trống. Để bộ và kết quả còn nguyên khi deploy/khởi động lại trong thời hạn 24 giờ, service Railway phải có volume bền vững:

```text
Volume mount path: /app/data
CUSTOM_DECK_DIR=/app/data/custom-decks
```

Đặt biến trên cho **backend** và gắn volume vào đúng service đang chạy `backend/server.mjs`. Thư mục được tạo khi khởi động. Chạy local mặc định dùng `data/custom-decks` trong repo, đã bị loại khỏi Git. Không commit bộ từ người dùng tạo.

Store hiện dành cho **một replica**: index và phòng nằm trong RAM của từng tiến trình, file nằm trên volume của service. Chưa hỗ trợ chia sẻ index/phòng giữa nhiều replica. Không có volume bền vững thì dữ liệu có thể mất khi redeploy dù link chưa hết 24 giờ. Không dùng xóa volume để dọn bộ hết hạn; backend đã tự dọn theo TTL.

API dùng `POST /api/custom-decks` để tạo và `GET /api/custom-decks/:id` để tải, trả `{ "deck": ... }`. POST nhận tối đa 1 MiB JSON; lỗi kiểm tra trả 422 kèm `errors` có dòng/trường. ID ngẫu nhiên 128 bit, không lấy từ tên bộ hay đường dẫn người dùng nhập. Phản hồi deck dùng `Cache-Control: no-store`. Store giới hạn mặc định 1.000 bộ đang còn hạn hoặc 100 MiB; khi đầy trả lỗi để thử lại sau.

`GET /api/custom-decks/:id/leaderboard` trả `{ "deckId": "...", "expiresAt": 0, "entries": [...] }` với `Cache-Control: no-store`; cũng hỗ trợ HEAD. Mỗi dòng gồm `id`, `players`, `score`, `words`, `accuracy`, `durationMs`, `endedAt`, `reason` (`defeat` hoặc `vocabulary-complete`). Không có API công khai POST/PUT điểm; endpoint bảng danh vọng từ chối các phương thức ghi. Dữ liệu bảng được tính chung vào giới hạn lưu trữ và không thể kéo dài hạn dùng của bộ.

Mã chính: `src/ui/CreateMode.tsx`, `src/ui/CustomDeckGame.tsx`, `src/ui/DeckLeaderboard.tsx`, `src/game/customDeck.ts`, `src/game/customDeckLeaderboard.ts`, `src/game/customDeckApi.ts`, `backend/custom-decks.mjs`, `backend/server.mjs` và `backend/rooms.mjs`. Sau thay đổi shared schema/engine cần chạy lại `pnpm build:api`; `pnpm build` cũng thực hiện bước này.
