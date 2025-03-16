import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Message from '../models/message.js';
import MessageGroup from '../models/messageGroup.js';
import { getIO } from '../config/socketConfig.js';
import moment from 'moment';

const router = express.Router();




// Thu hồi tin nhắn
export const recallMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);

        if (!message || message.sender.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Message not found or unauthorized' });
        }

        message.isRecalled = true;
        await message.save();

        res.json({ message: 'Message recalled' });
    } catch (error) {
        res.status(500).json({ message: 'Error recalling message', error });
    }
};

// Gửi tin nhắn
export const sendMessage = async (req, res) => {
    try {
        const {  content } = req.body;
        const {receiverId} = req.params;
        const senderId = req.user._id;

        // Tạo tin nhắn mới với timestamp sent
        const newMessage = new Message({
            sender: senderId,
            receiver: receiverId,
            content,
            img:[],
            files:[],
            status: 'sent',
            statusTimestamps: {
                sent: new Date()
            }
        });
        await newMessage.save();

        // Lấy ngày hiện tại format YYYY-MM-DD
        const today = moment(newMessage.createdAt).format('YYYY-MM-DD');

        // Tìm hoặc tạo nhóm tin nhắn cho ngày hiện tại
        let messageGroup = await MessageGroup.findOne({
            participants: { $all: [senderId, receiverId] },
            day: today
        });

        if (!messageGroup) {
            messageGroup = new MessageGroup({
                participants: [senderId, receiverId],
                day: today,
                messages: [newMessage._id]
            });
        } else {
            messageGroup.messages.push(newMessage._id);
        }
        await messageGroup.save();

        // Gửi thông báo realtime cho người nhận
        getIO().to(`user_${receiverId}`).emit('newMessage', {
            message: await newMessage.populate('sender', 'firstName lastName avatar')
        });

        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi gửi tin nhắn', error: error.message });
    }
};

// Lấy tin nhắn
export const getMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        res.json(message);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching message', error });
    }
};

// Lấy tất cả tin nhắn
export const getMessages = async (req, res) => {
    try {
        const messages = await Message.find();
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error });
    }
};

// Xóa tin nhắn
export const deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        await message.delete();
        res.json({ message: 'Message deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting message', error });
    }
};

// Lấy lịch sử tin nhắn theo ngày
export const getMessageHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        const messageGroups = await MessageGroup.find({
            participants: { $all: [currentUserId, userId] }
        })
        .sort({ day: -1 })
        .populate({
            path: 'messages',
            populate: {
                path: 'sender',
                select: 'firstName lastName avatar'
            }
        });

        // Đánh dấu tin nhắn là đã đọc khi người nhận mở lịch sử chat
        getIO().emit('openChat', {
            userId: currentUserId,
            partnerId: userId
        });

        res.json(messageGroups);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy lịch sử tin nhắn', error: error.message });
    }
};


