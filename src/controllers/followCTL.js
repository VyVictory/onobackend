import Follow from "../models/follow.js";
import Notification from "../models/notification.js";
import { getIO } from "../config/socketConfig.js";
import { createNotification } from "./checkNotification.js";

// Theo dõi người dùng
export const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user._id;

    if (userId === followerId.toString()) {
      return res
        .status(400)
        .json({ message: "Không thể tự theo dõi chính mình" });
    }

    const follow = new Follow({
      follower: followerId,
      following: userId,
    });

    const data = await follow.save();

    // Tạo thông báo
    // const notification = new Notification({
    //   recipient: userId,
    //   sender: followerId,
    //   type: "NEW_FOLLOWER",
    //   referenceModel: "Follow",
    //   content: `${req.user.firstName} ${req.user.lastName} đã bắt đầu theo dõi bạn`,
    // });
    // await notification.save();
    if (data) {
      const notification = await createNotification({
        recipient: userId,
        sender: followerId,
        type: "NEW_FOLLOWER",
        referenceModel: "Follow",
        content: `${req.user.firstName} ${req.user.lastName} đã bắt đầu theo dõi bạn`,
      });
    }

    // Gửi thông báo realtime
    // getIO()
    //   .to(`user_${userId}`)
    //   .emit("notification", {
    //     type: "NEW_FOLLOWER",
    //     notification: await notification.populate(
    //       "sender",
    //       "firstName lastName avatar"
    //     ),
    //   });

    res.status(200).json({ message: "Đã theo dõi người dùng" });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "Đã theo dõi người dùng này trước đó" });
    }
    res
      .status(500)
      .json({ message: "Lỗi khi theo dõi người dùng", error: error.message });
  }
};

// Hủy theo dõi
export const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await Follow.findOneAndDelete({
      follower: req.user._id,
      following: userId,
    });
    res.status(200).json({ message: "Đã hủy theo dõi người dùng" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi hủy theo dõi", error: error.message });
  }
};

// Lấy danh sách người đang theo dõi
export const getFollowers = async (req, res) => {
  try {
    const followers = await Follow.find({ following: req.params.userId })
      .populate("follower", "firstName lastName avatar")
      .sort({ createdAt: -1 });

    res.json(followers);
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách người theo dõi",
      error: error.message,
    });
  }
};
export const checkFolow = async (req, res) => {
  try {
    const { userId } = req.params;
    const iduser = req.user._id;

    const isFollowing = await Follow.findOne({
      follower: iduser,
      following: userId,
    });

    res.json({ following: !!isFollowing });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi kiểm tra trạng thái theo dõi",
      error: error.message,
    });
  }
};

// Lấy danh sách đang theo dõi
export const getFollowing = async (req, res) => {
  try {
    const following = await Follow.find({ follower: req.params.userId })
      .populate("following", "firstName lastName avatar")
      .sort({ createdAt: -1 });

    res.json(following);
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách đang theo dõi",
      error: error.message,
    });
  }
};
