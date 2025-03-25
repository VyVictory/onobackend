import Notification from '../models/notification.js';
import { getIO } from '../config/socketConfig.js';

export const createNotification = async ({
    recipient,
    sender,
    type,
    reference,
    referenceModel,
    content
}) => {
    try {
        // Kiểm tra và xóa thông báo cũ cùng loại (nếu có)
        await Notification.deleteMany({
            recipient,
            type,
            reference,
            isRead: false
        });

        // Tạo thông báo mới
        const notification = new Notification({
            recipient,
            sender,
            type,
            reference,
            referenceModel,
            content
        });
        await notification.save();

        // Populate thông tin sender
        await notification.populate('sender', 'firstName lastName avatar');

        // Gửi thông báo realtime
        getIO().to(`user_${recipient}`).emit('newNotification', notification);

        return notification;
    } catch (error) {
        console.error('Create notification error:', error);
        throw error;
    }
};

export const deactivateNotifications = async (reference) => {
    try {
        const notifications = await Notification.find({ 
            reference,
            isRead: false
        });

        if (notifications.length > 0) {
            await Notification.updateMany(
                { reference },
                { $set: { isActive: false } }
            );

            // Thông báo cho tất cả người nhận về việc hủy thông báo
            notifications.forEach(notification => {
                getIO().to(`user_${notification.recipient}`)
                    .emit('notificationDeactivated', { notificationId: notification._id });
            });
        }
    } catch (error) {
        console.error('Deactivate notifications error:', error);
        throw error;
    }
}; 