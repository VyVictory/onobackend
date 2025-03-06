import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Message from '../models/message.js';

const router = express.Router();

// Gửi tin nhắn
export const createMessage = async (req, res) => {
    const { receiverId, content } = req.body;

    try {
        const newMessage = new Message({
            sender: req.user.id,
            receiver: receiverId,
            content
        });

        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ message: 'Error creating message', error });
    }
};


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
    const { receiverId, content } = req.body;

    try {
        const message = await Message.findById(req.params.messageId);
        if (!message || message.receiver.toString() !== receiverId) {
            return res.status(404).json({ message: 'Message not found or unauthorized' });
        }

        const newMessage = new Message({
            sender: req.user.id,
            receiver: receiverId,
            content
        });

        await newMessage.save();
        message.receiver = receiverId;
        await message.save();

        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ message: 'Error sending message', error });
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
