import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Chuyển về ObjectId tự động
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String, required: true },
    media: [{ type: String }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    shares: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    mentions: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      startIndex: Number, // Vị trí bắt đầu của mention trong content
      endIndex: Number   // Vị trí kết thúc của mention trong content
    }],
  },
  { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);

export default Post;
