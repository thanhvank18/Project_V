import { useLanguage } from './LanguageContext';
export function GameHelp() {
  const { t } = useLanguage();
  return <div className="help-content">
    <p>{t("Đọc nghĩa tiếng Việt, từ loại và chữ gợi ý, rồi nhập ")}<strong>{t("toàn bộ từ tiếng Anh")}</strong>{t(". Mỗi ký tự đúng trở thành đòn đánh của anh hùng. Đủ năng lượng, kỹ năng riêng tự kích hoạt.")}</p>
    <dl>
      <div><dt>{t("Chọn vị trí")}</dt><dd><kbd>←</kbd> / <kbd>→</kbd>{t(" để di chuyển. Cung thủ cần khoảng cách, kiếm sĩ mạnh khi quái áp sát, thương thủ tận dụng quái đứng thành hàng. Xem chiến thuật của từng anh hùng khi chọn nhân vật.")}</dd></div>
      <div><dt>{t("Chọn mục tiêu")}</dt><dd><kbd>Tab</kbd> / <kbd>Shift + Tab</kbd>{t(" để đổi mục tiêu; chữ đúng đầu tiên sẽ khóa mục tiêu. ")}<kbd>Backspace</kbd>{t(" xóa hết để mở khóa. Gõ lại chữ đã tính không gây thêm sát thương hoặc năng lượng.")}</dd></div>
      <div><dt>{t("Nhịp hoàn hảo")}</dt><dd>{t("Hoàn thành từ không sai, không dùng gợi ý để tăng nhịp: thêm điểm và tốc độ di chuyển, tối đa 5 bậc. Một lỗi chỉ làm mất một bậc; tiếp tục gõ chính xác để lấy lại nhịp. Thanh nhịp cạn dần nếu lâu không hoàn thành từ.")}</dd></div>
      <div><dt>{t("Đọc đòn Boss")}</dt><dd>{t("Vùng sáng trên mặt đất báo vị trí đòn đánh sắp tới. Rời khỏi vùng đó trước khi Boss ra đòn. Boss đổi cách đánh qua các giai đoạn; hãy quan sát cả khoảng đất phía trước khi Boss lấy đà lao tới.")}</dd></div>
      <div><dt>{t("Đội hình quái")}</dt><dd>{t("Tank che các quái phía sau cùng hướng. Runner tranh thủ lao tới; quái tầm xa và quái triệu hồi gây áp lực từ phía sau. Đổi phía, mở đội hình rồi chọn mục tiêu quan trọng trước.")}</dd></div>
      <div><dt>{t("Bản đồ tương tác")}</dt><dd>{t("Chọn thùng nổ bằng ")}<kbd>Tab</kbd>{t(", gõ từ trên thùng để kích nổ gần quái. Đứng cạnh cổng, xóa hết chữ rồi nhấn ")}<kbd>Enter</kbd>{t(" để đóng hoặc mở. Đứng yên trong vùng hồi phục để nạp máu; số lượt hồi có giới hạn.")}</dd></div>
      <div><dt>{t("Gõ sai")}</dt><dd>{t("Đòn đánh bị kẹt 0,3 giây trong khi quái vẫn tiến. Mỗi chữ trúng làm quái khựng 0,3 giây; Boss không khựng.")}</dd></div>
      <div><dt>{t("Vật phẩm")}</dt><dd><kbd>1</kbd>{t(" hồi máu · ")}<kbd>2</kbd>{t(" đóng băng · ")}<kbd>3</kbd>{t(" tăng lực · ")}<kbd>4</kbd>{t(" gợi ý. Từ càng khó, cơ hội rơi đồ càng cao; mỗi loại giữ tối đa 5 món.")}</dd></div>
      <div><dt>{t("Tiến độ học")}</dt><dd>{t("Trận mới bắt đầu bậc 1; mỗi 20 từ hoàn thành tăng một bậc, tối đa bậc 10. Mỗi từ chỉ xuất hiện một lần, kể cả qua các trận. Hết kho và dọn sạch đợt cuối là chiến thắng.")}</dd></div>
      <div><dt>{t("Sổ từ")}</dt><dd>{t("Sau trận, xem lại vài từ vừa gặp cùng nghĩa, từ loại và ví dụ có sẵn. Trong sổ Từ đã gặp, bấm loa để nghe tiếng Anh hoặc ngôi sao để lưu yêu thích. Ôn trong sổ không đưa từ trở lại trận.")}</dd></div>
      <div><dt>{t("Chơi cùng bạn")}</dt><dd>{t("Gửi mã phòng 6 số cho bạn bè. Tối đa 4 người, mỗi người chọn một anh hùng khác nhau; chủ phòng bắt đầu trận.")}</dd></div>
      <div><dt>{t("Tạm dừng")}</dt><dd><kbd>Esc</kbd>{t(" để nghỉ. Chơi một mình sẽ dừng trận; trong phòng trực tuyến chỉ dừng điều khiển của bạn, thế giới vẫn tiếp tục. Chuyển tab cũng dừng điều khiển.")}</dd></div>
    </dl>
    <p className="help-note">{t("Khi HP dưới 30, cảnh chơi chao nhẹ và tối viền. Bật Giảm chuyển động để tắt rung và chao. Dùng bộ gõ tiếng Anh; bản chơi hiện dành cho máy tính có bàn phím.")}</p>
  </div>;
}
