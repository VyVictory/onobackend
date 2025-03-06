import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { toggleNotification } from '../controllers/notifiCLT.js';

const routerNotifi = express.Router();

routerNotifi.post('/toggle-notification', authMiddleware, toggleNotification);

export default routerNotifi;