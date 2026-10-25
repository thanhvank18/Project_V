# Triển khai

Frontend Vite/React chạy trên **Vercel**. **Railway** chạy API Node.js chỉ đọc từ điển đã đóng gói. Hai dịch vụ dùng cùng repository và thư mục gốc dự án.

- [Mở game](https://project-v-swart.vercel.app)
- [Kiểm tra API đang chạy](https://projectv-production.up.railway.app/health)

## Chạy local

Yêu cầu Node.js 22.12+ và phiên bản pnpm trong `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Frontend ở http://127.0.0.1:5174. Mặc định `VITE_API_URL` để trống, game tải `/vocabulary/en-vi.json` cùng origin; chạy frontend riêng là đủ.

Để thử backend, mở terminal thứ hai:

```sh
pnpm start:api
```

API mặc định ở http://127.0.0.1:3001. Đặt dòng sau trong `.env.local`, rồi khởi động lại Vite:

```dotenv
VITE_API_URL=http://127.0.0.1:3001
```

`GET /health` trả trạng thái và số từ; `GET /api/vocabulary` trả catalog. Có thể chạy `pnpm test:api` để kiểm tra API.

## Railway: API từ điển

Kết nối repository với service Railway, chọn thư mục gốc repository. Railway tự phát hiện `Dockerfile` ở gốc. Container chỉ cần server cùng `public/vocabulary/en-vi.json`; không cần cài dependency Node bên ngoài.

Service hiện tại không áp dụng `railway.json`: Railway đánh dấu Config-as-Code là deprecated và không cho service mới bật từ 28/08/2026. File này được giữ làm tham khảo. Các giá trị đang dùng được đặt trực tiếp trong Dashboard: health check **`/health`**, timeout **120 giây**, restart policy **On Failure**, tối đa **3 lần thử lại**. Khi tạo service mới, nhập các giá trị này trong Dashboard.

Railway cấp `PORT`; server lắng nghe `0.0.0.0` trên cổng đó. Giá trị 3001 là mặc định khi chạy local. Origin API hiện tại là `https://projectv-production.up.railway.app`; kiểm tra [health endpoint](https://projectv-production.up.railway.app/health) trả HTTP 200 trước khi nối frontend.

`CORS_ORIGINS` là biến tùy chọn của Railway. Mặc định `*` cho API dữ liệu công khai, chỉ đọc. Có thể đặt danh sách origin frontend chính xác, phân cách bằng dấu phẩy; mỗi origin gồm giao thức và host, không có đường dẫn. Thêm origin local hoặc preview nếu muốn chúng gọi API khi đã giới hạn CORS.

## Vercel: frontend

Import cùng repository, chọn thư mục gốc. `vercel.json` đã đặt framework Vite, lệnh cài `pnpm install --frozen-lockfile`, build `pnpm build` và thư mục đầu ra `dist`.

Trong Environment Variables, đặt `VITE_API_URL=https://projectv-production.up.railway.app` cho môi trường cần triển khai. Frontend tự nối `/api/vocabulary`; giá trị cấu hình chỉ cần origin. Biến này được đưa vào bundle lúc build, nên thay đổi cần build/deploy lại.

Nếu để trống `VITE_API_URL`, bản Vercel dùng từ điển tĩnh đi kèm. Khi đã cấu hình API mà API lỗi, giao diện báo lỗi tải và cho thử lại; không tự đổi sang bản tĩnh.

Sau deploy, kiểm tra trang tải được từ điển, bắt đầu trận, nhập chữ và tải lại để xác nhận tiến trình trình duyệt vẫn còn. Nếu gặp lỗi CORS, đối chiếu origin frontend với `CORS_ORIGINS` trên Railway.

## Dữ liệu và repository

API không ghi kết quả trận hoặc tài khoản. localStorage/IndexedDB tiếp tục lưu lịch sử, điểm và cài đặt trên từng trình duyệt; chưa có database hoặc đồng bộ cloud. Đổi thiết bị, trình duyệt hoặc origin frontend không tự chuyển tiến trình.

Repository giữ code, lockfile và asset/catalog runtime để clone rồi build trực tiếp. `.gitignore` loại bí mật, cache, review artifacts, CSV/pack nguồn và ZIP. Các script nhập lại hoặc kiểm chứng xuất xứ có thể cần những nguồn bị bỏ qua đó; build/deploy thông thường dùng đầu ra đã đóng gói. Khi đổi từ điển, cập nhật JSON runtime rồi deploy lại cả API và frontend để giữ dữ liệu nhất quán.
