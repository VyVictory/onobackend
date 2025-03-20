import { Server } from "socket.io";
import Message from "../models/message.js";

let io;
let onlineUsers = new Map();
let userWatchers = new Map();
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    socket.on("authenticate", (userId) => {
      socket.userId = userId;
      socket.join(`user_${userId}`);
      onlineUsers.set(userId, true);
      console.log(`✅ User ${userId} is now online.`);

      // Gửi cập nhật trạng thái đến client nào đã yêu cầu user này
      notifyWatchers(userId, true);
    });

    // Khi client yêu cầu trạng thái của một hoặc nhiều user
    socket.on("requestUserStatus", (userIds) => {
      console.log(`📡 ${socket.id} requested user status:`, userIds);

      if (!Array.isArray(userIds)) {
        if (typeof userIds === "string") {
          userIds = [userIds];
        } else {
          console.error("❌ Invalid userIds:", userIds);
          return;
        }
      }
      // Lưu socket này vào danh sách theo dõi từng user
      userIds.forEach((id) => {
        if (!userWatchers.has(id)) {
          userWatchers.set(id, new Set());
        }
        userWatchers.get(id).add(socket.id);
      });

      // Gửi trạng thái hiện tại của các user được yêu cầu
      const users = userIds.map((id) => ({
        _id: id,
        status: !!onlineUsers.get(id), // Kiểm tra user có online không
      }));

      console.log(`📡 Sending status to ${socket.id}:`, { users });

      socket.emit("updateUserStatus", { users });
    });

    socket.on("openChat", async ({ userId, partnerId }) => {
      try {
        const updatedMessages = await Message.find({
          sender: partnerId,
          receiver: userId,
          status: "sent",
        });

        if (updatedMessages.length > 0) {
          await Message.updateMany(
            { sender: partnerId, receiver: userId, status: "sent" },
            {
              $set: {
                status: "delivered",
                "statusTimestamps.delivered": new Date(),
              },
            }
          );

          io.to(`user_${partnerId}`).emit("messagesDelivered", {
            messages: updatedMessages,
          });
        }
      } catch (error) {
        console.error("Error updating message status:", error);
      }
    });

    // Xử lý khi người dùng đọc tin nhắn
    socket.on("readMessages", async ({ userId, partnerId }) => {
      try {
        // Cập nhật trạng thái "seen" cho tất cả tin nhắn
        await Message.updateMany(
          {
            sender: partnerId,
            receiver: userId,
            status: { $ne: "seen" },
          },
          {
            $set: {
              status: "seen",
              "statusTimestamps.seen": new Date(),
            },
          }
        );

        // Thông báo cho người gửi về việc tin nhắn đã được đọc
        const updatedMessages = await Message.find({
          sender: partnerId,
          receiver: userId,
          status: "seen",
        });

        io.to(`user_${partnerId}`).emit("messagesSeen", {
          messages: updatedMessages,
        });
      } catch (error) {
        console.error("Error updating message status:", error);
      }
    });

    // Xử lý typing status
    socket.on("typing", ({ receiverId, isTyping }) => {
      io.to(`user_${receiverId}`).emit("userTyping", {
        userId: socket.userId,
        isTyping,
      });
    });
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);

      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        console.log(`❌ User ${socket.userId} is now offline.`);

        // Gửi cập nhật trạng thái **chỉ** đến client nào đã yêu cầu user này
        notifyWatchers(socket.userId, false);
      }
      userWatchers.forEach((sockets, userId) => {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userWatchers.delete(userId);
        }
      });
    });
  });

  return io;
};
const notifyWatchers = (userId, isOnline) => {
  const watchers = userWatchers.get(userId);
  if (watchers) {
    watchers.forEach((socketId) => {
      io.to(socketId).emit("updateUserStatus", {
        users: [{ _id: userId, status: isOnline }],
      });
    });
  }
};
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};
