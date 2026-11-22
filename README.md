# GKM Tính giá vốn

App chạy offline hoàn toàn trên trình duyệt (Chrome / Edge / Cốc Cốc), không cần cài đặt, không cần mạng.

## Cách chạy để kiểm tra
1. Giữ nguyên cả thư mục `gkm-tinh-gia-von` (gồm `index.html`, `app.js`, thư mục `lib`…).
2. Bấm đúp `index.html` để mở bằng Chrome hoặc Edge.
3. Dữ liệu (bảng giá, bộ nhựa, ảnh) lưu ngay trong trình duyệt trên máy đó. Lần sau mở lại vẫn còn.
   Lưu ý: luôn mở cùng một file `index.html` ở cùng chỗ, vì nếu chuyển thư mục đi nơi khác, trình duyệt coi đó là app mới. Đừng xóa dữ liệu duyệt web của trình duyệt, vì dữ liệu app nằm trong đó.

## Các bước dùng
1. **📦 Lấy bảng giá & tồn kho KiotViet** (nút cam trên cùng): app tự lấy giá vốn, giá bán, tên hàng và tồn kho mới nhất từ KiotViet, dùng chung cho cả hóa đơn và bộ nhựa. Không cần nhập tay bảng giá hóa đơn.
2. **🧾 Hóa đơn**: kéo thả file `ChiTietHoaDon_….xlsx`. App hiện giá vốn, giá bán (lấy từ hóa đơn, thiếu thì lấy theo bảng giá), tiền vốn, tiền bán và chênh lệch từng món và tổng. Sửa SL trong ô, ✕ để bớt, ô ➕ để thêm món. Khi đã thêm/bớt sẽ có khung vàng thông báo ở dưới, có nút khôi phục bản gốc. Muốn tạo đơn bằng tay: gõ tên hoặc mã vào ô **🔍 Tìm sản phẩm thêm vào đơn**, chọn món, nhập số lượng rồi bấm Thêm. Dòng trên cùng của tab ghi giá vốn KiotViet đang dùng cập nhật lúc nào.
3. **🏍️ Bộ nhựa**: nhập file bộ nhựa, rồi bấm **🔄 Cập nhật bảng giá vốn bộ nhựa** (bảng giá Honda, chỉ một bảng) ở đầu tab. Mã không có trên KiotViet được gắn nhãn tím **Chưa mở bán**.
   - Nút **🙈 Ẩn giá vốn**: chế độ cho khách xem, chỉ hiện giá bán.
   - Thanh **dòng xe** (SH Mode, Vision, Lead, Wave Alpha…) phía trên danh sách: bấm để lọc nhanh theo dòng xe.
   - Nút **🔍 Mã thay thế** cạnh nhãn *Chưa mở bán*: gợi ý các mã đang bán có phần đầu giống nhất, bấm *Chọn* để thay. Nếu mã cũ còn ở bộ nhựa khác (kể cả phiên khác), app hỏi *Thay tất cả* hay *Chỉ món này*. Chọn *Thay tất cả* thì app nhớ lại và tự thay cả khi nhập file bộ nhựa mới sau này.
   - Tồn kho lấy cùng lúc với nút **📦 Lấy bảng giá & tồn kho KiotViet**: cột *Tồn* cho từng món (hết hoặc thiếu thì tô đỏ). Cần cài chương trình **GKM Tồn kho** một lần trên mỗi máy: vào thư mục `tonkho`, bấm đúp `cai-dat.bat`. Địa chỉ cửa hàng (mặc định `ptxmgkk`), đăng nhập và đổi tài khoản KiotViet nằm ở **⚙️ Cài đặt**. Chương trình dùng cửa sổ Edge **riêng**, không đụng tới Chrome đang dùng, không lưu mật khẩu. Gỡ: bấm đúp `go-cai-dat.bat`.
   - Nút **🖨️ In phiếu nhặt hàng** và **🖼️ Ảnh phiếu nhặt (Zalo)**: danh sách mã để đi nhặt nhựa trong kho, không có giá (xem mục bên dưới).
   - Hóa đơn: món bán thấp hơn giá vốn tô cam, có nhãn *Bán lỗ* và bộ lọc *Chỉ món lỗ*.
   - Ô *Thêm sản phẩm*: gõ vài chữ của mã hoặc tên là ra gợi ý, dùng ↑ ↓ Enter để chọn.
