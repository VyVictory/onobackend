import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Comment from '../models/comment.js';
import Post from '../models/post.js';



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

// Đăng bình luận
export const createComment = async (req, res) => {
    const { content } = req.body;
    const { postId } = req.params;
    const media = req.files; // Lấy các tệp đã tải lên

    try {
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const newComment = new Comment({
            author: req.user._id,
            post: postId,
            content: content.trim(),
            media: media.map(file => file.path) // Lưu đường dẫn media từ Cloudinary
        });

        await newComment.save();
        post.comments.push(newComment._id);
        await post.save();

        res.status(201).json(newComment);
    } catch (error) {
        res.status(500).json({ message: 'Error creating comment', error });
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
