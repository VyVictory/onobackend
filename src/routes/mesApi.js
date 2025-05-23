import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {getMessage, getMessages, deleteMessage, sendMessage, recallMessage,getMessageHistory, getMessagesByDay, getMessagesByRange, editMessage,toggleMessageReaction,getMessageReactions, shareMessage } from '../controllers/mesCTL.js';
import multer from 'multer';
import path from 'path';

const routerMessage = express.Router();

// Cấu hình multer để lưu file tạm thời
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, 'uploads/') // Đảm bảo thư mục uploads/ tồn tại
//     },
//     filename: function (req, file, cb) {
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
//         cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
//     }
// });

// const fileFilter = (req, file, cb) => {
//     // Kiểm tra loại file
//     const allowedMimeTypes = {
//         'image': ['image/jpeg', 'image/png', 'image/gif'],
//         'video': ['video/mp4', 'video/quicktime'],
//         'voice': ['audio/mpeg', 'audio/wav', 'audio/ogg'],
//         'gif': ['image/gif']
//     };

//     const messageType = req.body.messageType;
//     if (allowedMimeTypes[messageType] && allowedMimeTypes[messageType].includes(file.mimetype)) {
//         cb(null, true);
//     } else {
//         cb(new Error('Invalid file type'), false);
//     }
// };

const upload = multer({
    storage: multer.diskStorage({
        destination: 'uploads/',
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || 
            file.mimetype.startsWith('video/') || 
            file.mimetype.startsWith('audio/')||
            file.mimetype.startsWith('gif/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 10 // Tối đa 10 file
    }
});

// Middleware xử lý lỗi multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            message: 'File upload error',
            error: err.message
        });
    }
    next(err);
};

routerMessage.post('/send/:receiverId', authMiddleware, upload.array('media', 10), sendMessage);
routerMessage.post('/share/:receiverId',authMiddleware,shareMessage)
routerMessage.post('/:messageId/recall', authMiddleware, recallMessage);
routerMessage.get('/:messageId', authMiddleware, getMessage);
routerMessage.get('/inbox/:userId', authMiddleware, getMessagesByDay);
routerMessage.get('/inbox/rage/:userId', authMiddleware, getMessagesByRange);
routerMessage.get('/all', authMiddleware, getMessages);
routerMessage.delete('/:messageId', authMiddleware, deleteMessage);
routerMessage.get('/history/:userId', authMiddleware, getMessageHistory);
routerMessage.get('/reactions/:messageId', authMiddleware, getMessageReactions);
routerMessage.post('/reactions/:messageId', authMiddleware, toggleMessageReaction);
routerMessage.put('/:messageId', authMiddleware, upload.array('media', 10), editMessage);

export default routerMessage;