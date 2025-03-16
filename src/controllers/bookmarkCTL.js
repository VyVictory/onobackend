import Bookmark from '../models/bookmark';

// Lưu bài viết
export const savePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user._id;

        const bookMark = new Bookmark({
            user: userId,
            post: postId
        });

        await bookMark.save();

        res.status(201).json({ message: 'Đã lưu bài viết' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Bài viết đã được lưu trước đó' });
        }
        res.status(500).json({ message: 'Lỗi khi lưu bài viết', error: error.message });
    }
};

// Lấy danh sách bài viết đã lưu
export const getSavedPosts = async (req, res) => {
    try {
        const bookMarks = await Bookmark.find({ user: req.user._id })
            .populate({
                path: 'post',
                populate: {
                    path: 'author',
                    select: 'firstName lastName avatar'
                }
            })
            .sort({ savedAt: -1 });

        res.json(bookMarks);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy danh sách bài viết đã lưu', error: error.message });
    }
};

// Xóa bài viết đã lưu
export const unsavePost = async (req, res) => {
    try {
        const { postId } = req.params;
        await Bookmark.deleteOne({
            user: req.user._id,
            post: postId
        });

        res.json({ message: 'Đã xóa bài viết khỏi danh sách đã lưu' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi xóa bài viết đã lưu', error: error.message });
    }
};