4. **Tính giá bán**: mặc định là phép nhân (giá vốn × hệ số, vd 1,3), không làm tròn. Muốn đổi sang + − ÷ +% thì bấm vào dấu × để hiện các phép khác. Ảnh bộ nhựa lấy nguyên từ file bộ nhựa, không sửa trong app.

## Làm mới
Nút **🧹 Làm mới** góc trên: đưa mọi bộ nhựa đã sửa (mã thay thế, thêm / bớt món, số lượng) về bản gốc trong file, quên các mã thay thế đã nhớ, và xóa hóa đơn đang làm. Bảng giá vốn, các phiên bộ nhựa, ảnh xe và giá vốn tự điền tay được giữ nguyên.

## Cập nhật bản mới
Vào **⚙️ Cài đặt** → *Cập nhật app* → **Kiểm tra bản mới** (cần có mạng, dùng Chrome hoặc Edge). Nếu có bản mới, bấm **⚡ Cập nhật ngay**, chọn thư mục app (thư mục đang chứa `index.html`) và bấm *Cho phép* khi trình duyệt hỏi. App tự tải bản mới, ghi đè đúng chỗ và mở lại. Bảng giá, bộ nhựa, ảnh xe vẫn giữ nguyên.

## Mật khẩu hiện giá vốn
Vào **⚙️ Cài đặt** → *Mật khẩu hiện giá vốn*, gõ mỗi dòng một mật khẩu (dùng được nhiều mật khẩu, để trống là không cần). Khi đang ẩn giá vốn, bấm **👁 Hiện giá vốn** phải nhập đúng một mật khẩu. Tồn kho vẫn hiện khi ẩn giá vốn. Quên mật khẩu: ở ô nhập bấm *Quên mật khẩu?* để xem gợi ý, hoặc chọn thư mục app để xóa hết mật khẩu rồi đặt lại.

## Biểu tượng trên màn hình
Bấm đúp file `tao-bieu-tuong.bat` trong thư mục app. Màn hình Desktop sẽ có biểu tượng **GKM Tính giá vốn** (logo thẻ giá màu cam), từ sau bấm đúp vào đó để mở app.

## Gửi phiếu nhặt hàng qua Zalo
Trong chi tiết bộ nhựa, bấm **🖼️ Ảnh phiếu nhặt (Zalo)**. App tạo ảnh danh sách mã cần nhặt (mã hàng chữ to, tên, số lượng, tồn kho, không có giá) và chép sẵn: mở Zalo, bấm vào ô chat rồi nhấn `Ctrl+V`. Có nút *Chép mã dạng chữ* để gửi dạng tin nhắn, và *Tải ảnh* để lưu file.

## In phiếu nhặt hàng
Trong chi tiết bộ nhựa, bấm **🖨️ In phiếu nhặt hàng** để in danh sách mã đi nhặt nhựa trong kho: ô tích, mã hàng chữ to, tên, số lượng, tồn kho (nếu đã lấy) và cột ghi chú. Phiếu không có giá. Món thiếu hàng hoặc chưa mở bán được tô xám để dễ thấy.

## Bảng giá & tồn kho KiotViet (một nút)
Nút **📦 Lấy bảng giá & tồn kho KiotViet** (nút cam trên cùng, cạnh nút Làm mới) tự vào KiotViet xuất danh sách hàng hóa, rồi cùng lúc: cập nhật tồn kho, và **thay bảng giá vốn hóa đơn mặc định** bằng giá vốn, giá bán, tên hàng mới nhất. Không cần nhập tay bảng giá hóa đơn nữa. Anh chỉ tự nhập **bảng bộ nhựa** và **bảng giá Honda** (bảng giá vốn bộ nhựa).

Tên chi tiết trong bộ nhựa lấy theo tên hàng trên KiotViet; mã nào KiotViet không có mới dùng tên trong file bộ nhựa.

## Cập nhật bảng giá vốn bộ nhựa
App chỉ dùng **một** bảng giá vốn bộ nhựa (bảng giá Honda). Ở đầu tab Bộ nhựa bấm **🔄 Cập nhật bảng giá vốn bộ nhựa**, chọn file mới: bảng cũ được thay luôn và các bộ nhựa tính lại theo giá mới. Dòng bên dưới ghi bảng giá cập nhật lúc nào, từ file nào.
