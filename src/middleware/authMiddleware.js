import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET || 'emiton'; // Sử dụng biến môi trường

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), SECRET_KEY);
        req.user = decoded; // Lưu thông tin user vào request
        next(); // Cho phép tiếp tục
        // Nếu user chỉ cần xác thực mà không cần chuyển sang middleware khác, trả về luôn user
        //return res.status(200).json({ message: 'Authenticated', user: decoded });

        // Nếu cần tiếp tục xử lý middleware khác, thay `return` bằng `next();`
        // next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

export default authMiddleware;
