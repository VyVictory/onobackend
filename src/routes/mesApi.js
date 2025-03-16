import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {getMessage, getMessages, deleteMessage, sendMessage, recallMessage,getMessageHistory } from '../controllers/mesCTL.js';

const routerMessage = express.Router();

routerMessage.post('/send/:receiverId', authMiddleware, sendMessage);
routerMessage.post('/:messageId/recall', authMiddleware, recallMessage);
routerMessage.get('/:messageId', authMiddleware, getMessage);
routerMessage.get('/all', authMiddleware, getMessages);
routerMessage.delete('/:messageId', authMiddleware, deleteMessage);
routerMessage.get('/history/:userId', authMiddleware, getMessageHistory);


export default routerMessage;