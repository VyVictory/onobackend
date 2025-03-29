import { Server } from "socket.io";
import Message from "../models/message.js";
import Notification from "../models/notification.js";

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
    console.log("🔌 User connected:", socket.id);
    console.log(onlineUsers);
    socket.on("authenticate", (userId) => {
      if (!userId) return;
      const existingSocket = [...io.sockets.sockets.values()].find(
        (s) => s.userId === userId
      );

      if (existingSocket) {
        console.log(
          `🔄 User ${userId} đã có socket cũ (${existingSocket.id}), ngắt kết nối`
        );
        existingSocket.disconnect(true); // 🔥 Ngắt kết nối socket cũ
      }

      socket.userId = userId;
      socket.join(`user_${userId}`);
      onlineUsers.set(userId, true);

      console.log(`✅ User ${userId} is now online.`);
      notifyWatchers(userId, true);

      // Lắng nghe sự kiện hủy thông báo
      socket.on("notificationDeactivated", async (data) => {
        const { notificationId } = data;
        const notification = await Notification.findById(notificationId);
        if (notification && notification.recipient.toString() === userId) {
          notification.isActive = false;
          await notification.save();
        }
      });
    }); 
    socket.on("call-accept", (data) => {
      if (data.status === false || data.status === true) {
        socket
          .to(`user_${data.target}`)
          .emit("call-accept", { caller: socket.userId, status: data.status });
      }
      console.log("Call accept status:", socket.userId, data.status);
    });
    socket.on("offer", (data) => {
      socket
        .to(`user_${data.target}`)
        .emit("offer", { sdp: data.sdp, caller: socket.userId });
    });

    socket.on("answer", (data) => {
      socket
        .to(`user_${data.target}`)
        .emit("answer", { sdp: data.sdp, caller: socket.userId });
    });

    socket.on("ice-candidate", (data) => {
      socket.to(`user_${data.target}`).emit("ice-candidate", data.candidate);
    });
    socket.on("end-call", (data) => {
      console.log("Ending call with user:", data.target);
      socket.to(`user_${data.target}`).emit("end-call", true);
    });

    socket.on("requestUserStatus", (userIds) => {
      if (!Array.isArray(userIds)) userIds = [userIds];
      // console.log(`📡 ${socket.id} requested user status:`, userIds);

      userIds.forEach((id) => {
        if (!userWatchers.has(id)) userWatchers.set(id, new Set());
        userWatchers.get(id).add(socket.id);
      });

      const users = userIds.map((id) => ({
        _id: id,
        status: !!onlineUsers.get(id),
      }));

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
        console.error("❌ Error updating message status:", error);
      }
    });

    socket.on("readMessages", async ({ userId, partnerId }) => {
      try {
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

        const updatedMessages = await Message.find({
          sender: partnerId,
          receiver: userId,
          status: "seen",
        });

        io.to(`user_${partnerId}`).emit("messagesSeen", {
          messages: updatedMessages,
        });
      } catch (error) {
        console.error("❌ Error updating message status:", error);
      }
    });

    socket.on("typing", ({ receiverId, isTyping }) => {
      io.to(`user_${receiverId}`).emit("userTyping", {
        userId: socket.userId,
        isTyping,
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);

      if (socket.userId) {
        setTimeout(() => {
          if (
            [...io.sockets.sockets.values()].some(
              (s) => s.userId === socket.userId
            )
          ) {
            console.log(
              `⚠️ User ${socket.userId} is still connected on another tab.`
            );
            return;
          }

          onlineUsers.delete(socket.userId);
          console.log(`🔴 User ${socket.userId} is now offline.`);
          notifyWatchers(socket.userId, false);
        }, 1000); // 🔥 Delay để tránh mất trạng thái do refresh nhanh

        userWatchers.forEach((sockets, userId) => {
          sockets.delete(socket.id);
          if (sockets.size === 0) userWatchers.delete(userId);
        });
      }
    });
  });

  return io;
};

const notifyWatchers = (userId, isOnline) => {
  if (!userId || !userWatchers.has(userId)) return;

  const watchers = userWatchers.get(userId);
  watchers.forEach((socketId) => {
    io.to(socketId).emit("updateUserStatus", {
      users: [{ _id: userId, status: isOnline }],
    });
  });

  console.log(
    `📢 Notify watchers: User ${userId} is now ${
      isOnline ? "online" : "offline"
    }`
  );
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};
