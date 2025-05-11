import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { createComment, getComment, getComments, deleteComment, updateComment, getPostComments, getCommentReplies, getCommentPost } from '../controllers/cmtCTL.js';
import multer from 'multer';
import cloudinary from '../config/cloudinaryConfig.js';
import { CloudinaryStorage } from 'multer-storage-cloudinary';


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
routerCmt.get('/byPost/:postId', authMiddleware, getCommentPost);
routerCmt.get('/all', authMiddleware, getComments);
routerCmt.delete('/:commentId', authMiddleware, deleteComment);
routerCmt.get('/:postId/comments', authMiddleware, getPostComments);
routerCmt.get('/:commentId/replies', authMiddleware, getCommentReplies);
routerCmt.put('/:commentId', upload.array('media', 10), authMiddleware, updateComment);

export default routerCmt;