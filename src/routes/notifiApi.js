import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { toggleNotification, getNotificationsByType, markAsRead ,getNotificationsByRange, getNotificationFollow} from '../controllers/notifiCLT.js';

const routerNotifi = express.Router();

routerNotifi.post('/toggle-notification', authMiddleware, toggleNotification);getNotificationFollow
routerNotifi.get('/notifications', authMiddleware, getNotificationsByRange);
routerNotifi.get('/notifications/follow', authMiddleware, getNotificationFollow);
routerNotifi.put('/notifications/:notificationId/read', authMiddleware, markAsRead);
routerNotifi.get('/notifications/:type', authMiddleware, getNotificationsByType);
export default routerNotifi;