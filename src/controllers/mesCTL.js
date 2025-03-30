import express from "express";
import Message from "../models/message.js";
import MessageGroup from "../models/messageGroup.js";
import { getIO } from "../config/socketConfig.js";
import moment from "moment";
import cloudinary from "../config/cloudinaryConfig.js";
import { Readable } from "stream";
import { uploadMedia, deleteMedia } from "../services/mediaService.js";

// Thu hồi tin nhắn
export const recallMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message || message.sender.toString() !== req.user._id) {
      return res
        .status(404)
        .json({ message: "Message not found or unauthorized" });
    }

    message.isRecalled = true;
    await message.save();
    const receiverId = message.receiver.toString();
    getIO()
      .to(`user_${receiverId}`)
      .to(`user_${req.user._id}`) // Cả người gửi cũng nhận thông báo
      .emit("messageRecalled", {
        messageId: message._id,
      });
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
    const { content = "" } = req.body;
    const files = req.files;
    const senderId = req.user._id;

    if (!content && (!files || files.length === 0)) {
      return res.status(400).json({
        message: "Tin nhắn phải có nội dung hoặc media",
      });
    }

    // Xử lý upload nhiều file
    const mediaPromises = files
      ? files.map(async (file) => {
          const type = file.mimetype.startsWith("image/gif")
            ? "gif"
            : file.mimetype.startsWith("image/")
            ? "image"
            : file.mimetype.startsWith("video/")
            ? "video"
            : file.mimetype.startsWith("audio/")
            ? "voice"
            : null;

          if (!type) throw new Error("Invalid file type");

          return await uploadMedia(file, type);
        })
      : [];

    const mediaResults = await Promise.all(mediaPromises);

    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      content: content || "",
      media: mediaResults,
      status: "sent",
      statusTimestamps: {
        sent: new Date(),
      },
    });

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
      return res.status(200).json({ message: "No messages found" });
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
        media: msg.media,
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

// Sửa tin nhắn
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const files = req.files;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message || message.sender.toString() !== userId.toString()) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tin nhắn hoặc không có quyền sửa" });
    }

    // Xóa media cũ nếu có
    if (message.media && message.media.length > 0) {
      await Promise.all(
        message.media.map((media) => deleteMedia(media.publicId))
      );
    }

    // Upload media mới nếu có
    const mediaPromises = files
      ? files.map(async (file) => {
          const type = file.mimetype.startsWith("image/gif")
            ? "gif"
            : file.mimetype.startsWith("image/")
            ? "image"
            : file.mimetype.startsWith("video/")
            ? "video"
            : file.mimetype.startsWith("audio/")
            ? "voice"
            : null;

          if (!type) throw new Error("Invalid file type");

          return await uploadMedia(file, type);
        })
      : [];

    const mediaResults = await Promise.all(mediaPromises);

    message.content = content || "";
    message.media = mediaResults;
    message.isEdited = true;
    await message.save();

    // Thông báo tin nhắn đã được sửa
    getIO()
      .to(`user_${message.receiver}`)
      .emit("messageEdited", {
        message: await message.populate("sender", "firstName lastName avatar"),
      });

    res.json(message);
  } catch (error) {
    console.error("Edit message error:", error);
    res.status(500).json({
      message: "Lỗi khi sửa tin nhắn",
      error: error.message,
    });
  }
};

export const toggleMessageReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { type } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Không tìm thấy tin nhắn' });
        }

        // Kiểm tra quyền reaction (phải là người gửi hoặc người nhận)
        if (![message.sender.toString(), message.receiver.toString()].includes(userId.toString())) {
            return res.status(403).json({ message: 'Không có quyền tương tác với tin nhắn này' });
        }

        // Tìm reaction hiện tại
        const existingReactionIndex = message.reactions.findIndex(
            r => r.user.toString() === userId.toString()
        );

        if (existingReactionIndex > -1) {
            if (message.reactions[existingReactionIndex].type === type) {
                // Xóa reaction nếu đã tồn tại cùng loại
                message.reactions.splice(existingReactionIndex, 1);
            } else {
                // Cập nhật loại reaction
                message.reactions[existingReactionIndex].type = type;
            }
        } else {
            // Thêm reaction mới
            message.reactions.push({ user: userId, type });
        }

        await message.save();

        // Gửi thông báo realtime
        getIO().to(`chat_${message.sender}_${message.receiver}`).emit('messageReaction', {
            messageId: message._id,
            reactions: message.reactions
        });

        res.json(message);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Lấy danh sách người reaction
export const getMessageReactions = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId)
            .populate('reactions.user', 'firstName lastName avatar');

        if (!message) {
            return res.status(404).json({ message: 'Không tìm thấy tin nhắn' });
        }

        if (![message.sender.toString(), message.receiver.toString()].includes(userId.toString())) {
            return res.status(403).json({ message: 'Không có quyền xem reactions' });
        }

        res.json(message.reactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
