import express from 'express';
import { login, register, forgotPassword, verifyResetToken, resetPassword } from '../controllers/authCTL.js';
import passport from '../config/passport.js';
import jwt from 'jsonwebtoken';
const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        session: false 
    })
);

router.get('/google/callback',
    passport.authenticate('google', { 
        session: false,
        failureRedirect: '/login'
    }),
    (req, res) => {
        try {
            const { token } = req.user;
            console.log(req.user);
            // Chuyển hướng về frontend với token
            res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${token}`);
        } catch (error) {
            console.error('Google callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
        }
    }
);

// Routes cho quên mật khẩu
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', verifyResetToken);
router.post('/reset-password/:token', resetPassword);

export default router;
