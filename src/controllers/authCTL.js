import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js"; 
import mongoose from "mongoose";
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { createEmailTransporter } from '../config/emailConfig.js';
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const SECRET_KEY = process.env.JWT_SECRET || "emiton"; // Sử dụng biến môi trường

// 🟢 Đăng ký tài khoản
export const register = async (req, res) => {
  try {
    let { firstName, lastName, email, password, birthDate, gender } = req.body;

    // Kiểm tra dữ liệu nhập vào
    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !birthDate ||
      !gender
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // email = email.trim().toLowerCase(); // Chuẩn hóa email

    // 🔍 Kiểm tra email đã tồn tại hay chưa
    const existingUser = await User.findOne({ email }); // Dùng lean() để tối ưu hiệu suất
    if (existingUser) {
      console.log(existingUser);
      return res.status(400).json({ message: "Email already in use" });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      password: hashedPassword,
      birthDate,
      gender,
    });

    await newUser.save();
    const token = jwt.sign(
      {
          _id: newUser._id,
          firstName: newUser.firstName.trim(),
          lastName: newUser.lastName.trim(),
          email: newUser.email,
          birthDate: newUser.birthDate,
          gender: newUser.gender,

      },
      SECRET_KEY,
      { expiresIn: "1h" }
    );
    res.status(201).json({
      message: "User registered successfully",
      user:{
        _id: newUser._id,
        firstName: newUser.firstName.trim(),
        lastName: newUser.lastName.trim(),
        email: newUser.email,
        birthDate: newUser.birthDate,
        gender: newUser.gender,
      },
      token,
    });
  } catch (error) {
    console.error("❌ Registration error:", error);

    // Xử lý lỗi duplicate key
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already in use" });
    }

    res
      .status(500)
      .json({ message: "Error registering user", error: error.message });
  }
};

// 🔵 Đăng nhập
export const login = async (req, res) => {
  let { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  email = email.trim().toLowerCase(); // Chuẩn hóa email

  try {
    console.log("🔍 Searching user with email:", email); // ✅ Debug

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ từ authCTL No user found");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("✅ từ authCTL User found:", user);

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("🔑 từ authCTL Password match:", isPasswordValid); // ✅ Debug

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 🔑 Tạo token
    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        birthDate: user.birthDate,
        createdAt: user.createdAt,
        avatar: user.avatar,
        updatedAt: user.updatedAt,
      },
      SECRET_KEY,
      { expiresIn: "24h" }
    );

    // ✅ Trả về dữ liệu hợp lệ
    res.status(200).json({
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        birthDate: user.birthDate,
        createdAt: user.createdAt,
        avatar: user.avatar,
        updatedAt: user.updatedAt,
      },
      token, // 🔹 Gửi token hợp lệ
    });
  } catch (error) {
    console.error("❌ Error during login:", error);
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
};

// Gửi email reset password
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        // Kiểm tra email có tồn tại
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng với email này' });
        }

        // Tạo token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // 1 giờ

        // Lưu token vào database
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiry = resetTokenExpiry;
        await user.save();

        // Tạo transporter
        const transporter = createEmailTransporter();

        // Tạo URL reset password
        const resetUrl = `${process.env.FRONTEND_URL}/login?otp=${resetToken}`;

        // Cấu trúc email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Reset mật khẩu',
            html: `
                <h2>Yêu cầu đặt lại mật khẩu</h2>
                <p>Bạn đã yêu cầu đặt lại mật khẩu. Click vào link dưới đây để tiếp tục:</p>
                <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Đặt lại mật khẩu</a>
                <p>Link này sẽ hết hạn sau 1 giờ.</p>
                <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
            `
        };

        // Gửi email
        await transporter.sendMail(mailOptions);

        res.json({ 
            message: 'Email reset password đã được gửi',
            debug: process.env.NODE_ENV === 'development' ? resetToken : undefined
        });

    } catch (error) {
        console.error('Error in forgotPassword:', error);
        res.status(500).json({
            message: 'Lỗi khi gửi email reset password',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Xác thực token reset password
export const verifyResetToken = async (req, res) => {
    try {
        const { token } = req.params;
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpiry: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
        }

        res.json({ message: 'Token hợp lệ' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi xác thực token' });
    }
};

// Reset password
export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpiry: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
        }

        // Hash password mới
        const hashedPassword = await bcrypt.hash(password, 10);

        // Cập nhật password và xóa token
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
        await user.save();

        res.json({ message: 'Mật khẩu đã được đặt lại thành công' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi reset password' });
    }
};
