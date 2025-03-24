import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.js";
import jwt from "jsonwebtoken";
import Config from "../models/config.js"; // Import model cấu hình
import express from "express";

const router = express.Router();

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Lấy dữ liệu OAuth từ MongoDB
const getOAuthConfig = async () => {
  const config = await Config.findOne(); // Lấy config đầu tiên
  if (!config) throw new Error("OAuth configuration not found in MongoDB");
  return config;
};

(async () => {
  try {
    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      CALLBACK_URL,
      JWT_SECRET,
      CALLBACK_URL_FRONTEND,
    } = await getOAuthConfig();

    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: CALLBACK_URL,
          proxy: true,
          passReqToCallback: true,
          scope: ["profile", "email"],
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
            console.log("🔑 JWT_SECRET:", JWT_SECRET);
            // Tạo JWT token
            const token = jwt.sign(
              {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
              },
              JWT_SECRET,
              { expiresIn: "24h" }
            );

            request.res.redirect(
              `${CALLBACK_URL_FRONTEND}/login?token=${token}`
            );
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  } catch (error) {
    console.error("❌ Error loading OAuth configuration:", error);
  }
})();

export default passport;
