import mongoose from 'mongoose';

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

commentSchema.index({ content: 'text' });
commentSchema.index({ createdAt: -1 });

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;