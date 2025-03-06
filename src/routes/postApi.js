import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { createPost, getPost, getPosts, deletePost, sharePost, recallPost, likePost, updatePost } from '../controllers/postCLT.js';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinaryConfig.js';

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'posts', // Thư mục trên Cloudinary
        allowed_formats: ['jpg', 'png', 'gif', 'mp4'], // Các định dạng cho phép
    },
});

const upload = multer({ storage: storage });

const routerPost = express.Router();

routerPost.post('/create', upload.array('media', 10), authMiddleware, createPost);
routerPost.post('/:postId/send', authMiddleware, sharePost);
routerPost.post('/:postId/recall', authMiddleware, recallPost);
routerPost.get('/:postId', authMiddleware, getPost);
routerPost.get('/all', authMiddleware, getPosts);
routerPost.post('/:postId/like', authMiddleware, likePost);
routerPost.delete('/:postId', authMiddleware, deletePost);
routerPost.put('/:postId', upload.array('media', 10), authMiddleware, updatePost);

export default routerPost;