import express from "express";
import passport from "../config/passport.js";
import {
  login,
  register,
  forgotPassword,
  verifyResetToken,
  resetPassword,
} from "../controllers/authCTL.js";

const authRoutes = express.Router();

// Đăng ký & Đăng nhập
authRoutes.post("/register", register);
authRoutes.post("/login", login);

// Google OAuth: Chạy xác thực
authRoutes.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth: Callback
authRoutes.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/auth/login-failed" }),
  (req, res) => {
    if (!req.user || !req.user.token) {
      console.error("❌ Authentication failed: No user or token found");
      return res.redirect("https://ono-ono.vercel.app/login?error=auth_failed");
    }

    console.log("✅ Authentication successful, redirecting...");
    res.redirect(`https://ono-ono.vercel.app/login?token=${req.user.token}`);
  }
);

// Route xử lý lỗi đăng nhập
authRoutes.get("/login-failed", (req, res) => {
  res.status(401).json({ message: "Google Authentication Failed" });
});

// Quên mật khẩu
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.get("/reset-password/:token", verifyResetToken);
authRoutes.post("/reset-password/:token", resetPassword);

export default authRoutes;
