import mongoose from 'mongoose';

const messageGroupSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    day: { type: String, required: true }, // Format: "YYYY-MM-DD"
    messages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }]
}, {
    timestamps: true
});

// Thêm index cho việc tìm kiếm nhóm tin nhắn
messageGroupSchema.index({ participants: 1, day: 1 });

const MessageGroup = mongoose.model('MessageGroup', messageGroupSchema);

export default MessageGroup; 