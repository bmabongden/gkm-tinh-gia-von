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
   - Nút **📦 Lấy tồn kho**: app tự vào KiotViet xuất danh sách hàng hóa và lấy tồn kho mới nhất, hiện cột *Tồn* cho từng món (hết hoặc thiếu thì tô đỏ). Cần cài chương trình **GKM Tồn kho** một lần trên mỗi máy: vào thư mục `tonkho`, bấm đúp `cai-dat.bat`. Địa chỉ cửa hàng (mặc định `ptxmgkk`), đăng nhập và đổi tài khoản KiotViet nằm ở nút **⚙️ Cài đặt** góc trên: bấm *Đăng nhập KiotViet* để mở một cửa sổ Edge **riêng**, đăng nhập một lần rồi đóng cửa sổ đó; *Đổi tài khoản* sẽ đăng xuất tài khoản cũ rồi mở trang đăng nhập. Chương trình không đụng tới Chrome đang dùng, không lưu mật khẩu, chỉ nhận lệnh từ chính máy đó. Gỡ: bấm đúp `go-cai-dat.bat`.
   - Nút **🖨️ In báo giá**: in hoặc *Lưu dưới dạng PDF* báo giá cho khách (ảnh xe, danh sách món, giá bán, không có giá vốn). Cần đặt công thức giá bán trước.
   - Hóa đơn: món bán thấp hơn giá vốn tô cam, có nhãn *Bán lỗ* và bộ lọc *Chỉ món lỗ*.
   - Ô *Thêm sản phẩm*: gõ vài chữ của mã hoặc tên là ra gợi ý, dùng ↑ ↓ Enter để chọn.
4. **Tính giá bán theo công thức** (+ − × ÷ +%) nằm dưới hóa đơn và dưới mỗi bộ nhựa.

## Làm mới
Nút **🧹 Làm mới** góc trên: đưa mọi bộ nhựa đã sửa (mã thay thế, thêm / bớt món, số lượng) về bản gốc trong file, quên các mã thay thế đã nhớ, và xóa hóa đơn đang làm. Bảng giá vốn, các phiên bộ nhựa, ảnh xe và giá vốn tự điền tay được giữ nguyên.

## Cập nhật bản mới
Bấm nút **🔄 Cập nhật** góc trên bên phải (cần có mạng, dùng Chrome hoặc Edge). Nếu có bản mới, bấm **⚡ Cập nhật ngay**, chọn thư mục app (thư mục đang chứa `index.html`) và bấm *Cho phép* khi trình duyệt hỏi. App tự tải bản mới, ghi đè đúng chỗ và mở lại. Bảng giá, bộ nhựa, ảnh xe vẫn giữ nguyên.

## Mật khẩu hiện giá vốn
Vào **⚙️ Cài đặt** → *Mật khẩu hiện giá vốn*, gõ mỗi dòng một mật khẩu (dùng được nhiều mật khẩu, để trống là không cần). Khi đang ẩn giá vốn, bấm **👁 Hiện giá vốn** phải nhập đúng một mật khẩu. Tồn kho vẫn hiện khi ẩn giá vốn. Quên mật khẩu: ở ô nhập bấm *Quên mật khẩu?* để xem gợi ý, hoặc chọn thư mục app để xóa hết mật khẩu rồi đặt lại.

## Biểu tượng trên màn hình
Bấm đúp file `tao-bieu-tuong.bat` trong thư mục app. Màn hình Desktop sẽ có biểu tượng **GKM Tính giá vốn** (logo thẻ giá màu cam), từ sau bấm đúp vào đó để mở app.
