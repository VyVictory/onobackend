import mongoose from 'mongoose';

const reactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { 
        type: String, 
        enum: ['Post', 'Comment', 'Message'], 
        required: true 
    },
    targetId: { 
        type: mongoose.Schema.Types.ObjectId, 
        refPath: 'targetType', 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'], 
        required: true 
    }
}, { timestamps: true });

// Index để tối ưu truy vấn
reactionSchema.index({ targetType: 1, targetId: 1, user: 1 });

export default mongoose.model('Reaction', reactionSchema); 