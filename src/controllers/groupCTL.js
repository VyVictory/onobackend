import express from 'express';
import Group from '../models/group.js';
import Message from '../models/message.js';
import Post from '../models/post.js';
import Comment from '../models/comment.js';
import { getIO } from '../config/socketConfig.js';

const router = express.Router();

// Tạo nhóm nhắn tin
export const createGroup = async (req, res) => {
    try {
        const { name, description, privacy } = req.body;
        const creator = req.user._id;

        const group = new Group({
            name,
            description,
            privacy,
            creator,
            members: [{
                user: creator,
                role: 'admin',
                status: 'active'
            }]
        });

        await group.save();
        res.status(201).json(group);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Gửi tin nhắn nhóm
export const sendMessage = async (req, res) => {
    const { content } = req.body;

    try {
        const group = await Group.findById(req.params.groupId);
        if (!group || !group.members.includes(req.user.id)) {
            return res.status(404).json({ message: 'Group not found or unauthorized' });
        }

        const newMessage = new Message({
            sender: req.user.id,
            content
        });

        await newMessage.save();
        group.messages.push(newMessage._id);
        await group.save();

        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ message: 'Error sending group message', error });
    }
};
// Thu hồi tin nhắn nhóm
export const recallGroupMessage = async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);
        const message = await Message.findById(req.params.messageId);

        if (!group || !message || message.sender.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Group or message not found or unauthorized' });
        }

        message.isRecalled = true;
        await message.save();

        res.json({ message: 'Group message recalled' });
    } catch (error) {
        res.status(500).json({ message: 'Error recalling group message', error });
    }
};

// Tắt thông báo nhóm
export const toggleNotificationGroup = async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group || !group.members.includes(req.user.id)) {
            return res.status(404).json({ message: 'Group not found or unauthorized' });
        }
        res.json({ message: 'Group notification setting updated' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating group notification setting', error });
    }
};
// Lấy nhóm
export const getGroup = async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        res.json(group);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching group', error });
    }
};

// Lấy tất cả nhóm
export const getGroups = async (req, res) => {
    try {
        const groups = await Group.find();
        res.json(groups);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching groups', error });
    }
};
//Xóa nhóm
export const deleteGroup = async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        await group.delete();
        res.json({ message: 'Group deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting group', error });
    }
};

