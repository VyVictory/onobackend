import express from "express";
import {
  login,
  register,
  forgotPassword,
  verifyResetToken,
  resetPassword,
} from "../controllers/authCTL.js";
import passport from "../config/passport.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// Đăng nhập với Google
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    if (!req.user || !req.user.token) {
      return res.redirect("https://ono-ono.vercel.app/login?error=OAuthFailed");
    }
    const token = req.user.token;
    res.redirect(`https://ono-ono.vercel.app/login?token=${token}`);
  }
);

// Routes cho quên mật khẩu
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", verifyResetToken);
router.post("/reset-password/:token", resetPassword);

export default router;
