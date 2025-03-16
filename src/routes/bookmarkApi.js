import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { savePost, getSavedPosts, unsavePost } from '../controllers/bookmarkCTL.js';

const routerBookMark = express.Router();

routerBookMark.post('/:postId', authMiddleware, savePost);
routerBookMark.get('/', authMiddleware, getSavedPosts);
routerBookMark.delete('/:postId', authMiddleware, unsavePost);

export default routerBookMark;
