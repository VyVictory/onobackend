import User from "../models/user.js";
import Friendship from "../models/friendship.js";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinaryConfig.js";

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
    const myId = req?.user?._id;
    const id = req.params.id; // Lấy trực tiếp ID

    const user = await User.findOne({ _id: id, ...offUser() })
      .select("-password -email")
      .lean(); // Chuyển kết quả từ mongoose document sang object để thêm trường friendStatus

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Kiểm tra trạng thái kết bạn
    const friendship = await Friendship.findOne({
      $or: [
        { requester: myId, recipient: id },
        { requester: id, recipient: myId },
      ],
    });
    let status = "noFriend"; // Mặc định là chưa kết bạn
    if (friendship) {
      if (friendship.status === "pending") {
        status = friendship.requester.equals(myId) ? "waiting" : "pending";
      } else if (friendship.status === "accepted") {
        status = "accepted";
      } else if (friendship.status === "blocked") {
        status = "blocked";
      } else if (
        friendship.status === "rejected" &&
        friendship.requester.equals(myId)
      ) {
        status = "rejected";
      }
    }
    // Gán trạng thái kết bạn vào user

    if (myId == null) {
      user.friendStatus = "noFriend";
    } else {
      user.friendStatus = status;
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
export const searchFriendsForMention = async (req, res) => {
  try {
    const { query } = req.query;
    const currentUser = await User.findById(req.user._id);

    // Tìm kiếm trong danh sách bạn bè
    const users = await User.find({
      $and: [
        {
          $or: [
            { firstName: { $regex: query, $options: "i" } },
            { lastName: { $regex: query, $options: "i" } },
          ],
        },
      ],
    })
      .select("_id firstName lastName avatar")
      .limit(5);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error searching friends", error });
  }
};

// Tìm kiếm người dùng với phân trang
export const searchUsers = async (req, res) => {
  try {
    const { search, start = 0, limit = 10 } = req.query;
    const currentUserId = req.user._id;

    const query = search
      ? {
          $and: [
            {
              $or: [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
              ],
            },
            { _id: { $ne: currentUserId } }, // Loại trừ user hiện tại
          ],
        }
      : { _id: { $ne: currentUserId } };

    const users = await User.find(query)
      .select("firstName lastName avatar email")
      .sort({ firstName: 1, lastName: 1 })
      .skip(parseInt(start))
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      total,
      hasMore: total > parseInt(start) + users.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi tìm kiếm người dùng", error: error.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID người dùng không hợp lệ" });
    }

    // Lấy dữ liệu từ request body
    const {
      firstName,
      lastName,
      gender,
      title,
      birthDate,
      education,
      street,
      ward,
      district,
      city,
      country,
      email,
      phoneNumber,
    } = req.body;

    // Tạo đối tượng cập nhật
    const updateData = {
      firstName,
      lastName,
      gender,
      email,
      birthDate,
      education,
      address: { street, ward, district, city, country },
      phoneNumber,
      title,
    };

    // ✅ Xử lý upload avatar
    if (req.files?.avatar) {
      const avatarUpload = await cloudinary.uploader.upload(req.files.avatar[0].path, {
        folder: "ono/avatars",
        transformation: [{ width: 500, height: 500, crop: "fill" }],
      });
      updateData.avatar = avatarUpload.secure_url;
    }

    // ✅ Xử lý upload ảnh bìa (coverPhoto)
    if (req.files?.coverPhoto) {
      const coverUpload = await cloudinary.uploader.upload(req.files.coverPhoto[0].path, {
        folder: "ono/covers",
        transformation: [{ width: 1920, height: 1080, crop: "fill" }],
      });
      updateData.coverPhoto = coverUpload.secure_url;
    }

    // ✅ Cập nhật user trong database
    const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true })
      .select("-password"); // Loại bỏ password khỏi dữ liệu trả về

    if (!updatedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Lỗi cập nhật thông tin người dùng:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật thông tin người dùng",
      error: error.message,
    });
  }
};



 