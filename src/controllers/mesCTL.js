import express from "express";
import Message from "../models/message.js";
import MessageGroup from "../models/messageGroup.js";
import { getIO } from "../config/socketConfig.js";
import moment from "moment";
import cloudinary from "../config/cloudinaryConfig.js";
import { Readable } from "stream";

// Thu hồi tin nhắn
export const recallMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message || message.sender.toString() !== req.user.id) {
      return res
        .status(404)
        .json({ message: "Message not found or unauthorized" });
    }

    message.isRecalled = true;
    await message.save();

    res.json({ message: "Message recalled" });
  } catch (error) {
    res.status(500).json({ message: "Error recalling message", error });
  }
};

// Hàm xử lý upload file lên Cloudinary
const uploadToCloudinary = async (file, folder) => {
  try {
    if (!file || !file.path) {
      throw new Error("No file to upload");
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
      resource_type: "auto",
    });

    return result;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

// Gửi tin nhắn với media
export const sendMessage = async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { content = "", messageType = "text" } = req.body;
    const file = req.file;
    const senderId = req.user._id;

    // Validate cho tin nhắn văn bản
    if (messageType === "text" && !content) {
      return res.status(400).json({
        message: "Nội dung tin nhắn là bắt buộc với tin nhắn văn bản",
      });
    }

    // Validate cho tin nhắn media
    if (["image", "video", "voice", "gif"].includes(messageType) && !file) {
      return res.status(400).json({
        message: "File là bắt buộc với tin nhắn dạng media",
      });
    }

    let fileData = null;

    if (file) {
      try {
        let uploadResult;
        const options = {
          folder: `message_${messageType}s`,
          resource_type: "auto",
        };

        // Thêm options đặc biệt cho video
        if (messageType === "video") {
          options.eager = [
            { width: 300, height: 300, crop: "pad", audio_codec: "none" },
            {
              width: 160,
              height: 100,
              crop: "crop",
              gravity: "south",
              audio_codec: "none",
            },
          ];
          options.eager_async = true;
        }

        uploadResult = await uploadToCloudinary(file, options);

        switch (messageType) {
          case "image":
            fileData = {
              url: uploadResult.secure_url,
              type: file.mimetype,
            };
            break;

          case "video":
            fileData = {
              url: uploadResult.secure_url,
              type: file.mimetype,
              thumbnail: uploadResult.eager
                ? uploadResult.eager[1].secure_url
                : null,
              duration: uploadResult.duration || null,
            };
            break;

          case "voice":
            fileData = {
              url: uploadResult.secure_url,
              type: file.mimetype,
              duration: uploadResult.duration || null,
            };
            break;

          case "gif":
            fileData = {
              url: uploadResult.secure_url,
              type: file.mimetype,
            };
            break;
        }
      } catch (uploadError) {
        console.error("Upload error:", uploadError);
        return res.status(500).json({
          message: "Lỗi khi tải lên file",
          error: uploadError.message,
        });
      }
    }

    const messageData = {
      sender: senderId,
      receiver: receiverId,
      content: content || "",
      messageType,
      file: fileData,
      status: "sent",
      statusTimestamps: {
        sent: new Date(),
      },
    };

    const newMessage = new Message(messageData);
    await newMessage.save();

    // Gửi thông báo realtime
    getIO()
      .to(`user_${receiverId}`)
      .emit("newMessage", {
        message: await newMessage.populate(
          "sender",
          "firstName lastName avatar"
        ),
      });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      message: "Lỗi khi gửi tin nhắn",
      error: error.message,
    });
  }
};

