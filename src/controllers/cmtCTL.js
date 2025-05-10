import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Comment from '../models/comment.js';
import Post from '../models/post.js';
import Notification from '../models/notification.js';
import { getIO } from '../config/socketConfig.js';
import Friendship from '../models/friendship.js';
import { createNotification } from '../services/notificationService.js';

// Lấy bình luận
export const getComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        res.json(comment);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching comment', error });
    }
};

// Lấy tất cả bình luận
export const getComments = async (req, res) => {
    try {
        const comments = await Comment.find();
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching comments', error });
    }
};

// Xóa bình luận
export const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        await comment.delete();
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting comment', error });
    }
};

const MAX_MENTIONS = 10;

// Thêm hàm xử lý mentions
const extractMentions = async (content, userId) => {
    try {
        const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
        const mentions = [];
        let match;

        while ((match = mentionRegex.exec(content)) !== null) {
            const [fullMatch, username, mentionedUserId] = match;
            
            // Kiểm tra xem người được mention có phải là bạn bè không
            const friendship = await Friendship.findOne({
                users: { $all: [userId, mentionedUserId] },
                status: 'accepted'
            });

            if (friendship) {
                mentions.push({
                    user: mentionedUserId,
                    startIndex: match.index,
                    endIndex: match.index + fullMatch.length
                });
            }
        }

        return mentions;
    } catch (error) {
        console.error('Error extracting mentions:', error);
        return [];
    }
};

// Đăng bình luận
export const createComment = async (req, res) => {
    const { content, parentCommentId } = req.body;
    const { postId } = req.params;
    const media = req.files;

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Không tìm thấy bài đăng' });
        }

        // Nếu là trả lời bình luận, kiểm tra bình luận gốc
        let parentComment = null;
        if (parentCommentId) {
            parentComment = await Comment.findById(parentCommentId);
            if (!parentComment) {
                return res.status(404).json({ message: 'Không tìm thấy bình luận gốc' });
            }
            // Kiểm tra xem bình luận gốc có thuộc bài đăng này không
            if (parentComment.post.toString() !== postId) {
                return res.status(400).json({ message: 'Bình luận gốc không thuộc bài đăng này' });
            }
        }

        // Xử lý media nếu có
        const media = req.files ? req.files.map(file => ({
            type: file.mimetype.startsWith('image/') ? 'image' : 'video',
            url: file.path
        })) : [];
        // Xử lý mentions với userId của người đang comment
        const mentions = await extractMentions(content, req.user._id);

        // Kiểm tra giới hạn mentions
        if (mentions.length > MAX_MENTIONS) {
            return res.status(400).json({ 
                message: `Bạn chỉ có thể gắn thẻ tối đa ${MAX_MENTIONS} người trong một bình luận`
            });
        }

        const newComment = new Comment({
            author: req.user._id,
            post: postId,
            content: content.trim(),
            media: media ? media.map(file => file.path) : [],
            mentions,
            parentCommentId: parentCommentId ? parentCommentId : null
        });

        await newComment.save();
        if (parentComment) {
            parentComment.replies.push(newComment._id);
            await parentComment.save();
        }

        // Populate thông tin tác giả
        await Comment.populate('author', 'firstName lastName avatar');
        // Thêm comment vào post
        post.comments.push(newComment._id);
        await post.save();

        // Tạo và gửi thông báo cho những người được mention
        const notifications = await Promise.all(mentions.map(async mention => {
            const notification = new Notification({
                recipient: mention.user,
                sender: req.user._id,
                type: 'COMMENT_MENTION',
                reference: newComment._id,
                referenceModel: 'Comment',
                content: `${req.user.firstName} ${req.user.lastName} đã nhắc đến bạn trong một bình luận`
            });
            await notification.save();

            // Gửi thông báo realtime
            getIO().to(`user_${mention.user}`).emit('notification', {
                type: 'COMMENT_MENTION',
                notification: await notification.populate('sender', 'firstName lastName avatar')
            });

            return notification;
        }));

        // Trả về comment đã được populate với thông tin author và mentions
        const populatedComment = await Comment.findById(newComment._id)
            .populate('author', 'firstName lastName avatar')
            .populate('mentions.user', 'firstName lastName avatar');

        res.status(201).json(populatedComment);
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const updateComment = async (req, res) => {
    const { content } = req.body;
    const media = req.files; // Lấy các tệp đã tải lên

    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        // Cập nhật nội dung nếu có
        if (content) {
            comment.content = content.trim();
        }

        // Cập nhật media nếu có tệp mới được tải lên
        if (media && media.length > 0) {
            comment.media = media.map(file => file.path);
        }

        await comment.save();
        res.json(comment);
    } catch (error) {
        res.status(500).json({ message: 'Error updating comment', error });
    }
};

// Lấy danh sách bình luận của bài đăng
export const getPostComments = async (req, res) => {
    try {
        const { postId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const comments = await Comment.find({
            post: postId,
            parentComment: null // Chỉ lấy bình luận gốc
        })
        .populate('author', 'firstName lastName avatar')
        .populate({
            path: 'replies',
            populate: {
                path: 'author',
                select: 'firstName lastName avatar'
            },
            options: { sort: { createdAt: 1 } }
        })
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

        const total = await Comment.countDocuments({
            post: postId,
            parentComment: null
        });

        res.json({
            comments,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Lấy danh sách trả lời của một bình luận
export const getCommentReplies = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const replies = await Comment.find({
            parentComment: commentId
        })
        .populate('author', 'firstName lastName avatar')
        .sort('createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

        const total = await Comment.countDocuments({
            parentComment: commentId
        });

        res.json({
            replies,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
