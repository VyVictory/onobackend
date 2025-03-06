import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { createMessage, getMessage, getMessages, deleteMessage, sendMessage, recallMessage } from '../controllers/mesCTL.js';

const routerMessage = express.Router();

routerMessage.post('/create', authMiddleware, createMessage);
routerMessage.post('/:messageId/send', authMiddleware, sendMessage);
routerMessage.post('/:messageId/recall', authMiddleware, recallMessage);
routerMessage.get('/:messageId', authMiddleware, getMessage);
routerMessage.get('/all', authMiddleware, getMessages);
routerMessage.delete('/:messageId', authMiddleware, deleteMessage);

export default routerMessage;