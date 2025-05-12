import PostReport from '../models/postReport.js';
import UserReport from '../models/userReport.js';
import CommentReport from '../models/commentReport.js';
import Post from '../models/post.js';
import User from '../models/user.js';
import Comment from '../models/comment.js';

// Báo cáo bài viết
export const reportPost = async (req, res) => {
    try {
        const { postId, content } = req.body;
        const author = req.user._id;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Bài viết không tồn tại' });
        }

        const report = new PostReport({
            post: postId,
            author,
            content
        });

        await report.save();
        res.status(201).json({ message: 'Báo cáo đã được gửi', report });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Báo cáo người dùng
export const reportUser = async (req, res) => {
    try {
        const { userId, content } = req.body;
        const author = req.user._id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tồn tại' });
        }

        const report = new UserReport({
            reportedUser: userId,
            author,
            content
        });

        await report.save();
        res.status(201).json({ message: 'Báo cáo đã được gửi', report });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Báo cáo bình luận
export const reportComment = async (req, res) => {
    try {
        const { commentId, content } = req.body;
        const author = req.user._id;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Bình luận không tồn tại' });
        }

        const report = new CommentReport({
            comment: commentId,
            author,
            content
        });

        await report.save();
        res.status(201).json({ message: 'Báo cáo đã được gửi', report });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin: Lấy danh sách báo cáo
export const getReports = async (req, res) => {
    try {
        const { type } = req.query; // 'post', 'user', 'comment'
        let reports;

        switch (type) {
            case 'post':
                reports = await PostReport.find()
                    .populate('post')
                    .populate('author', 'firstName lastName avatar');
                break;
            case 'user':
                reports = await UserReport.find()
                    .populate('reportedUser', 'firstName lastName avatar')
                    .populate('author', 'firstName lastName avatar');
                break;
            case 'comment':
                reports = await CommentReport.find()
                    .populate('comment')
                    .populate('author', 'firstName lastName avatar');
                break;
            default:
                return res.status(400).json({ message: 'Loại báo cáo không hợp lệ' });
        }

        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin: Cập nhật trạng thái báo cáo
export const updateReportStatus = async (req, res) => {
    try {
        const { reportId, type, status } = req.body;
        let report;

        switch (type) {
            case 'post':
                report = await PostReport.findById(reportId);
                break;
            case 'user':
                report = await UserReport.findById(reportId);
                break;
            case 'comment':
                report = await CommentReport.findById(reportId);
                break;
            default:
                return res.status(400).json({ message: 'Loại báo cáo không hợp lệ' });
        }

        if (!report) {
            return res.status(404).json({ message: 'Báo cáo không tồn tại' });
        }

        report.status = status;
        report.isRead = true;
        await report.save();

        res.status(200).json({ message: 'Cập nhật trạng thái thành công', report });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
