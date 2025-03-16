import express from 'express';
import Message from '../models/message.js';
import MessageGroup from '../models/messageGroup.js';
import { getIO } from '../config/socketConfig.js';
import moment from 'moment';
import cloudinary from '../config/cloudinaryConfig.js';
import { Readable } from 'stream';

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

// Hàm xử lý upload file lên Cloudinary
const uploadToCloudinary = async (file, folder) => {
    try {
        if (!file || !file.path) {
            throw new Error('No file to upload');
        }

        const result = await cloudinary.uploader.upload(file.path, {
            folder: folder,
            resource_type: 'auto'
        });

        return result;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
};

// Gửi tin nhắn với media
export const sendMessage = async (req, res) => {
    try {
        const { receiverId } = req.params;
        const { content = '', messageType = 'text' } = req.body;
        const file = req.file;
        const senderId = req.user._id;

        // Validate cho tin nhắn văn bản
        if (messageType === 'text' && !content) {
            return res.status(400).json({ 
                message: 'Nội dung tin nhắn là bắt buộc với tin nhắn văn bản' 
            });
        }

        // Validate cho tin nhắn media
        if (['image', 'video', 'voice', 'gif'].includes(messageType) && !file) {
            return res.status(400).json({ 
                message: 'File là bắt buộc với tin nhắn dạng media' 
            });
        }

        let fileData = null;

        if (file) {
            try {
                let uploadResult;
                const options = {
                    folder: `message_${messageType}s`,
                    resource_type: 'auto'
                };

                // Thêm options đặc biệt cho video
                if (messageType === 'video') {
                    options.eager = [
                        { width: 300, height: 300, crop: "pad", audio_codec: "none" },
                        { width: 160, height: 100, crop: "crop", gravity: "south", audio_codec: "none" }
                    ];
                    options.eager_async = true;
                }

                uploadResult = await uploadToCloudinary(file, options);

                switch (messageType) {
                    case 'image':
                        fileData = {
                            url: uploadResult.secure_url,
                            type: file.mimetype
                        };
                        break;

                    case 'video':
                        fileData = {
                            url: uploadResult.secure_url,
                            type: file.mimetype,
                            thumbnail: uploadResult.eager ? uploadResult.eager[1].secure_url : null,
                            duration: uploadResult.duration || null
                        };
                        break;

                    case 'voice':
                        fileData = {
                            url: uploadResult.secure_url,
                            type: file.mimetype,
                            duration: uploadResult.duration || null
                        };
                        break;

                    case 'gif':
                        fileData = {
                            url: uploadResult.secure_url,
                            type: file.mimetype
                        };
                        break;
                }
            } catch (uploadError) {
                console.error('Upload error:', uploadError);
                return res.status(500).json({ 
                    message: 'Lỗi khi tải lên file', 
                    error: uploadError.message 
                });
            }
        }

        const messageData = {
            sender: senderId,
            receiver: receiverId,
            content: content || '',
            messageType,
            file: fileData,
            status: 'sent',
            statusTimestamps: {
                sent: new Date()
            }
        };

        const newMessage = new Message(messageData);
        await newMessage.save();

        // Gửi thông báo realtime
        getIO().to(`user_${receiverId}`).emit('newMessage', {
            message: await newMessage.populate('sender', 'firstName lastName avatar')
        });

        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ 
            message: 'Lỗi khi gửi tin nhắn', 
            error: error.message 
        });
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


