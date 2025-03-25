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
      .populate("referenceId");

    // Lọc bỏ các thông báo có reference không tồn tại
    const filteredNotifications = notifications.filter(
      (notification) => notification.referenceId != null
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
      read: false,
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
