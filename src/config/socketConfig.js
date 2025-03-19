import { Server } from "socket.io";
import Message from "../models/message.js";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "https://ono-ono.vercel.app"],
      methods: "GET,POST,PUT,DELETE", // Allow specific HTTP methods
      allowedHeaders: "Content-Type, Authorization", // Allow specific headers
      credentials: true, // ✅ Thêm dòng này để hỗ trợ cookie/token
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Lưu userId cho socket connection
    socket.on("authenticate", (userId) => {
      socket.userId = userId;
      socket.join(`user_${userId}`);
    });

    // Xử lý khi người dùng mở hộp thoại chat
    socket.on("openChat", async ({ userId, partnerId }) => {
      try {
        // Cập nhật trạng thái "delivered" cho tất cả tin nhắn chưa đọc
        await Message.updateMany(
          {
            sender: partnerId,
            receiver: userId,
            status: "sent",
          },
          {
            $set: {
              status: "delivered",
              "statusTimestamps.delivered": new Date(),
            },
          }
        );

        // Thông báo cho người gửi về việc tin nhắn đã được delivered
        const updatedMessages = await Message.find({
          sender: partnerId,
          receiver: userId,
          status: "delivered",
        });

        io.to(`user_${partnerId}`).emit("messagesDelivered", {
          messages: updatedMessages,
        });
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
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};
