import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
console.log(
    "🔹 GOOGLE_CLIENT_ID:",
    process.env.GOOGLE_CLIENT_ID || "Not Found"
  );
  console.log(
    "🔹 GOOGLE_CLIENT_SECRET:",
    process.env.GOOGLE_CLIENT_SECRET || "Not Found"
  );
  console.log("🔹 CALLBACK_URL:", process.env.CALLBACK_URL || "Not Found");

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
      proxy: true,
      passReqToCallback: true,
    },

    async (request, accessToken, refreshToken, profile, done) => {
      console.log(profile);
      try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          // Tạo user mới với thông tin từ Google
          const names = profile.displayName.split(" ");
          const firstName = names[0];
          const lastName = names.slice(1).join(" ");

          user = new User({
            firstName: firstName || profile.name.givenName,
            lastName: lastName || profile.name.familyName,
            email: profile.emails[0].value,
            avatar: profile.photos[0]?.value,
            googleId: profile.id,
            status: true,
            // Đặt giá trị mặc định cho các trường bắt buộc
            gender: "Other",
            birthDate: new Date("2000-01-01"), // Ngày mặc định
          });
          await user.save();
        } else {
          // Cập nhật thông tin Google nếu user đã tồn tại
          user.googleId = profile.id;
          user.avatar = profile.photos[0]?.value || user.avatar;
          user.status = true;
          await user.save();
        }

        // Tạo JWT token
        const token = jwt.sign(
          {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          process.env.JWT_SECRET,
          { expiresIn: "24h" }
        );

        // Trả về user và token
        return done(null, { user, token }, profile);
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

// Đảm bảo export passport để sử dụng ở nơi khác
export default passport;
