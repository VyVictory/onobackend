import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { createGroup, getGroup, getGroups, deleteGroup, sendMessage, recallGroupMessage, toggleNotificationGroup, banGroupMember,createGroupPost,addGroupMember,removeGroupMember,updateGroupPost,deleteGroupPost,getGroupPosts,getGroupMembers } from '../controllers/groupCTL.js';

const routerGroup = express.Router();

routerGroup.post('/create', authMiddleware, createGroup);
routerGroup.post('/:groupId/send-message', authMiddleware, sendMessage);
routerGroup.post('/:groupId/recall-message/:messageId', authMiddleware, recallGroupMessage);
routerGroup.post('/:groupId/toggle-notification', authMiddleware, toggleNotificationGroup);
routerGroup.get('/:groupId', authMiddleware, getGroup);
routerGroup.get('/all', authMiddleware, getGroups);
routerGroup.delete('/:groupId', authMiddleware, deleteGroup);
routerGroup.post('/:groupId/members/:memberId/ban', authMiddleware, banGroupMember);
routerGroup.post('/:groupId/post', authMiddleware, createGroupPost);
routerGroup.post('/:groupId/members/:memberId/add', authMiddleware, addGroupMember);
routerGroup.post('/:groupId/members/:memberId/remove', authMiddleware, removeGroupMember);
routerGroup.put('/:groupId/post/:postId/update', authMiddleware, updateGroupPost);
routerGroup.delete('/:groupId/post/:postId/delete', authMiddleware, deleteGroupPost);
routerGroup.get('/:groupId/post', authMiddleware, getGroupPosts);
routerGroup.get('/:groupId/members', authMiddleware, getGroupMembers);


export default routerGroup;