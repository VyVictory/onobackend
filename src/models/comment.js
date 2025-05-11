import mongoose from 'mongoose';


const commentSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    content: { type: String, required: true },
    media: [{
      url: { type: String },
      type: { type: String, enum: ['image', 'video', 'gif'] },
      thumbnail: String,
      status: { type: Boolean, default: true }
    }],
    idCmt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null
    },
    hashtags: [{
      tag : { type: String },
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      line: Number,
      status: { type: Boolean, default: true }
    }],
    mentions: [{
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      index: Number
    }],
    reactionCounts: {
        like: { type: Number, default: 0 },
        love: { type: Number, default: 0 },
        haha: { type: Number, default: 0 },
        wow: { type: Number, default: 0 },
        sad: { type: Number, default: 0 },
        angry: { type: Number, default: 0 }
    },
    active: { type: Boolean, default: true }
}, { timestamps: true });


commentSchema.index({ content: 'text' });
commentSchema.index({ createdAt: -1 });

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;