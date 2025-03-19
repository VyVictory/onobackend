import { Server } from "socket.io";

const onlineUsers = new Map(); // Lưu trữ userId và socketId

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000", "https://ono-ono.vercel.app"],
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("⚡ A user connected:", socket.id);

    // Lắng nghe khi client gửi userId để xác định danh tính
    socket.on("join", (userId) => {
      onlineUsers.set(userId, socket.id);
      console.log(`User ${userId} is online.`);
    });

    // Xóa người dùng khi họ disconnect
    socket.on("disconnect", () => {
      onlineUsers.forEach((value, key) => {
        if (value === socket.id) onlineUsers.delete(key);
      });
      console.log("⚡ A user disconnected:", socket.id);
    });
  });

  return io;
};

export const getOnlineUsers = () => onlineUsers;