// Lấy tin nhắn
export const getMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: "Error fetching message", error });
  }
};
export const getMessagesByDay = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days } = req.query;
    const id = req.user._id;
    const daysLimit = parseInt(days) || 2; // Mặc định là 2 ngày nếu không có query

    if (!id) {
      return res.status(400).json({ message: "Missing chat partner ID" });
    }

    // Tìm tin nhắn giữa userId và id (cả hai chiều)
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: id },
        { sender: id, receiver: userId },
      ],
    })
      .sort({ createdAt: -1 }) // Sắp xếp giảm dần theo thời gian
      .limit(100); // Giới hạn tin nhắn để tránh quá tải

    if (!messages || messages.length === 0) {
      return res.status(404).json({ message: "No messages found" });
    }

    // Nhóm tin nhắn theo ngày
    const groupedMessages = {};
    messages.forEach((msg) => {
      const dayKey = msg.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
      if (!groupedMessages[dayKey]) {
        groupedMessages[dayKey] = [];
      }
      groupedMessages[dayKey].push({
        mess: msg.content,
        sender: msg.sender,
        receiver: msg.receiver,
        messageType: msg.messageType,
        file: msg.file,
        status: msg.status,
        createdAt: msg.createdAt,
      });
    });

    // Chuyển đổi dữ liệu về dạng [{ daytime: '', mess: [] }, ...]
    const result = Object.entries(groupedMessages)
      .slice(0, daysLimit) // Giới hạn số nhóm ngày
      .map(([daytime, mess]) => ({ daytime, mess }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages", error });
  }
};
import mongoose from "mongoose";

export const getMessagesByRange = async (req, res) => {
  try {
    const { userId } = req.params;
    const { start, limit } = req.query;
    const id = req.user._id;
    // Kiểm tra userId và id có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid chat partner ID" });
    }

    const startIndex = parseInt(start) || 0; // Mặc định từ 0
    const limitCount = parseInt(limit) || 20; // Mặc định lấy 100 tin nhắn
    // Truy vấn tin nhắn giữa hai người
    const messages = await Message.find({
      $or: [
        {
          sender: new mongoose.Types.ObjectId(userId),
          receiver: new mongoose.Types.ObjectId(id),
        },
        {
          sender: new mongoose.Types.ObjectId(id),
          receiver: new mongoose.Types.ObjectId(userId),
        },
      ],
    })
      .sort({ createdAt: -1 }) // Sắp xếp giảm dần theo thời gian
      .skip(startIndex) // Bỏ qua số lượng tin nhắn đã xem
      .limit(limitCount); // Giới hạn số tin nhắn cần lấy

    if (!messages || messages.length === 0) {
      return res.status(404).json({ message: "No messages found" });
    }
    // Nhóm tin nhắn theo ngày
    messages.reverse();
    const groupedMessages = {};
    messages.forEach((msg) => {
      const dayKey = msg.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
      if (!groupedMessages[dayKey]) {
        groupedMessages[dayKey] = [];
      }
      groupedMessages[dayKey].push({
        _id: msg._id,
        content: msg.content,
        sender: msg.sender,
        receiver: msg.receiver,
        messageType: msg.messageType,
        file: msg.file,
        status: msg.status,
        isRecalled: msg.isRecalled,
        createdAt: msg.createdAt,
      });
    });

    // Chuyển đổi dữ liệu về dạng [{ daytime: '', mess: [] }, ...]
    const result = Object.entries(groupedMessages).map(([daytime, mess]) => ({
      daytime,
      mess,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages", error });
  }
};
// Lấy tất cả tin nhắn
export const getMessages = async (req, res) => {
  try {
    const messages = await Message.find();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages", error });
  }
};

// Xóa tin nhắn
export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    await message.delete();
    res.json({ message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting message", error });
  }
};

// Lấy lịch sử tin nhắn theo ngày
export const getMessageHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const messageGroups = await MessageGroup.find({
      participants: { $all: [currentUserId, userId] },
    })
      .sort({ day: -1 })
      .populate({
        path: "messages",
        populate: {
          path: "sender",
          select: "firstName lastName avatar",
        },
      });

    // Đánh dấu tin nhắn là đã đọc khi người nhận mở lịch sử chat
    getIO().emit("openChat", {
      userId: currentUserId,
      partnerId: userId,
    });

    res.json(messageGroups);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy lịch sử tin nhắn", error: error.message });
  }
};
