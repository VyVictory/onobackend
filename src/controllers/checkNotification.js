import Notification from "../models/notification.js";

export const createNotification = async (data) => {
  const {
    recipient,
    sender,
    reference,
    referenceModel,
    type,
    content,
    ...rest
  } = data;

  // Chỉ kiểm tra nếu referenceModel là "Friendship" hoặc "Follow"
  if (["Friendship", "Follow"].includes(referenceModel)) {
    const existing = await Notification.findOne({
      recipient,
      sender,
      reference,
      referenceModel,
      isRead: false,
    });

    if (existing) {
      // Không tạo thêm vì đã có thông báo tương tự chưa đọc
      return null;
    }
  }

  // Chỉ thêm các field có trong `data`
  const newNotification = new Notification({
    ...(recipient && { recipient }),
    ...(sender && { sender }),
    ...(type && { type }),
    ...(reference && { reference }),
    ...(referenceModel && { referenceModel }),
    ...(content && { content }),
    ...rest, // Nếu bạn muốn hỗ trợ các field phụ khác
  });

  return await newNotification.save();
};
