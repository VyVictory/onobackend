import User from "../models/user.js";
import Friendship from "../models/friendship.js";
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
    const myId = req.user._id;
    const id = req.params.id; // Lấy trực tiếp ID

    const user = await User.findOne({ _id: id, ...offUser() })
      .select("-password -email")
      .lean();// Chuyển kết quả từ mongoose document sang object để thêm trường friendStatus

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
      } else if (friendship.status === "friend") {
        status = "friend";
      } else if (friendship.status === "blocked") {
        status = "blocked";
      } else if (friendship.status === "rejected") {
        status = "rejected";
      }
    }
    // Gán trạng thái kết bạn vào user
    user.friendStatus = status;
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
