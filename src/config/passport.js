import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/user.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ email: profile.emails[0].value });
                
                if (!user) {
                    // Tạo user mới nếu chưa tồn tại
                    user = new User({
                        firstName: profile.name.givenName,
                        lastName: profile.name.familyName,
                        email: profile.emails[0].value,
                        avatar: profile.photos[0]?.value,
                        googleId: profile.id,
                        status: true
                    });
                    await user.save();
                }

                // Tạo JWT token
                const token = jwt.sign(
                    { 
                        _id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );

                // Trả về user và token
                return done(null, { user, token });
            } catch (error) {
                return done(error);
            }
        }
    )
);

// Thêm route xử lý callback từ Google
export const handleGoogleCallback = (req, res) => {
    const { token } = req.user;
    // Chuyển hướng về frontend với token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
};