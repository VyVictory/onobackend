import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { followUser, unfollowUser, getFollowers, getFollowing } from '../controllers/followCTL.js';

const routerFollow = express.Router();

routerFollow.post('/:userId', authMiddleware, followUser);
routerFollow.delete('/:userId', authMiddleware, unfollowUser);
routerFollow.get('/:userId/followers', authMiddleware, getFollowers);
routerFollow.get('/:userId/following', authMiddleware, getFollowing);

export default routerFollow; 