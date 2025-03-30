import e from 'express';
import User from '../models/user.js';

export const checkPostAccess = async (req, res, next) => {
    try {
        const userId = req.user._id;
        
        // Lấy danh sách bạn bè
        const user = await User.findById(userId);
        const friendIds = user.friends.map(friend => friend.toString());

        // Thêm điều kiện vào query
        req.postQuery = {
            currentUser: userId,
            friendIds: friendIds
        };

        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}; 
export default checkPostAccess;