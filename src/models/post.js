import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Chuyển về ObjectId tự động
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String, default: "" },
    media: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "video", "gif"], required: true },
        thumbnail: String, // cho video và gif
        publicId: String, // ID của file trên Cloudinary để quản lý xóa
        duration: Number, // cho video
      },
    ],
    shares: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    security: {
      type: String,
      enum: ["Public", "Private", "MyFriend"],
      default: "Public",
    },
    mentions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        startIndex: Number, // Vị trí bắt đầu của mention trong content
        endIndex: Number, // Vị trí kết thúc của mention trong content
      },
    ],
    group: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Group' 
    },
    reactionCounts: {
        like: { type: Number, default: 0 },
        love: { type: Number, default: 0 },
        haha: { type: Number, default: 0 },
        wow: { type: Number, default: 0 },
        sad: { type: Number, default: 0 },
        angry: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

postSchema.index({ content: "text" });
postSchema.index({ createdAt: -1 });

// Middleware để kiểm tra quyền xem bài đăng
postSchema.pre('find', function(next) {
    this._conditions = {
        ...this._conditions,
        $or: [
            { security: 'Public' },
            { security: 'Private', author: this._conditions.currentUser },
            {
              security: 'MyFriend',
                author: { 
                    $in: this._conditions.friendIds || [] 
                }
            }
        ]
    };
    next();
});

const Post = mongoose.model("Post", postSchema);

export default Post;
