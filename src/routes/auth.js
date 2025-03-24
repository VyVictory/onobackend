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
const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// router.get(
//   "/google",
//   passport.authenticate("google", {
//     scope: ["profile", "email"],
//     session: false,
//   })
// );

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  })
);

// Routes cho quên mật khẩu
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", verifyResetToken);
router.post("/reset-password/:token", resetPassword);

export default router;
