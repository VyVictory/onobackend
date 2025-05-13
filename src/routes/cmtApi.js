import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { createComment, getComment, getComments, deleteComment, updateComment, getCommentReplies, getCommentPost,toggleCommentBan, hiddenComment } from '../controllers/cmtCTL.js';
import multer from 'multer';
import cloudinary from '../config/cloudinaryConfig.js';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { isAdmin } from '../middleware/authMiddleware.js';


const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'comments', // Thư mục trên Cloudinary
        allowed_formats: ['jpg', 'png', 'gif', 'mp4'], // Các định dạng cho phép
    },
});

const upload = multer({ storage: storage });
const routerCmt = express.Router();

routerCmt.post('/:postId/comment',upload.array('media', 10),authMiddleware, createComment);
routerCmt.get('/:commentId', authMiddleware, getComment);
routerCmt.get('/byPost/:postId', getCommentPost);
routerCmt.get('/admin/all', authMiddleware, getComments);
routerCmt.delete('/:commentId', authMiddleware, deleteComment);
routerCmt.put('/hidden/:commentId', authMiddleware, hiddenComment);

routerCmt.get('/:commentId/replies', authMiddleware, getCommentReplies);
routerCmt.put('/:commentId', upload.array('media', 10), authMiddleware, updateComment);
routerCmt.get('/admin/comments', authMiddleware,isAdmin, getComments);
routerCmt.put('/admin/comments/:commentId/ban', authMiddleware,isAdmin, toggleCommentBan);
routerCmt.delete('/admin/comments/:commentId', authMiddleware,  isAdmin, deleteComment);

export default routerCmt;