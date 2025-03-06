import User from "../models/user.js";
import mongoose from "mongoose";

const offUser = () => ({
  status: true,
 // banned: false, // Chỉnh sửa lại từ `activer` thành `active` nếu đây là key đúng trong database
});
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById({
      _id: req.user._id,
      ...offUser(),
    }).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("❌ Error fetching profile:", error);

    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    res
      .status(500)
      .json({ message: "Error fetching profile", error: error.message });
  }
};
export const getCurrentUser = async (req, res) => {
  try {
    // Tìm user theo ID và loại bỏ password
    // console.log(req.user._id)
    const id = req.params.id; // Lấy trực tiếp ID

    const user = await User.findOne({ _id: id, ...offUser() }).select(
      "-password -email"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("❌ Error fetching profile:", error);

    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    res
      .status(500)
      .json({ message: "Error fetching profile", error: error.message });
  }
};
export const getUsersByUsername = async (req, res) => {
  try {
    let { name } = req.params;

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Username is required" });
    }

    name = name.trim(); // Xóa khoảng trắng dư thừa

    // Tìm user có firstName hoặc lastName chứa chuỗi tìm kiếm (không phân biệt hoa thường)
    const users = await User.find({
      $or: [
        { firstName: { $regex: new RegExp(name, "i") } },
        { lastName: { $regex: new RegExp(name, "i") } },
      ],
      ...offUser(),
    })
      .select("-password -email") // Ẩn thông tin nhạy cảm
      .limit(10); // Giới hạn số lượng kết quả

    res.json(users);
  } catch (error) {
    console.error("❌ Error fetching users by username:", error);
    res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};
