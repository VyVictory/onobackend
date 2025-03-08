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

