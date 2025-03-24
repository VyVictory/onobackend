import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.js";
import jwt from "jsonwebtoken";
import Config from "../models/config.js";

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Lấy dữ liệu OAuth từ MongoDB
const getOAuthConfig = async () => {
  const config = await Config.findOne();
  if (!config) throw new Error("OAuth configuration not found in MongoDB");
  return config;
};

// Cấu hình Passport Google Strategy
const setupGoogleAuth = async () => {
  try {
    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      CALLBACK_URL,
      JWT_SECRET,
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
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            let user = await User.findOne({ email: profile.emails[0].value });

            if (!user) {
              const names = profile.displayName.split(" ");
              user = new User({
                firstName: names[0] || profile.name.givenName,
                lastName: names.slice(1).join(" ") || profile.name.familyName,
                email: profile.emails[0].value,
                avatar: profile.photos[0]?.value,
                googleId: profile.id,
                status: true,
                gender: "Other",
                birthDate: new Date("2000-01-01"),
              });
              await user.save();
            } else {
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
              JWT_SECRET || "emiton", 
              { expiresIn: "24h" }
            );

            // Passport sử dụng `done()` để truyền user
            return done(null, { token, user });
          } catch (error) {
            console.error("❌ Google OAuth Error:", error.message);
            return done(error, false);
          }
        }
      )
    );

    passport.serializeUser((user, done) => {
      done(null, user);
    });

    passport.deserializeUser((user, done) => {
      done(null, user);
    });

  } catch (error) {
    console.error("❌ Error loading OAuth configuration:", error);
  }
};

// Chạy setup
setupGoogleAuth();

export default passport;
