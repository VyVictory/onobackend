import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config(); // Load biến môi trường từ .env

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
      { expiresIn: "1h" }
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
