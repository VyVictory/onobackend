export const validateFriendRequest = (req, res, next) => {
    try {
        const { recipientId } = req.body;
        
        if (!recipientId) {
            return res.status(400).json({ 
                message: 'recipientId là bắt buộc' 
            });
        }

        if (recipientId === req.user._id.toString()) {
            return res.status(400).json({ 
                message: 'Không thể gửi lời mời kết bạn cho chính mình' 
            });
        }

        next();
    } catch (error) {
        res.status(400).json({ 
            message: 'Dữ liệu không hợp lệ',
            error: error.message 
        });
    }
};

export const validateFriendResponse = (req, res, next) => {
    try {
        const { status } = req.body;
        
        if (!status || !['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ 
                message: 'Trạng thái phản hồi không hợp lệ' 
            });
        }

        next();
    } catch (error) {
        res.status(400).json({ 
            message: 'Dữ liệu không hợp lệ',
            error: error.message 
        });
    }
}; 