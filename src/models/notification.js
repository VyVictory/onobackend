import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        enum: [
            'POST_MENTION', 
            'COMMENT_MENTION',
            'FRIEND_REQUEST',
            'FRIEND_ACCEPTED',
            'FRIEND_REJECTED'
        ], 
        required: true 
    },
    reference: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'referenceModel'
    },
    referenceModel: {
        type: String,
        enum: ['Post', 'Comment', 'Friendship']
    },
    read: { type: Boolean, default: false },
    content: String
}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema); 