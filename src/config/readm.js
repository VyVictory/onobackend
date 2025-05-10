import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import validateFriendRequest from "../middlewares/validateFriendRequest.js";
import sendFriendRequest from "../controllers/sendFriendRequest.js";
import { getOnlineUsers } from "./socketConfig.js";

const router = express.Router();

router.post(
  "/request",
  authMiddleware,
  validateFriendRequest,
  async (req, res) => {
    try {
      const { senderId, receiverId } = req.body;
      const friendRequest = await sendFriendRequest(senderId, receiverId);

      // Kiểm tra nếu người nhận đang online
      const onlineUsers = getOnlineUsers();
      const receiverSocketId = onlineUsers.get(receiverId);

      if (receiverSocketId) {
        req.app.get("io").to(receiverSocketId).emit("friendRequest", {
          senderId,
          message: "Bạn có một lời mời kết bạn mới!",
        });
      }

      res.status(200).json({ message: "Lời mời kết bạn đã được gửi!", friendRequest });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Lỗi khi gửi lời mời kết bạn" });
    }
  }
);

export default router;