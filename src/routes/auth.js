import express from "express";
import {
  login,
  register,
  forgotPassword,
  verifyResetToken,
  resetPassword,
} from "../controllers/authCTL.js";
import passport from "../config/passport.js";
import jwt from "jsonwebtoken";
const authRoutes = express.Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);

// router.get(
//   "/google",
//   passport.authenticate("google", {
//     scope: ["profile", "email"],
//     session: false,
//   })
// );

authRoutes.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    if (!req.user || !req.user.token) {
      return res.status(401).json({ message: "Authentication failed" });
    }
    console.log("token: " + req.user.token);
    res.redirect(`https://ono-ono.vercel.app/login?token=${req.user.token}`);
  }
);

// Routes cho quên mật khẩu
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.get("/reset-password/:token", verifyResetToken);
authRoutes.post("/reset-password/:token", resetPassword);

export default authRoutes;
