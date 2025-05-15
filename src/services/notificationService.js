import Notification from "../models/notification.js";
import { getIO } from "../config/socketConfig.js";

export const createNotification = async ({
  recipient,
  sender,
  type,
  reference,
  referenceModel,
  content,
}) => {
  try {
    const filter = { isRead: false };
    if (recipient) filter.recipient = recipient;
    if (sender) filter.sender = sender;
    if (type) filter.type = type;
    if (referenceModel) filter.referenceModel = referenceModel;
    getIO().to(`user_${recipient}`).emit("loadProfile", { _id: sender });
    if (!referenceModel) return;
    const existingNotification = await Notification.findOne(filter);
    if (existingNotification && referenceModel == "Friendship") return null;

    const notification = new Notification({
      recipient,
      sender,
      type,
      reference,
      referenceModel,
      content,
    });
    await notification.save();
    await notification.populate("sender", "firstName lastName avatar");

    // Gửi thông báo socket với cấu trúc chuẩn hóa
    const socketPayload = {
      _id: notification._id,
      type: notification.type || "",
      content: notification.content || "",
      createdAt: notification.createdAt || "",
      updatedAt: notification.updatedAt || "",
      isActive: notification.isActive ?? true,
      isRead: notification.isRead ?? false,
      recipient: notification.recipient || "",
      sender: {
        _id: notification.sender?._id || "",
        firstName: notification.sender?.firstName || "",
        lastName: notification.sender?.lastName || "",
        avatar: notification.sender?.avatar || "",
      },
      reference: notification.reference || "",
      referenceModel: notification.referenceModel || "",
      __v: 0,
    };

    getIO().to(`user_${recipient}`).emit("notification", socketPayload);

    return notification;
  } catch (error) {
    console.error("Create notification error:", error);
    throw error;
  }
};

export const deactivateNotifications = async (reference) => {
  try {
    const notifications = await Notification.find({
      reference,
      isRead: false,
    });

    if (notifications.length > 0) {
      await Notification.updateMany(
        { reference },
        { $set: { isActive: false } }
      );

      // Thông báo cho tất cả người nhận về việc hủy thông báo
      notifications.forEach((notification) => {
        getIO()
          .to(`user_${notification.recipient}`)
          .emit("notificationDeactivated", {
            notificationId: notification._id,
          });
      });
    }
  } catch (error) {
    console.error("Deactivate notifications error:", error);
    throw error;
  }
};
