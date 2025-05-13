import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import checkPostAccess from '../middleware/postAccessMiddleware.js';
import { createPost, getPost, getPosts, deletePost, sharePost, recallPost, updatePost, getPostsByRange, searchPosts,getPostByRange,togglePostBan, isNotification, getMyPost, getPostByUserByRange, getAllVisiblePosts } from '../controllers/postCLT.js';
import multer from 'multer';
import { toggleReaction, getReactions } from '../controllers/reactionCTL.js';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinaryConfig.js';
import path from 'path';
import authGetProfile from '../middleware/authGetProfile.js';
import { isAdmin } from '../middleware/authMiddleware.js';

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'posts', // Thư mục trên Cloudinary
        allowed_formats: ['jpg', 'png', 'gif', 'mp4'], // Các định dạng cho phép
    },
});

const upload = multer({
    storage: multer.diskStorage({
        destination: 'uploads/',
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
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

const routerPost = express.Router();

routerPost.post('/', authMiddleware, upload.array('media', 10), createPost);
routerPost.post('/:postId/send', authMiddleware, sharePost);
routerPost.post('/:postId/recall', authMiddleware, recallPost);
routerPost.get('/getpost/:postId', getPost);
routerPost.get('/all', authMiddleware, getPosts);
routerPost.get('/postByRange', authGetProfile, getPostsByRange);
routerPost.get('/myPostByRange', authGetProfile, getMyPost);
routerPost.get('/postByUser/:userId', authGetProfile, getPostByUserByRange);
routerPost.get('/getAllVisiblePost', authGetProfile, getAllVisiblePosts);


routerPost.delete('/:postId', authMiddleware, deletePost);
routerPost.put('/:postId', upload.array('media', 10), authMiddleware, updatePost);
routerPost.get('/range', authMiddleware, getPostsByRange);
routerPost.get('/search', authMiddleware, searchPosts);
routerPost.put('/:targetId/reaction', authMiddleware, toggleReaction);
routerPost.put('/isNotification/:postId', authMiddleware,isNotification);
routerPost.get('/:targetType/:targetId/reaction', authMiddleware, getReactions);
routerPost.get('/admin/posts', authMiddleware,isAdmin, getPosts);
routerPost.put('/admin/posts/:postId/ban', authMiddleware,isAdmin, togglePostBan);
routerPost.delete('/admin/posts/:postId', authMiddleware, isAdmin, deletePost);

export default routerPost;