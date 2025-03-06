import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import User from '../models/user.js';

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

