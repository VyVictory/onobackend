import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { toggleNotification, getNotifications, markAsRead } from '../controllers/notifiCLT.js';

const routerNotifi = express.Router();

routerNotifi.post('/toggle-notification', authMiddleware, toggleNotification);
routerNotifi.get('/notifications', authMiddleware, getNotifications);
routerNotifi.put('/notifications/:notificationId/read', authMiddleware, markAsRead);

export default routerNotifi;