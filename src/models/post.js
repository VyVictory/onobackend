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
    media: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "video", "gif"], required: true },
        thumbnail: String, // cho video và gif
        publicId: String, // ID của file trên Cloudinary để quản lý xóa
        duration: Number, // cho video
      },
    ],
    security: {
      type: String,
      enum: ["Public", "Private", "MyFriend"],
      default: "Public",
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    shares: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    mentions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        startIndex: Number, // Vị trí bắt đầu của mention trong content
        endIndex: Number, // Vị trí kết thúc của mention trong content
      },
    ],
  },
  { timestamps: true }
);

postSchema.index({ content: "text" });
postSchema.index({ createdAt: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
