import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import User from '../models/user.js';
import Notification from '../models/notification.js';

const router = express.Router();

// Tắt thông báo tin nhắn
export const toggleNotification = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.notificationsEnabled = !user.notificationsEnabled;
        await user.save();

        res.json({ message: 'Notification setting updated', notificationsEnabled: user.notificationsEnabled });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification setting', error });
    }
};

// Lấy danh sách thông báo
export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user._id })
            .sort({ createdAt: -1 })
            .populate('sender', 'firstName lastName avatar')
            .populate('reference')
            .limit(20);

        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error });
    }
};
export const getNotificationsByRange = async (req, res) => {
    try {
        const { start, limit } = req.query;
        const startIndex = parseInt(start) || 0; // Mặc định từ 0
        const limitCount = parseInt(limit) || 20; // Mặc định lấy 20 thông báo
        const notifications = await Notification.find({ recipient: req.user._id })
            .sort({ createdAt: -1 })
            .skip(startIndex) // Bỏ qua số thông báo đã xem
            .limit(limitCount) // Giới hạn số lượng thông báo cần lấy
            .populate('sender', 'firstName lastName avatar')
            .populate('reference');

        if (!notifications.length) {
            return res.status(200).json({ message: "No notifications found" });
        }
        // Nhóm thông báo theo ngày
        const groupedNotifications = {};
        notifications.forEach((notification) => {
            const dayKey = notification.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
            if (!groupedNotifications[dayKey]) {
                groupedNotifications[dayKey] = [];
            }
            groupedNotifications[dayKey].push(notification);
        });
        // Chuyển đổi dữ liệu về dạng [{ date: '', notifications: [] }, ...]
        const result = Object.entries(groupedNotifications).map(([date, notifications]) => ({
            date,
            notifications,
        }));
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error });
    }
};


// Đánh dấu thông báo đã đọc
export const markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, recipient: req.user._id },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json(notification);
    } catch (error) {
        res.status(500).json({ message: 'Error marking notification as read', error });
    }
};

