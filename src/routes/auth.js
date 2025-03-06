import express from 'express';
import { login, register } from '../controllers/authCTL';
import passport from 'passport';
import jwt from 'jsonwebtoken';
const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', { session: false }),
    (req, res) => {
        const token = jwt.sign(
            {
                _id: req.user._id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${token}`);
    }
);

export default router;
