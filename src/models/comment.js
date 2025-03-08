import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    content: { type: String, required: true },
    media: [{ type: String }],
    mentions: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      startIndex: Number,
      endIndex: Number
    }]
}, { timestamps: true });

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;