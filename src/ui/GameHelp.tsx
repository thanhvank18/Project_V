export function GameHelp() {
  return <div className="help-content">
    <p>Đọc nghĩa tiếng Việt, từ loại và chữ gợi ý, rồi nhập <strong>toàn bộ từ tiếng Anh</strong>. Mỗi ký tự đúng trở thành đòn đánh của anh hùng. Đủ năng lượng, kỹ năng riêng tự kích hoạt.</p>
    <dl>
      <div><dt>Chọn vị trí</dt><dd><kbd>←</kbd> / <kbd>→</kbd> để di chuyển. Cung thủ cần khoảng cách, kiếm sĩ mạnh khi quái áp sát, thương thủ tận dụng quái đứng thành hàng. Xem chiến thuật của từng anh hùng khi chọn nhân vật.</dd></div>
      <div><dt>Chọn mục tiêu</dt><dd><kbd>Tab</kbd> / <kbd>Shift + Tab</kbd> để đổi mục tiêu; chữ đúng đầu tiên sẽ khóa mục tiêu. <kbd>Backspace</kbd> xóa hết để mở khóa. Gõ lại chữ đã tính không gây thêm sát thương hoặc năng lượng.</dd></div>
      <div><dt>Nhịp hoàn hảo</dt><dd>Hoàn thành từ không sai, không dùng gợi ý để tăng nhịp: thêm điểm và tốc độ di chuyển, tối đa 5 bậc. Một lỗi chỉ làm mất một bậc; tiếp tục gõ chính xác để lấy lại nhịp. Thanh nhịp cạn dần nếu lâu không hoàn thành từ.</dd></div>
      <div><dt>Đọc đòn Boss</dt><dd>Vùng sáng trên mặt đất báo vị trí đòn đánh sắp tới. Rời khỏi vùng đó trước khi Boss ra đòn. Boss đổi cách đánh qua các giai đoạn; hãy quan sát cả khoảng đất phía trước khi Boss lấy đà lao tới.</dd></div>
      <div><dt>Đội hình quái</dt><dd>Tank che các quái phía sau cùng hướng. Runner tranh thủ lao tới; quái tầm xa và quái triệu hồi gây áp lực từ phía sau. Đổi phía, mở đội hình rồi chọn mục tiêu quan trọng trước.</dd></div>
      <div><dt>Bản đồ tương tác</dt><dd>Chọn thùng nổ bằng <kbd>Tab</kbd>, gõ từ trên thùng để kích nổ gần quái. Đứng cạnh cổng, xóa hết chữ rồi nhấn <kbd>Enter</kbd> để đóng hoặc mở. Đứng yên trong vùng hồi phục để nạp máu; số lượt hồi có giới hạn.</dd></div>
      <div><dt>Gõ sai</dt><dd>Đòn đánh bị kẹt 0,3 giây trong khi quái vẫn tiến. Mỗi chữ trúng làm quái khựng 0,3 giây; Boss không khựng.</dd></div>
      <div><dt>Vật phẩm</dt><dd><kbd>1</kbd> hồi máu · <kbd>2</kbd> đóng băng · <kbd>3</kbd> tăng lực · <kbd>4</kbd> gợi ý. Từ càng khó, cơ hội rơi đồ càng cao; mỗi loại giữ tối đa 5 món.</dd></div>
      <div><dt>Tiến độ học</dt><dd>Trận mới bắt đầu bậc 1; mỗi 20 từ hoàn thành tăng một bậc, tối đa bậc 10. Mỗi từ chỉ xuất hiện một lần, kể cả qua các trận. Hết kho và dọn sạch đợt cuối là chiến thắng.</dd></div>
      <div><dt>Sổ từ</dt><dd>Sau trận, xem lại vài từ vừa gặp cùng nghĩa, từ loại và ví dụ có sẵn. Trong sổ Từ đã gặp, bấm loa để nghe tiếng Anh hoặc ngôi sao để lưu yêu thích. Ôn trong sổ không đưa từ trở lại trận.</dd></div>
      <div><dt>Chơi cùng bạn</dt><dd>Gửi mã phòng 6 số cho bạn bè. Tối đa 4 người, mỗi người chọn một anh hùng khác nhau; chủ phòng bắt đầu trận.</dd></div>
      <div><dt>Tạm dừng</dt><dd><kbd>Esc</kbd> để nghỉ. Chơi một mình sẽ dừng trận; trong phòng trực tuyến chỉ dừng điều khiển của bạn, thế giới vẫn tiếp tục. Chuyển tab cũng dừng điều khiển.</dd></div>
    </dl>
    <p className="help-note">Khi HP dưới 30, cảnh chơi chao nhẹ và tối viền. Bật Giảm chuyển động để tắt rung và chao. Dùng bộ gõ tiếng Anh; bản chơi hiện dành cho máy tính có bàn phím.</p>
  </div>;
}
