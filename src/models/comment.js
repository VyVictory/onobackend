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
    mentions: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      startIndex: Number,
      endIndex: Number
    }]
}, { timestamps: true });

commentSchema.index({ content: 'text' });
commentSchema.index({ createdAt: -1 });

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;