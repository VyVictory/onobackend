import mongoose from 'mongoose';

const MAX_REPLIES = 10; // Giới hạn tối đa 10 replies

const commentSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    content: { type: String, required: true },
    media: [{
      url: { type: String },
      type: { type: String, enum: ['image', 'video', 'gif'] },
      thumbnail: String // cho video và gif
    }],
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null
    },
    replies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment'
    }],
    mentions: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      startIndex: Number,
      endIndex: Number
    }],
    reactionCounts: {
        like: { type: Number, default: 0 },
        love: { type: Number, default: 0 },
        haha: { type: Number, default: 0 },
        wow: { type: Number, default: 0 },
        sad: { type: Number, default: 0 },
        angry: { type: Number, default: 0 }
    }
}, { timestamps: true });

// Thêm middleware để kiểm tra số lượng replies
commentSchema.pre('save', async function(next) {
    if (this.isModified('replies') && this.replies.length > MAX_REPLIES) {
        const error = new Error(`Số lượng replies vượt quá giới hạn cho phép (${MAX_REPLIES})`);
        return next(error);
    }
    next();
});

commentSchema.index({ content: 'text' });
commentSchema.index({ createdAt: -1 });

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;