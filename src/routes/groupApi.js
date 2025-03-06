import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { createGroup, getGroup, getGroups, deleteGroup, sendMessage, recallGroupMessage, toggleNotificationGroup } from '../controllers/groupCTL.js';

const routerGroup = express.Router();

routerGroup.post('/create', authMiddleware, createGroup);
routerGroup.post('/:groupId/send-message', authMiddleware, sendMessage);
routerGroup.post('/:groupId/recall-message/:messageId', authMiddleware, recallGroupMessage);
routerGroup.post('/:groupId/toggle-notification', authMiddleware, toggleNotificationGroup);
routerGroup.get('/:groupId', authMiddleware, getGroup);
routerGroup.get('/all', authMiddleware, getGroups);
routerGroup.delete('/:groupId', authMiddleware, deleteGroup);

export default routerGroup;