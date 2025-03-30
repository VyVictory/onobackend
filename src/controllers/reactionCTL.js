import Reaction from '../models/reaction.js';
import Post from '../models/post.js';
import Comment from '../models/comment.js';
import Message from '../models/message.js';
import User from '../models/user.js';
import Group from '../models/group.js';
import { getIO } from '../config/socketConfig.js';

// Helper function để kiểm tra quyền xem bài đăng
const canViewPost = async (post, userId) => {
    if (!post) return false;
    
    // Nếu là người đăng bài
    if (post.author.toString() === userId.toString()) return true;
    
    // Nếu bài đăng công khai
    if (post.privacy === 'public') return true;
    
    // Nếu bài đăng private chỉ người đăng mới xem được
    if (post.privacy === 'private') return false;
    
    // Nếu bài đăng chỉ cho bạn bè xem
    if (post.privacy === 'friends') {
        const user = await User.findById(post.author);
        return user.friends.some(friendId => 
            friendId.toString() === userId.toString()
        );
    }

    // Nếu là bài đăng trong nhóm
    if (post.group) {
        const group = await Group.findById(post.group);
        return group.members.some(member => 
            member.user.toString() === userId.toString() && 
            member.status === 'active'
        );
    }

    return false;
};

// Helper function để kiểm tra quyền xem tin nhắn
const canViewMessage = async (message, userId) => {
    if (!message) return false;
    
    // Chỉ người gửi và người nhận mới có thể tương tác với tin nhắn
    return message.sender.toString() === userId.toString() || 
           message.receiver.toString() === userId.toString();
};

export const toggleReaction = async (req, res) => {
    try {
        const { targetId } = req.params;
        const { targetType, reactionType } = req.body;
        const userId = req.user._id;

        if (!['like', 'love', 'haha', 'wow', 'sad', 'angry'].includes(reactionType)) {
            return res.status(400).json({ 
                message: 'Loại reaction không hợp lệ' 
            });
        }

        // Kiểm tra quyền tương tác
        let target;
        let canInteract = false;

        switch (targetType) {
            case 'Post':
                target = await Post.findById(targetId);
                canInteract = await canViewPost(target, userId);
                break;
            case 'Comment':
                target = await Comment.findById(targetId);
                const parentPost = await Post.findById(target?.post);
                canInteract = await canViewPost(parentPost, userId);
                break;
            case 'Message':
                target = await Message.findById(targetId);
                canInteract = await canViewMessage(target, userId);
                break;
            default:
                return res.status(400).json({ 
                    message: 'Loại đối tượng tương tác không hợp lệ' 
                });
        }

        if (!target) {
            return res.status(404).json({ 
                message: 'Không tìm thấy đối tượng tương tác' 
            });
        }

        // if (!canInteract) {
        //     return res.status(403).json({ 
        //         message: 'Không có quyền tương tác với nội dung này' 
        //     });
        // }

        // Kiểm tra reaction hiện tại
        let existingReaction = await Reaction.findOne({
            user: userId,
            targetType,
            targetId
        });

        if (existingReaction) {
            if (existingReaction.type === reactionType) {
                // Hủy reaction
                await Reaction.deleteOne({ _id: existingReaction._id });
                await updateReactionCount(targetType, targetId, reactionType, -1);
                
                res.json({ 
                    message: 'Đã hủy tương tác',
                    action: 'removed'
                });
            } else {
                // Đổi loại reaction
                const oldType = existingReaction.type;
                await updateReactionCount(targetType, targetId, oldType, -1);
                
                existingReaction.type = reactionType;
                await existingReaction.save();
                
                await updateReactionCount(targetType, targetId, reactionType, 1);
                
                res.json({ 
                    message: 'Đã thay đổi tương tác',
                    action: 'changed',
                    from: oldType,
                    to: reactionType
                });
            }
        } else {
            // Tạo reaction mới
            existingReaction = new Reaction({
                user: userId,
                targetType,
                targetId,
                type: reactionType
            });
            await existingReaction.save();
            await updateReactionCount(targetType, targetId, reactionType, 1);
            
            res.json({ 
                message: 'Đã thêm tương tác',
                action: 'added',
                type: reactionType
            });
        }

        // Gửi thông báo realtime nếu cần
        if (targetType === 'Post' || targetType === 'Comment') {
            const authorId = target.author.toString();
            if (authorId !== userId) {
                getIO().to(`user_${authorId}`).emit('newReaction', {
                    targetType,
                    targetId,
                    reaction: existingReaction
                });
            }
        }

    } catch (error) {
        console.error('Toggle reaction error:', error);
        res.status(500).json({ 
            message: 'Lỗi khi cập nhật tương tác',
            error: error.message 
        });
    }
};

const updateReactionCount = async (targetType, targetId, reactionType, increment) => {
    const updateQuery = {
        $inc: { [`reactionCounts.${reactionType}`]: increment }
    };

    switch (targetType) {
        case 'Post':
            await Post.findByIdAndUpdate(targetId, updateQuery);
            break;
        case 'Comment':
            await Comment.findByIdAndUpdate(targetId, updateQuery);
            break;
    }
}; 
export const getReactions = async (req, res) => {
    try {
        const { targetType, targetId } = req.params;
        const { type } = req.query;

        const query = { targetType, targetId };
        if (type) {
            query.type = type;
        }

        const reactions = await Reaction.find(query)
            .populate('user', 'firstName lastName avatar')
            .sort('-createdAt');

        res.json(reactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};