import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { 
        type: String, 
        required: function() {
            return this.messageType === 'text'; // content chỉ bắt buộc khi là tin nhắn văn bản
        },
        default: ''
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'video', 'gif', 'sticker', 'voice', 'file'],
        default: 'text'
    },
    file: {
        url: { type: String },
        type: { type: String }, // MIME type của file
        duration: { type: Number }, // Cho voice và video
        thumbnail: { type: String } // Cho video và gif
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'seen'],
        default: 'sent'
    },
    statusTimestamps: {
        sent: { type: Date, default: Date.now },
        delivered: Date,
        seen: Date
    },
    isRecalled: { type: Boolean, default: false }
}, { 
    timestamps: true 
});

// Thêm index cho việc tìm kiếm tin nhắn
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, status: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;