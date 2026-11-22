# GKM Tính giá vốn

App chạy offline hoàn toàn trên trình duyệt (Chrome / Edge / Cốc Cốc), không cần cài đặt, không cần mạng.

## Cách chạy để kiểm tra
1. Giữ nguyên cả thư mục `gkm-tinh-gia-von` (gồm `index.html`, `app.js`, thư mục `lib`…).
2. Bấm đúp `index.html` để mở bằng Chrome hoặc Edge.
3. Dữ liệu (bảng giá, bộ nhựa, ảnh) lưu ngay trong trình duyệt trên máy đó. Lần sau mở lại vẫn còn.
   Lưu ý: luôn mở cùng một file `index.html` ở cùng chỗ, vì nếu chuyển thư mục đi nơi khác, trình duyệt coi đó là app mới. Đừng xóa dữ liệu duyệt web của trình duyệt, vì dữ liệu app nằm trong đó.

## Các bước dùng
1. **📦 Bảng giá vốn** có 2 nhóm chạy riêng:
   - *Bảng giá vốn hóa đơn (hàng đang bán)*: nhập `DanhSachSanPham.xlsx` từ KiotViet (Mã hàng, Tên hàng, Giá vốn, Giá bán).
   - *Bảng giá vốn bộ nhựa*: nhập bảng giá vốn dùng riêng cho bộ nhựa. Nút ⇄ chuyển một phiên sang nhóm kia.
2. **🧾 Hóa đơn**: kéo thả file `ChiTietHoaDon_….xlsx`. App hiện giá vốn, giá bán (lấy từ hóa đơn, thiếu thì lấy theo bảng giá), tiền vốn, tiền bán và chênh lệch từng món và tổng. Sửa SL trong ô, ✕ để bớt, ô ➕ để thêm món. Khi đã thêm/bớt sẽ có khung vàng thông báo ở dưới, có nút khôi phục bản gốc.
3. **🏍️ Bộ nhựa**: nhập file bộ nhựa, chọn *Bảng giá vốn bộ nhựa* và *Đối chiếu hàng đang bán*. Mã không có trong bảng hàng đang bán được gắn nhãn tím **Chưa mở bán**. Thêm/bớt/sửa SL được lưu lại, có khung thông báo và nút khôi phục bộ gốc.
   - Nút **🙈 Ẩn giá vốn**: chế độ cho khách xem, chỉ hiện giá bán.
   - Thanh **dòng xe** (SH Mode, Vision, Lead, Wave Alpha…) phía trên danh sách: bấm để lọc nhanh theo dòng xe.
   - Nút **🔍 Mã thay thế** cạnh nhãn *Chưa mở bán*: gợi ý các mã đang bán có phần đầu giống nhất, bấm *Chọn* để thay. Nếu mã cũ còn ở bộ nhựa khác (kể cả phiên khác), app hỏi *Thay tất cả* hay *Chỉ món này*. Chọn *Thay tất cả* thì app nhớ lại và tự thay cả khi nhập file bộ nhựa mới sau này.
   - Nút **🖨️ In báo giá**: in hoặc *Lưu dưới dạng PDF* báo giá cho khách (ảnh xe, danh sách món, giá bán, không có giá vốn). Cần đặt công thức giá bán trước.
   - Hóa đơn: món bán thấp hơn giá vốn tô cam, có nhãn *Bán lỗ* và bộ lọc *Chỉ món lỗ*.
   - Ô *Thêm sản phẩm*: gõ vài chữ của mã hoặc tên là ra gợi ý, dùng ↑ ↓ Enter để chọn.
4. **Tính giá bán theo công thức** (+ − × ÷ +%) nằm dưới hóa đơn và dưới mỗi bộ nhựa.

## Làm mới
Nút **🧹 Làm mới** góc trên: đưa mọi bộ nhựa đã sửa (mã thay thế, thêm / bớt món, số lượng) về bản gốc trong file, quên các mã thay thế đã nhớ, và xóa hóa đơn đang làm. Bảng giá vốn, các phiên bộ nhựa, ảnh xe và giá vốn tự điền tay được giữ nguyên.

## Cập nhật bản mới
Bấm nút **🔄 Cập nhật** góc trên bên phải (cần có mạng). Nếu có bản mới, app hiện nội dung thay đổi và nút **Tải bản mới**. Giải nén file zip, rồi chép đè tất cả file vào **đúng thư mục app đang dùng**, sau đó mở lại `index.html`. Dữ liệu vẫn còn nguyên.
