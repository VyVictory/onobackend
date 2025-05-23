import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";

const router = express.Router();

// Tắt thông báo tin nhắn
export const toggleNotification = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.notificationsEnabled = !user.notificationsEnabled;
    await user.save();

    res.json({
      message: "Notification setting updated",
      notificationsEnabled: user.notificationsEnabled,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating notification setting", error });
  }
};

// Lấy danh sách thông báo
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const notifications = await Notification.find({
      recipient: userId,
      isActive: true, // Chỉ lấy thông báo còn active
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("sender", "firstName lastName avatar")
      .populate("reference");

    // Lọc bỏ các thông báo có reference không tồn tại
    const filteredNotifications = notifications.filter(
      (notification) => notification.reference != null
    );

    res.json(filteredNotifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getNotificationsByRange = async (req, res) => {
  try {
    const { start, limit } = req.query;
    const startIndex = parseInt(start) || 0; // Default start from 0
    const limitCount = parseInt(limit) || 20; // Default limit to 20 notifications

    // 📌 Lấy danh sách thông báo theo phạm vi (phân trang)
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .skip(startIndex) // Skip the number of notifications already fetched
      .limit(limitCount) // Limit the number of notifications to fetch
      .populate("sender", "_id avatar lastName firstName");

    if (!notifications.length) {
      return res.status(200).json({ unreadCount: 0, notifications: [] });
    }

    // 📌 Truy vấn tổng số thông báo chưa đọc
    const totalUnreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    // 📌 Nhóm thông báo theo ngày
    const groupedNotifications = {};
    notifications.forEach((notification) => {
      const dayKey = notification.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
      if (!groupedNotifications[dayKey]) {
        groupedNotifications[dayKey] = { notifications: [] };
      }
      groupedNotifications[dayKey].notifications.push(notification);
    });

    // 📌 Chuyển đổi dữ liệu về dạng [{ date: '', notifications: [] }, ...]
    const result = Object.entries(groupedNotifications).map(
      ([date, { notifications }]) => ({
        date,
        notifications,
      })
    );

    // 📌 Trả về tổng số thông báo chưa đọc + danh sách thông báo
    res.json({ unreadCount: totalUnreadCount, notifications: result });
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications", error });
  }
};
export const getNotificationFollow = async (req, res) => {
  try {
    const { start, limit } = req.query;
    const startIndex = parseInt(start) || 0; // Mặc định bắt đầu từ 0
    const limitCount = parseInt(limit) || 20; // Mặc định lấy 20 thông báo

    // 📌 Truy vấn danh sách thông báo chỉ với type: "NEW_FOLLOWER"
    const notifications = await Notification.find({
      recipient: req.user._id,
      type: "NEW_FOLLOWER",
    })
      .sort({ createdAt: -1 }) // Sắp xếp theo thời gian mới nhất
      .skip(startIndex) // Bỏ qua số lượng đã lấy trước đó
      .limit(limitCount) // Giới hạn số lượng lấy về
      .populate("sender", "_id avatar lastName firstName"); // Lấy thông tin người gửi

    if (!notifications.length) {
      return res.status(200).json({ unreadCount: 0, notifications: [] });
    }

    // 📌 Đếm tổng số thông báo chưa đọc dạng "NEW_FOLLOWER"
    const totalUnreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      type: "NEW_FOLLOWER",
      isRead: false,
    });

    // 📌 Nhóm thông báo theo ngày
    const groupedNotifications = {};
    notifications.forEach((notification) => {
      const dayKey = notification.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
      if (!groupedNotifications[dayKey]) {
        groupedNotifications[dayKey] = { notifications: [] };
      }
      groupedNotifications[dayKey].notifications.push(notification);
    });

    // 📌 Chuyển đổi dữ liệu về dạng [{ date: '', notifications: [] }, ...]
    const result = Object.entries(groupedNotifications).map(
      ([date, { notifications }]) => ({
        date,
        notifications,
      })
    );

    // 📌 Trả về dữ liệu gồm tổng số thông báo chưa đọc + danh sách thông báo
    res.json({ unreadCount: totalUnreadCount, notifications: result });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy thông báo NEW_FOLLOWER", error });
  }
};

// Đánh dấu thông báo đã đọc
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(notification);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error marking notification as read", error });
  }
};

export const getNotificationsByType = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const query = {
      recipient: userId,
      isActive: true,
    };

    // Thêm điều kiện type nếu được chỉ định
    if (type && type !== "all") {
      query.type = type.toUpperCase();
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("sender", "firstName lastName avatar")
      .populate({
        path: "reference",
        populate: {
          path: "sender receiver", // Cho FriendRequest
          select: "firstName lastName avatar",
        },
      });

    // Lọc và format thông báo theo loại
    const formattedNotifications = notifications.map((notification) => {
      const baseNotification = {
        _id: notification._id,
        sender: notification.sender,
        type: notification.type,
        content: notification.content,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      };

      switch (notification.type) {
        case "FRIEND_REQUEST":
          return {
            ...baseNotification,
            friendRequest: notification.reference,
          };
        case "MESSAGE":
          return {
            ...baseNotification,
            message: {
              content: notification.reference?.content,
              messageType: notification.reference?.messageType,
            },
          };
        case "POST":
          return {
            ...baseNotification,
            post: {
              _id: notification.reference?._id,
              content: notification.reference?.content?.substring(0, 100),
            },
          };
        case "COMMENT":
          return {
            ...baseNotification,
            comment: {
              _id: notification.reference?._id,
              content: notification.reference?.content?.substring(0, 100),
            },
          };
        case "LIKE":
          return {
            ...baseNotification,
            like: {
              _id: notification.reference?._id,
              content: notification.reference?.content?.substring(0, 100),
            },
          };
        case "NEW_FOLLOWER":
          return {
            ...baseNotification,
            newFollower: {
              _id: notification.reference?._id,
              content: notification.reference?.content?.substring(0, 100),
            },
          };
        default:
          return baseNotification;
      }
    });

    res.json({
      notifications: formattedNotifications,
      page,
      limit,
      total: await Notification.countDocuments(query),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