export const createGroupPost = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm' });
        }

        const member = group.members.find(m => m.user.toString() === userId.toString());
        if (!member || member.status === 'banned') {
            return res.status(403).json({ message: 'Không có quyền đăng bài trong nhóm này' });
        }

        const post = new Post({
            ...req.body,
            author: userId,
            group: groupId
        });
        await post.save();

        group.posts.push(post._id);
        await group.save();

        res.status(201).json(post);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const banGroupMember = async (req, res) => {
    try {
        const { groupId, memberId } = req.params;
        const { duration } = req.body; // Duration in days
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm' });
        }

        // Kiểm tra quyền admin
        if (group.creator.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Không có quyền cấm thành viên' });
        }

        const memberIndex = group.members.findIndex(m => m.user.toString() === memberId);
        if (memberIndex === -1) {
            return res.status(404).json({ message: 'Không tìm thấy thành viên' });
        }

        group.members[memberIndex].status = 'banned';
        group.members[memberIndex].banUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
        await group.save();

        res.json({ message: 'Đã cấm thành viên' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Thêm thành viên vào nhóm
export const addGroupMember = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId, role = 'member' } = req.body;
        const adminId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm' });
        }

        // Kiểm tra quyền admin
        const admin = group.members.find(m => 
            m.user.toString() === adminId.toString() && 
            ['admin', 'moderator'].includes(m.role)
        );
        if (!admin) {
            return res.status(403).json({ message: 'Không có quyền thêm thành viên' });
        }

        // Kiểm tra thành viên đã tồn tại
        if (group.members.some(m => m.user.toString() === userId)) {
            return res.status(400).json({ message: 'Thành viên đã tồn tại trong nhóm' });
        }

        group.members.push({
            user: userId,
            role,
            status: 'active'
        });

        await group.save();
        res.json(group);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Xóa thành viên khỏi nhóm
export const removeGroupMember = async (req, res) => {
    try {
        const { groupId, memberId } = req.params;
        const adminId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm' });
        }

        // Kiểm tra quyền admin
        const admin = group.members.find(m => 
            m.user.toString() === adminId.toString() && 
            ['admin', 'moderator'].includes(m.role)
        );
        if (!admin) {
            return res.status(403).json({ message: 'Không có quyền xóa thành viên' });
        }

        // Không thể xóa creator
        if (group.creator.toString() === memberId) {
            return res.status(403).json({ message: 'Không thể xóa người tạo nhóm' });
        }

        group.members = group.members.filter(m => 
            m.user.toString() !== memberId
        );

        await group.save();
        res.json({ message: 'Đã xóa thành viên khỏi nhóm' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Sửa bài đăng trong nhóm
export const updateGroupPost = async (req, res) => {
    try {
        const { groupId, postId } = req.params;
        const userId = req.user._id;
        const { content } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm' });
        }

        const post = await Post.findOne({
            _id: postId,
            group: groupId
        });

        if (!post) {
            return res.status(404).json({ message: 'Không tìm thấy bài đăng' });
        }

        // Kiểm tra quyền sửa bài
        const member = group.members.find(m => m.user.toString() === userId.toString());
        const isAdmin = member && ['admin', 'moderator'].includes(member.role);
        const isAuthor = post.author.toString() === userId.toString();

        if (!isAdmin && !isAuthor) {
            return res.status(403).json({ message: 'Không có quyền sửa bài đăng này' });
        }

        post.content = content;
        await post.save();

        res.json(post);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Xóa bài đăng trong nhóm
export const deleteGroupPost = async (req, res) => {
    try {
        const { groupId, postId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm' });
        }

        const post = await Post.findOne({
            _id: postId,
            group: groupId
        });

        if (!post) {
            return res.status(404).json({ message: 'Không tìm thấy bài đăng' });
        }

        // Kiểm tra quyền xóa bài
        const member = group.members.find(m => m.user.toString() === userId.toString());
        const isAdmin = member && ['admin', 'moderator'].includes(member.role);
        const isAuthor = post.author.toString() === userId.toString();

        if (!isAdmin && !isAuthor) {
            return res.status(403).json({ message: 'Không có quyền xóa bài đăng này' });
        }

        await post.remove();
        group.posts = group.posts.filter(p => p.toString() !== postId);
        await group.save();

        res.json({ message: 'Đã xóa bài đăng' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Lấy danh sách bài đăng trong nhóm
export const getGroupPosts = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm' });
        }

        // Kiểm tra quyền xem bài đăng
        const isMember = group.members.some(m => 
            m.user.toString() === userId.toString() && 
            m.status === 'active'
        );

        if (!isMember && group.privacy === 'private') {
            return res.status(403).json({ message: 'Không có quyền xem bài đăng trong nhóm này' });
        }

        const posts = await Post.find({ group: groupId })
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('author', 'firstName lastName avatar')
            .populate('comments');

        const total = await Post.countDocuments({ group: groupId });

        res.json({
            posts,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Lấy danh sách thành viên nhóm
export const getGroupMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { status, role } = req.query;

        const group = await Group.findById(groupId)
            .populate('members.user', 'firstName lastName avatar');

        if (!group) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm' });
        }

        let members = group.members;

        if (status) {
            members = members.filter(m => m.status === status);
        }

        if (role) {
            members = members.filter(m => m.role === role);
        }

        res.json(members);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Bình luận bài đăng trong nhóm
export const commentGroupPost = async (req, res) => {
    try {
        const { groupId, postId } = req.params;
        const { content } = req.body;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm' });
        }

        // Kiểm tra quyền bình luận
        const member = group.members.find(m => 
            m.user.toString() === userId.toString()
        );

        if (!member || member.status !== 'active') {
            return res.status(403).json({ message: 'Không có quyền bình luận trong nhóm này' });
        }

        const post = await Post.findOne({ _id: postId, group: groupId });
        if (!post) {
            return res.status(404).json({ message: 'Không tìm thấy bài đăng' });
        }

        const comment = new Comment({
            author: userId,
            post: postId,
            content,
            group: groupId
        });

        await comment.save();
        post.comments.push(comment._id);
        await post.save();

        const populatedComment = await Comment.findById(comment._id)
            .populate('author', 'firstName lastName avatar');

        // Thông báo realtime
        getIO().to(`group_${groupId}`).emit('newGroupComment', {
            postId,
            comment: populatedComment
        });

        res.status(201).json(populatedComment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


